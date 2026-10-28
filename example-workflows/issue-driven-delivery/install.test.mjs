import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { installWorkflow, runtimeFiles } from "./install.mjs";

const exec = promisify(execFile);
const source = fileURLToPath(new URL(".", import.meta.url));
const installer = path.join(source, "install.mjs");

async function fixture(t) {
    const base = await realpath(await mkdtemp(path.join(tmpdir(), "issue-driven-delivery-test-")));
    t.after(() => rm(base, { recursive: true, force: true }));
    const root = path.join(base, "target application");
    await mkdir(root);
    await exec("git", ["-C", root, "init", "--quiet"]);
    await writeFile(path.join(root, "README.md"), "# Target application\n");
    return { base, root, destination: path.join(root, ".github", "extensions", "issue-driven-delivery") };
}

test("installs only portable runtime modules into a separate repository without changing application source or committing", async (t) => {
    const { root, destination } = await fixture(t);
    const before = (await exec("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" })).stdout;
    const result = await installWorkflow(root);
    assert.equal(result.status, "installed");
    assert.equal(result.destination, destination);
    assert.deepEqual((await readdir(destination)).sort(), [...runtimeFiles].sort());
    for (const file of runtimeFiles) {
        assert.deepEqual(await readFile(path.join(destination, file)), await readFile(path.join(source, file)));
    }
    assert.equal(await readFile(path.join(root, "README.md"), "utf8"), "# Target application\n");
    const after = (await exec("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" })).stdout;
    assert.equal(after, `?? .github/\n${before}`);
    assert.deepEqual(await readdir(path.join(root, ".github")), ["extensions"]);
    const copied = await import(pathToFileURL(path.join(destination, "workflow.mjs")).href);
    assert.equal(copied.deliveryWorkflow.meta.name, "issue-driven-delivery");
    assert.equal((await installWorkflow(root)).status, "unchanged");
});

test("refuses modified installations or extra files without overwriting anything", async (t) => {
    const { root, destination } = await fixture(t);
    await installWorkflow(root);
    await writeFile(path.join(destination, "workflow.mjs"), "// User customization\n");
    await assert.rejects(installWorkflow(root), /Existing extension differs/);
    assert.equal(await readFile(path.join(destination, "workflow.mjs"), "utf8"), "// User customization\n");
    await writeFile(path.join(destination, "workflow.mjs"), await readFile(path.join(source, "workflow.mjs")));
    await writeFile(path.join(destination, "private.txt"), "Keep this file");
    await assert.rejects(installWorkflow(root), /Existing extension differs/);
    assert.equal(await readFile(path.join(destination, "private.txt"), "utf8"), "Keep this file");
});

test("requires an explicit Git root and rejects missing/non-repository/nested targets", async (t) => {
    const { base, root } = await fixture(t);
    await assert.rejects(installWorkflow(), /explicit --target/);
    await assert.rejects(installWorkflow(path.join(base, "missing")), /ENOENT/);
    await assert.rejects(installWorkflow(base), /not a git repository/i);
    const nested = path.join(root, "src");
    await mkdir(nested);
    await assert.rejects(installWorkflow(nested), /not a subdirectory/);
    assert.deepEqual((await readdir(root)).sort(), [".git", "README.md", "src"].sort());
});

test("refuses a linked extension parent without writing outside the target", async (t) => {
    const { base, root } = await fixture(t);
    const outside = path.join(base, "outside");
    await mkdir(outside);
    await mkdir(path.join(root, ".github"));
    await symlink(outside, path.join(root, ".github", "extensions"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(installWorkflow(root), /Refusing linked destination/);
    assert.deepEqual(await readdir(outside), []);
});

test("installer CLI is runnable from anywhere and never infers the current directory as its target", async (t) => {
    const { base, root, destination } = await fixture(t);
    const help = await exec(process.execPath, [installer, "--help"], { cwd: base, encoding: "utf8" });
    assert.match(help.stdout, /--target/);
    for (const args of [[], ["--unknown"], ["--target"], ["--target", root, "--run"]]) {
        await assert.rejects(exec(process.execPath, [installer, ...args], { cwd: root }), (error) => {
            assert.equal(error.code, 1);
            assert.match(error.stderr, /Usage:/);
            return true;
        });
    }
    const installed = await exec(process.execPath, [installer, "--target", root], { cwd: base, encoding: "utf8" });
    assert.equal(JSON.parse(installed.stdout).destination, destination);
    assert.equal(JSON.parse(installed.stdout).status, "installed");
});

test("an agent can install from just the downloaded example modules without the source repository or npm", async (t) => {
    const { base, root, destination } = await fixture(t);
    const downloaded = path.join(base, "downloaded example");
    await mkdir(downloaded);
    const payload = ["install.mjs", ...runtimeFiles];
    for (const file of payload) await copyFile(path.join(source, file), path.join(downloaded, file));
    assert.deepEqual((await readdir(downloaded)).sort(), payload.sort());
    const result = await exec(process.execPath, [path.join(downloaded, "install.mjs"), "--target", root], {
        cwd: base, encoding: "utf8",
    });
    assert.equal(JSON.parse(result.stdout).status, "installed");
    assert.deepEqual((await readdir(destination)).sort(), [...runtimeFiles].sort());
    const copied = await import(pathToFileURL(path.join(destination, "workflow.mjs")).href);
    assert.equal(copied.deliveryWorkflow.meta.name, "issue-driven-delivery");
});
