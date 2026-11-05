# Dynamic Workflow Studio manual

Start with the [four-step quickstart](README.md). This manual covers installation
variations, workflow setup/recovery, standalone browser mode and development.

## Plugin installation and updates

The recommended installation is a global Copilot CLI plugin:

```text
copilot plugin marketplace add hoopdad/gh-dynamic-workflow-studio
copilot plugin install dynamic-workflow-studio@dynamic-workflow-studio
copilot plugin list
```

The repository root is an
[Agent Plugins 1.0](https://docs.github.com/en/copilot/concepts/customizations/plugins)
package. `.github/plugin/marketplace.json` lists that root package in the
`dynamic-workflow-studio` marketplace. `plugin.json` declares its metadata;
`com.github.copilot/extensions/dynamic-workflow-studio/extension.mjs` delegates to
the same `src/extension.mjs` used by the manual installer. All runtime imports
are Node built-ins or the CLI-provided SDK; no npm install or build is needed
for plugin use. The canvas is a Copilot CLI-specific extension, not a portable
MCP server or a promise of canvas support in every plugin-capable client.

The global plugin is available across repositories. Restart Copilot after
installation or updates. It registers Studio only: it does not install a
workflow, grant target-repository access or launch work.

```text
copilot plugin marketplace update dynamic-workflow-studio
copilot plugin update dynamic-workflow-studio@dynamic-workflow-studio
copilot plugin uninstall dynamic-workflow-studio@dynamic-workflow-studio
```

For local development, mount the checkout without a persistent installation:

```powershell
copilot --experimental --plugin-dir "C:\source\gh-dynamic-workflow-studio"
```

Direct `copilot plugin install hoopdad/gh-dynamic-workflow-studio` remains a
compatibility alternative on the tested CLI, but emits a deprecation warning;
use the marketplace commands for normal installation.

Use only one active Studio registration. If migrating from the manual global
or project installer below, retire only that recognized Studio copy before
enabling the plugin; do not remove unrelated extensions. Plugin updates do not
update old manually copied installations. Native managed policy still controls
whether a plugin is allowed/enabled.

## Add and run a workflow

Studio can observe any GitHub-compliant Dynamic Workflow whose recorded runs use
the supported local CLI storage schema; the examples are optional. Studio does
not parse workflow source or manufacture runs for an installed-but-unrun workflow.

In Copilot, the quickstart's installation prompt follows the selected example's
own AI installation contract. For a terminal-only alternative, clone this source
and install the two-module example into a different existing Git repository:

```powershell
git clone https://github.com/hoopdad/gh-dynamic-workflow-studio.git
node .\gh-dynamic-workflow-studio\example-workflows\issue-driven-delivery\install.mjs --target "C:\projects\my-app"
Set-Location C:\projects\my-app
copilot --experimental
```

No Studio npm installation is needed for that helper. Ask Copilot to reload
extensions and verify `issue-driven-delivery` is registered before running it.
Installation alone never authorizes delivery.

For native Copilot workflow tools:

```js
run_dynamic_workflow({
  name: "issue-driven-delivery",
  args: { repository: "OWNER/REPO", issue: 123, base: "main", delivery: "pr" }
});
```

For the CLI, save those four arguments as `delivery-input.json` and run:

```text
copilot workflow run issue-driven-delivery --args "@delivery-input.json"
```

`repository` and a positive `issue` are required; `base` defaults to `main`.
`delivery:"pr"` publishes a verified PR, `"local"` stops after local release
verification/review, and explicit `"merge"` also merges the reviewed head and
verifies issue closure. Use a dedicated issue checkout and the target's existing
release/test/build conventions. PR/local modes never merge or close issues.
The [example guide](https://github.com/hoopdad/gh-dynamic-workflow-studio/blob/main/example-workflows/issue-driven-delivery/README.md)
owns the full lifecycle, inputs and limitations.

The native workflow tool returns a run ID while work continues. Observe that
run with `dynamic_workflows_manage({operation:"inspect-run",runId})`; resume an
unfinished compatible run with `run_dynamic_workflow({resumeFromRunId:runId})`.
Inspect the actual per-issue result: `completed` means verified delivery in the
requested mode; `blocked` retains the reason and any delivered PR URL.
Do not submit a fresh run as a blind retry of unknown partial effects.
The single-issue example's v5 journals/inputs are incompatible with its retired
queue/stack versions.

Open Studio for the same absolute application root while work runs, or later
to inspect retained results. Studio's project selector and run list are
read-only observation, not workflow execution controls.

## Activity and requirements

**Dynamic Workflow Studio** is a local visual workspace for GitHub Copilot CLI
Dynamic Workflows. Follow recorded live team activity and explore historical
runs in one pane, either as a Copilot canvas or in your browser.

Use one **Activity** view for live and past runs. Filter the run list with
**All / Live / Past**, inspect recorded phases, agents, models and exact token
counts, and export snapshots. Select **Outcome & evidence** in the activity
picker to inspect the selected run's retained result or failure details.

**Requirements:** Node.js **24 or newer** (including `node:sqlite`), npm, and a
modern browser. The canvas additionally requires a GitHub Copilot CLI build with
the experimental `createCanvas` extension API; it has been checked with CLI
1.0.105-0. Windows, Linux and macOS use the same Node.js implementation and
installation commands; no Bash, PowerShell, Python or compiler is required.
`node:sqlite` may print an experimental-feature warning.

## Manual installation alternatives

These are alternatives to the plugin, not additional quickstart steps.

Clone this repository and install the exact dependency versions recorded in `npm-shrinkwrap.json`:

```text
git clone https://github.com/hoopdad/gh-dynamic-workflow-studio.git
cd gh-dynamic-workflow-studio
npm ci
```

### Manually installed global canvas

From this checkout:

```text
node bin/dynamic-workflow-studio.mjs install --global --replace
```

This installs a self-contained copy, including production dependencies, into
`~/.copilot/extensions/dynamic-workflow-studio` (`%USERPROFILE%\.copilot\extensions\dynamic-workflow-studio`
on Windows). When `COPILOT_HOME` is set, that directory replaces `~/.copilot`.
The original checkout is not needed by the installed canvas.

`--replace` replaces only recognized Studio installations and retires a
recognized old `workflow-studio` registration **after** the new files and
dependencies are ready. Other extensions are untouched. Without `--replace`,
existing registrations are refused. Re-run the command to update.

Restart Copilot or ask it to **reload extensions**. Installing does not itself
launch the canvas or grant access to another project's files.

### Optional terminal command

```text
npm install --global .
dynamic-workflow-studio --help
```

This adds a terminal command; it is separate from installing the Copilot canvas.
You can then run `dynamic-workflow-studio install --global --replace` instead of
the longer `node` command. The npm registry package is not required: install
directly from this checkout.

### Project-only canvas

Instead of global installation, install into a specific existing repository:

```text
dynamic-workflow-studio install "C:\projects\my-app"
```

On Linux/macOS, substitute a path such as `/home/me/projects/my-app`.
Without the optional terminal command, use the absolute path to this checkout's
`bin/dynamic-workflow-studio.mjs` with `node`. Project installation writes only
`.github/extensions/dynamic-workflow-studio`; no delivery source, instructions,
agents or permissions are changed. You may ignore that directory in the target
repository if the installation is personal. A project registration shadows a
global registration of the same name.

## Launch from another repository or the command line

### Inside GitHub Copilot CLI

Start Copilot in **any repository**, then request:

> Open the Dynamic Workflow Studio canvas for projectRoot
> C:\projects\my-app.

Use the actual absolute project path (`/home/me/projects/my-app` on Linux/macOS).
The canvas ID is `dynamic-workflow-studio`; an explicit `projectRoot` is required.
For another project, open a different canvas instance. The agent-callable
`snapshot` action reports that instance's durable runs.

You can also select **...** beside the project name/path to open the system
directory picker. Choosing a folder reloads the pane with that project's recorded
sessions; canceling keeps the current project. On Linux desktops, this uses
`zenity` (GNOME/GTK) or `kdialog` (KDE); one must be installed. Headless systems can still select a
project through the launch command.

### Standalone browser

After installing the optional terminal command:

```text
cd my-app
dynamic-workflow-studio
```

Or specify a different project:

```text
dynamic-workflow-studio "C:\projects\my-app"
```

Open the printed loopback URL in a browser; **Ctrl+C** stops the server. No browser
is opened automatically, so SSH/headless terminals also work. Alternatively,
from this checkout use `npm start -- "<absolute-project-path>"`, or invoke
`node "<absolute-path-to-checkout>/bin/dynamic-workflow-studio.mjs" "<project-path>"`
from anywhere. Use native path separators for your shell.

The browser and canvas use the same UI and read-only backend. No Copilot SDK is
needed for standalone browser mode. If the project has no workflows or runs,
Studio displays an empty workspace rather than creating or executing anything.

## Boundaries and privacy

Studio reads matching sessions from the current user's `.copilot/session-state` (or `COPILOT_HOME`)
using a **read-only, experimental schema-v1 SQLite adapter**, not an authenticated
attachment to a running workflow. CLI storage changes may require adapter updates.
Only allowlisted usage/outcome fields are projected from session events;
prompts, reasoning, intermediate messages, tool arguments, authentication caches
and workflow journals are not exposed.

The server binds to loopback, uses an unguessable instance URL, rejects unexpected
Host/cross-origin requests, and loads no remote UI assets. Treat its URL and
exported results as private. Completed agents and green graph nodes are **not**
proof of delivery acceptance. See the
[detailed UI and observation guide](docs/studio.md) for all limitations.

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/` | Canvas registration, local HTTP server, read-only store and browser UI |
| `bin/` | Cross-platform terminal entry point |
| `scripts/` | Installation, distribution build and syntax checks |
| `test/` | Unit/integration and Playwright browser tests |
| `docs/studio.md` | Detailed UI and observation semantics |
| `.github/workflows/ci.yml` | Windows/Linux/macOS validation |
| `extension.mjs` | Installed Copilot discovery entry point |
| `plugin.json`, `com.github.copilot/` | Agent Plugins manifest and CLI-native canvas discovery wrapper |
| `manual.md` | Detailed installation, workflow, recovery and development instructions |
| `npm-shrinkwrap.json` | Locked runtime and development dependencies, included in distributions |

## Develop, build and test

```text
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:ui
npm run build
```

On Linux CI, use `npx playwright install --with-deps chromium` to install browser
system libraries as well. The build produces `dist/dynamic-workflow-studio`
without vendoring the development environment. To run that artifact:

```text
npm --prefix dist/dynamic-workflow-studio ci --omit=dev
node dist/dynamic-workflow-studio/bin/dynamic-workflow-studio.mjs "<project-path>"
```

`npm pack` also produces an installable npm archive with the runtime, CLI, installer,
documentation and dependency lock. No transpilation is needed. Development tests
and fleet-controller files are excluded from the runtime distribution.
