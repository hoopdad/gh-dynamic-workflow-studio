import { copyFile, mkdir, lstat, readFile, realpath, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

const source = fileURLToPath(new URL("../", import.meta.url));
export const extensionName = "dynamic-workflow-studio";
const marker = ".dynamic-workflow-studio.json";
const files = [
    "extension.mjs", "package.json", "npm-shrinkwrap.json", "README.md", "LICENSE",
    "bin/dynamic-workflow-studio.mjs", "scripts/install.mjs", "docs/studio.md",
    ...["extension.mjs", "server.mjs", "directory-picker.mjs", "source.mjs", "store.mjs", "usage.mjs", "observed.mjs",
        "index.html", "app.mjs", "style.css"].map((file) => `src/${file}`),
];

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

export async function copyDistribution(destination) {
    for (const file of files) {
        if (!(await lstat(path.join(source, file))).isFile()) throw new Error(`Missing Studio source: ${file}`);
    }
    for (const file of files) {
        const target = path.join(destination, file);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(path.join(source, file), target, 1);
    }
    await writeFile(path.join(destination, marker), JSON.stringify({ name: extensionName, version: 1 }) + "\n", { flag: "wx" });
}

async function owned(directory, legacy = false) {
    if (!(await stat(directory))?.isDirectory()) return false;
    try {
        if (JSON.parse(await readFile(path.join(directory, marker), "utf8")).name === extensionName) return true;
    } catch (error) { if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error; }
    if (!legacy) return false;
    try {
        const entry = await readFile(path.join(directory, "extension.mjs"), "utf8");
        return /gh-dynamic-workflows\/studio\/extension\.mjs/.test(entry) ||
            (entry.includes('id: "workflow-studio"') && entry.includes("createCanvas") && entry.includes("joinSession"));
    } catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

async function restoreDependencies(directory) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    // cmd.exe must resolve npm.cmd on Windows; the command contains no user input.
    const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : npm;
    const args = process.platform === "win32"
        ? ["/d", "/s", "/c", "npm.cmd ci --omit=dev --ignore-scripts --no-audit --no-fund"]
        : ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"];
    await new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd: directory, stdio: "inherit" });
        child.once("error", reject);
        child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`npm ci failed (${code})`)));
    });
}

export async function installStudio(requestedRoot, {
    global = false, replace = false, installDependencies = true,
    extensionsDir = path.join(process.env.COPILOT_HOME || path.join(os.homedir(), ".copilot"), "extensions"),
} = {}) {
    if (!global && (typeof requestedRoot !== "string" || !requestedRoot.trim())) {
        throw new Error("An explicit target project root is required");
    }
    const parent = global ? path.resolve(extensionsDir)
        : path.join(await realpath(requestedRoot), ".github", "extensions");
    if (!global) await noLinks(requestedRoot);
    await noLinks(parent);
    const target = path.join(parent, extensionName);
    const legacy = path.join(parent, "workflow-studio");
    const existing = [];
    for (const directory of [target, legacy]) {
        const entry = await stat(directory);
        if (!entry) continue;
        if (entry.isSymbolicLink()) throw new Error(`Refusing linked destination: ${directory}`);
        if (!replace) throw new Error(`Already exists: ${directory}; use --replace for a recognized Studio installation`);
        if (!await owned(directory, directory === legacy)) throw new Error(`Refusing to replace unrecognized extension: ${directory}`);
        existing.push(directory);
    }
    await mkdir(parent, { recursive: true });
    const staging = await mkdtemp(path.join(path.dirname(parent), ".dynamic-workflow-studio-"));
    const backups = [];
    let recoveryNeeded = false;
    try {
        const candidate = path.join(staging, "candidate");
        await mkdir(candidate);
        await copyDistribution(candidate);
        if (installDependencies) await restoreDependencies(candidate);
        try {
            for (const directory of existing) {
                const backup = path.join(staging, path.basename(directory));
                await rename(directory, backup);
                backups.push([directory, backup]);
            }
            await rename(candidate, target);
        }
        catch (error) {
            for (const [directory, backup] of backups.toReversed()) {
                try { await rename(backup, directory); }
                catch { recoveryNeeded = true; }
            }
            if (recoveryNeeded) error.message += `; recovery backups retained in ${staging}`;
            throw error;
        }
    } finally {
        // Only this operation's unique staging directory is removed.
        // Retain backups if an interrupted rollback still needs recovery.
        if (!recoveryNeeded) await rm(staging, { recursive: true, force: true });
    }
    return target;
}
