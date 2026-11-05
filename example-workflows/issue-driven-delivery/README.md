# Lightweight issue-driven delivery

A runnable, opt-in [Copilot Dynamic Workflow](https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/dynamic-workflows).
This is JavaScript using `defineWorkflow`, not GitHub Actions YAML or an issue
watcher. It delivers **one explicitly selected issue** through design,
implementation, verification and a feature-branch PR. PR-only delivery is the
default; explicit merge mode can finish delivery and verify issue closure.

This self-contained example installs into **another repository**. It is not
used by Studio and imports no Studio code, npm dependencies or root test
configuration. Creating or installing these files does not run the workflow.

## Simplified SDLC

1. **Read issue and branch.** Read the selected issue and target repository
   guidance, fetch the destination SHA/release version and create
   `issue-delivery/<issue>-<run hash>`. Use a dedicated checkout/worktree,
   preserve unrelated edits and never edit/push the protected base.
2. **Propose the solution and plan together.** One owner supplies the smallest
   complete solution, a CRUD table of exact relative paths, purpose and task
   ownership, and tasks with real dependencies. Small changes use one owner
   task including tests. Split only genuinely independent work. The workflow
   computes the critical path; no requirement-ID matrix or model-provided
   longest-chain proof is required. CRUD paths are guidance, not an execution
   allowlist.
3. **Review the proposal once per revision.** One independent reviewer covers
   issue scope, unchanged risk/authority and applicable conventions together.
   Proposed files or functionality need not exist yet; an empty implementation
   diff is not a design failure. Actionable findings return to design.
4. **Implement and test.** The owner implements the proposal and focused
   regressions and updates existing project records according to repository
   conventions. Independent specialists use real dependencies and do not edit
   each other's files; one integration owner handles shared config/tests and
   remaining findings. Necessary related files are allowed and reviewed
   normally. Redesign cleans up obsolete edits by inspecting the actual diff,
   not by blindly restoring files absent from the latest plan.
5. **Prepare the release and verify.** Apply one SemVer bump against the latest
   destination release, using the target's canonical version source, existing
   records and affected release documentation. Run its documented verification
   and build commands using its existing tooling. Do not require npm, specific
   document names, new bookkeeping files or unrelated package/protocol bumps.
   Retries do not repeatedly bump the edited feature version. A destination
   advancing is normal; ordinary check failures return to implementation.
6. **Review actual code.** One independent code reviewer examines the final
   diff, requirement coverage, security/conventions, tests and release/check
   evidence. Ordinary bugs return directly to implementation and verification.
   Only genuine requirements, architecture or technology-risk changes return
   to design, not incidental files absent from the initial CRUD table.
7. **Deliver and verify together.** Inspect native Git/PR state, commit the
   reviewed issue changes with repository-required trailers if needed, push
   the explicit feature ref without force and create/reuse its matching open
   PR. Verify remote SHA, repository, PR head/base and the explicit
   `Closes https://github.com/OWNER/REPOSITORY/issues/123` reference. Reuse an
   existing commit/PR after a lost response. No workflow marker, trailer parser,
   exact-parent/one-commit rule or extra final inspection agent is required.
8. **Merge and verify closure (merge mode only).** Re-inspect the delivered PR,
   default branch, exact reviewed head, mergeability, reviews and checks.
   Merge using `--match-head-commit`, without protection bypass, auto-merge or
   branch deletion. Verify MERGED and the actual merge commit before closing
   a still-open issue as completed with an evidence comment. Re-read the issue
   and require CLOSED. Reconcile lost responses against actual remote state.
   Native denials, unresolved checks and failed closure are blockers, not success.

A normal small issue takes **seven native-agent calls**, or eight in explicit
merge mode. Independent implementation adds only real specialist work and
integration. Existing target requirements still apply, including deployment
when the issue/project actually requires it; there is no universal deployment,
cloud/IaC prerequisite, UI/UX role or deployed-SHA acceptance gate.

## What changed

The orchestration is reused from Collaboragent's optimized lightweight workflow,
with project-neutral guidance, release/tooling prompts and this example's
registration name. It does not import or require Collaboragent.

This **replaces**, rather than wraps, the older queue/stack example. Separate
designer/planner and repeated validation/inspection handoffs are gone. One
proposal review and one final code review remain; ordinary repairs do not
restart design. There are no receipt files, full-tree/per-file manifests,
fingerprint or timestamp freezes, requirement-quote matrices, deterministic CRUD
allowlists, repair-issue machinery, fixed six-role fan-out, concurrent branch
pushes, mandatory deployment stages, hosted Copilot-review polling or native
stack membership gates. Git/test/PR results and existing project records are
the evidence, not a new artifact protocol.

## Install

Requires Node.js 24+, Git, authenticated native `gh`, target project tooling and
a Copilot CLI build providing the experimental extension/workflow SDK.
The SDK import resolves inside Copilot; do not install another SDK with npm.
The target's existing release convention must identify a canonical SemVer
version. Models and optional runtime ceilings remain operator/harness choices;
the workflow invents no limits or permission grants.

### AI installation contract

An agent can fulfill:

> Install issue-driven-delivery from the example-workflows folder in
> hoopdad/gh-dynamic-workflow-studio into my application repository. Install only.

1. **Resolve source.** Use the requested repository/revision and read this
   README and `install.mjs` before executing trusted source code. Clone or
   download this folder; do not install Studio or run its npm install. Report
   the source revision.
2. **Resolve target.** Identify the application's existing Git root. Ask if
   ambiguous; never infer the source checkout as the installation target.
