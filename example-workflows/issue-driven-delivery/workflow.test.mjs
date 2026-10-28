import { test } from "node:test";
import assert from "node:assert/strict";
import { command, githubIO, renderStack, roles, runDelivery, validatePlan, validateReport } from "./workflow.mjs";

const sha = "a".repeat(40);
const issue = { number: 7, title: "Add a greeting", body: "Show a greeting.", url: "https://github.com/example/app/issues/7", state: "OPEN" };
const requirement = { id: "R1", text: "Show a greeting." };
const finding = {
    requirementId: "R1", owner: "API", check: "Greeting response",
    expected: "Greeting", actual: "500 response", evidence: "GET /greeting returned 500",
};
const makeReport = (overrides = {}) => ({
    status: "pass", sha, summary: "Verified", evidence: ["node --test: exit 0"], findings: [], ...overrides,
});
const makePlan = () => ({
    status: "ready", summary: "Greeting design", sha, designFile: "docs/design/issue-7.md",
    requirements: [structuredClone(requirement)],
    assignments: roles.map((role) => ({
        role, task: `Implement ${role}`, files: [`${role.toLowerCase()}/greeting.mjs`], requirementIds: ["R1"],
    })),
});

function fixture(handler = () => undefined, ioOverrides = {}, args = {}) {
    const calls = [];
    const scopedCalls = [];
    const bodies = new Map();
    const open = [];
    const journal = new Map();
    const io = {
        repository: async () => ({ nameWithOwner: "example/app", defaultBranchRef: { name: "main" } }),
        select: async (number, label, excluded = []) => excluded.includes(issue.number) ? null : issue,
        label: async () => {},
        head: async () => sha,
        ancestor: async () => {},
        design: async () => "# Design",
        issues: async () => [...open],
        file: async (repo, label, parent, branch, stage, item) => {
            calls.push(`file:${stage}:${item.requirementId}`);
            const number = open.length + 100;
            open.push({ number, body: `<!-- delivery:${parent}:${branch}:test -->\nStage: ${stage}\n`, finding: item });
            return number;
        },
        close: async (number) => {
            calls.push(`close:${number}`);
            open.splice(open.findIndex((item) => item.number === number), 1);
        },
        pull: async () => ({
            number: 8, body: bodies.get(8) ?? "Original PR notes", isCrossRepository: false,
            state: "OPEN", headRefName: "feature/issue-7", baseRefName: "main",
            headRefOid: sha, url: "https://github.com/example/app/pull/8",
        }),
        publishStack: async (stack) => {
            calls.push("stack");
            for (const [index, entry] of stack.entries()) {
                bodies.set(entry.pullRequestNumber, renderStack(bodies.get(entry.pullRequestNumber) ?? "Original PR notes", stack, index));
            }
        },
        requestReview: async () => { calls.push("request-review"); },
        review: async () => ({ id: 20, html_url: "https://github.com/example/app/pull/8#pullrequestreview-20" }),
        wait: async () => { calls.push("wait"); },
        finish: async () => { calls.push("finish"); },
        ...ioOverrides,
    };
    const ctx = {
        runId: "test-run", args: { deploymentTarget: "approved-test-environment", ...args },
        phase: (name) => { calls.push(`phase:${name}`); },
        log: (message) => { calls.push(message); },
        step: async (key, producer) => {
            if (!journal.has(key)) journal.set(key, await producer());
            return structuredClone(journal.get(key));
        },
        parallel: (thunks) => Promise.all(thunks.map(async (thunk) => {
            try { return await thunk(); } catch { return null; }
        })),
        agent: async (prompt, options) => {
            scopedCalls.push(options.label);
            const label = options.label.replace(/^issue-\d+:/, "");
            calls.push(label);
            const result = handler(label, prompt);
            if (result !== undefined) return result;
            if (options.label.includes(":design:")) return makePlan();
            if (options.label.includes(":pr:")) return { number: 8 };
            return makeReport();
        },
    };
    return { ctx, io, calls, scopedCalls, bodies, open, run: () => runDelivery(ctx, io) };
}

