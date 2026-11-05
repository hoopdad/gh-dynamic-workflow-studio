import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { copyDistribution } from "../scripts/install.mjs";
import { fixture } from "./fixture.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const extensionPath = "com.github.copilot/extensions/dynamic-workflow-studio";

test("the detached distribution loads the plugin canvas and serves the real runtime without source or npm dependencies", async (t) => {
    const f = await fixture();
    t.after(f.cleanup);
    const distribution = path.join(f.base, "detached plugin");
    await copyDistribution(distribution);
    const manifest = JSON.parse(await readFile(path.join(distribution, "plugin.json"), "utf8"));
    const pkg = JSON.parse(await readFile(path.join(distribution, "package.json"), "utf8"));
    const lock = JSON.parse(await readFile(path.join(distribution, "npm-shrinkwrap.json"), "utf8"));
    assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    assert.equal(manifest.name, pkg.name);
    assert.equal(manifest.version, pkg.version);
    assert.equal(lock.packages[""].version, manifest.version);
    const marketplace = JSON.parse(await readFile(path.join(distribution, ".github", "plugin", "marketplace.json"), "utf8"));
    assert.equal(marketplace.plugins.length, 1);
    assert.equal(marketplace.plugins[0].name, manifest.name);
    assert.equal(path.resolve(distribution, marketplace.plugins[0].source), distribution);
    assert.deepEqual(await readdir(path.join(distribution, "com.github.copilot", "extensions")), [manifest.name]);
    assert.equal(JSON.parse(await readFile(path.join(distribution, extensionPath, "copilot-extension.json"), "utf8")).name, manifest.name);
    await assert.rejects(readFile(path.join(distribution, "example-workflows", "issue-driven-delivery", "workflow.mjs")), { code: "ENOENT" });

    const script = `
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
const sdk = "data:text/javascript," + encodeURIComponent(
    "export const createCanvas = (options) => options; export async function joinSession(options) { globalThis.registration = options; }"
);
registerHooks({ resolve(specifier, context, next) {
    return specifier === "@github/copilot-sdk/extension" ? { url: sdk, shortCircuit: true } : next(specifier, context);
} });
await import(pathToFileURL(process.argv[1]).href);
const canvas = globalThis.registration.canvases[0];
assert.equal(canvas.id, "dynamic-workflow-studio");
assert.equal(globalThis.registration.workflows, undefined);
const ctx = { instanceId: "plugin-test", input: { projectRoot: process.argv[2] } };
await assert.rejects(canvas.open({ instanceId: "missing", input: {} }), /explicit projectRoot/);
const opened = await canvas.open(ctx);
try {
    const response = await fetch(opened.url, { headers: { Connection: "close" } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Dynamic Workflow Studio/);
    const snapshot = await canvas.actions[0].handler(ctx);
    assert.equal(snapshot.projectRoot, process.argv[2]);
    assert.deepEqual(snapshot.runs, []);
} finally { await canvas.onClose(ctx); }
await assert.rejects(fetch(opened.url));
console.log("Detached plugin canvas verified");
`;
    const { stdout } = await promisify(execFile)(process.execPath, [
        "--input-type=module", "-e", script,
        path.join(distribution, extensionPath, "extension.mjs"), f.otherProject,
    ], { env: { ...process.env, COPILOT_HOME: path.join(f.base, "empty home") }, timeout: 15_000 });
    assert.match(stdout, /Detached plugin canvas verified/);
});
