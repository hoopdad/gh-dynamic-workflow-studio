import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    canonicalPath, deliveryWorkflow, executePlan, releaseVersion,
    runIssueDelivery, validateArgs, validatePlan,
} from "./workflow.mjs";

const evidence = ["Actual native tool results (mocked; not a live issue run)"];
const report = (findings = []) => ({ blocker: "", findings, evidence });
const finding = (area = "implementation") => ({ text: "Repair this issue", area });
const proposal = (independent = false) => ({
    summary: "Implement the requested feature", increment: "minor", blocker: "",
    files: ["src/example.mjs", "test/example.mjs"].map((path, index) => ({
        path, operation: "update", purpose: "Satisfy the issue", task: independent ? `task-${index}` : "owner",
    })),
    tasks: (independent ? ["task-0", "task-1"] : ["owner"]).map((id) => ({
        id, description: "Implement the feature and focused tests", dependsOn: [],
    })),
});

function runtime(options = {}) {
    const controller = new AbortController();
    const journal = new Map(), calls = [];
    const actual = { head: "a".repeat(40), files: new Set(), pending: false, commits: 0, pushes: 0, prs: 0, merges: 0, closes: 0 };
    let designs = 0, implementations = 0, releases = 0, reviews = 0, deliveries = 0;
    const ctx = {
        runId: "test-run", args: { repository: "owner/repo", issue: 42 },
        signal: controller.signal, phase() {}, log() {},
        async step(key, producer) {
            if (!journal.has(key)) journal.set(key, structuredClone(await producer()));
            return structuredClone(journal.get(key));
        },
        parallel: (thunks) => Promise.all(thunks.map(async (thunk) => {
            try { return await thunk(); }
            catch (error) {
                if (["AbortError", "ResponseError"].includes(error.name)) throw error;
                return null;
            }
        })),
        async agent(prompt, settings) {
            const label = settings.label.split(":").slice(3).join(":");
            calls.push({ label, prompt, settings });
            if (options.failAgent === label) return null;
            if (options.cancelAt === label) { controller.abort(); controller.signal.throwIfAborted(); }
            if (options.hardFailure === label) throw Object.assign(new Error("Runtime failure"), { name: "ResponseError" });
            if (options.blockAt === label) return { ...report(), blocker: "Native permission denied", files: [], tasks: [] };
            if (label === "bind") return {
                blocker: "", root: "C:\\repo", baseSha: actual.head, baseVersion: "0.4.2",
                issue: { number: 42, title: "Enhance app", body: "Untrusted requirements", url: "https://github.com/owner/repo/issues/42" },
            };
            if (label.startsWith("design:")) { designs++; return proposal(options.independent); }
            if (label === "design-review") return report(options.failDesign && designs === 1 ? [finding("design")] : []);
            if (label === "implement" || label.startsWith("implement:")) {
                implementations++;
                const data = JSON.parse(prompt.match(/Untrusted context: (\{[^\n]+\})/)[1]);
                const task = prompt.match(/Untrusted task: (\{[^\n]+\})/)?.[1];
                const paths = task ? JSON.parse(task).files : data.proposal.files.map((file) => file.path);
                paths.forEach((path) => actual.files.add(path));
                if (options.relatedConfig) actual.files.add("eslint.config.mjs");
                actual.pending = true;
                if (options.specialistDesignFinding && label.startsWith("implement:")) {
                    options.specialistDesignFinding = false;
                    return report([finding("design")]);
                }
                return report(options.partialImplement && implementations === 1 ? [finding()] : []);
            }
            if (label === "integration") return report();
            if (label === "release") {
                const baseVersion = options.baseVersions?.[Math.min(releases, options.baseVersions.length - 1)] ?? "0.4.2";
                releases++;
                actual.pending = true;
                return {
                    ...report(options.failRelease && releases === 1 ? [finding()] : []),
                    baseVersion, version: options.badVersion ?? releaseVersion(baseVersion, "minor"),
                };
            }
            if (label === "review") {
                reviews++;
                return report(options.failReview && reviews === 1 ? [finding(options.scopeChange ? "design" : "implementation")] : []);
            }
            if (label === "deliver") {
                deliveries++;
                if (options.deliveryRepair && deliveries === 1) return { ...report([finding()]), head: "", url: "" };
                if (actual.pending) { actual.commits++; actual.head = "e".repeat(40); actual.pending = false; }
                if (options.lostCommit) { options.lostCommit = false; throw new Error("commit response lost"); }
                if (!actual.prs) { actual.pushes++; actual.prs++; }
                if (options.lostPr) { options.lostPr = false; throw new Error("PR response lost"); }
                return { ...report(), head: options.badDelivery ? "bad" : actual.head, url: options.badUrl ?? "https://github.com/owner/repo/pull/43" };
            }
            if (label === "merge") {
                if (!actual.merges) actual.merges++;
                if (options.lostMerge) { options.lostMerge = false; throw new Error("merge response lost"); }
                if (!actual.closes) actual.closes++;
                if (options.lostClose) { options.lostClose = false; throw new Error("close response lost"); }
                return {
                    blocker: "", evidence, mergeCommit: options.badMergeCommit ?? "f".repeat(40),
                    prState: options.prState ?? "MERGED", issueState: options.issueState ?? "CLOSED",
                };
            }
            throw new Error(`Unexpected native agent ${label}`);
        },
    };
    return { ctx, actual, calls, journal, run: () => runIssueDelivery(ctx) };
}
const labels = (fixture) => fixture.calls.map(({ label }) => label);
const count = (fixture, label) => labels(fixture).filter((value) => value === label).length;