function queueFixture(handler = () => undefined, args = {}) {
    const queue = [
        issue,
        { ...issue, number: 9, title: "Add a farewell", body: "Show a farewell.", url: issue.url.replace("/7", "/9") },
    ];
    const prompts = [];
    const issueSha = (number) => (number === 7 ? "a" : number === 9 ? "b" : "c").repeat(40);
    const f = fixture((label, prompt) => {
        const identity = JSON.parse(prompt.split("\n").find((line) => line.startsWith('{"repo":')));
        prompts.push({ label, prompt, identity });
        const custom = handler(identity, label, prompt);
        if (custom !== undefined) return custom;
        if (label.includes(":design:")) {
            const plan = makePlan();
            plan.sha = issueSha(identity.parent.number);
            plan.designFile = `docs/design/issue-${identity.parent.number}.md`;
            plan.requirements = [{ id: "R1", text: identity.parent.body }];
            return plan;
        }
        if (label.includes(":pr:")) return { number: identity.parent.number + 1 };
        return makeReport({ sha: issueSha(identity.parent.number) });
    }, {}, args);
    f.io.select = async (number, label, excluded = []) => {
        f.calls.push(`select:${number}`);
        return queue.find((item) => (!number || item.number === number) && !excluded.includes(item.number)) ?? null;
    };
    f.io.head = async (branch) => branch === "main" ? "d".repeat(40) : issueSha(Number(branch.split("-").at(-1)));
    f.io.pull = async (number) => {
        const index = queue.findIndex((item) => item.number + 1 === number);
        const selected = queue[index];
        return {
            number, body: f.bodies.get(number) ?? "Original PR notes", isCrossRepository: false,
            state: "OPEN", headRefName: `feature/issue-${selected.number}`,
            baseRefName: index ? `feature/issue-${queue[index - 1].number}` : "main",
            headRefOid: issueSha(selected.number), url: `https://github.com/example/app/pull/${number}`,
        };
    };
    f.io.issues = async (repo, label) => f.open.filter((item) => item.body.includes(`<!-- delivery:${label.split("-").at(-1)}:`));
    f.io.finish = async (number) => { f.calls.push(`finish:${number}`); };
    return { ...f, queue, prompts, issueSha };
}

test("literal delivery flow fans out all six writers, then gates deployment, E2E and completed review", async () => {
    let active = 0;
    let peak = 0;
    const f = fixture();
    const original = f.ctx.agent;
    f.ctx.agent = async (prompt, options) => {
        if (!options.label.includes(":develop:")) return original(prompt, options);
        active++;
        peak = Math.max(peak, active);
        await Promise.resolve();
        const result = await original(prompt, options);
        active--;
        assert.match(prompt, /SAME remote feature branch/);
        assert.match(prompt, /never the main checkout/);
        return result;
    };
    const result = await f.run();
    assert.equal(result.status, "done");
    assert.equal(peak, 6);
    assert.deepEqual(f.calls.filter((call) => call.startsWith("phase:")), [
        "phase:Scan", "phase:Design", "phase:Develop", "phase:Local tests",
        "phase:Deploy and smoke", "phase:Deployed E2E", "phase:Review", "phase:Stack", "phase:Scan",
    ]);
    assert.ok(f.calls.indexOf("1:local:Test") < f.calls.indexOf("1:deploy-1:DevOps"));
    assert.ok(f.calls.indexOf("1:e2e:Test") < f.calls.indexOf("request-review"));
    assert.ok(f.calls.indexOf("request-review") < f.calls.indexOf("1:review:Architect"));
    assert.ok(f.calls.includes("finish"));
    assert.equal(result.stack.length, 1);
    assert.match(f.bodies.get(8), /Original PR notes/);
    assert.match(f.bodies.get(8), /approval and merge order/);
    assert.equal(f.open.length, 0);
});

test("empty queue does not launch agents or deploy", async () => {
    const f = fixture(undefined, { select: async () => null });
    assert.equal((await f.run()).status, "idle");
    assert.deepEqual(f.calls, ["phase:Scan"]);
});

