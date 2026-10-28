import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, readdir, symlink } from "node:fs/promises";
import path from "node:path";
import { fixture } from "./fixture.mjs";
import { installStudio } from "../scripts/install.mjs";

test("installs studio independently without modifying an existing workflow", async (t) => {
    const f = await fixture();
    t.after(f.cleanup);
    const workflow = path.join(f.project, "gh-dynamic-workflows", "workflow.mjs");
    const before = await readFile(workflow);
    await installStudio(f.project, { installDependencies: false });
    const installed = path.join(f.project, ".github", "extensions", "dynamic-workflow-studio");
    assert.match(await readFile(path.join(installed, "extension.mjs"), "utf8"), /src\/extension.mjs/);
    assert.deepEqual(await readFile(workflow), before);
    assert.ok((await readdir(installed)).includes("npm-shrinkwrap.json"));
    assert.deepEqual((await readdir(path.join(installed, "src"))).sort(),
        ["app.mjs", "directory-picker.mjs", "extension.mjs", "index.html", "observed.mjs", "server.mjs", "source.mjs", "store.mjs", "style.css", "usage.mjs"]);
    await assert.rejects(installStudio(f.project), /Already exists/);
});

test("preflights all destinations before writing or replacing any file", async (t) => {
    const f = await fixture();
    t.after(f.cleanup);
    const destination = path.join(f.project, ".github", "extensions", "workflow-studio");
    await mkdir(destination);
    await writeFile(path.join(destination, "extension.mjs"), "user content");
    await assert.rejects(installStudio(f.project), /Already exists/);
    assert.equal(await readFile(path.join(destination, "extension.mjs"), "utf8"), "user content");
    await assert.rejects(readFile(path.join(f.project, ".github", "extensions", "dynamic-workflow-studio", "src", "server.mjs")), { code: "ENOENT" });
    await assert.rejects(installStudio(undefined), /explicit/);
});

test("global replacement retires recognized legacy registration and preserves other extensions", async (t) => {
    const f = await fixture();
    t.after(f.cleanup);
    const extensionsDir = path.join(f.base, "global extensions");
    const legacy = path.join(extensionsDir, "workflow-studio");
    const unrelated = path.join(extensionsDir, "other-extension");
    await mkdir(legacy, { recursive: true });
    await mkdir(unrelated);
    await writeFile(path.join(unrelated, "extension.mjs"), "// unrelated");
    await writeFile(path.join(legacy, "extension.mjs"), 'import "../../../gh-dynamic-workflows/studio/extension.mjs";');
    const options = { global: true, replace: true, extensionsDir, installDependencies: false };
    const target = await installStudio(undefined, options);
    await assert.rejects(readFile(path.join(legacy, "extension.mjs")), { code: "ENOENT" });
    assert.equal(await readFile(path.join(unrelated, "extension.mjs"), "utf8"), "// unrelated");
    await writeFile(path.join(target, "src", "index.html"), "old build");
    assert.equal(await installStudio(undefined, options), target);
    assert.match(await readFile(path.join(target, "src", "index.html"), "utf8"), /Dynamic Workflow Studio/);
});

test("replacement refuses unrecognized content and linked extension destinations", async (t) => {
    const f = await fixture();
    t.after(f.cleanup);
    const extensionsDir = path.join(f.base, "extensions");
    const legacy = path.join(extensionsDir, "workflow-studio");
    await mkdir(legacy, { recursive: true });
    await writeFile(path.join(legacy, "extension.mjs"), "user content");
    const options = { global: true, replace: true, extensionsDir, installDependencies: false };
    await assert.rejects(installStudio(undefined, options), /unrecognized/);
    assert.equal(await readFile(path.join(legacy, "extension.mjs"), "utf8"), "user content");
    const linked = path.join(f.base, "linked");
    await symlink(extensionsDir, linked, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(installStudio(undefined, { ...options, extensionsDir: linked }), /linked/);
});
