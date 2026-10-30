import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { reviewPermissions } from "./review-permissions.mjs";

const exec = promisify(execFile);
const helper = fileURLToPath(new URL("./review-permissions.mjs", import.meta.url));
const starter = JSON.parse(await readFile(new URL("./permissions.example.json", import.meta.url), "utf8"));
const request = (root, file) => ({ root, path: file, reason: "Explicit owned fixture path." });

async function fixture(t) {
    const base = await realpath(await mkdtemp(path.join(tmpdir(), "delivery-permissions-")));
    t.after(() => rm(base, { recursive: true, force: true }));
    const roots = { workspace: path.join(base, "application"), worktrees: path.join(base, "assigned worktree"), evidence: path.join(base, "run evidence") };
    for (const root of Object.values(roots)) await mkdir(root);
    await exec("git", ["-C", roots.workspace, "init", "--quiet"]);
    return { base, roots, profile: structuredClone(starter) };
}

test("the inspection starter renders explicit native argument data without authorizing full delivery", async (t) => {
    const { roots, profile } = await fixture(t);
    const result = await reviewPermissions(profile, roots);
    assert.equal(result.mode, "proposal-only");
    assert.deepEqual(result.nativeArgumentProposal.slice(0, 2), ["-C", roots.workspace]);
    assert.deepEqual(result.nativeArgumentProposal.slice(2, 4), ["--allow-tool", "shell(git status)"]);
    assert.ok(result.nativeArgumentProposal.includes(`--add-dir=${roots.worktrees}`));
    assert.deepEqual(result.nativeArgumentProposal.slice(-3), ["--allow-url", "https://github.com", "https://api.github.com"]);
    assert.deepEqual(result.requests.writes, []);
    assert.match(result.limitations.join(" "), /not a sandbox or approval/);
});

test("owned file requests resolve within explicit roots and retain argv boundaries for spaces", async (t) => {
    const { roots, profile } = await fixture(t);
    profile.writes = [request("workspace", "docs\\architecture.md"), request("evidence", "owned-output.json")];
    profile.tools.push({ pattern: "project-server(check_status)", reason: "Explicit MCP tool." });
    const result = await reviewPermissions(profile, roots);
    assert.ok(result.nativeArgumentProposal.includes(`write(${path.join(roots.workspace, "docs", "architecture.md")})`));
    assert.ok(result.nativeArgumentProposal.includes(`write(${path.join(roots.evidence, "owned-output.json")})`));
    profile.directories = [];
    await assert.rejects(reviewPermissions(profile, roots), /containing directory request/);
});

test("blanket tools, wildcard families, interpreters and command expressions are rejected", async (t) => {
    const { roots, profile } = await fixture(t);
    for (const pattern of ["shell", "shell(git)", "shell(git:*)", "shell(git status:*)", "write", "write(.)",
        "server", "server(*)", "shell(pwsh Invoke-Expression)", "shell(node.exe script)", "shell(python3.12 module)",
        "shell(. script)", "shell(eval expression)", "shell(git status;whoami)",
        "shell(git -C)", "Shell(git)", "--allow-all(tool)"]) {
        profile.tools = [{ pattern, reason: "Rejected fixture request." }];
        await assert.rejects(reviewPermissions(profile, roots), /Shell requests|exact MCP server/);
    }
});

test("named PowerShell and Unix inspection commands work without whole-interpreter or mixed-purpose leaf grants", async (t) => {
    const { roots, profile } = await fixture(t);
    profile.tools = ["Get-ChildItem", "Get-Content", "Get-FileHash", "Get-Process", "Resolve-DnsName", "Test-Path",
        "ls", "pwd", "cat", "grep", "stat", "sha256sum"].map((command) => ({ pattern: `shell(${command})`, reason: "Inspection." }));
    const result = await reviewPermissions(profile, roots);
    for (const entry of profile.tools) assert.ok(result.nativeArgumentProposal.includes(entry.pattern));
    for (const command of ["pwsh", "powershell", "bash", "sh", "git", "az", "docker", "kubectl", "find", "sed",
        "awk", "env", "xargs", "tee", "sort", "uniq", "less", "more", "date", "Get-ChildItem;Remove-Item"]) {
        profile.tools = [{ pattern: `shell(${command})`, reason: "Rejected broad or mixed-purpose request." }];
        await assert.rejects(reviewPermissions(profile, roots), /Shell requests/);
    }
});

test("path requests cannot escape bindings or request whole-root writes, devices or patterns", async (t) => {
    const { roots, profile } = await fixture(t);
    for (const file of [".", "..\\outside", "docs\\..\\outside", "C:\\foreign\\file", "/foreign/file",
        "docs\\*.md", "docs\\file:stream", "docs\\NUL", "docs\\name.", "docs\\file)"]) {
        profile.writes = [request("workspace", file)];
        await assert.rejects(reviewPermissions(profile, roots), /literal relative paths/);
    }
    profile.writes = [request("unknown", "file")];
    await assert.rejects(reviewPermissions(profile, roots), /explicit root binding/);
});