test("ownership covers exact new/existing files, inactive tiers and shared artifacts", () => {
    assert.equal(validatePlan(makePlan(), issue).requirements.length, 1);
    const overlap = makePlan();
    overlap.assignments[1].files = ["WEB/GREETING.mjs"];
    assert.throws(() => validatePlan(overlap, issue), /Overlapping ownership/);
    overlap.assignments[1].files = ["web/greeting.mjs/nested.mjs"];
    assert.throws(() => validatePlan(overlap, issue), /Overlapping ownership/);
    for (const file of ["../outside.mjs", "C:/outside.mjs", "src/**", "src/", "src\\file.mjs"]) {
        const plan = makePlan();
        plan.assignments[0].files = [file];
        assert.throws(() => validatePlan(plan, issue), /exact repository-relative/);
    }
    const inactive = makePlan();
    inactive.assignments[0].files = [];
    assert.doesNotThrow(() => validatePlan(inactive, issue));
    const missing = makePlan();
    missing.assignments.pop();
    assert.throws(() => validatePlan(missing, issue), /exactly once/);
});

test("requirements cannot be invented and findings need evidence at the tested SHA", () => {
    const invented = makePlan();
    invented.requirements[0].text = "Add enterprise SSO.";
    assert.throws(() => validatePlan(invented, issue), /verbatim/);
    assert.throws(() => validateReport(null, makePlan()), /not a pass/);
    assert.throws(() => validateReport(makeReport({ evidence: [] }), makePlan()), /not a pass/);
    assert.throws(() => validateReport(makeReport(), makePlan(), "b".repeat(40)), /candidate commit/);
    assert.throws(() => validateReport(makeReport({ findings: [finding] }), makePlan()), /Pass requires no findings/);
    assert.throws(() => validateReport(makeReport({
        status: "rework", findings: [{ ...finding, requirementId: "R99" }],
    }), makePlan()), /existing requirement/);
    assert.throws(() => validateReport(makeReport({
        status: "rework", findings: [{ ...finding, requirementId: "DELIVERY" }],
    }), makePlan()), /only an operational blocker/);
});

for (const stage of ["local:Test", "e2e:Test", "review:Architect"]) {
    test(`${stage} findings go to Architect replanning and close only after that gate passes`, async () => {
        const f = fixture((label) => label === `1:${stage}` ? makeReport({
            status: "rework", findings: [finding],
        }) : undefined);
        const result = await f.run();
        assert.equal(result.status, "done");
        assert.ok(f.calls.includes("2:design:Architect"));
        assert.ok(f.calls.includes(`2:${stage}`));
        assert.ok(f.calls.some((call) => call.startsWith("close:")));
        assert.equal(f.open.length, 0);
        if (stage === "local:Test") assert.ok(!f.calls.includes("1:deploy-1:DevOps"));
        if (stage === "e2e:Test") assert.ok(!f.calls.includes("1:pr:Architect"));
    });
}

test("null parallel reports cannot reach tests/deployment or return done", async () => {
    const f = fixture((label) => label === "1:develop:API" ? null : undefined);
    await assert.rejects(f.run(), /parallel worker failed/);
    assert.ok(!f.calls.includes("1:local:Test"));
    assert.ok(!f.calls.includes("finish"));
});

test("requirement IDs/text cannot drift in a repair round", async () => {
    const f = fixture((label) => {
        if (label === "1:local:Test") return makeReport({ status: "rework", findings: [finding] });
        if (label === "2:design:Architect") {
            const plan = makePlan();
            plan.requirements[0].text = "Add a greeting";
            return plan;
        }
        return undefined;
    });
    assert.equal((await f.run()).status, "blocked");
    assert.ok(!f.calls.includes("2:develop:API"));
    assert.ok(!f.calls.includes("finish"));
});

test("a worker's reported commit must actually be included in the shared remote branch", async () => {
    const unpublished = "b".repeat(40);
    const f = fixture((label) => label === "1:develop:API" ? makeReport({ sha: unpublished }) : undefined, {
        ancestor: async (base) => {
            if (base === unpublished) throw new Error("Worker commit is not in the feature branch");
        },
    });
    await assert.rejects(f.run(), /not in the feature branch/);
    assert.ok(!f.calls.includes("1:local:Test"));
    assert.ok(!f.calls.includes("finish"));
});

