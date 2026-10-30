import path from "node:path";
import { pathToFileURL } from "node:url";

const [sourceRoot, projectRoot] = process.argv.slice(2);
if (!path.isAbsolute(sourceRoot ?? "") || !path.isAbsolute(projectRoot ?? "")) {
    throw new Error("Explicit source and target roots required");
}
const { WorkflowStore } = await import(pathToFileURL(path.join(sourceRoot, "src", "store.mjs")));
const result = await new WorkflowStore(projectRoot).listRuns();
console.log(JSON.stringify({
    source: result.source,
    observedAt: result.observedAt,
    warnings: result.warnings,
    runs: result.runs.map(({ sessionId, runId, status, stale, updatedAt }) => ({ sessionId, runId, status, stale, updatedAt })),
}));
