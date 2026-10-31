import path from "node:path";
import { pathToFileURL } from "node:url";

const [sourceRoot, projectRoot, sessionId] = process.argv.slice(2);
if (!path.isAbsolute(sourceRoot ?? "") || !path.isAbsolute(projectRoot ?? "")) {
    throw new Error("Explicit source and target roots required");
}
const { WorkflowStore } = await import(pathToFileURL(path.join(sourceRoot, "src", "store.mjs")));
const store = new WorkflowStore(projectRoot);
const result = await store.listRuns();
if (sessionId) {
    if (result.warnings.length) throw new Error(result.warnings.join("\n"));
    const matches = result.runs.filter(run => run.sessionId === sessionId && run.workflowName === "issue-driven-delivery");
    if (matches.length !== 1) throw new Error("Expected exactly one delivery in the owning interactive session");
    const detail = await store.detail(sessionId, matches[0].runId);
    console.log(JSON.stringify({
        sessionId, runId: detail.runId, status: detail.status, stale: detail.stale,
        result: detail.result, error: detail.error, failure: detail.failure,
    }));
} else {
    console.log(JSON.stringify({
        source: result.source,
        observedAt: result.observedAt,
        warnings: result.warnings,
        runs: result.runs.map(({ sessionId, runId, status, stale, updatedAt }) => ({ sessionId, runId, status, stale, updatedAt })),
    }));
}
