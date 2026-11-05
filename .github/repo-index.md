# Repository index

## Areas and boundaries

- `src/extension.mjs`: Copilot canvas registration, lazy-loads `server.mjs`.
  Root `extension.mjs` is the manually installed discovery entry point.
  `plugin.json` declares the Agent Plugins 1.0 package; the
  `com.github.copilot/extensions/dynamic-workflow-studio/` wrapper and descriptor
  register the same canvas in plugin installations, with no copied runtime or
  automatically installed/run delivery workflow. Plugin and npm versions agree.
  `.github/plugin/marketplace.json` lists the root package in the
  `dynamic-workflow-studio` marketplace; README uses marketplace installation.
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
  production dependencies and project/global registration. Includes plugin
  discovery files and `manual.md` in detached distributions.
- `scripts/build.mjs`: copies distribution into `dist/dynamic-workflow-studio`.
- `test/`: Node regression tests and Playwright `studio.spec.mjs`.
  `plugin.test.mjs` loads the detached plugin with an SDK registration stub and
  verifies actual server/snapshot/close behavior without source-checkout imports.
- `example-workflows/`: standalone examples installed into other repositories,
  never workflows used by Studio. `issue-driven-delivery/extension.mjs` registers
  `deliveryWorkflow` from adjacent `workflow.mjs`. The lightweight runtime reuses
  Collaboragent's optimized orchestration with project-neutral guidance,
  canonical release source and existing target verification/build tooling.
  One explicit `{repository,issue,base?,delivery?}` invocation delivers one issue:
  combined proposal/plan -> one proposal review -> implementation/tests ->
  release/verification -> one final code review -> combined commit/push/PR
  verification. `delivery` is `pr` by default, `local` for no publication, or
  explicit `merge` for reviewed-head merge and verified issue closure.
  Dependency-ready specialists are optional; small changes use one owner.
  CRUD paths are guidance, ordinary repairs return to implementation, and only
  scope/architecture/risk findings return to design. No receipt/fingerprint
  protocol, requirement matrices, mandatory deployment, fixed role fan-out,
  ready queue, hosted-review polling, native-stack adapter or runtime
  subprocesses. Existing native permissions remain the effect authority.
  Journal keys are `issue-driven-delivery-v5`; old queue/stack inputs/journals
  are incompatible. `install.mjs` still copies exactly two runtime modules,
  never starts work and preserves different existing installations.
  Colocated Node tests cover orchestration, installer and optional permission
  preview; they are outside Studio's root checks/distribution.
  `PERMISSIONS.md`, profiles and `review-permissions.mjs` are optional,
  proposal-only native tool/path/URL previews, not runtime approval gates.
  `test-harness/` is a separate private lab fixture with existing scoped reset,
  asset accounting and cleanup controls. Setup retains A/B/C fixtures but
  generates the single-issue contract selecting A; the launcher accepts
  `completed`, not old queue `done`. Application agents, not the generic
  runtime, own required external-asset inventory/cleanup. Its Node wrapper
  invokes PowerShell offline lifecycle checks.

## Navigation and checks

Start with `README.md` for the plugin-first four-step quickstart. `manual.md`
owns installation/update variations, workflow inputs/recovery, standalone browser
mode and development. `docs/studio.md` owns UI/observation semantics.
Runtime source has no fleet-controller dependencies. Keep distribution paths in
`scripts/install.mjs` aligned with runtime additions, plugin discovery and npm
`files`. The marketplace points at the repository root; the native
canvas is CLI-specific, not a portable MCP server. Avoid duplicate manual/plugin
registrations. `scripts/check.mjs` checks the plugin wrapper as well as root code.
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

2026-11-05: reviewed from `2ce1fa5` plus the lightweight example changes for
plugin-first onboarding, release 0.2.0 and main integration. Added root
`plugin.json`, `.github/plugin/marketplace.json`,
`com.github.copilot/extensions/dynamic-workflow-studio/extension.mjs`
and `copilot-extension.json`, `manual.md` and `test/plugin.test.mjs`.
README now holds only the three-sentence Install overview, four-step quickstart
and reference links. Manual preserves installation/launch/development variations.
Updated distribution/npm manifests, syntax checks and UI-guide navigation;
no new npm dependencies, workflow auto-registration or Studio control-plane change.
The existing integration branch is a descendant of main and can be integrated
without rewriting history; actual branch/delivery state is verified at push time.

