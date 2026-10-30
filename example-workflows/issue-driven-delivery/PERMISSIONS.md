# Building a bounded permission proposal

Keep authorization project-specific and reviewable. The supplied
`permissions.example.json` is an **initial inspection starter**, not permission
for an entire Architect stage or delivery. Architect also creates a worktree,
commits and publishes a design; those mutations are deliberately not included.
Docker, registries, Terraform, Azure and Bastion/SSH are not universal grants.

`review-permissions.mjs` validates a proposal and prints native argument **data**.
It never executes Copilot, changes settings, grants permissions or starts a
workflow. It needs only Node.js 24+; no SDK, npm installation or service access.
The installer still copies exactly the two workflow runtime modules.

## Review the starter

Run from this example folder in the source checkout. Bind `--workspace` to the
target application checkout, not this source checkout. Supply explicit, narrow
application worktree and current-run evidence scopes:

```powershell
node .\review-permissions.mjs `
  --profile .\permissions.example.json `
  --workspace "C:\projects\my-app" `
  --worktrees "C:\delivery-worktrees\my-app\assigned-scope" `
  --evidence "C:\private\delivery-run-123"
```

These are illustrative paths, not discovered defaults. Prefer the actual assigned
worktree over a shared worktree parent. If the runtime has not assigned its path,
keep it unresolved for review rather than substituting a home/shared directory.
The helper only reads profile/filesystem metadata and prints JSON to stdout.
It does not create missing directories or verify repository origin, credentials,
RBAC, ownership or deployment readiness. Preview output contains machine paths;
keep it private rather than committing it.

The starter proposes named Git inspection and `gh` issue/repository inspection
commands, two GitHub HTTPS origins, and directory access. It requests no file
writes, commits, pushes, PR mutations, provisioning, deployment or cleanup.
An unlisted operation must still prompt or remain blocked.

## Delivery draft for final review

`permissions.delivery-git.proposed.json` is the expanded, **unapplied lab-specific
draft**, not a replacement for the inspection starter or an automatically
installed profile. It includes inspection and execution proposals, recursive
application-worktree editor writes, three named evidence outputs, selected HTTPS
origins and the approved existing lab launcher with its reviewed hash.
Its absolute owner-script path/hash are workstation-specific; other users must
review and replace those against their own approved owner source. Merely keeping
the draft here does not select it in any launcher, approve its requests or run it.

## Profile format and review boundaries

Each request needs a reason. Unknown fields and duplicate requests fail.

| Field | Requested native capability | Review requirement |
| --- | --- | --- |
| `tools` | `shell(program subcommand)`, a supported named command, an exact absolute `.ps1` path with `sha256`, or an exact `server(tool)` | Use recorded requests or explicitly justified project proposals, not catch-all rules. Common shell/interpreter commands, wildcards and whole-client grants are rejected. |
| `directories` | `--add-dir` for a literal path under an operator-supplied root | This also trusts configuration there, including skills/agents. It is not a read-only grant. Never substitute a home, drive root or shared parent. |
| `writes` | Absolute `write(...)` rules for individual files, or directory subtrees with `"recursive":true` | Source can cover the entire bound application tree, not a shared parent. Evidence remains individually enumerated. Outside-checkout writes also need a containing directory request. Never include credentials, immutable baselines, harness receipts or unrelated state. |
| `urls` | Explicit HTTPS origins, or explicit HTTP loopback development endpoints | No wildcard hosts, credentials, query strings or repository-path-shaped URL constraints. An origin is not repository-specific authorization. |

`workspace`, `worktrees` and `evidence` are operator-supplied path bindings, not
strings that a profile can redefine. Path entries use
`{"root":"worktrees","path":"docs\\architecture.md","reason":"Owned design artifact"}`.
Directories may use `"path":"."`; writes name a file unless explicitly recursive. Traversal, links,
device names and pattern characters are rejected. Bindings must not overlap:
keep worktrees and private evidence outside the checkout and separate from each other.
This intentionally conservative format does not cover every native selector.
Leave unsupported script/interpreter requests unresolved for specific native
review rather than replacing them with a general interpreter grant.

