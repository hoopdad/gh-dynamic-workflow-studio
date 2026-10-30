# Private Note Assistant integration harness

PowerShell 7.2+, Node 24+ and Git are harness tooling requirements. Operations
using GitHub or Azure require authenticated `gh` or isolated lab Azure CLI access,
respectively. Docker and other delivery prerequisites are workflow-owned project
requirements, not supervisor launch prerequisites. No package installation is needed.
Setup and teardown never build the application or invoke a model.
The lifecycle entry point invokes the installed workflow; workflow agents alone
own application implementation.

Run the offline checks **before** reset or delivery:

```powershell
node --test example-workflows\issue-driven-delivery\workflow.test.mjs example-workflows\issue-driven-delivery\install.test.mjs example-workflows\issue-driven-delivery\review-permissions.test.mjs example-workflows\issue-driven-delivery\test-harness\harness.test.mjs
node --check example-workflows\issue-driven-delivery\extension.mjs
node --check example-workflows\issue-driven-delivery\workflow.mjs
node --check example-workflows\issue-driven-delivery\install.mjs
node --check example-workflows\issue-driven-delivery\review-permissions.mjs
node --check example-workflows\issue-driven-delivery\test-harness\observe-runs.mjs
```

## Private configuration and staged setup

Keep configuration, manifest, state and sanitized receipts outside every checkout
and disposable worktree. Use a unique explicit `testRunId` for a new experiment;
the same ID and manifest are mandatory for setup, delivery ownership and teardown.
Do not renew/reset model allowances by choosing a new ID during recovery.
Protect the evidence directory with the current user's normal private ACLs.
Never put credentials, auth profiles, raw model payloads or Terraform state in Git.

Create a private JSON configuration with these fields (all IDs/paths are explicit,
not inferred from ambient Azure defaults):

```json
{
  "schemaVersion": 1,
  "testRunId": "note-assistant-YYYYMMDD-01",
  "repository": "hoopdad/lab-greeting-agent",
  "repositoryRoot": "C:\\work\\lab-greeting-agent",
  "defaultBranch": "main",
  "sourceRoot": "C:\\work\\gh-dynamic-workflow-studio",
  "sourceRevision": "<full committed revision of that checkout>",
  "labRoot": "C:\\work\\mikeo-lab",
  "worktreeRoot": "C:\\work\\.delivery-worktrees\\lab-greeting-agent",
  "evidenceRoot": "C:\\private\\note-assistant-YYYYMMDD-01",
  "subscriptionId": "<verified West subscription UUID>",
  "tenantId": "<verified lab tenant UUID>",
  "deploymentTarget": "lab-greeting-agent-westus3",
  "supervisorSessionId": "<owning Copilot session UUID>",
  "modelAttemptLimit": 1000,
  "sharedDependencies": [],
  "previous": {
    "azureReconciled": false,
    "processClosureVerified": false,
    "diagnosticsPreserved": false
  }
}
```

The optional environmental diagnostic expects exactly one owner-verified existing
West US 3 resource in `sharedDependencies` for each role:
`foundryAccount`, `foundryProject`, `modelDeployment`, `vnet`,
`appInsights`, `logAnalytics`, `keyVault`, `storage`. An optional `registry` is
also reusable. Each entry has `role`, exact ARM `id`, `type`, `apiVersion`,
`ownerSource` (source path/revision), and `intendedUse`. A missing `id` is allowed
for inventory and ownership-reconciled repository setup; report it as an unmet
diagnostic condition, not a launch gate or a pass. Existing-service reuse remains
a product requirement for workflow agents to resolve, not permission to create
unapproved monitoring/vault resources or recreate shared services.
Repository reset never depends on model/telemetry availability; its
old ownership, state, process and diagnostic gates remain mandatory. Workflow
agents must independently verify current provisioning, endpoint, permissions,
model suitability and subnet delegations; a selected resource ID alone proves
none of these.

Use the existing authorized GitHub identity in a process scoped to this repository;
never print tokens or silently change the desktop's default identity. Azure reads
use only `<labRoot>\.azure-cli` and explicit tenant/subscription checks. If its
session needs authentication, use the owner's `scripts\Connect-LabAzure.ps1`.
No automatic login, credential-cache copying or dynamic extension installation.

```powershell
$harness = 'C:\work\gh-dynamic-workflow-studio\example-workflows\issue-driven-delivery\test-harness'
$run = 'note-assistant-YYYYMMDD-01'
$manifest = "C:\private\$run\manifest.json"
# Default is read-only Inspect. Apply Inventory writes private evidence only.
& "$harness\Setup-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest -ConfigurationPath "C:\private\$run\configuration.json"
& "$harness\Setup-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest -ConfigurationPath "C:\private\$run\configuration.json" -Mode Apply
```

