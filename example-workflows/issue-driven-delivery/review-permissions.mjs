import { lstat, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootNames = ["workspace", "worktrees", "evidence"];
const interpreters = new Set(["sh", "bash", "dash", "zsh", "ksh", "fish", "cmd", "pwsh", "powershell", "python", "node", "nodejs",
    "perl", "ruby", "php", "lua", "deno", "bun", "wsl", "env", "sudo", "runas", "eval", "exec", "source", "call", "invoke-expression", "iex"]);

function object(value, keys, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)
        || Object.keys(value).some((key) => !keys.includes(key))
        || keys.some((key) => !Object.hasOwn(value, key))) {
        throw new Error(`${label} must contain exactly: ${keys.join(", ")}`);
    }
}

function text(value, label) {
    if (typeof value !== "string" || !value.trim() || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
        throw new Error(`${label} must be a nonempty single-line string`);
    }
    return value;
}

function inside(root, file) {
    const relative = path.relative(root, file);
    return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

async function stat(file) {
    try { return await lstat(file); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function noLinks(file) {
    for (let current = file;; current = path.dirname(current)) {
        if ((await stat(current))?.isSymbolicLink()) throw new Error("Linked permission paths are not supported");
        if (path.dirname(current) === current) break;
    }
}

function tool(entry) {
    object(entry, ["pattern", "reason"], "Tool request");
    const pattern = text(entry.pattern, "Tool pattern");
    text(entry.reason, "Tool reason");
    if (pattern.startsWith("shell(")) {
        const command = /^shell\(([a-zA-Z0-9_][a-zA-Z0-9_.-]*(?: [a-zA-Z0-9_][a-zA-Z0-9_.-]*)+)\)$/.exec(pattern)?.[1];
        const executable = command?.split(" ")[0].toLowerCase().replace(/\.exe$/, "");
        if (!command || interpreters.has(executable) || /^python\d+(?:\.\d+)*$/.test(executable)) {
            throw new Error("Shell requests require named subcommands, not wildcards, interpreters, flags or shell expressions");
        }
    } else {
        const match = /^([a-zA-Z0-9_][a-zA-Z0-9_.-]*)\(([a-zA-Z0-9_][a-zA-Z0-9_.-]*)\)$/.exec(pattern);
        if (!match || ["shell", "write", "read", "url"].includes(match[1].toLowerCase())) {
            throw new Error("Request an exact MCP server/tool; file writes and URLs have separate scoped fields");
        }
    }
    return pattern;
}

function origin(entry) {
    object(entry, ["origin", "reason"], "URL request");
    const requested = text(entry.origin, "URL origin");
    text(entry.reason, "URL reason");
    const url = new URL(requested);
    if (!/^https?:\/\/[^/?#]+\/?$/.test(requested) || requested.includes("*") || url.username || url.password
        || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
        throw new Error("URLs must be explicit HTTPS origins (or HTTP loopback), without credentials, paths, queries or wildcards");
    }
    return url.origin;
}

async function requestedPath(entry, roots, directory) {
    object(entry, ["root", "path", "reason"], "Path request");
    text(entry.reason, "Path reason");
    const relative = text(entry.path, "Relative path");
    if (!rootNames.includes(entry.root) || !Object.hasOwn(roots, entry.root)) throw new Error("Path request needs an explicit root binding");
    const parts = relative === "." && directory ? [] : relative.split(/[\\/]/);
    if (path.isAbsolute(relative) || path.win32.isAbsolute(relative)
        || /[:*?<>|"()[\]{}]/.test(relative)
        || parts.some((part) => !part || part === "." || part === ".." || /[. ]$/.test(part)
            || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
        throw new Error("Use literal relative paths inside a bound root; traversal, devices and pattern characters are not supported");
    }
    const resolved = path.join(roots[entry.root], ...parts);
    await noLinks(resolved);
    const existing = await stat(resolved);
    if (existing && !(directory ? existing.isDirectory() : existing.isFile())) throw new Error("Permission path has the wrong file type");
    return resolved;
}

function unique(values, label) {
    if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label} requests`);
    return values;
}

export async function reviewPermissions(profile, bindings) {
    object(profile, ["schemaVersion", "name", "purpose", "tools", "directories", "writes", "urls"], "Profile");
    if (profile.schemaVersion !== 1) throw new Error("Unsupported permission profile schema");
    text(profile.name, "Profile name");
    text(profile.purpose, "Profile purpose");
    for (const key of ["tools", "directories", "writes", "urls"]) {
        if (!Array.isArray(profile[key])) throw new Error(`${key} must be an array`);
    }
    if (!bindings || Object.keys(bindings).some((key) => !rootNames.includes(key)) || !Object.hasOwn(bindings, "workspace")) {
        throw new Error("Explicit workspace binding required; only workspace, worktrees and evidence roots are supported");
    }
    const roots = {};
    for (const [name, value] of Object.entries(bindings)) {
        text(value, "Root path");
        if (!path.isAbsolute(value) || /[*?()[\]{}\u0000-\u001f]/.test(value)) throw new Error("Root bindings must be absolute literal paths");
        const root = path.resolve(value);
        if (root === path.parse(root).root || inside(root, homedir())) throw new Error("Filesystem roots, home directories and their ancestors are too broad");
        await noLinks(root);
        const existing = await stat(root);
        if (existing && !existing.isDirectory()) throw new Error("Root binding must name a directory");
        roots[name] = root;
    }
    const git = await stat(path.join(roots.workspace, ".git"));
    if (!git || git.isSymbolicLink() || !(git.isFile() || git.isDirectory())) throw new Error("Workspace must be an existing Git checkout root");
    const boundRoots = Object.values(roots);
    for (let index = 0; index < boundRoots.length; index += 1) {
        if (boundRoots.slice(index + 1).some((other) => inside(boundRoots[index], other) || inside(other, boundRoots[index]))) {
            throw new Error("Root bindings must not overlap");
        }
    }
    const tools = unique(profile.tools.map(tool), "tool");
    const urls = unique(profile.urls.map(origin), "URL");
    const directories = unique(await Promise.all(profile.directories.map((entry) => requestedPath(entry, roots, true))), "directory");
    const writes = unique(await Promise.all(profile.writes.map((entry) => requestedPath(entry, roots, false))), "write");
    if (writes.some((file) => !inside(roots.workspace, file) && !directories.some((directory) => inside(directory, file)))) {
        throw new Error("Writes outside the workspace also need an explicit containing directory request");
    }
    const toolRules = [...tools, ...writes.map((file) => `write(${file})`)];
    return {
        mode: "proposal-only", name: profile.name, purpose: profile.purpose, requests: profile, roots,
        nativeArgumentProposal: [
            "-C", roots.workspace,
            ...(toolRules.length ? ["--allow-tool", ...toolRules] : []),
            ...directories.map((directory) => `--add-dir=${directory}`),
            ...(urls.length ? ["--allow-url", ...urls] : []),
        ],
        limitations: [
            "This preview does not grant permissions, change settings, execute commands or run a workflow.",
            "Shell rules match command families, not full arguments, scripts, branches, repositories or cloud resources.",
            "Directory access also trusts configuration there; file-write requests do not authorize shell redirection.",
            "Native checks, managed policies, deny rules and existing identity/RBAC limits still apply.",
            "Profile validation is not a sandbox or approval. Workflow-agent inheritance needs separate native verification.",
        ],
    };
}

const help = `Usage: node review-permissions.mjs --profile <json> --workspace <absolute-checkout-root>
  [--worktrees <absolute-application-worktree-scope>] [--evidence <absolute-run-evidence-directory>]

Validate a proposed profile and print argument data for human review only.
Never applies permissions, writes settings, executes a workflow or uses an SDK.
`;

export async function main(args) {
    if (args.length === 1 && ["--help", "-h"].includes(args[0])) { console.log(help); return; }
    const values = {};
    for (let index = 0; index < args.length; index += 2) {
        const key = args[index]?.slice(2);
        if (!["profile", ...rootNames].includes(key) || args[index] !== `--${key}`
            || !args[index + 1] || args[index + 1].startsWith("-") || Object.hasOwn(values, key)) throw new Error(help);
        values[key] = args[index + 1];
    }
    if (!values.profile || !values.workspace) throw new Error(help);
    const { profile: file, ...bindings } = values;
    let profile;
    try { profile = JSON.parse(await readFile(file, "utf8")); }
    catch (error) { if (error instanceof SyntaxError) throw new Error("Profile must be valid JSON"); throw error; }
    console.log(JSON.stringify(await reviewPermissions(profile, bindings), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