test("invalid inputs, closed parents and stale local evidence cannot launch a deployment", async () => {
    for (const args of [{ deploymentTarget: "" }, { maxRounds: 0 }, { reviewPolls: 1.5 }, { issueNumber: -1 }, { stackAfter: -1 }]) {
        const f = fixture(undefined, {}, args);
        await assert.rejects(f.run(), /explicit deploymentTarget/);
        assert.deepEqual(f.calls, []);
    }
    const closed = fixture(undefined, { select: async () => ({ ...issue, state: "CLOSED" }) });
    await assert.rejects(closed.run(), /not open/);
    const stale = fixture((label) => label === "1:local:Test" ? makeReport({ sha: "b".repeat(40) }) : undefined);
    await assert.rejects(stale.run(), /candidate commit/);
    assert.ok(!stale.calls.includes("1:deploy-1:DevOps"));
});

test("DevOps retries smoke/deploy failure, files blocked deployment issues and never skips local tests on changed code", async () => {
    const retry = fixture((label) => label === "1:deploy-1:DevOps"
        ? makeReport({ status: "rework", findings: [finding] }) : undefined);
    assert.equal((await retry.run()).status, "done");
    assert.ok(retry.calls.includes("1:deploy-2:DevOps"));
    const blocked = fixture((label) => label === "1:deploy-1:DevOps" ? makeReport({
        status: "blocked", findings: [{ ...finding, requirementId: "DELIVERY", owner: "DevOps" }],
    }) : undefined);
    assert.equal((await blocked.run()).status, "blocked");
    assert.ok(blocked.calls.includes("file:deployment:DELIVERY"));
    assert.ok(!blocked.calls.includes("1:e2e:Test"));
    let changed;
    let changedOnce = false;
    changed = fixture(undefined, {
        head: async (branch) => {
            if (branch === "feature/issue-7" && !changedOnce && changed.calls.includes("1:deploy-1:DevOps")) {
                changedOnce = true;
                return "b".repeat(40);
            }
            return sha;
        },
    });
    assert.equal((await changed.run()).status, "done");
    assert.ok(!changed.calls.includes("1:e2e:Test"));
    assert.ok(changed.calls.includes("2:local:Test"));
});

test("pending Copilot review is blocked, not done; a later run can complete and close its wait issue", async () => {
    const f = fixture(undefined, { review: async () => null }, { reviewPolls: 2 });
    assert.equal((await f.run()).status, "blocked");
    assert.equal(f.calls.filter((call) => call === "wait").length, 2);
    assert.ok(f.calls.includes("file:review-wait:DELIVERY"));
    assert.ok(!f.calls.includes("1:review:Architect"));
    f.io.review = async () => ({ id: 20, html_url: "https://github.com/example/app/pull/8#review-20" });
    assert.equal((await f.run()).status, "done");
    assert.equal(f.open.length, 0);
});

test("review requires the actual candidate PR and final branch freshness", async () => {
    const wrongPR = fixture(undefined, { pull: async () => ({ state: "OPEN", headRefName: "another-feature" }) });
    assert.equal((await wrongPR.run()).status, "blocked");
    assert.ok(!wrongPR.calls.includes("request-review"));
    let stale;
    stale = fixture(undefined, {
        head: async () => stale.calls.includes("1:review:Architect") ? "b".repeat(40) : sha,
    });
    assert.equal((await stale.run()).status, "blocked");
    assert.ok(!stale.calls.includes("finish"));
});

test("bounded rework creates a recovery issue; a later passing run resolves the budget issue", async () => {
    const f = fixture((label) => label.endsWith(":local:Test")
        ? makeReport({ status: "rework", findings: [finding] }) : undefined, {}, { maxRounds: 1 });
    assert.equal((await f.run()).status, "blocked");
    assert.ok(f.calls.includes("file:budget:DELIVERY"));
    const recovered = fixture();
    recovered.open.push(...f.open);
    assert.equal((await recovered.run()).status, "done");
    assert.equal(recovered.open.length, 0);
});

