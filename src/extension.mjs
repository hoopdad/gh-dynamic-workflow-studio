import { joinSession, createCanvas } from "@github/copilot-sdk/extension";

const instances = new Map();
const inputSchema = {
    type: "object", required: ["projectRoot"],
    properties: { projectRoot: { type: "string", description: "Explicit local project root whose recorded workflow sessions may be observed read-only." } },
};

await joinSession({
    canvases: [createCanvas({
        id: "dynamic-workflow-studio",
        displayName: "Dynamic Workflow Studio",
        description: "Explore live and past Dynamic Workflow runs in one Activity view with retained outcomes. Never starts, changes or stops a workflow.",
        inputSchema,
        actions: [{
            name: "snapshot",
            description: "Inspect the selected project's durable workflow runs without reading prompts or modifying execution.",
            handler: async (ctx) => {
                const instance = instances.get(ctx.instanceId);
                if (!instance) throw new Error("Open this canvas instance first");
                const snapshot = await instance.snapshot();
                return {
                    projectRoot: instance.projectRoot, observedAt: snapshot.observedAt,
                    runs: snapshot.runs, warnings: snapshot.warnings,
                    current: snapshot.detail && {
                        runId: snapshot.detail.runId, status: snapshot.detail.status,
                        phases: snapshot.detail.phases, liveAgentCount: snapshot.detail.liveAgentCount,
                        agentCount: snapshot.detail.agents.length, progress: snapshot.detail.progress,
                    },
                };
            },
        }],
        open: async (ctx) => {
            const projectRoot = ctx.input?.projectRoot;
            if (typeof projectRoot !== "string" || !projectRoot.trim()) throw new Error("An explicit projectRoot is required");
            let instance = instances.get(ctx.instanceId);
            if (instance && instance.requestedRoot !== projectRoot && instance.projectRoot !== projectRoot) {
                throw new Error("Use a new instanceId to observe another project");
            }
            if (!instance) {
                const { startStudio } = await import("./server.mjs");
                instance = await startStudio(projectRoot);
                instance.requestedRoot = projectRoot;
                instances.set(ctx.instanceId, instance);
            }
            return { title: "Dynamic Workflow Studio", url: instance.url };
        },
        onClose: async (ctx) => {
            const instance = instances.get(ctx.instanceId);
            if (instance) {
                instances.delete(ctx.instanceId);
                await instance.close();
            }
        },
    })],
});

process.once("SIGTERM", () => {
    Promise.all([...instances.values()].map((instance) => instance.close()))
        .then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
});
