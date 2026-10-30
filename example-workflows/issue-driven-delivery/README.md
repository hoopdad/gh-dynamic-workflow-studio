# Issue-driven delivery

A runnable, opt-in [Copilot Dynamic Workflow](https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/dynamic-workflows).
This is JavaScript using `defineWorkflow`, not a GitHub Actions YAML workflow.
This folder is a self-contained package for installation into **another
repository**, not a workflow used by this Studio repository. No Studio source,
root package, npm dependencies or root test/check configuration is needed.

The example preserves the requested flow, **including concurrent pushes to one
feature branch and deployment before PR review**. Those are deliberate risks,
not recommendations. Creating these files does not install or run the workflow.

## Flow

1. Select the oldest open issue labeled `workflow:ready`, or an explicit starting
   issue number. Work on one parent at a time, then scan again at step 9.
2. Architect creates `feature/issue-N` in the target application repository and commits a
   design there. On repair rounds, Architect updates that design on the same
   branch. The first feature starts from the default branch; later features start
   from the preceding feature's tested branch/SHA. Requirements get stable IDs
   quoting that parent issue verbatim.
3. Architect enumerates every affected tier, folder, existing/new file, shared
   contract and dependency. Each file has exactly one owner, including manifests,
   lockfiles, generated files, test fixtures and delivery scripts. The design
   document belongs to Architect. Missing tiers get explicit no-work assignments.
   Architect also decides whether the issue needs a **UI/UX Designer**, with an
   explicit reason for selecting or skipping it.
4. Web, API, Infrastructure, Agent, Test and DevOps run concurrently in separate
   contexts and isolated worktrees. Every active writer commits and pushes its
   own work to the **same remote feature branch**. No shared checkout/index.
   - If selected, **UI/UX Designer runs first**, receiving Architect's plan,
     requirement IDs, narrow task and exclusively owned design artifact paths.
     The designer commits/pushes the design; the workflow verifies its inclusion
     and nonempty artifacts before launching any implementation writer.
     Web starts from that published revision and treats the UI/UX design as
     **authoritative**, not optional inspiration. Conflicts with issue scope,
     architecture contracts or existing policies block for Architect replanning,
     never silent redesign. Designer failures enter the same scoped repair loop;
     once selected, design stays enabled through repair rounds.
   - If skipped, no designer agent or design phase runs. The six-writer fan-out
     and concurrency limit are unchanged.
   - Test writes requirement-traceable local tests, local/deployed E2E and
     post-deployment smoke tests.
   - DevOps writes scan, lint, formatting-check, CI/deploy/rollback orchestration
     using the project's existing GitHub Actions or local tooling preference.
5. After the parallel barrier, Test executes all local tests. Demonstrated
   requirement failures and runtime errors on required flows become repair issues
   identifying the requirement, tier owner, expected/actual behavior and evidence.
6. DevOps runs static scans/lint/format checks, deploys the tested revision,
   waits for CI/deployment completion, and runs Test's smoke tests. Deployment
   retries are bounded. Any committed fix goes back through design/local tests.
   A blocked deployment creates an operational issue for later Architect pickup.
7. Test independently runs requirement-based E2E against the deployed target.
   Failures become scoped repair issues, not invented acceptance criteria.
8. Architect replans outstanding work and repeats steps 2-7. When application
   repair issues are resolved, Architect creates/reuses a PR. The workflow
   targets the preceding feature branch (or the default branch for the bottom
   PR), registers/extends its **native GitHub stack** once two PRs exist,
   publishes its stack position and dependency order, then requests GitHub
   Copilot review and waits for a **submitted review of the
   exact tested SHA**. Architect reads and dispositions all comments; actionable
   findings return through the same design/build/test/deploy loop.
9. When local tests, deployment/smoke, deployed E2E and assessed Copilot review
   pass at an unchanged candidate with no scoped repair issues, mark this
   feature ready for human approval. Update the ordered stack table in every
   PR, remove this issue's ready-queue label, and **return to step 1 for the next
   issue**. Its branch and PR base are the preceding feature branch. Continue
   until the ready queue is empty; a blocked feature stops further intake.
   `done` means the queue is empty, not that PRs were approved or merged. PRs and
   parent issues remain open for the normal human review/merge/closure process.

## Stacked PR review and approval order

