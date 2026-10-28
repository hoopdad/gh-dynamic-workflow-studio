# Dynamic Workflow Studio

## 1. Executive summary

**Dynamic Workflow Studio** is a local visual workspace for GitHub Copilot CLI
Dynamic Workflows. Follow recorded live team activity and explore historical
runs in one pane, either as a Copilot canvas or in your browser.

Use one **Activity** view for live and past runs. Filter the run list with
**All / Live / Past**, inspect recorded phases, agents, models and exact token
counts, and export snapshots. Select **Outcome & evidence** in the activity
picker to inspect the selected run's retained result or failure details.

This is the standalone home of the Studio extracted from
`enterprise-copilot-fleet-controller`. It does **not** install the fleet
controller, register delivery workflows, run agents, or start/stop/resume
workflows. It does not inspect or edit workflow source.

**Requirements:** Node.js **24 or newer** (including `node:sqlite`), npm, and a
modern browser. The canvas additionally requires a GitHub Copilot CLI build with
the experimental `createCanvas` extension API; it has been checked with CLI
1.0.105-0. Windows, Linux and macOS use the same Node.js implementation and
installation commands; no Bash, PowerShell, Python or compiler is required.
`node:sqlite` may print an experimental-feature warning.

## 2. Install

Clone this repository and restore its locked dependencies:

```text
git clone https://github.com/hoopdad/gh-dynamic-workflow-studio.git
cd gh-dynamic-workflow-studio
npm ci
```

### Global Copilot canvas (recommended)

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

## 3. Launch from another repository or the command line

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

## Provenance and license

Extracted from `gh-dynamic-workflows/studio` at fleet-controller commit
`d168e7a`, retaining the observation adapters and regression tests.
Licensed under [MIT](LICENSE).
