import { constants } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const source = fileURLToPath(new URL(".", import.meta.url));
export const runtimeFiles = ["extension.mjs", "workflow.mjs"];
const name = "issue-driven-delivery";

async function stat(file) {
    try { return await lstat(file); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function noLinks(directory) {
    for (let current = path.resolve(directory);; current = path.dirname(current)) {
        const entry = await stat(current);
        if (entry?.isSymbolicLink()) throw new Error(`Refusing linked destination: ${current}`);
        if (entry && !entry.isDirectory()) throw new Error(`Not a directory: ${current}`);
        if (path.dirname(current) === current) break;
    }
}

export async function installWorkflow(requestedRoot) {
    if (typeof requestedRoot !== "string" || !requestedRoot.trim()) {
        throw new Error("An explicit --target Git repository root is required");
    }
    await noLinks(requestedRoot);
    const root = await realpath(requestedRoot);
    const { stdout } = await exec("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
    if (path.relative(root, await realpath(path.resolve(stdout.trim()))) !== "") {
        throw new Error("Target must be the Git repository root, not a subdirectory");
    }
    const parent = path.join(root, ".github", "extensions");
    const destination = path.join(parent, name);
    await noLinks(destination);
    for (const file of runtimeFiles) {
        if (!(await lstat(path.join(source, file))).isFile()) throw new Error(`Missing regular runtime file: ${file}`);
        await exec(process.execPath, ["--check", path.join(source, file)]);
    }
    if (await stat(destination)) {
        const entries = (await readdir(destination)).sort();
        const identical = entries.length === runtimeFiles.length && entries.every((entry, index) => entry === [...runtimeFiles].sort()[index]);
        if (identical) {
            let sameContents = true;
            for (const file of runtimeFiles) {
                if (!(await lstat(path.join(destination, file))).isFile()
                    || !(await readFile(path.join(destination, file))).equals(await readFile(path.join(source, file)))) {
                    sameContents = false;
                    break;
                }
            }
            if (sameContents) return { status: "unchanged", destination, files: runtimeFiles };
        }
        throw new Error(`Existing extension differs; inspect it and obtain approval before updating: ${destination}`);
    }
    await mkdir(parent, { recursive: true });
    const staging = await mkdtemp(path.join(path.dirname(parent), `.${name}-`));
    try {
        for (const file of runtimeFiles) {
            await copyFile(path.join(source, file), path.join(staging, file), constants.COPYFILE_EXCL);
        }
        await rename(staging, destination);
    } finally {
        await rm(staging, { recursive: true, force: true });
    }
    return { status: "installed", destination, files: runtimeFiles };
}

const help = `Usage: node install.mjs --target <existing-git-repository-root>

Copies only extension.mjs and workflow.mjs into the target repository's
.github/extensions/issue-driven-delivery directory. No npm install, GitHub
changes, workflow execution or deployment. Identical installations are a no-op;
different existing files are never overwritten.
`;

export async function main(args) {
    if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
        console.log(help);
        return;
    }
    if (args.length !== 2 || args[0] !== "--target" || args[1].startsWith("-")) {
        throw new Error(help);
    }
    console.log(JSON.stringify(await installWorkflow(args[1]), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