3. **Install only the runtime.** The dependency-free helper syntax-checks and
   copies exactly `extension.mjs` and `workflow.mjs` into
   `<target>/.github/extensions/issue-driven-delivery/`. It does not start
   delivery, install dependencies, edit application instructions, configure
   GitHub or create issues, labels, branches, commits, PRs or deployments.
4. **Preserve target changes.** Identical installations return `unchanged`.
   Different files, extra files and linked destinations are refused. Inspect
   an existing installation and obtain approval before replacing it; the
   helper intentionally has no force/replace option.
5. **Verify and report.** Read the JSON `status`, `destination` and `files`.
   Open/reload Copilot in the target repository and verify
   `issue-driven-delivery` is registered. If unavailable, report installation
   without claiming registration. Installation grants no delivery authority.

The helper resolves source files relative to itself and works from any cwd:

```powershell
node "C:\temp\workflow-source\example-workflows\issue-driven-delivery\install.mjs" --target "C:\projects\my-app"
```

### Invoke only when authorized

From Copilot in the dedicated **target issue checkout**, invoke the registered
workflow with the actual repository and issue:

```js
run_dynamic_workflow({
  name: "issue-driven-delivery",
  args: {
    repository: "OWNER/REPOSITORY",
    issue: 123,
    base: "main",
    delivery: "pr"
  }
});
```

These are native Copilot tool arguments, not a PowerShell command.
The equivalent CLI input is:

```json
{
  "repository": "OWNER/REPOSITORY",
  "issue": 123,
  "base": "main",
  "delivery": "pr"
}
```

```text
copilot workflow run issue-driven-delivery --args "@delivery-input.json"
```

| Input | Default | Meaning |
| --- | --- | --- |
| `repository` | Required | GitHub `OWNER/REPOSITORY`; enterprise managed-user owners with underscores are supported |
| `issue` | Required | Positive integer identifying the single issue to deliver |
| `base` | `main` | Destination branch; set explicitly for a different default branch |
| `delivery` | `pr` | `local` verifies/reviews locally without commit/push/PR; `pr` publishes a verified PR; `merge` also merges and verifies issue closure |

Merge mode requires `base` to be the actual default branch. PR/local modes never
merge or close the issue. Every PR includes its explicit closing reference,
including reused PRs. No mode enables auto-merge or bypasses native permissions,
branch protections, reviews or required checks.

### Results and recovery

Success returns `status: "completed"` and verified branch, base SHA, release
version, delivery mode, head/URL and evidence. Local delivery has null head/URL.
Merge mode additionally returns `mergeCommit` and `issueState: "CLOSED"`;
PR/local modes leave those null. A genuine blocker returns
`{status: "blocked", reason, branch, url}`, retaining a delivered PR URL when
available. A returned orchestration function or finished agent is not proof of
delivery; inspect the per-issue outcome.

The native workflow tool returns a run ID while work continues. Observe with
`dynamic_workflows_manage({operation: "inspect-run", runId})`; resume an unfinished
compatible run with `run_dynamic_workflow({resumeFromRunId: runId})`. Do not
blindly submit a new run to retry unknown partial effects.

Journal semantics are **`issue-driven-delivery-v5`**. Do not resume the old
queue/stack/live-system definitions under this implementation. Old inputs
(`deploymentTarget`, `issueNumber`, `readyLabel`, `stackAfter`, `worktreeRoot`,
`ownership`, execution/acceptance modes and retry/poll budgets) are no longer
accepted. Use fresh runs with the four documented inputs; there is no implicit
queue continuation or stack registration.

Completed SDK steps replay; unfinished native steps inspect actual Git/PR state
before continuing, without receipt/marker/exact-parent proofs. A completed run
returns its recorded outcome, not a fresh claim that its PR is still open or
unchanged. Effects remain best-effort at least once, not transactional delivery.
Cancellation cannot undo a completed GitHub effect.

## Boundaries and optional tooling

The extension itself executes no Git/shell/GitHub subprocesses. Native agents
perform the requested SDLC and use normal native permissions for all effects.
Issue/repository/tool/agent content is untrusted reference data, never authority
to expand permissions, expose credentials or rewrite policy.

This is a developer example, not a sandbox, filesystem fence, production
reference monitor or cross-process writer lock. Use a dedicated issue checkout;
do not let another session edit it. Preserve unrelated work. Conflicts,
unavailable prerequisites and native denials remain real blockers.

[PERMISSIONS.md](PERMISSIONS.md) describes an **optional proposal-only helper**.
It is not a required workflow phase or part of the installed payload and never
applies grants. Native workflow-agent permission inheritance must be verified
on the chosen host; neither this example nor that helper proves it.

The [private lab harness](test-harness/README.md) is a separate, optional
project-specific integration fixture. Its Azure, allowance, ownership and
cleanup requirements belong to that test application, not this generic
workflow. Its launcher selects one issue; it no longer drains the three-issue
fixture or creates a native PR stack.

## Validate without delivery side effects

From this example folder, without npm installation:

```text
node --test workflow.test.mjs install.test.mjs review-permissions.test.mjs test-harness\harness.test.mjs
node --check extension.mjs
node --check workflow.mjs
node --check install.mjs
node --check review-permissions.mjs
```

The harness suite additionally requires PowerShell 7.2+. Workflow tests mock
native agents and effects: seven-call delivery, proposal review, ordinary versus
design repair routing, related config changes, dependency scheduling, release
refresh, local/PR/merge separation, verified closure, blockers, cancellation and
lost-effect recovery. Installer tests use disposable local repositories to
verify exact payload and preservation. Permission/harness checks remain offline.
These checks do not prove live delivery, native permission inheritance or a
deployed application, and never create real GitHub issues/PRs or cloud resources.