2026-11-05: reviewed from `2ce1fa5` for replacement of the issue-driven delivery
example with Collaboragent's lightweight workflow. Updated runtime, offline
tests, example/catalog/permission guides and dependent lab input/result handoff.
No paths added/deleted, npm dependencies, Studio runtime/distribution changes or
installation. The existing two-module installer and optional proposal helper
remain separate from delivery. Earlier queue/stack/UI/UX/runtime-ownership
descriptions below are historical and superseded by this single-issue v5 flow.

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

2026-10-30: reviewed from `7ad567b` for cycle-05 native follow-up. Writer prompts
require separate successful worktree creation before cwd/read operations and
fail-fast Set-Location plus exact Git toplevel verification. Native evidence
identified path checks against a not-yet-created worktree, distinct from tool
matching. Added only named Write-Output for observed console/hash evidence;
no interpreter, Git-family or directory expansion. Existing colocated tests
cover the updated prompt/proposal contract; no paths or dependencies changed.
Cycle 05 then published its design and verified scoped teardown, but its plan
used Windows separators and failed existing exact-path validation. Plan schema
descriptions/prompts now distinguish forward-slash Git ownership identifiers
from native Windows filesystem paths; validation/ownership guards are unchanged.
Cycle 06 confirmed those native operations/path identifiers, then blocked on
Where-Object plus an unnecessary Architect inventory Add-Member update. Named
Where-Object now supports inspection filtering. Common rules/cleanup docs make
the existing prospective Git scope explicit: no per-commit external-ledger
rewrite or ad hoc temporary evidence files. Exact evidence grants and actual
external-asset accounting remain unchanged; no Add-Member grant was added.
Atomic external-ledger updates have one explicit staging-file grant:
ownership.pending.json. Bootstrap hands off ownershipPendingPath; cleanup fails
closed while pending publication exists. The existing offline accounting test
covers pending refusal and clean continuation; no new paths/dependencies.

2026-10-30: reviewed from `7743cab` for cycle-07 command/registry follow-up.
Native literal and fixed-prefix Python/Node mode experiments failed without
whole-interpreter access; those requests remain rejected. Only the proven exact
npm --version form is admitted. Added named ForEach-Object/Out-Null requests and
three explicit official Docker metadata origins. Common prompts distinguish
genuine approved project test entrypoints from bypass wrappers and prefer
cwd-first Terraform/npm plus docker version. Colocated permission/prompt tests
cover the changes; no paths, dependencies, installer payload or cleanup guards
changed.

2026-10-30: reviewed from `8b13bc2` after cycle 08 and an isolated native fixture.
PERMISSIONS.md records that Windows 1.0.105 collapses Docker/Terraform/Azure
metadata commands to whole-client identifiers and misclassifies npm registry
HTTPS arguments as paths even when separated/quoted. Those narrow proposals
are not unattended-delivery-ready. Common rules require an actionable native
capability blocker, not whole-client/UNC/interpreter expansion. Genuine npm
test/run checks did execute. Existing prompt tests cover the stop contract;
no paths, dependencies, profile grants or cleanup guards changed.

2026-10-31: reviewed from `f73f83e` for local/live-system lab delivery.
Optional `executionMode:"local"` selects existing authenticated local tooling;
`acceptanceMode:"live-system"` removes application-fingerprint requirements
from evaluation reports and fingerprint-only repair loops, with v4 journal keys.
Default candidate-mode behavior and Git/PR/native-stack identities remain.
The lab harness generates these options and permits one-container logical
components without mandatory Terraform/frontend frameworks. Its applied cycle
now emits `run-record.json` with issue/native identities, actual outcomes and
errors, without claiming intervention-free execution from an exit code.
Colocated tests cover live success, real failures and durable blocked records
(28 inner PowerShell checks). Optional harness `-RetainSuccessfulApplication`
keeps a delivered app for live assessment and records cleanup as deferred;
failures and default runs retain existing guarded teardown.
No added/deleted repository paths, dependencies,
installer payload, native permission expansion or new readiness phase.

2026-10-31: assisted baseline launch from `35bb448` adds optional harness
`-Interactive` using native `copilot -i` and the same reviewed permissions.
After the operator exits, `observe-runs.mjs` can return the canonical result
for exactly one issue-driven delivery in its owning session via the existing
read-only Studio store. No Studio/runtime payload or unattended behavior changes.

2026-10-31: interactive launch correction from `c988d23` explicitly enables
the SDK experimental host. The existing fresh-process fixture now checks that
argument with the unchanged reviewed permissions. Documentation requires a real
console: native metadata inspection there registered the canonical two-module
workflow without authoring or execution, while earlier prompt-mode checks were
empty. No added/deleted repository paths, runtime payload or permission changes.