test("GitHub adapter paginates scope, deduplicates findings and filters completed reviews by bot AND SHA", async () => {
    const calls = [];
    let createdBody;
    const run = async (program, args) => {
        calls.push([program, args]);
        if (args[0] === "api" && args.at(-1).includes("/reviews")) return JSON.stringify([[
            { id: 1, user: { login: "human" }, commit_id: sha, submitted_at: "today", state: "COMMENTED" },
            { id: 2, user: { login: "copilot-pull-request-reviewer[bot]" }, commit_id: "b".repeat(40), submitted_at: "today", state: "COMMENTED" },
        ], [
            { id: 3, user: { login: "copilot-pull-request-reviewer[bot]" }, commit_id: sha, submitted_at: "today", state: "COMMENTED" },
        ]]);
        if (args[0] === "api") return JSON.stringify([[
            { number: 100, body: createdBody ?? "" }, { number: 101, pull_request: {}, body: "" },
        ]]);
        if (args[1] === "create") {
            createdBody = args[args.indexOf("--body") + 1];
            return "https://github.com/example/app/issues/100";
        }
        return "";
    };
    const io = githubIO(run);
    assert.equal(await io.file("example/app", "delivery:issue-7", 7, "feature/issue-7", "local", finding), 100);
    assert.equal(await io.file("example/app", "delivery:issue-7", 7, "feature/issue-7", "local", finding), 100);
    assert.equal(calls.filter(([, args]) => args[1] === "create").length, 1);
    assert.ok(calls.some(([, args]) => args[1] === "comment"));
    assert.equal((await io.issues("example/app", "delivery:issue-7")).length, 1);
    assert.equal((await io.review("example/app", 8, sha)).id, 3);
    assert.ok(calls.filter(([, args]) => args[0] === "api").every(([, args]) => args.includes("--paginate")));
});

test("GitHub adapter selects the oldest eligible issue via paginated REST, excluding PRs and completed features", async () => {
    const calls = [];
    const io = githubIO(async (program, args) => {
        calls.push([program, args]);
        if (program === "git") return args[0] === "rev-parse" ? sha : "# Design";
        if (args[0] === "api") return JSON.stringify([[
            { ...issue, number: 6, pull_request: {}, html_url: issue.url, state: "open" },
            { ...issue, html_url: issue.url, state: "open" },
        ], [{ ...issue, number: 9, html_url: issue.url.replace("/7", "/9"), state: "open" }]]);
        return JSON.stringify(issue);
    });
    assert.equal((await io.select(0, "workflow:ready")).number, issue.number);
    assert.equal((await io.select(0, "workflow:ready", [7])).number, 9);
    assert.equal(await io.select(0, "workflow:ready", [7, 9]), null);
    assert.deepEqual(await io.select(7, "workflow:ready"), issue);
    assert.equal(await io.head("feature/issue-7"), sha);
    await io.ancestor(sha, sha);
    await io.design(sha, "docs/design/issue-7.md");
    assert.deepEqual(calls[0], ["gh", [
        "api", "--paginate", "--slurp",
        "repos/{owner}/{repo}/issues?state=open&labels=workflow%3Aready&sort=created&direction=asc&per_page=100",
    ]]);
    assert.deepEqual(calls.filter(([program]) => program === "git").map(([, args]) => args[0]), [
        "fetch", "rev-parse", "merge-base", "show",
    ]);
});

test("step 9 drains the queue and stacks each feature on its predecessor with issue-scoped contexts", async () => {
    const f = queueFixture();
    const result = await f.run();
    assert.equal(result.status, "done");
    assert.deepEqual(result.stack.map((entry) => [entry.issueNumber, entry.baseBranch]), [
        [7, "main"], [9, "feature/issue-7"],
    ]);
    assert.equal(result.stackAfter, 10);
    assert.ok(f.calls.indexOf("finish:7") < f.calls.lastIndexOf("1:design:Architect"));
    assert.ok(f.calls.includes("finish:9"));
    assert.equal(new Set(f.scopedCalls).size, f.scopedCalls.length);
    assert.ok(f.scopedCalls.includes("issue-9:1:local:Test"));
    const design = f.prompts.find((entry) => entry.identity.parent.number === 9 && entry.label === "1:design:Architect");
    assert.match(design.prompt, /from feature\/issue-7 at a{40}/);
    const pr = f.prompts.find((entry) => entry.identity.parent.number === 9 && entry.label === "1:pr:Architect");
    assert.match(pr.prompt, /into feature\/issue-7/);
    assert.match(f.bodies.get(8), /1 of 2/);
    assert.match(f.bodies.get(10), /2 of 2/);
    assert.match(f.bodies.get(10), /Depends on https:\/\/github\.com\/example\/app\/pull\/8/);
    assert.ok(f.bodies.get(8).indexOf("| 1 |") < f.bodies.get(8).indexOf("| 2 |"));
    assert.match(f.bodies.get(8), /Ready for human approval/);
});