An approved existing PowerShell transport launcher can be proposed as
`{"pattern":"shell(C:\\owner\\scripts\\Start-Transport.ps1)","reason":"Approved owner transport","sha256":"<64 hexadecimal characters>"}`.
The helper reads that exact regular, nonlinked file and verifies its hash;
it never executes it, approves a whole interpreter or adds its parent directory.
Native matching/path access and readable dependencies still need verification.
The hash check is at preview time, not an execution-time native hash pin.
Script arguments are not restricted by the selector; retain the launcher's
own target, trust, policy and process-ownership checks.

For recursive source writes, use
`{"root":"worktrees","path":".","recursive":true,"reason":"Application worktree subtree"}`.
The helper renders an **absolute directory followed by the native separator and
`**`** in `write(...)`. Native Windows CLI 1.0.105 tests rejected both bare
directory and trailing-separator rules; directory-bounded globstar rules allowed
nested writes while an unapproved write was denied. The closed
[github/copilot-cli#285](https://github.com/github/copilot-cli/issues/285) alone
was not proof that its proposed trailing-separator form worked.
Future files and generated role/run subdirectories need no filename inventory.
`recursive` must be a boolean; omit it or use `false` for exact-file requests.
Recursive evidence grants are rejected so a whole evidence directory cannot
replace its named output files. This does not relax Architect's exact disjoint
file assignments or allow writers to modify peer worktrees.

These are native editor-tool approval proposals, **not an OS filesystem fence**.
Shell file operations and container daemons have separate capabilities;
`--add-dir` also trusts configuration and default native path access includes
the working directory and temporary files. Actual shell containment needs
separately reviewed native sandbox policy and host verification, not just
`write(...)` rules. Do not assume the sandbox's default user-profile/cache
access satisfies worktree-only writes. Native sandboxing is not enabled here;
built-in edits follow its policy only on a best-effort basis, and a Docker
daemon/cloud API is not confined by an editor path rule. Nested-path matching
and workflow-agent inheritance need live native verification for each supported host/build; a failure
must remain blocked, never fall back to unrestricted writes or interpreters.

Named PowerShell cmdlets such as `shell(Get-ChildItem)`, JSON converters
`shell(ConvertTo-Json)` / `shell(ConvertFrom-Json)`, and Unix utilities such
as `shell(ls)` are supported through an explicit inspection-command list.
`shell(Write-Output)` emits console evidence; it does not grant file redirection.
`shell(Where-Object)` supports data/path filtering; nested operations still need
their own approvals. Neither grants a whole interpreter.
`shell(Out-Null)` discards pipeline output. `shell(ForEach-Object)` is an explicit
execution utility, not a read-only guarantee or permission for nested operations.
The delivery profile's exact `ownership.pending.json` evidence grant supports
atomic external-ledger publication, not directory writes. Bootstrap exposes its
path; unresolved pending publication blocks teardown.
This does not approve `powershell`, `pwsh`, `bash`, `sh` or arbitrary scripts.
There is no universal "every read-only command" rule: plugins and versions vary,
and options/configuration can change side effects. Generic `gh api`, secret/token
dumps, and mixed-purpose utilities such as `find`, `sed`, `awk` and `env` are not
read-only shortcuts. A syntactically valid proposal does not prove that native
matching distinguishes every nested CLI verb; never fall back to a whole-client
grant when a specific selector fails.

Explicit execution proposals can also name file-operation commands:
`Set-Location`, `New-Item`, `Set-Content`, `Add-Content`, `Copy-Item`, `Move-Item`, `Rename-Item`,
`Remove-Item`, `Out-File`, `mkdir`, `touch`, `cp`, `mv`, `rm`, `rmdir` and `tee`,
plus the `pytest` runner. These are **not inspection permissions** and are never
added automatically or included in the starter. Their native rules cannot
constrain file arguments, recursive deletion, test plugins or invoked project
code. Scoped `writes` requests apply to editor tools, not these shell commands.
Keep assigned file ownership, exact cleanup inventories and native controls;
do not use shell writes to work around a denied editor request.
On PowerShell, enter the assigned worktree with `Set-Location -LiteralPath`,
with `-ErrorAction Stop`, then verify the exact Git toplevel and use ordinary
approved Git subcommands. Create a new worktree in a separate completed tool call
before entering/reading it; native path approval can reject references into a
not-yet-created worktree even when its parent is allowed.
Native CLI 1.0.105 classifies
`git -C <path> status` with an allow-match identity of `git -C`, which does not
match the reviewed `git status` grant. Do not solve that by granting whole Git.
Likewise, enter the selected IaC/package directory before `terraform fmt/init`
or `npm install/test`, rather than using leading `-chdir` or `--prefix` forms.
Use the already named `docker version` form, not `docker --version`.

Native Windows CLI 1.0.105 workflow experiments rejected both literal and `:*`
prefix rules for Python version/unittest/compileall/json.tool and Node
version/check/test modes, even in standalone calls. All three arbitrary
Python/Node execution controls also stayed denied. Those mode rules are not
working narrow approvals and remain rejected by this helper; do not substitute
whole-interpreter access. The exact `shell(npm --version)` request did work and
is the only supported flag-form exception. Use genuine, explicitly authorized
project test entrypoints such as `pytest` or `npm test` when appropriate.
Do not create wrappers/package scripts merely to conceal a denied command.
An essential unsupported entrypoint requires specific native review or a
capability blocker, not a fabricated passing check.

For a delivery proposal, review each role separately: writers need only assigned
file operations and Git publication; Test needs the chosen build/test runners;
DevOps needs the chosen IaC, image publication, deployment, rollback and owned
cleanup operations; Architect needs PR publication and complete review reads.
Command-family entries do not enforce role isolation. Terraform, imperative
Azure CLI, kubectl and azd are conditional alternatives, not authority to
introduce competing stacks or mutate the same resources through multiple owners.
Do not guess future app filenames, generated worktree identities or private
endpoints. Bind recursive source access to the application-specific directory;
Architect still assigns exact files within it. Resolve additional exact evidence
outputs and origins from the approved plan and actual metadata. Cleanup script
execution still needs its actual reviewed capability; generic interpreters are
not a substitute. The trusted GitHub adapter now paginates all submitted,
nondismissed review bodies and all PR inline comments/replies, including replies
from other review IDs, and supplies them directly to Architect as untrusted
evidence. The bot/current-SHA completion gate remains unchanged; unreadable or
incomplete data cannot be assessed as a pass. No agent `gh api` grant is needed.

URL entries are Copilot child-process tool approvals, not GitHub repository
network configuration or Azure network/RBAC enforcement. Actual DNS, routing,
firewalls, TLS and service authorization remain authoritative. Do not repair
those prerequisites by changing the lab or granting new privileges.
The delivery draft explicitly names `hub.docker.com`, `auth.docker.io` and
`registry-1.docker.io` for selected public base-image metadata/digest resolution.
These are not wildcard registry or credential-upload approvals. Preserve TLS;
do not print/persist anonymous bearer tokens or host credentials.
Where Azure RBAC is provisioned outside delivery, omit assignment create/delete
requests and assignment/role-definition resources from Terraform/ARM/azd too.
Exercise the normal lab operation rather than adding prerequisite-remediation
scripts. On an access failure, stop with an actionable operator alert: operation,
principal ID, resource scope, native error and correlation/request ID, plus the
specific prerequisite to fix. Do not leak credentials, silently self-grant or
blindly retry authorization failures. Reuse the existing failure/report path;
the workflow files the finding and returns its evidence with `blocked`, stopping
further repair/intake for a `DELIVERY` blocker at any report stage. This does not
add a notification system or claim an alert was sent elsewhere.

Where private lab transport is required, Architect assigns DevOps an
application-side registration/handoff packet, not an owner-repository change
or new transport. DevOps derives the actual deployed resource identity,
private ingress/addresses, exact HTTPS/WSS hosts and start URLs, necessary
API/redirect origins and read-only readiness operation, following the existing
owner's service-extension contract. Use only a registered explicit selection
in the approved launcher. `Start-LabBrowser.ps1` does not yet support Note
Assistant: until the owner registration is completed, return the packet and
specific required action as a blocker. Do not use an unrelated selection,
interactive chooser, new tunnel or guessed endpoint. Owner-source changes also
invalidate the reviewed script hash and require a new review.

**This is a proposal format, not a sandbox or authority.** Named shell commands
can have side effects through arguments, configuration, scripts or helpers.
For example, a Git inspection command is not guaranteed read-only. Native
command rules do not enforce a particular branch, repository, Terraform plan,
cloud resource or script hash. Keep native path/URL checks, deny rules, managed
policies, existing identity/RBAC limits and workflow ownership guards intact.
Filesystem metadata can change after a preview.

## Have Copilot help build the proposal

Copy the starter to a project-owned profile and ask Copilot:

> Read this permission guide, the approved issue/plan, applicable repository
> instructions and the actual denied requests from native diagnostics. Propose
> the smallest profile changes needed for the current task. Give a reason and
> evidence for every request. Keep unknown commands, paths and endpoints
> unresolved; never replace them with wildcards, a shell/interpreter grant or a
> broader directory. Distinguish tool approval from path/URL access and actual
> GitHub/cloud authorization. Do not change permission settings or launch
> anything. Run the preview and explain its capability limits for human review.

Use the native `/diagnose` facility to identify actual denied operations.
The model's proposal is not approval. Review the diff and rendered argument
array yourself, including the underlying extension and any invoked code.
For later writes, publication or deployment, derive additional requests from
the current plan and real project tooling rather than preauthorizing every
possible phase. Changed commands, scripts, targets or ownership need review.

The supplied roots, exact write requests and command families make the proposal
inspectable; they do not prove that its operations are safe. Do not invent
approval records, credentials, resource IDs or ownership evidence to satisfy it.

## Apply a reviewed profile to the lifecycle launcher

The [lifecycle runner](test-harness/README.md#clean-lifecycle) accepts an explicit
`-PermissionProfilePath`. Selecting this option requests the reviewed profile's
native grants for **that child process only**; a profile alone is not approval.
Without the option, the runner's command and permissions are unchanged.

```powershell
& "$harness\Invoke-LabDeliveryTest.ps1" -TestRunId $run -ManifestPath $manifest `
  -PermissionProfilePath "C:\private\$run\permissions.json" -Mode Inspect
```

Inspect validates and displays argument data without granting permissions or
launching Copilot. When the operator separately launches with `-Mode Apply`,
the runner validates the profile before setup and passes its scoped requests
to the actual `copilot ... workflow run` child. Roots come from the validated
manifest, not ambient directories or fields a profile can redefine. Keep the
profile private, review changes before reuse, and do not add unrestricted flags.

The argument list places permission options before fixed-arity `-C` and the
workflow subcommand so variadic tool/URL options cannot consume the command.
Fresh-run, receipt, lock and ownership guards still apply. Selecting a profile
does not authorize replaying an already executed cycle or waive cleanup.

## Native inheritance still needs verification

Any approved requests must apply to the **actual launching Copilot process**.
A chat instruction or session-only approval in another process is not enough.
The preview itself never installs grants or edits configuration. The launcher's
explicit option passes reviewed requests; existing deny rules, managed policy,
identity/RBAC and native path/URL checks remain in force.

The trusted workflow extension also invokes Git and `gh` directly for its
orchestration. Those subprocesses are **outside agent-tool approval prompts**;
this profile neither authorizes nor restricts them. Review the extension before
trusting/loading it and retain the actual GitHub identity's repository limits.

CLI 1.0.105 documents `--allow-tool`, `--allow-url`, `--add-dir` and native
per-request approval prompts (`copilot help permissions` and `copilot --help`).
Non-interactive `workflow run` cannot display those prompts. Offline regressions
verify exact profile arguments at the real runner's mocked child boundary and
reject an invalid profile before setup. Native help parsing has also been checked.
Actual workflow-agent inheritance remains a separate live verification; these
checks do not prove it. A native Windows 1.0.105 workflow fixture additionally
verified the helper-rendered full profile: nested/top-level source edits, exact
evidence write, selected reference read and cwd/Git checks succeeded; an editor
write in readable CWD but outside all write grants was denied. This verifies
those capabilities, not every deployment command, platform or future CLI build.
The inspection starter still cannot authorize a complete
Architect stage or guarantee unattended completion.

See [GitHub's CLI usage and approval documentation](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli).