describe("portable planning", () => {
    it("keeps enterprise-owner support without model or budget overrides", async () => {
        assert.deepEqual(validateArgs({ repository: "enterprise_owner/app", issue: 4 }), {
            repository: "enterprise_owner/app", issue: 4, base: "main", delivery: "pr",
        });
        const fixture = runtime();
        await fixture.run();
        assert.equal(deliveryWorkflow.run, runIssueDelivery);
        assert.ok(!("limits" in deliveryWorkflow.meta));
        for (const { settings } of fixture.calls) {
            for (const key of ["model", "reasoningEffort", "contextTier"]) assert.ok(!(key in settings));
        }
    });
    for (const value of [
        {}, null, [], { repository: "owner/repo", issue: 0 }, { repository: "owner/repo", issue: 1.2 },
        { repository: "owner;echo/repo", issue: 1 }, { repository: "owner/repo", issue: 1, base: "main..bad" },
        { repository: "owner/repo", issue: 1, base: "main.lock" },
        { repository: "owner/repo", issue: 1, delivery: "automatic" },
        { repository: "owner/repo", issue: 1, permissions: "allow-all" },
        { deploymentTarget: "old-target", issueNumber: 1 },
    ]) it(`rejects invalid or obsolete invocation ${JSON.stringify(value)}`, () => assert.throws(() => validateArgs(value)));
    for (const path of ["../outside", "/absolute", "C:\\repo\\file", "src\\file", "src/*.mjs", ".git/config", "src/./file", "src/CON.ts"]) {
        it(`rejects nonportable planned path ${path}`, () => assert.throws(() => canonicalPath(path)));
    }
    it("derives critical paths without requirement matrices or reserved bookkeeping files", () => {
        const value = proposal(true);
        value.files[1].path = "plan.md";
        value.tasks[1].dependsOn = ["task-0"];
        assert.deepEqual(validatePlan(value).criticalPath, ["task-0", "task-1"]);
        value.tasks[0].dependsOn = ["task-1"];
        assert.throws(() => validatePlan(value), /cyclic/);
        value.tasks[0].dependsOn = ["missing"];
        assert.throws(() => validatePlan(value), /dependency/);
    });
    it("derives one destination-based SemVer increment", () => {
        assert.equal(releaseVersion("0.4.2", "patch"), "0.4.3");
        assert.equal(releaseVersion("0.4.2", "minor"), "0.5.0");
        assert.equal(releaseVersion("0.4.2", "major"), "1.0.0");
        assert.throws(() => releaseVersion("01.4.2", "patch"));
        assert.throws(() => releaseVersion("9007199254740991.0.0", "major"));
    });
});

describe("dependency-ready implementation", () => {
    it("starts dependents without waiting for unrelated work", async () => {
        const started = [];
        let release;
        const slow = new Promise((resolve) => { release = resolve; });
        await executePlan(runtime().ctx, { tasks: [
            { id: "fast", dependsOn: [] }, { id: "slow", dependsOn: [] }, { id: "next", dependsOn: ["fast"] },
        ] }, async ({ id }) => {
            started.push(id);
            if (id === "slow") await slow;
            if (id === "next") release();
            return report();
        });
        assert.deepEqual(started, ["fast", "slow", "next"]);
    });
    it("does not execute dependents after null failure", async () => {
        const started = [];
        await assert.rejects(executePlan(runtime().ctx, { tasks: [
            { id: "bad", dependsOn: [] }, { id: "next", dependsOn: ["bad"] },
        ] }, ({ id }) => { started.push(id); return null; }), /parallel/);
        assert.deepEqual(started, ["bad"]);
    });
    it("preserves prerequisite blockers while completing independent tasks", async () => {
        const started = [];
        const results = await executePlan(runtime().ctx, { tasks: [
            { id: "blocked", dependsOn: [] }, { id: "independent", dependsOn: [] }, { id: "next", dependsOn: ["blocked"] },
        ] }, async ({ id }) => {
            started.push(id);
            return id === "blocked" ? { ...report(), blocker: "Permission denied" } : report();
        });
        assert.deepEqual(started, ["blocked", "independent"]);
        assert.equal(results[2].blocker, "Permission denied");
    });
});