The workflow uses [GitHub stacked pull requests](https://docs.github.com/en/pull-requests/how-tos/stacked-pull-requests),
not just a branch chain with a Markdown table. It registers stacks through the
documented [stacked pull requests REST API](https://docs.github.com/en/rest/pulls/stacks),
using authenticated `gh api` and API version `2026-03-10`. No third-party service
or additional CLI extension is required; this is the native stack feature also
managed by `gh stack`.

```text
main <- feature/issue-7 <- feature/issue-9 <- feature/issue-11
         first PR          second PR         third PR
```

Each feature PR therefore shows its incremental changes relative to the feature
below it. With only one PR, there is no native stack yet. When the second PR is
opened, the workflow creates the native stack with PR numbers ordered bottom-up;
later PRs are appended to that same stack. Before writing delivery metadata, it
reads membership back and verifies the trunk, order, open state, branch names
and tested SHAs. Replays reuse existing membership rather than creating duplicate
stacks. Missing API support/access, conflicting membership or unexpected stack
changes fail explicitly; there is no branch-chain-only fallback.

GitHub provides native stack navigation and stack-aware rules/CI. Every PR
description additionally contains a workflow-managed **delivery** block with:

- The full bottom-up approval/merge order, PR/issue links, base branch and position.
- Its immediate predecessor, and whether its automated delivery gates are
  complete or Copilot review/repair is still pending.
- Machine-readable stack metadata used to validate an explicit continuation.

The block is first published when the PR is opened, before requesting Copilot
review, and marked ready only after that feature's gates pass. Existing human
PR text outside the managed block is preserved. A pending PR is not an accepted
stack tip and cannot admit the next feature.

**Review and approve bottom-up; merge bottom-up as well.** The delivery table's
human approval order is guidance, not an additional approval lock; GitHub's
native stack rules and required checks still apply. The workflow never approves
or merges PRs and never bypasses branch protection. It does not wait for human
approval before taking the next issue. If a predecessor changes, is merged,
closed or retargeted while work is running, the workflow stops rather than
initiating a restack or reusing stale evidence. Dissolved or changed native
membership also stops intake.

Human merge/release ownership includes GitHub's native cascading rebases and
rerunning affected checks/reviews after base or SHA changes. Automatic native
rebasing does not validate this workflow's deployment/test evidence. This
example never initiates a cascading rebase and is not a merge queue.
Keep the queue curated: processing until
empty can accumulate a large unmerged review backlog.

### Architect-to-UI/UX-to-Web contract

The structured Architect plan always includes `uiUx`:

```json
{
  "enabled": true,
  "reason": "The issue needs a new user interaction",
  "task": "Design the issue's required screens and interaction states",
  "files": ["docs/design/issue-123-ui-ux.md"],
  "requirementIds": ["R1"]
}
```

For a skipped step, use `enabled: false`, a nonempty `reason`, `task: ""`,
`files: []` and `requirementIds: []`. There is no workflow input toggle:
Architect decides from each issue. Enabled design requires active Web work,
existing requirement IDs and exact artifact paths disjoint from Architect and
all six implementation owners. UI/UX Designer owns only those artifacts, not
Web implementation files, and can receive requirement-linked repair findings.
Web and evaluation agents receive the authoritative artifact paths and revision.
The design refines implementation of the quoted issue requirements; it cannot
invent acceptance criteria or override repository policies.

## Install and run

Requires Node.js 24+, Git, authenticated `gh` with native stacked-PR REST API
access on the target GitHub host, and a Copilot CLI version providing
the experimental extension/workflow SDK. The API was checked against the
[SDK workflow guide](https://github.com/github/copilot-sdk/blob/main/nodejs/docs/workflows.md)
and CLI 1.0.105. The SDK import resolves inside Copilot; do not install an
unrelated SDK version with npm.

### AI installation contract

An agent can fulfill a request such as:

> Install issue-driven-delivery from the example-workflows folder in
> hoopdad/gh-dynamic-workflow-studio into my application repository. Install only.

1. **Resolve source:** use the repository and revision requested by the user.
   Read this README and `install.mjs` before executing trusted source code.
   Clone the source or download this example folder; do not install Studio or
   run the source repository's `npm install`. Report the source revision used.
2. **Resolve target:** identify the application's existing Git repository root.
   Ask if ambiguous. Do not use the example's source checkout as the target.
3. **Payload:** the runtime consists of exactly `extension.mjs` and
   `workflow.mjs`. Both are required; neither imports anything from Studio.
   `install.mjs` is a dependency-free installation helper. README and
   `*.test.mjs` are documentation/offline validation, not runtime dependencies.
4. **Install:** execute the helper with an explicit target root. It syntax-checks
   the runtime and copies only those two modules into
   `<target>/.github/extensions/issue-driven-delivery/`. It does not create
   commits, labels, issues, branches, PRs or deployments, run the workflow, edit
   application instructions/configuration, or install dependencies.
5. **Preserve target changes:** identical installations return `unchanged`.
   Different files, extra files or linked destinations are refused. Do not
   overwrite a different installation without inspecting it and obtaining
   approval. There is intentionally no force/replace option.
6. **Verify and report:** the helper returns JSON with `status`, `destination`
   and `files`. Open/reload Copilot in the **target repository** and verify
   `issue-driven-delivery` is registered. If the CLI/SDK is unavailable, report
   that files were installed but registration could not be verified.
   Installation is not permission to start delivery or configure GitHub.

The helper resolves source files relative to itself, so it works from any
working directory and does not depend on a source Git checkout. Example:

```powershell
node "C:\temp\workflow-source\example-workflows\issue-driven-delivery\install.mjs" --target "C:\projects\my-app"
```

### Configure and run only when separately authorized

After installation, launch Copilot in the target application repository. When
the user authorizes delivery, configure its queue there (reuse an existing
`workflow:ready` label rather than recreating it):

```powershell
Set-Location "C:\projects\my-app"
gh label create workflow:ready --description "Approved issue ready for delivery"
gh issue edit 123 --add-label workflow:ready
```

Run **from that target repository**, whose `origin` must be its GitHub repository,
never from the downloaded example/Studio checkout:

```text
copilot workflow run issue-driven-delivery --args '{"deploymentTarget":"approved-preview-environment"}'
```

For PowerShell versions with awkward native JSON quoting, use an input file:

```json
{
  "deploymentTarget": "approved-preview-environment",
  "issueNumber": 123,
  "stackAfter": 0,
  "worktreeRoot": "C:\\delivery-worktrees\\my-app",
  "maxDeploymentAttempts": 3,
  "reviewPolls": 60
}
```

```text
copilot workflow run issue-driven-delivery --args "@delivery-input.json"
```

`deploymentTarget` must name an actual, authorized environment with enough
project configuration to resolve its endpoint and deployment command. It is not
a magic environment provisioner. No production authorization is implied.

| Input | Default | Meaning |
| --- | --- | --- |
| `deploymentTarget` | Required | Explicit authorized deployment environment/target |
| `issueNumber` | `0` | Zero scans the queue; positive selects the first issue, then normal queue intake resumes |
| `stackAfter` | `0` | Zero starts a stack; otherwise continue after this workflow-managed, open, latest accepted PR |
| `readyLabel` | `workflow:ready` | Opt-in queue; removed per feature only after its gates and stack-order publication pass |
| `worktreeRoot` | Application-specific sibling `.delivery-worktrees/<application-name>` | Absolute persistent parent outside the application checkout and OS temporary directory; paths remain isolated per run/issue/role/round |
| `maxRounds` | Uncapped | Only an explicitly supplied positive safe integer caps design/build/test/review repair rounds per issue |
| `maxDeploymentAttempts` | `3` | Deployment/smoke attempts per round |
| `reviewPolls` | `60` | Ten-second waits for a completed current-SHA review |

Deployment/review budgets and an optional explicit round cap are circuit breakers,
not estimated credit/time budgets. Omitting `maxRounds` does not replace it with a
larger arbitrary limit or change cancellation, permissions or runtime controls.
The six-writer concurrency limit is declared in workflow metadata. Set runtime
credit/agent/time limits appropriate to the whole queue and your permission
policy. There is no issue-count cap: intake continues until the ready queue is
empty, a feature blocks, or the runtime stops the run.

### Permissions and recovery

- Run only one delivery workflow per target repository/stack at a time. Queue selection
  and GitHub labels are **not atomic claims or distributed locks**.
- Agents inherit the launching session's permissions. Grant only the Git,
  GitHub, build/test and deployment operations actually needed. Non-interactive
  `copilot workflow run` cannot display permission prompts; configure grants
  before running, or start interactively. Do not grant unrestricted tooling.
- The trusted extension itself invokes checkout-preserving Git fetch/show/ancestry checks
  and `gh` issue/label/review and native stack REST operations directly. These subprocesses are not
  agent permission prompts. Review the extension before trusting/loading it.
  `gh` must already have the required repository access, including creating
  issues/labels, pushing branches, opening PRs, reading/creating/extending native
  stacks and requesting Copilot review.
- Enable Copilot review on GitHub. Missing entitlement/access or a pending review
  is not a pass. Review request uses `gh pr edit --add-reviewer "@copilot"`; the
  submitted REST review must come from `copilot-pull-request-reviewer[bot]` and
  match the candidate commit.
- The authoritative issue title/body is snapshotted for the run. Scope changes
  require a human update to the parent and a new run, not inferred requirements
  from neighboring code or a reviewer's preferences.
  Initial requirement quotes allow CRLF/LF equivalence only; wording, case and
  spacing remain exact. Invalid quotes receive at most two requirements-only
  corrections without republishing the design or changing other plan fields.
  Validated plans and initial scoped issues are journaled for reproducible replay.
  The workflow owns the canonical requirement IDs/quotes; repair output references
  immutable IDs and omits quote text. Unknown requirement references still fail.
  This version provides no legacy-journal migration; use it for fresh runs.
- Repair issues use `delivery:issue-N`, a parent/branch marker and a stable
  stage/requirement/owner/check key. A repeat failure comments on the existing
  open issue. Only a passing rerun of its originating gate closes it. `DELIVERY`
  issues describe operational blockers, not new application requirements.
  Review/wait/budget issues can reach the review gate, but cannot remain open at
  final acceptance. Unrecognized open scoped issues block completion.
- The result explicitly distinguishes `idle`, `blocked` and `done` and includes
  the ordered accepted `stack` plus `stackAfter` (its latest accepted PR number).
  `idle` means no eligible issue/no stack; `done` means the ready queue is empty.
  Neither status grants human approval or proves a merge/release. SDK task
  completion alone is not delivery success. Inspect the returned result.
  Failures/null reports throw; missing evidence never becomes a green default.
- For a returned `blocked` result, fix the reported blocker and start a **new
  invocation** with the blocked `issueNumber` and the returned `stackAfter`
  (zero for a blocked bottom feature). It reuses the feature branch and scoped
  issues without forgetting preceding features. Use the accepted predecessor,
  not the blocked/pending PR itself. Continuation rejects old/non-tip stack
  members, cycles, inconsistent metadata, foreign PRs and moved/merged/retargeted
  parents; resolve these explicitly rather than starting a disconnected stack.
  If a pending child is already registered in the native stack, recovery allows
  only that single trailing child and only for its explicit `issueNumber`.
  An older branch-chain-only stack with two or more PRs must be validated and
  linked natively (for example with the documented `gh stack link`) before
  continuation; a delivery table alone no longer qualifies.
  For interrupted/error runs, prefer the CLI's resume mechanism: per-issue
  journal keys, labels and worktree paths prevent one feature's results from
  being reused for another. Completed issue deliveries are journaled as a unit,
  so replay never republishes an earlier stack prefix over descendants. Remote
  checks and idempotent stack publication still run before dequeueing, and final
  queue completion revalidates the full native stack even on replay.
  Returned blockers are retained; fix them in a new invocation, not by resuming
  the blocked result. Start a new run rather than resuming an older workflow
  definition after upgrading to this native-stack/UI/UX version (journal v3).
- Worktrees live under the persistent `worktreeRoot` (or its documented sibling
  default), separated by run, issue, role and round. Agents remove only their own
  clean worktrees after successful pushes. Retain blocked work for recovery;
  inspect its exact path before targeted cleanup. Never delete the shared root.
- This is a prompt-governed example, not a sandbox or production delivery engine.
  Ownership and requirement references are structurally checked; exact staging,
  commands, test completeness, deployment receipts and comment dispositions
  still depend on agents supplying truthful evidence. Runtime SHA checks cannot
  independently prove what a remote environment runs. Each successful writer's
  reported commit must be an ancestor of the shared remote candidate before tests
  start; this verifies inclusion, not semantic correctness.

## Systems-thinking critique

**Good starting point:** explicit handoffs separate design, implementation,
verification and operations contexts. GitHub Issues retain a durable feedback
loop. Narrow assignments avoid making every LLM read every other agent's logs.
Requirement-linked defects restrain scope creep. Independent post-deploy E2E
checks the integrated system instead of merely counting completed agents.

The optimization target should be **time to an accepted, working requirement**,
not maximum agent utilization or minimum time to an individual commit.

| System effect | Risk in the requested flow | Better production policy |
| --- | --- | --- |
| Shared branch is a coordination bottleneck | Even disjoint files race on push; rebasing can cause repeated rejection. Shared schemas/dependencies can break semantically without a textual conflict. | Keep parallel development, but use per-agent branches and one serialized integrator/publisher. Freeze interface contracts before fan-out. |
| Local optimization shifts work downstream | Every tier can look finished while integration is broken; the Test agent becomes a late bottleneck. | Agree contracts and test cases during design; add cheap contract checks early. Track integration rework, not agent completion counts. |
| More parallelism increases coordination cost | Launching all tiers for tiny changes spends more context and time than it saves. | Activate only affected tiers; use vertical slices where appropriate. This sample skips empty tier assignments but keeps Test/DevOps active. |
| Delayed review increases blast radius | A faulty or unsafe change is deployed before PR review; protected CI may refuse deployment without a PR. | Deploy an approved preview environment first; open a draft PR early when CI requires it; require human/risk approval before production. This literal example instead blocks if existing policy forbids its ordering. |
| Negative feedback can become endless churn | Flaky tests, unavailable infrastructure or repeated review suggestions keep the loop alive. | Distinguish product defects, flaky tests and operational blockers; deduplicate issues, cap retries, escalate with evidence. Never turn a blocked dependency into a pass. |
| Intake can outrun human review | Draining the queue creates stacked, deployed but unmerged features; fixing a lower PR can invalidate descendants. | Curate the ready queue, monitor review backlog and pause intake when needed. Review/approve/merge bottom-up and restack/retest after parent changes. This requested flow has no automatic issue-count cap. |
| Shared model bias can weaken verification | The same Test role writes and later evaluates its own tests; another invocation is not a different principal or a proof of independence. | Keep an independently approved acceptance oracle and deterministic CI receipts; consider a separate evaluator for high-risk changes. |
| Requirement restraint can be over-applied | "Not in the issue" must not excuse violating already-required security, privacy, accessibility or release policies. | Keep application scope fixed while honoring existing policy gates. Escalate ambiguity; do not invent product features or silently waive policy. |
| The PR stack is a handoff, not production acceptance | Copilot comments are not generally a required human approval; no open repair issues or an empty intake queue is not proof of quality. | Keep required CI, human approvals, rollback readiness and release ownership. Distinguish queue `done` from approved/merged/released. |

Start with one well-scoped issue, one environment and explicit acceptance
criteria. Measure accepted lead time, first-pass integration success, escaped
requirement failures, blocked time and credits per accepted issue. Change the
workflow only when those whole-system outcomes improve; do not add agents,
review layers or inferred standards merely to make the process look complete.

## Validate without delivery side effects

For the scoped private Note Assistant integration lifecycle, see
[`test-harness/README.md`](test-harness/README.md). That harness inventories and
bootstraps an explicitly authorized test repository; it never implements the
application, invokes a model, or launches delivery automatically.

From this example folder (no root package or npm installation required):

```text
node --test workflow.test.mjs install.test.mjs
node --check extension.mjs
node --check workflow.mjs
node --check install.mjs
```

Workflow tests use fake agents and GitHub responses: they check orchestration, disjoint
ownership, requirement/evidence guards, parallel failure, repair/review loops,
deployment retries, stale-SHA gates and paginated review/issue handling. They
verify optional designer selection/skipping, authoritative Web handoffs,
artifact ownership/publication and designer repair/failure gates. They
also cover multi-issue queue draining, ordered PR bodies, pending versus
accepted stack tips, continuation, stale parents and publication failure replay,
plus native stack create/append/readback, idempotency, membership drift and
API failure handling.
Installer tests create disposable local Git repositories, verify portability and exact
payload, preserve modified installations, and reject unsafe/ambiguous targets.
Tests do **not** create GitHub issues/branches/PRs, request a real review, or deploy.
