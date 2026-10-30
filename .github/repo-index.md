# Repository index

## Areas and boundaries

- `src/extension.mjs`: Copilot canvas registration, lazy-loads `server.mjs`.
  Root `extension.mjs` is the installed discovery entry point.
- `src/server.mjs`: tokenized loopback HTTP server shared by canvas and CLI.
- `src/directory-picker.mjs`: native Windows/macOS/Linux folder selection;
  the protected project-pick endpoint atomically swaps session scope.
  The header ellipsis reloads the UI after a successful selection.
- `src/store.mjs` -> `src/usage.mjs`: project-scoped read-only SQLite and
  allowlisted event projection, including session-file realpath boundaries.
  Never controls the workflow runtime or reads workflow source.
- `src/app.mjs`, `observed.mjs`, `index.html`, `style.css`: browser UI,
  unified Activity view, All/Live/Past run-list filters, graph/drawer and
  snapshot exports. Outcome & evidence is the sixth exclusive activity card;
  its selection persists across refreshes and run changes.
- `bin/dynamic-workflow-studio.mjs`: terminal server and installation commands.
- `scripts/install.mjs`: standalone distribution manifest, scoped replacement,
  production dependencies and project/global registration.
- `scripts/build.mjs`: copies distribution into `dist/dynamic-workflow-studio`.
- `test/`: Node regression tests and Playwright `studio.spec.mjs`.
- `example-workflows/`: catalog of standalone workflows to install into other
  repositories, not workflows used by Studio. `issue-driven-delivery/extension.mjs`
  registers the SDK workflow; `workflow.mjs` owns orchestration, GitHub adapter,
  structural ownership/requirement guards and role prompts. Its README covers
  the AI installation contract, concurrent same-branch writers and critique.
  Architect assigns project-required provisioning/deployment implementation to
  DevOps exclusively, including Terraform when required. Technologies and
  prerequisites come from project requirements, not universal workflow gates.
  Architect explicitly selects/skips UI/UX Designer per issue. When enabled,
  its disjoint, published design artifacts gate the six-writer fan-out and are
  authoritative for Web within issue scope, architecture contracts and policy.
  The runner drains ready issues sequentially, scopes journals/worktrees per
  issue, stacks PR bases on accepted predecessor branches and publishes ordered
  approval/merge metadata in PR bodies. `githubIO` registers native GitHub
  stacks via versioned REST create/add/read endpoints through `gh api` once
  two PRs exist; metadata tables supplement, not replace, native membership.
  `stackAfter` validates continuation;
  pending or changed parent PRs cannot silently admit a new feature.
  Its dependency-free `install.mjs` requires an explicit target Git root and
  copies only the two runtime modules; it never runs the workflow or changes
  GitHub. All example tests live alongside it (`workflow.test.mjs`,
  `install.test.mjs`, `review-permissions.test.mjs`); they are not part of
  Studio's root test/check commands.
  `PERMISSIONS.md`, `permissions.example.json` and `review-permissions.mjs`
  provide Copilot-assisted authoring and a dependency-free proposal-only preview
  of explicit tool/path/URL requests. They never apply approvals, change native
  settings or launch delivery; trusted extension subprocesses remain a separate
  boundary. They are not added to the installer payload.

## Navigation and checks

Start with `README.md` for install/launch; `docs/studio.md` covers UI semantics.
Runtime source has no fleet-controller dependencies. Keep distribution paths in
`scripts/install.mjs` aligned with runtime additions and npm `files`.
`npm-shrinkwrap.json` is intentionally distributable; restore with `npm ci`.
Use `npm run check`, `npm test`, `npm run test:ui`, `npm run build`.
CI runs those checks on Windows, Ubuntu and macOS with Node 24.
SDK imports resolve from Copilot at canvas launch, not npm dependencies.
Example workflow SDK imports likewise resolve inside Copilot; import only its
SDK-independent `workflow.mjs` in Node tests. Run example tests/checks separately
using that example's README; there are no dependencies on the root package.
There are no production npm dependencies. Workflow selection comes only from
recorded runs, not installed source. The HTTP API exposes project scope,
snapshot/progress reads and discovery refresh; no Design/preview/source APIs.

## Freshness

2026-10-27: reviewed through `504044a` and the activity-picker refinements.
Removed `src/source.mjs`, `test/source.test.mjs` and `test/fixtures/loops.yml`,
source/draft UI and APIs, and Acorn/YAML dependencies. Replaced Observe/History
tabs with Activity; retained outcomes now use the same exclusive picker as
flowchart/progress/agents/inspector/query, without a dropdown narrative. Considered runtime,
distribution manifest, package metadata, docs and regression tests.
No workflow runner or fleet scaffold copied.