test("an explicit starting issue is followed by the remaining ready queue", async () => {
    const f = queueFixture(undefined, { issueNumber: 7 });
    assert.equal((await f.run()).stack.length, 2);
    assert.deepEqual(f.calls.filter((call) => call.startsWith("select:")), ["select:7", "select:0", "select:0"]);
});

test("queue intake rescans for issues that become ready while the previous feature is being delivered", async () => {
    const f = queueFixture();
    const later = f.queue.pop();
    const finish = f.io.finish;
    f.io.finish = async (number) => {
        await finish(number);
        if (number === 7) f.queue.push(later);
    };
    const result = await f.run();
    assert.equal(result.status, "done");
    assert.deepEqual(result.stack.map((entry) => entry.issueNumber), [7, 9]);
});

test("a blocked feature stops the stack before later issues and returns a recovery tip", async () => {
    const f = queueFixture((identity, label) => identity.parent.number === 9 && label === "1:deploy-1:DevOps"
        ? makeReport({
            sha: "b".repeat(40), status: "blocked",
            findings: [{ ...finding, requirementId: "DELIVERY", owner: "DevOps" }],
        }) : undefined);
    f.queue.push({ ...issue, number: 11 });
    const result = await f.run();
    assert.equal(result.status, "blocked");
    assert.equal(result.stack.length, 1);
    assert.equal(result.stackAfter, 8);
    assert.ok(!f.scopedCalls.some((label) => label.startsWith("issue-11:")));
    assert.ok(!f.calls.includes("finish:9"));
});

test("a pending review is visible in the stack but cannot be used as an accepted continuation tip", async () => {
    const f = queueFixture(undefined, { reviewPolls: 1 });
    const review = f.io.review;
    f.io.review = async (repo, number, commit) => number === 10 ? null : review(repo, number, commit);
    assert.equal((await f.run()).status, "blocked");
    assert.match(f.bodies.get(10), /Automated review\/repair pending/);
    const next = queueFixture(undefined, { stackAfter: 10 });
    for (const [number, body] of f.bodies) next.bodies.set(number, body);
    await assert.rejects(next.run(), /not-ready PR stack metadata/);
    assert.equal(next.scopedCalls.length, 0);
});

test("a fresh invocation can continue a validated stack without rebuilding previous features", async () => {
    const first = queueFixture();
    await first.run();
    const next = queueFixture(undefined, { stackAfter: 10, issueNumber: 11 });
    next.queue.push({ ...issue, number: 11, body: "Show a third greeting.", url: issue.url.replace("/7", "/11") });
    for (const [number, body] of first.bodies) next.bodies.set(number, body);
    const result = await next.run();
    assert.equal(result.status, "done");
    assert.equal(result.stack.length, 3);
    assert.equal(result.stack[2].baseBranch, "feature/issue-9");
    assert.equal(result.stack[2].baseSha, "b".repeat(40));
    assert.ok(next.scopedCalls.every((label) => label.startsWith("issue-11:")));
    assert.match(next.bodies.get(8), /1 of 3/);
});

test("continuation refuses an older stack member rather than silently dropping accepted descendants", async () => {
    const first = queueFixture();
    await first.run();
    const next = queueFixture(undefined, { stackAfter: 8 });
    for (const [number, body] of first.bodies) next.bodies.set(number, body);
    await assert.rejects(next.run(), /latest accepted PR/);
    assert.equal(next.scopedCalls.length, 0);
});

test("continuation refuses inconsistent root metadata and cross-repository PRs", async () => {
    const first = queueFixture();
    await first.run();
    for (const foreign of [false, true]) {
        const next = queueFixture(undefined, { stackAfter: 10 });
        for (const [number, body] of first.bodies) next.bodies.set(number, body);
        if (foreign) {
            const pull = next.io.pull;
            next.io.pull = async (number) => ({ ...await pull(number), isCrossRepository: true });
        } else {
            next.bodies.set(10, next.bodies.get(10).replace('"root":8', '"root":10'));
        }
        await assert.rejects(next.run(), foreign ? /restack and revalidate/ : /Inconsistent PR stack ancestry/);
        assert.equal(next.scopedCalls.length, 0);
    }
});

