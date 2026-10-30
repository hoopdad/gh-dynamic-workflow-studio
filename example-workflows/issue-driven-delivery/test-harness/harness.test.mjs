import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

test("offline PowerShell lifecycle scope and failure-path regressions", async () => {
    const { stdout } = await promisify(execFile)("pwsh", [
        "-NoProfile", "-File", fileURLToPath(new URL("./harness.tests.ps1", import.meta.url)),
    ], { timeout: 30_000 });
    assert.match(stdout, /23 offline harness checks passed/);
});
