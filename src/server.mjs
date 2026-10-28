import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile, realpath, lstat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { WorkflowStore } from "./store.mjs";
import { pickDirectory } from "./directory-picker.mjs";

const assets = new Map([
    ["", ["index.html", "text/html; charset=utf-8"]],
    ["app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
    ["observed.mjs", ["observed.mjs", "text/javascript; charset=utf-8"]],
    ["style.css", ["style.css", "text/css; charset=utf-8"]],
]);

export async function startStudio(projectRoot, options = {}) {
    async function openStore(root) {
        const resolved = await realpath(root);
        if (!(await lstat(resolved)).isDirectory()) throw new Error("Project root must be a directory");
        const nextStore = new WorkflowStore(resolved, options);
        await nextStore.discover();
        return nextStore;
    }
    let store = await openStore(projectRoot);
    let lastDiscovery = Date.now();
    const token = randomBytes(32).toString("hex");
    const nonce = randomBytes(24).toString("base64");
    let origin;
    let choosingDirectory = false;
    const pickerAbort = new AbortController();

    async function snapshot(selection = {}) {
        const currentStore = store;
        const discover = Date.now() - lastDiscovery > 10_000;
        const listing = await currentStore.listRuns({ discover });
        if (discover) lastDiscovery = Date.now();
        const selected = selection.runId ? listing.runs.find((run) =>
            run.runId === selection.runId && run.sessionId === selection.sessionId)
            : listing.runs.find((run) => run.status === "running" && !run.stale) ?? listing.runs[0];
        if (selection.runId && !selected) throw new Error("Selected run is not in this project");
        const detail = selected ? await currentStore.detail(selected.sessionId, selected.runId) : null;
        return { ...listing, projectRoot: currentStore.projectRoot, detail };
    }

    const server = createServer(async (request, response) => {
        const send = (status, value) => {
            response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify(value));
        };
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Content-Security-Policy",
            `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'`);
        try {
            if (request.headers.host !== new URL(origin).host) return send(403, { error: "Invalid host" });
            if (request.headers.origin && request.headers.origin !== origin) return send(403, { error: "Cross-origin request denied" });
            const url = new URL(request.url, origin);
            const prefix = `/${token}/`;
            if (!url.pathname.startsWith(prefix)) return send(404, { error: "Not found" });
            const route = url.pathname.slice(prefix.length);
            if (request.method === "GET" && assets.has(route)) {
                const [file, type] = assets.get(route);
                const content = await readFile(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8");
                response.writeHead(200, { "Content-Type": type });
                return response.end(content.replaceAll("__NONCE__", nonce));
            }
            if (request.method === "GET" && route === "api/project") return send(200, { projectRoot: store.projectRoot });
            if (request.method === "POST" && route === "api/project/pick") {
                if (request.headers.origin !== origin) return send(403, { error: "Same-origin directory selection required" });
                if (choosingDirectory) return send(409, { error: "A directory picker is already open" });
                choosingDirectory = true;
                try {
                    const selected = await (options.pickDirectory ?? pickDirectory)(store.projectRoot, { signal: pickerAbort.signal });
                    if (!selected) return send(200, { changed: false, projectRoot: store.projectRoot });
                    store = await openStore(selected);
                    lastDiscovery = Date.now();
                    return send(200, { changed: true, projectRoot: store.projectRoot });
                } finally { choosingDirectory = false; }
            }
            if (request.method === "POST" && route === "api/refresh") {
                const current = store;
                await current.discover();
                if (store === current) lastDiscovery = Date.now();
                return send(200, { projectRoot: store.projectRoot });
            }
            if (request.method === "GET" && route === "api/snapshot") {
                return send(200, await snapshot({
                    sessionId: url.searchParams.get("sessionId"), runId: url.searchParams.get("runId"),
                }));
            }
            if (request.method === "GET" && route === "api/progress") {
                const detail = await store.detail(url.searchParams.get("sessionId"), url.searchParams.get("runId"), {
                    beforeSeq: Number(url.searchParams.get("beforeSeq")), limit: 200,
                });
                return send(200, detail.progress);
            }
            return send(404, { error: "Not found" });
        } catch (error) {
            options.onError?.(error);
            if (!response.headersSent) send(400, { error: error.message });
            else response.destroy(error);
        }
    });
    server.requestTimeout = 15_000;
    server.headersTimeout = 10_000;
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    return {
        server, url: `${origin}/${token}/`, get projectRoot() { return store.projectRoot; }, snapshot,
        close: () => new Promise((resolve, reject) => {
            pickerAbort.abort();
            server.close((error) => error ? reject(error) : resolve());
            server.closeAllConnections();
        }),
    };
}