test("changed or merged predecessors stop queue progress rather than silently restacking", async () => {
    for (const patch of [{ state: "MERGED" }, { headRefOid: "c".repeat(40) }, { baseRefName: "another-base" }]) {
        const f = queueFixture();
        const pull = f.io.pull;
        f.io.pull = async (number) => ({
            ...await pull(number), ...(number === 8 && f.calls.includes("finish:7") ? patch : {}),
        });
        await assert.rejects(f.run(), /restack and revalidate/);
        assert.ok(!f.scopedCalls.some((label) => label.startsWith("issue-9:")));
    }
});

test("a moving immediate base fails the child's local-test gate before deploying it", async () => {
    const f = queueFixture();
    const head = f.io.head;
    f.io.head = async (branch) => branch === "feature/issue-7" && f.scopedCalls.includes("issue-9:1:local:Test")
        ? "c".repeat(40) : head(branch);
    const result = await f.run();
    assert.equal(result.status, "blocked");
    assert.ok(!f.scopedCalls.includes("issue-9:1:deploy-1:DevOps"));
});

test("stack description updates are idempotent and preserve human text; malformed blocks fail explicitly", async () => {
    const f = queueFixture();
    const { stack } = await f.run();
    const body = renderStack("Human rationale\n", stack, 1);
    assert.equal(renderStack(body, stack, 1), body);
    assert.match(body, /^Human rationale/);
    assert.throws(() => renderStack("<!-- issue-driven-delivery:stack:start -->", stack, 0), /Malformed/);
    assert.throws(() => renderStack(`${body}\n${body}`, stack, 0), /duplicate/);
    const cycle = queueFixture(undefined, { stackAfter: 10 });
    for (const [number, text] of f.bodies) cycle.bodies.set(number, text);
    cycle.bodies.set(10, cycle.bodies.get(10).replace('"previous":8', '"previous":10'));
    await assert.rejects(cycle.run(), /Cycle/);
});

test("a failed final stack publication never dequeues the feature and can replay its saved selection", async () => {
    const f = fixture();
    const publish = f.io.publishStack;
    let failed = false;
    f.io.publishStack = async (stack) => {
        await publish(stack);
        if (!failed && stack.at(-1).status === "ready") { failed = true; throw new Error("Publish failed"); }
    };
    await assert.rejects(f.run(), /Publish failed/);
    assert.ok(!f.calls.includes("finish"));
    assert.equal((await f.run()).status, "done");
    assert.equal(f.calls.filter((call) => call === "finish").length, 1);
});

test("GitHub adapter writes stack descriptions through stdin and refuses changed PRs", async () => {
    const f = queueFixture();
    const { stack } = await f.run();
    const writes = [];
    let changed = false;
    const io = githubIO(async (program, args, input) => {
        if (args[1] === "view") {
            const entry = stack.find((item) => item.pullRequestNumber === Number(args[2]));
            return JSON.stringify({ body: "Human notes", headRefOid: changed ? "e".repeat(40) : entry.sha, baseRefName: entry.baseBranch, state: "OPEN" });
        }
        writes.push({ args, input });
        return "";
    });
    await io.publishStack(stack);
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[1].args.slice(-2), ["--body-file", "-"]);
    assert.match(writes[1].input, /Human notes/);
    assert.match(writes[1].input, /2 of 2/);
    changed = true;
    await assert.rejects(io.publishStack(stack), /Stack changed while publishing/);
    assert.equal(writes.length, 2);
});

test("the command runner streams large PR descriptions through stdin and propagates process failures", async () => {
    const run = command(process.cwd());
    const body = "review-order\n".repeat(4_000);
    const output = await run(process.execPath, ["-e",
        "let text='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>text+=chunk);process.stdin.on('end',()=>process.stdout.write(text));",
    ], body);
    assert.equal(output, body.trim());
    await assert.rejects(run(process.execPath, ["-e", "process.exit(2)"], body));
});