2026-10-28: reviewed through `ce38df1` plus the new
`example-workflows/README.md` and the self-contained `issue-driven-delivery/`
package (runtime, installer, README and colocated tests). Removed the temporary
root test addition and restored the root README/check script; no application,
distribution, dependency or Studio control-plane changes. Examples use the
experimental `defineWorkflow` API and must be explicitly installed/registered
in a target repository; Studio remains read-only.
2026-10-28: reviewed through `9937041` plus native-stack/UI/UX changes.
The example keeps the same two-module runtime payload and six-writer limit.
Native stacks require the GitHub stacked-PR REST API (`2026-03-10`), with no
additional npm or CLI extension dependency. Native membership/order/SHA drift
fails closed; explicit recovery may reuse one pending trailing child.
Journal v3 caches completed issue deliveries to avoid replaying earlier
prefixes over native descendants and rechecks the full stack before `done`.
Worktrees use configurable persistent application-external roots. Initial
requirements allow CRLF/LF equivalence only and bounded quote-only corrections;
journaled validated plans retain canonical requirements for ID-only repairs.
Repair rounds have no implicit cap; `maxRounds` is an explicit opt-in limit.
`test-harness/Setup-LabDeliveryTest.ps1` and `Teardown-LabDeliveryTest.ps1`
share explicit run/private-manifest identity and exact inventories.
`Invoke-LabDeliveryTest.ps1` provides the outer fresh setup -> execute -> teardown
cycle; cleanup is attempted in `finally` and each stage retains its own verdict.
It never resumes an earlier delivery or bypasses native safeguards.
Setup separates inventory/reset/bootstrap/three-parent creation; no app build
or automatic workflow launch. Explicit read-only `Preflight` reports deployment
dependencies without gating delivery or independently safe repository setup.
Old ownership/process/state gates still apply to reset.
Environmental prerequisites belong to the workflow, not the supervisor.
Teardown requires a workflow-delivered pinned
owner procedure and exact mutation/readback inventory, preserves shared roots
and fails closed on unknown ownership/closure. `LabDeliveryTest.psm1` owns
scope guards; `observe-runs.mjs` reuses Studio's read-only store, not runtime
control. Offline scope/parser tests use PowerShell 7.2+ via Node's test runner.
UI/UX selection/artifact and native-stack/replay tests remain colocated.
No paths added/deleted; Studio runtime and distribution are unchanged.
Intake ends at an empty queue or blocker, never by merging PRs.

2026-10-30: reviewed from `7dfc027` for the four approved local runtime
adaptations. Updated example runtime, colocated regression tests and README;
no legacy-run migration, delivery-policy or Studio-runtime changes.
Added `test-harness/` lifecycle scripts, shared guards, run observer, README and
offline tests. Run `node --test example-workflows\issue-driven-delivery\test-harness\harness.test.mjs`
alongside the two example suites; root Studio test/check commands are unchanged.
2026-10-30: reviewed from `9af7762` for delivery-only `Preflight`, ignored-leaf
inventory and state-bearing reset refusal. No paths added/deleted; the runtime
payload is unchanged. Sixteen offline harness checks cover stage isolation,
Git worktree-path normalization and the retained ownership/closure gates.

2026-10-30: reviewed from `fb15892` for project-neutral DevOps provisioning/
deployment ownership and optional harness environment diagnostics. No new agent,
readiness phase or schema; existing repair, authorization and acceptance gates
remain in place. No paths added/deleted.

2026-10-30: reviewed from `9fd51bb` for the outer clean lifecycle runner.
Added `test-harness/Invoke-LabDeliveryTest.ps1`; existing setup/teardown scope
guards and the two-module workflow payload are unchanged. Twenty-one offline
harness checks include success and setup/execution/cleanup failure ordering.

2026-10-30: reviewed from `dcebce8` for shared harness module lifetime.
Nested setup/teardown scripts reuse the cycle entry point's loaded module rather
than force-reloading it and invalidating later callback helper bindings.
Twenty-three offline checks now include fresh-process runs of the real stage
scripts for success and execution-failure cleanup. No paths added/deleted;
workflow runtime, native permissions and ownership/cleanup guards are unchanged.

