import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fixture } from "./fixture.mjs";

const cli = fileURLToPath(new URL("../bin/dynamic-workflow-studio.mjs", import.meta.url));

test("CLI prints help and rejects unknown options without starting a server", () => {
    const help = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /Dynamic Workflow Studio/);
    const invalid = spawnSync(process.execPath, [cli, "--unknown"], { encoding: "utf8" });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Usage/);
});

for (const explicit of [true, false]) {
    test(`CLI serves an unrelated project ${explicit ? "by explicit path" : "from the working directory"} without the SDK or session storage`, async (t) => {
        const f = await fixture();
        const project = path.join(f.base, "project with spaces");
        await mkdir(project);
        const child = spawn(process.execPath, [cli, ...(explicit ? [project] : [])], {
            cwd: explicit ? f.base : project,
            env: { ...process.env, COPILOT_HOME: path.join(f.base, "fresh copilot home") },
            stdio: ["ignore", "pipe", "pipe"],
        });
        const exited = once(child, "close");
        t.after(async () => {
            if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
            await exited;
            await f.cleanup();
        });
        let stderr = "";
        child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
        const url = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error(`CLI startup timeout: ${stderr}`)), 15_000);
            let stdout = "";
            child.once("error", (error) => { clearTimeout(timeout); reject(error); });
            child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`CLI exited ${code}: ${stderr}`)); });
            child.stdout.setEncoding("utf8").on("data", (chunk) => {
                stdout += chunk;
                const match = stdout.match(/Open: (http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]+\/)/);
                if (match) { clearTimeout(timeout); resolve(match[1]); }
            });
        });
        const request = (target) => fetch(target, { headers: { Connection: "close" } });
        const page = await request(url);
        assert.equal(page.status, 200);
        assert.match(await page.text(), /<title>Dynamic Workflow Studio<\/title>/);
        const selected = await (await request(new URL("api/project", url))).json();
        assert.equal(path.resolve(selected.projectRoot), path.resolve(project));
        const snapshot = await (await request(new URL("api/snapshot", url))).json();
        assert.deepEqual(snapshot.runs, []);
        assert.match(snapshot.warnings[0], /No local Copilot session storage/);
    });
}