Inventory captures exact old issues/node IDs, PRs, branch SHAs, worktrees,
file hashes, state-file **locations/hashes only**, terminal/active workflow
observations and nonsecret shared configuration. It preserves local workflow
fixes/tests before any removal. It refuses to overwrite an existing baseline.
It never stops another runtime or reads secrets/state content. The read-only
observer uses Studio's existing schema-v1 adapter, not SQL writes or a second
workflow control plane; observation errors fail closed.

Before reset, reconcile every old deployment/state asset through its original
owner and preserve its evidence. Stop any active delivery in its owning Copilot
session, prove owned processes/listeners closed, and record those evidence
references in `previous`. Set `azureReconciled` / `processClosureVerified` only
after those independent checks, never just to bypass a blocker. Unknown ownership,
state-bearing disposable worktrees or dependent PRs/stacks block reset.
Open PR/stack disposition must be explicitly resolved; the harness does not
silently close/merge/restack them.

```powershell
# Inspect each exact plan first; -WhatIf also suppresses mutation.
& "$harness\Setup-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest -Stage Reset
& "$harness\Setup-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest -Stage Reset -Mode Apply
& "$harness\Setup-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest -Stage Bootstrap -Mode Apply
& "$harness\Setup-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest -Stage Issues -Mode Apply
```

Inventory includes ignored diagnostic leaves, not only tracked/untracked files;
preserve their sanitized terminal evidence before reset. State-bearing leaves
must be reconciled through the original deployment owner, never deleted by reset.
Reset uses enumerated leaf removals, normal commits and exact disposable worktree/
branch/issue identities. It never removes a checkout, `.git`, shared parent,
default branch or session root, rewrites history or force-pushes. Bootstrap
contains only README, instructions/index, ignores, nonsecret target/queue inputs
and the installer-copied runtime. Source must match the pinned commit and runtime
hashes. Issues are created A/B/C oldest-first with stable run markers. Reruns reuse
exact matching open issues; changed requirements or duplicate markers fail closed.
It commits/pushes the queue normally; it does not launch delivery.
Partial failures are retained, never silently retried. Re-inspect before rerunning;
identity/HEAD drift requires explicit reconciliation, not an automatic reset.

### Optional read-only environmental diagnostic

`Preflight` is an optional read-only diagnostic, **not a delivery launch gate**:

```powershell
& "$harness\Setup-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest -Stage Preflight
```

Keep its actual findings/errors (or explicitly record that it was not run);
never hide unresolved findings or relabel them as a pass. Present sanitized
findings to workflow agents through the existing project inputs/instructions and
requirements, alongside `.github\deployment-target.json` and the parent issue
context; private receipts alone are not a handoff. Do not rewrite immutable
issued requirements.

The supervisor fixes workflow registration only. Infrastructure, environment and
operator prerequisites—including existing West US 3 monitoring/vault discovery,
VNet readiness, Docker/registry transport and Bastion/strict SSH connectivity—are
the workflow's responsibility under project-declared requirements and normal
authorization. Agents must validate and address them within the original reuse
scope or report a truthful blocker, not assume readiness. This creates no new
generic preflight agent/phase and authorizes no supervisor application implementation.

### Mandatory safety and launch controls

Optional diagnostics do not waive safe-reset ownership/state/process/evidence
gates, installation/source guards or authorization. In a Copilot session scoped
to the target, verify workflow registration and both installed file hashes against
the pinned committed source. Confirm no other delivery is active and preserve
the aggregate model-attempt ceiling/accounting requirements in the project inputs.
The workflow must implement durable reservation before its first inference, not
before workflow launch. Invoke **one** workflow using the current supported CLI
interface:

```powershell
Set-Location C:\work\lab-greeting-agent
copilot workflow run issue-driven-delivery --args "@.github\delivery-input.json" --result-file "C:\private\<run>\workflow-result.json"
```

No `maxRounds` is generated. Preserve normal native permissions; unavailable
permissions are blockers, never a reason to grant unrestricted tooling.
Record `delivery.started`, owning session/run identity and `delivery.stopped`
truthfully in the manifest. Errored/interrupted runs resume only in the owning
session; completed blocked results use the documented continuation path.

## Delivery-owned cleanup protocol

Before or alongside **every** mutation, workflow agents must atomically publish
`delivery.ownershipPath` outside disposable paths:

```json
{
  "schemaVersion": 1,
  "testRunId": "<same run>",
  "assets": [
    {
      "kind": "arm",
      "id": "<exact new app ARM ID>",
      "type": "Microsoft.App/containerApps",
      "ownerRunId": "<same run>",
      "state": "planned"
    }
  ],
  "cleanup": {
    "path": "C:\\private\\<run>\\owner-cleanup.ps1",
    "sha256": "<reviewed script hash>",
    "sourceRevision": "<workflow-delivered commit>"
  }
}
```

