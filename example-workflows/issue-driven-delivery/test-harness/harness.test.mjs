import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("offline PowerShell lifecycle scope and failure-path regressions", async () => {
    const { stdout } = await promisify(execFile)("pwsh", [
        "-NoProfile", "-File", fileURLToPath(new URL("./harness.tests.ps1", import.meta.url)),
    ], { timeout: 30_000 });
    assert.match(stdout, /29 offline harness checks passed/);
});

test("interactive outcomes come only from one canonical delivery in the owning session", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "delivery-observer-"));
    const source = path.join(root, "source");
    const app = path.join(root, "app");
    const fixture = path.join(app, "fixture.json");
    const sessionId = "12345678-1234-1234-1234-123456789abc";
    const run = { sessionId, runId: "delivery-run", workflowName: "issue-driven-delivery" };
    try {
        await mkdir(path.join(source, "src"), { recursive: true });
        await mkdir(app);
        await writeFile(path.join(source, "src", "store.mjs"), `
import { readFileSync } from "node:fs";
import path from "node:path";
export class WorkflowStore {
    constructor(root) { this.file = path.join(root, "fixture.json"); }
    async listRuns() { return JSON.parse(readFileSync(this.file)).list; }
    async detail(sessionId, runId) {
        const data = JSON.parse(readFileSync(this.file));
        if (sessionId !== data.detail.sessionId || runId !== data.detail.runId) throw new Error("Wrong identity");
        return data.detail;
    }
}`);
        const invoke = () => promisify(execFile)("node", [
            fileURLToPath(new URL("./observe-runs.mjs", import.meta.url)), source, app, sessionId,
        ]);
        const set = (runs, detail = { ...run, status: "completed", stale: false, result: { status: "completed" } }, warnings = []) =>
            writeFile(fixture, JSON.stringify({ list: { runs, warnings }, detail }));
        await set([run]);
        assert.deepEqual(JSON.parse((await invoke()).stdout).result, { status: "completed" });
        await set([run], { ...run, status: "error", stale: false, result: null, error: "Actual failure" });
        assert.equal(JSON.parse((await invoke()).stdout).status, "error");
        await set([run, { ...run, runId: "other-run" }]);
        await assert.rejects(invoke, /exactly one delivery/);
        await set([{ ...run, sessionId: "another-session" }]);
        await assert.rejects(invoke, /exactly one delivery/);
        await set([run], undefined, ["Incomplete observation"]);
        await assert.rejects(invoke, /Incomplete observation/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