test("bindings reject ambient, filesystem-wide, home-wide and workspace-encompassing access", async (t) => {
    const { base, roots, profile } = await fixture(t);
    await assert.rejects(reviewPermissions(profile, {}), /Explicit workspace/);
    await assert.rejects(reviewPermissions(profile, { ...roots, workspace: "." }), /absolute literal paths/);
    for (const worktrees of [path.parse(base).root, homedir(), path.dirname(homedir())]) {
        await assert.rejects(reviewPermissions(profile, { ...roots, worktrees }), /too broad/);
    }
    await assert.rejects(reviewPermissions(profile, { ...roots, worktrees: base }), /overlap/);
    await assert.rejects(reviewPermissions(profile, { ...roots, evidence: path.join(roots.workspace, "private") }), /overlap/);
    await assert.rejects(reviewPermissions(profile, { ...roots, evidence: roots.worktrees }), /overlap/);
    await assert.rejects(reviewPermissions(profile, { ...roots, workspace: roots.evidence }), /Git checkout root/);
    await assert.rejects(reviewPermissions(profile, { ...roots, extra: base }), /only workspace/);
});

test("linked directories cannot redirect directory or file-write proposals outside the declared root", async (t) => {
    const { base, roots, profile } = await fixture(t);
    const outside = path.join(base, "outside");
    await mkdir(outside);
    await writeFile(path.join(outside, "keep.txt"), "preserve");
    const link = path.join(roots.worktrees, "redirect");
    await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
    profile.directories = [request("worktrees", "redirect")];
    await assert.rejects(reviewPermissions(profile, roots), /Linked permission paths/);
    profile.directories = structuredClone(starter.directories);
    profile.writes = [request("worktrees", "redirect\\keep.txt")];
    await assert.rejects(reviewPermissions(profile, roots), /Linked permission paths/);
    await assert.rejects(reviewPermissions(starter, { ...roots, worktrees: link }), /Linked permission paths/);
    assert.equal(await readFile(path.join(outside, "keep.txt"), "utf8"), "preserve");
});

test("URL requests reject wildcard, credential-bearing, path-bound and remote plaintext destinations", async (t) => {
    const { roots, profile } = await fixture(t);
    for (const origin of ["https://*.github.com", "https://user:secret@api.github.com",
        "https://api.github.com/repos/owner/repo", "https://api.github.com?token=secret",
        "https://github.com/#fragment", "http://api.github.com"]) {
        profile.urls = [{ origin, reason: "Rejected fixture URL." }];
        await assert.rejects(reviewPermissions(profile, roots), /explicit HTTPS origins/);
    }
    profile.urls = [{ origin: "http://localhost:3000", reason: "Explicit local development endpoint." }];
    assert.deepEqual((await reviewPermissions(profile, roots)).nativeArgumentProposal.slice(-2), ["--allow-url", "http://localhost:3000"]);
});

test("unknown fields, missing reasons and duplicate requests cannot silently expand a profile", async (t) => {
    const { roots, profile } = await fixture(t);
    await assert.rejects(reviewPermissions({ ...profile, allowAll: true }, roots), /contain exactly/);
    await assert.rejects(reviewPermissions({ ...profile, tools: "shell" }, roots), /must be an array/);
    profile.tools[0].reason = "";
    await assert.rejects(reviewPermissions(profile, roots), /nonempty single-line/);
    profile.tools = [starter.tools[0], starter.tools[0]];
    await assert.rejects(reviewPermissions(profile, roots), /Duplicate tool/);
    profile.tools = [];
    profile.directories.push(profile.directories[0]);
    await assert.rejects(reviewPermissions(profile, roots), /Duplicate directory/);
});

test("the CLI works from another directory, previews only and has no apply/settings/workflow side effects", async (t) => {
    const { base, roots, profile } = await fixture(t);
    const file = path.join(base, "profile.json");
    await writeFile(file, JSON.stringify(profile));
    const config = path.join(base, "copilot-home");
    await mkdir(config);
    await writeFile(path.join(config, "config.json"), '{"keep":true}');
    const before = await readdir(roots.workspace);
    const args = ["--profile", file, ...Object.entries(roots).flatMap(([name, value]) => [`--${name}`, value])];
    const result = await exec(process.execPath, [helper, ...args], { cwd: base, env: { ...process.env, COPILOT_HOME: config } });
    assert.equal(JSON.parse(result.stdout).mode, "proposal-only");
    assert.deepEqual(await readdir(roots.workspace), before);
    assert.deepEqual(await readdir(roots.worktrees), []);
    assert.deepEqual(await readdir(roots.evidence), []);
    assert.equal(await readFile(path.join(config, "config.json"), "utf8"), '{"keep":true}');
    for (const extra of [["--apply"], ["--allow-all"], ["--workspace", roots.workspace]]) {
        await assert.rejects(exec(process.execPath, [helper, ...args, ...extra], { cwd: base }), /Usage:/);
    }
    await writeFile(file, "not-json-private-content");
    await assert.rejects(exec(process.execPath, [helper, ...args], { cwd: base }), (error) => {
        assert.match(error.stderr, /Profile must be valid JSON/);
        assert.doesNotMatch(error.stderr, /not-json-private-content/);
        return true;
    });
});