`assets` includes planned/created/absent resources, data namespaces, image
artifacts, grants, shared-configuration additions and processes. Kind is `arm`,
`blobNamespace`, `image`, `grant`, `sharedConfiguration` or `process`.
Namespace/image entries additionally bind `parentId` to an inventoried service
and `namespace` to the exact run ID, not a broad prefix. Process entries need
`ownerHandle`, `creationTime`, `closureProcedure` and exact local ports/children;
a historical PID is not ownership. Shared changes require `ownerRoot=labRoot`,
`ownerProcedure` and `baselineHash`; only their original owner may restore them.
No shared root or pre-existing ARM resource can be deleted.

The workflow must implement and publish the owner cleanup procedure, including
partial-creation handling, **before mutating**. This harness does not prebuild
application Terraform, teardown implementation or product tests.
Review its source/hash and exact inspection plan before approving execution.
Its interface is:

```text
owner-cleanup.ps1 -Mode Inspect|Apply|Verify -TestRunId <id> -ManifestPath <path> -InventoryPath <path>
```

Emit JSON only on stdout. `Inspect` returns `plan`, entries exactly
`{id,kind,action}` matching the private inventory (`delete`, or `restore` for
shared configuration). `Apply` executes the correct owner procedures: validate
the exact Terraform destroy plan against only app-owned IDs, apply the same
saved artifact, preserve state/evidence until reconciliation; remove exact
namespace/image/grant entries; close retained owned jobs, not arbitrary PIDs.
`Verify` independently reads actual ARM/data/registry/process state and returns
`assets:[{id,status:"absent"|"restored",evidence}]` plus
`closure:"proven closed"`. Unknown results must stay blocked. A handler report
is evidence to audit, not a sandbox or permission to trust arbitrary code.

After acceptance evidence is saved and owning workflow has stopped:

```powershell
& "$harness\Teardown-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest
& "$harness\Teardown-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest -Mode Apply
```

Repeat with the same manifest safely; absent assets remain absent. Missing
inventory after delivery started, changed cleanup source, unresolved assets,
shared drift or uncertain process closure are blockers, not success.
The receipt survives under `evidenceRoot`; repository, issues, PRs/native stack
and shared logs are preserved. No shared resource group/VNet/Foundry/model/
storage/vault/monitoring/Bastion/VM deletion or name-prefix-only deletion exists.
Compare selected nonsecret shared configuration, not expected new telemetry.
Application acceptance, workflow acceptance and cleanup are separate verdicts.

## Clean lifecycle

A new test follows **setup -> execute -> teardown**, not resume of an earlier
delivery. Use a new run identity/private directory and reconcile the previous
attempt first. A clean repository means bootstrap-only content after the exact
inventoried reset; the repository, `.git` and history remain intact.

```powershell
& "$harness\Invoke-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest -ConfigurationPath "C:\private\$run\configuration.json"
& "$harness\Invoke-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest -ConfigurationPath "C:\private\$run\configuration.json" -Mode Apply
```

Default Inspect only describes the cycle. Apply performs Inventory/Reset/
Bootstrap/Issues, one fresh workflow invocation, and guarded teardown in
`finally`, including after setup or execution failure. An existing unexecuted
setup manifest is allowed; an executed attempt, cycle receipt or unresolved
cycle lock prevents silently starting another invocation. There is no automatic
retry/resume or environment Preflight gate.

The cycle entry point loads the shared PowerShell module once. Nested setup and
teardown scripts reuse it without forced reloads, which would invalidate helper
bindings in later callbacks. Both scripts still support standalone staged use.
Fresh-process regressions exercise the real stage scripts with external commands
mocked, including successful execution and cleanup after execution failure.

Run from the existing authorized GitHub-owner context and isolated lab profile.
Native tool authorization must already support the intended execution; the
runner never grants unrestricted permissions or changes trust settings.
Autonomous operation is the goal, not permission to label blocked work successful.

For explicitly reviewed project-specific grants, see the
[permission profile guide](../PERMISSIONS.md). Supply `-PermissionProfilePath`
to both Inspect and Apply:

```powershell
& "$harness\Invoke-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest -PermissionProfilePath "C:\private\$run\permissions.json"
```

Inspect validates the profile and displays permission arguments without launching.
Apply passes them to the actual Copilot child process; without the parameter,
permissions remain unchanged. An invalid profile fails before setup or delivery.
The example is inspection-only, not a full unattended delivery grant. Native
deny rules/policies and the already-executed-cycle guards remain unchanged.

`lifecycle-receipt.json` preserves separate setup, execution and teardown verdicts,
including both errors if execution and cleanup fail. Exit success requires all
three stages to pass; a non-success workflow result is not delivery success.
Teardown is always attempted, not forced past ownership/process/state guards.
Missing ownership after a started workflow remains blocked, even before an
application was deployed. Hard termination/power loss still requires recovery
from the preserved inventory; `finally` cannot run in a killed process.