2026-10-30: reviewed from `6ac9593` for bounded permission proposal authoring.
Added `issue-driven-delivery/PERMISSIONS.md`, `permissions.example.json`,
`review-permissions.mjs` and its colocated test. The inspection starter omits
write/push/deploy/cleanup requests; the helper emits argument data only and
rejects broad patterns, overlapping roots, linked/traversing paths and unsafe
origins. Workflow-agent inheritance is not claimed verified. No runtime,
installation, harness-launch or native permission configuration changed.

2026-10-30: reviewed from `39fbf5e` for explicit launcher profile handoff.
`Invoke-LabDeliveryTest.ps1 -PermissionProfilePath` validates a reviewed profile
with manifest-bound roots before setup and forwards its scoped arguments to the
native child, before fixed-arity `-C` and the workflow subcommand. Inspect only
previews; omitting the parameter preserves existing behavior. Fresh-process
stage regressions verify exact child arguments, mutation-free inspection and
invalid-profile rejection before setup. No paths added/deleted, runtime or
installer changes, persistent permission settings or relaxed ownership/replay
guards. Actual workflow-agent permission inheritance remains unverified.

2026-10-30: reviewed from `1a68a4e` for named inspection-command proposals.
The permission preview additionally accepts an explicit list of PowerShell
cmdlets and Unix inspection utilities; whole interpreters and arbitrary leaf
programs remain rejected. Colocated tests cover accepted leaves and mixed-purpose
or interpreter rejection. No paths added/deleted, runtime/installer changes or
active launcher permission changes; the expanded project proposal stays private.

2026-10-30: reviewed from `d45ed06` for explicit execution proposals.
The preview accepts JSON converters, a fixed list of named file-operation commands and `pytest`
only when requested; these are not inspection grants and do not enter the starter.
Tests distinguish shell file operations from exact editor writes and retain
whole-client/interpreter rejection. No paths added/deleted, runtime, installer,
active launcher or native permission changes. The expanded delivery proposal
remains private and unapplied pending operator review.

2026-10-30: reviewed from `d45ed06` plus the pending execution-proposal edits
for an explicitly approved existing transport launcher. The helper verifies an
exact absolute `.ps1` path and reviewed SHA256 without executing it or adding
directory/interpreter access. Tests cover changed/missing/linked/unsupported
scripts. Documentation distinguishes native URL approval from network/RBAC
enforcement and records externally managed RBAC prerequisites with actionable
failure reports, not self-grant/remediation scripts. No paths added/deleted,
workflow/runtime/launcher changes or applied permissions.

2026-10-30: reviewed from `d45ed06` plus pending permission-proposal changes for
final human review. Added `issue-driven-delivery/permissions.delivery-git.proposed.json`,
an unapplied lab-specific draft, separate from the unchanged inspection starter
and two-module installer payload. Optional `writes[].recursive` renders absolute
directory editor selectors for the application subtree; evidence stays exact-file.
This is not shell/container OS confinement and enables no sandbox/native settings.
`githubIO.review` now paginates submitted review bodies and all PR inline comments/
replies, preserving cross-review linkage, and hands untrusted data to Architect
behind the existing current-SHA/bot gate. Missing/unreadable data fails closed.
Report-stage `DELIVERY` interventions stop repair/intake and retain findings/evidence.
Architect/DevOps prompts conditionally require an actual-deployment registration
packet for an existing owner transport; no parallel tunnel, implicit owner-repo
edits or external RBAC remediation. Runtime/tests, permission guide and README
cover these boundaries; mocked real-stage harness checks cover recursive/exact
child grants. No active launcher, target installation, lab or permission changes.

2026-10-30: reviewed from `6d387ff` for cycle-04 native repair. Recursive editor
rules now generate a validated absolute-directory globstar: live Windows 1.0.105
workflow fixtures rejected directory/trailing-separator forms, accepted nested/
top-level and exact evidence writes with the full rendered profile, and denied
a readable-CWD write outside those rules. Named Set-Location supports approved
Git subcommands without git -C's different native allow-match identity.
`LabDeliveryTest.psm1:Publish-LabReferences` snapshots only explicitly selected
owner/harness documents as private non-executable hash-bound reference data.
Bootstrap forwards references and unchanged model allowance lineage.
Optional workflow `ownership:{testRunId,evidenceRoot}` initializes honest
run-bound accounting before agents; post-Develop empty ledgers still block
cleanup, and local Git worktrees are retained separately. Design blockers now
publish actionable Architect DELIVERY findings; unresolved environment facts
route to DevOps, not supervisor provisioning or a new readiness phase.
No paths added/deleted, new dependency or installer payload change. Colocated
example suites include native-pattern, initial-accounting, blocked-design and
reference regressions; the PowerShell wrapper now covers 25 offline checks.