describe("lightweight SDLC using mocked native effects", () => {
    it("delivers in seven calls, reviewing the final release diff and verifying publication together", async () => {
        const fixture = runtime();
        const result = await fixture.run();
        assert.equal(result.status, "completed");
        assert.equal(result.version, "0.5.0");
        assert.equal(result.head, "e".repeat(40));
        assert.equal(result.url, "https://github.com/owner/repo/pull/43");
        assert.deepEqual(labels(fixture), ["bind", "design:0", "design-review", "implement", "release", "review", "deliver"]);
        assert.equal(fixture.actual.commits, 1);
        assert.ok([...fixture.journal.keys()].every((key) => key.startsWith("issue-driven-delivery-v5:")));
    });
    it("uses target project guidance, version source and tooling instead of Collaboragent requirements", async () => {
        const fixture = runtime();
        await fixture.run();
        const binding = fixture.calls[0].prompt;
        assert.match(binding, /guidance where present/);
        assert.match(binding, /existing version source/);
        const release = fixture.calls.find(({ label }) => label === "release").prompt;
        assert.match(release, /target repository's documented/);
        assert.match(release, /Do not require npm/);
        assert.doesNotMatch(fixture.calls.map(({ prompt }) => prompt).join("\n"), /COLLABORAGENT_VERSION|Secure-Collaborative-Coding-Design\.md|npm run verify/);
    });
    it("repairs code/test/config findings directly without redesign or a CRUD allowlist", async () => {
        const fixture = runtime({ relatedConfig: true, partialImplement: true, failRelease: true, failReview: true });
        assert.equal((await fixture.run()).status, "completed");
        assert.equal(count(fixture, "design:0"), 1);
        assert.equal(count(fixture, "design:1"), 0);
        assert.equal(count(fixture, "implement"), 4);
        assert.ok(fixture.actual.files.has("eslint.config.mjs"));
    });
    it("redesigns failed proposals and genuine scope changes", async () => {
        const fixture = runtime({ failDesign: true, failReview: true, scopeChange: true });
        assert.equal((await fixture.run()).status, "completed");
        assert.equal(labels(fixture).filter((label) => label.startsWith("design:")).length, 3);
        assert.equal(count(fixture, "implement"), 2);
    });
    it("uses specialists only for independent work and then integrates", async () => {
        const fixture = runtime({ independent: true });
        assert.equal((await fixture.run()).status, "completed");
        assert.equal(labels(fixture).filter((label) => label.startsWith("implement:")).length, 2);
        assert.equal(count(fixture, "integration"), 1);
    });
    it("returns specialist scope changes to design before integration", async () => {
        const fixture = runtime({ independent: true, specialistDesignFinding: true });
        assert.equal((await fixture.run()).status, "completed");
        assert.ok(labels(fixture).indexOf("design:1") < labels(fixture).indexOf("integration"));
    });
    it("refreshes the release against an advancing destination without redesign", async () => {
        const fixture = runtime({ deliveryRepair: true, baseVersions: ["0.4.2", "0.5.0"] });
        assert.equal((await fixture.run()).version, "0.6.0");
        assert.equal(count(fixture, "design:1"), 0);
        assert.equal(fixture.actual.commits, 1);
    });
    it("does not publish an invalid release version", async () => {
        const fixture = runtime({ badVersion: "0.9.0" });
        await assert.rejects(fixture.run(), /one bump/);
        assert.equal(count(fixture, "deliver"), 0);
    });
    it("keeps local delivery free of commits and remote mutations", async () => {
        const fixture = runtime();
        fixture.ctx.args.delivery = "local";
        const result = await fixture.run();
        assert.equal(result.status, "completed");
        assert.equal(result.head, null);
        assert.equal(result.url, null);
        for (const key of ["commits", "pushes", "prs", "merges", "closes"]) assert.equal(fixture.actual[key], 0);
    });
    it("includes the closing reference but never merges or closes in default PR mode", async () => {
        const fixture = runtime();
        const result = await fixture.run();
        assert.equal(result.mergeCommit, null);
        assert.equal(result.issueState, null);
        assert.match(fixture.calls.at(-1).prompt, /Closes https:\/\/github\.com\/owner\/repo\/issues\/42/);
        assert.equal(fixture.actual.merges, 0);
        assert.equal(fixture.actual.closes, 0);
    });
    it("merges the reviewed head and verifies issue closure only in explicit merge mode", async () => {
        const fixture = runtime();
        fixture.ctx.args.delivery = "merge";
        const result = await fixture.run();
        assert.equal(result.status, "completed");
        assert.equal(result.issueState, "CLOSED");
        assert.equal(result.mergeCommit, "f".repeat(40));
        assert.deepEqual(labels(fixture).slice(-3), ["review", "deliver", "merge"]);
        assert.match(fixture.calls.at(-1).prompt, new RegExp(`--match-head-commit ${"e".repeat(40)}`));
        assert.equal(fixture.actual.merges, 1);
        assert.equal(fixture.actual.closes, 1);
    });
    it("preserves the PR URL when merge is blocked", async () => {
        const fixture = runtime({ blockAt: "merge" });
        fixture.ctx.args.delivery = "merge";
        const result = await fixture.run();
        assert.equal(result.status, "blocked");
        assert.equal(result.reason, "Native permission denied");
        assert.equal(result.url, "https://github.com/owner/repo/pull/43");
        assert.equal(fixture.actual.merges, 0);
    });
    for (const options of [{ prState: "OPEN" }, { prState: "CLOSED" }, { issueState: "OPEN" }, { badMergeCommit: "" }]) {
        it(`rejects unverified merge/closure ${JSON.stringify(options)}`, async () => {
            const fixture = runtime(options);
            fixture.ctx.args.delivery = "merge";
            await assert.rejects(fixture.run(), /closure not verified/);
        });
    }
    for (const kind of ["lostCommit", "lostPr", "lostMerge", "lostClose"]) {
        it(`reconciles ${kind} on resume without duplicate effects`, async () => {
            const fixture = runtime({ [kind]: true });
            if (["lostMerge", "lostClose"].includes(kind)) fixture.ctx.args.delivery = "merge";
            await assert.rejects(fixture.run(), /response lost/);
            const result = await fixture.run();
            assert.equal(result.status, "completed");
            for (const key of ["commits", "pushes", "prs"]) assert.equal(fixture.actual[key], 1);
            if (fixture.ctx.args.delivery === "merge") {
                assert.equal(fixture.actual.merges, 1);
                assert.equal(fixture.actual.closes, 1);
            }
            const calls = fixture.calls.length;
            assert.deepEqual(await fixture.run(), result);
            assert.equal(fixture.calls.length, calls);
        });
    }
    for (const blockAt of ["bind", "design:0", "design-review", "implement", "release", "review", "deliver"]) {
        it(`preserves the actual blocker at ${blockAt}`, async () => {
            const fixture = runtime({ blockAt });
            const result = await fixture.run();
            assert.equal(result.status, "blocked");
            assert.equal(result.reason, "Native permission denied");
            assert.equal(fixture.actual.prs, 0);
        });
    }
    for (const failAgent of ["bind", "design-review", "implement", "release", "review", "deliver", "merge"]) {
        it(`propagates a null native agent at ${failAgent}`, async () => {
            const fixture = runtime({ failAgent });
            if (failAgent === "merge") fixture.ctx.args.delivery = "merge";
            await assert.rejects(fixture.run(), /native agent failed/);
        });
    }
    for (const [kind, name] of [["cancelAt", "AbortError"], ["hardFailure", "ResponseError"]]) {
        it(`propagates ${kind}`, async () => assert.rejects(runtime({ [kind]: "design-review" }).run(), { name }));
    }
    it("respects cancellation even on completed replay", async () => {
        const fixture = runtime();
        await fixture.run();
        fixture.ctx.signal = AbortSignal.abort();
        await assert.rejects(fixture.run(), { name: "AbortError" });
    });
    for (const options of [{ badDelivery: true }, { badUrl: "https://github.com/other/repo/pull/43" }]) {
        it(`rejects invalid remote metadata ${JSON.stringify(options)}`, async () =>
            assert.rejects(runtime(options).run(), /not verified/));
    }
});
