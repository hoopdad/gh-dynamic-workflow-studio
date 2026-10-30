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

## Profile format and review boundaries

Each request needs a reason. Unknown fields and duplicate requests fail.

| Field | Requested native capability | Review requirement |
| --- | --- | --- |
| `tools` | `shell(program subcommand)` or an exact `server(tool)` | Use recorded requests, not guessed catch-all rules. Common shell/interpreter commands, wildcards and whole-tool grants are rejected. |
| `directories` | `--add-dir` for a literal path under an operator-supplied root | This also trusts configuration there, including skills/agents. It is not a read-only grant. Never substitute a home, drive root or shared parent. |
| `writes` | Absolute-file `write(...)` rules resolved from a bound root | Require owned, individually enumerated files. Outside-checkout writes also need a containing directory request. Do not include credentials, immutable baselines, harness receipts or unrelated state. |
| `urls` | Explicit HTTPS origins, or explicit HTTP loopback development endpoints | No wildcard hosts, credentials, query strings or repository-path-shaped URL constraints. An origin is not repository-specific authorization. |

`workspace`, `worktrees` and `evidence` are operator-supplied path bindings, not
strings that a profile can redefine. Path entries use
`{"root":"worktrees","path":"docs\\architecture.md","reason":"Owned design artifact"}`.
Directories may use `"path":"."`; writes must name a file. Traversal, links,
device names and pattern characters are rejected. Bindings must not overlap:
keep worktrees and private evidence outside the checkout and separate from each other.
This intentionally conservative format does not cover every native selector.
Leave unsupported script/interpreter requests unresolved for specific native
review rather than weakening a rule to make validation pass.

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
checks do not prove it. The inspection starter still cannot authorize a complete
Architect stage or guarantee unattended completion.

See [GitHub's CLI usage and approval documentation](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli).
