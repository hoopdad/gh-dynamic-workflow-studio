# Dynamic Workflow Studio

## Install

Dynamic Workflow Studio is a local visual workspace for live and past GitHub Copilot Dynamic Workflows.
Install it once as a global [GitHub Copilot plugin](https://docs.github.com/en/copilot/concepts/customizations/plugins) to use it across repositories.
Studio displays recorded activity and outcomes; it never starts, changes or stops a workflow.

## Quickstart

Requires Node.js 24+, Git, authenticated `gh`, and Copilot CLI with experimental
Dynamic Workflow and canvas support.

### 1. Install the plugin globally

```text
copilot plugin marketplace add hoopdad/gh-dynamic-workflow-studio
copilot plugin install dynamic-workflow-studio@dynamic-workflow-studio
```

Restart any open Copilot sessions. Keep only one active Studio installation.

### 2. Add an example workflow to your application

Open your **application repository**, not this source repository:

```powershell
Set-Location C:\projects\my-app
copilot --experimental
```

Ask Copilot:

> Install the issue-driven-delivery example workflow from
> hoopdad/gh-dynamic-workflow-studio into this repository. Follow its README,
> install only, then reload extensions and verify the workflow is registered.

Any GitHub-compliant Dynamic Workflow can be used, not just
[these examples](https://github.com/hoopdad/gh-dynamic-workflow-studio/tree/main/example-workflows).

### 3. Launch the workflow

In the same Copilot session, substitute your repository and issue:

> Run the registered issue-driven-delivery workflow for repository OWNER/REPO,
> issue 123, base main, delivery pr.

This example implements the selected issue and opens a verified feature PR;
it does not merge by default.

### 4. Open Workflow Studio

While the workflow runs, ask Copilot:

> Open the Dynamic Workflow Studio canvas for projectRoot C:\projects\my-app.

Select the run to follow activity, agents and token usage, or inspect
**Outcome & evidence**. Studio also shows retained past runs.

See [manual.md](manual.md) for installation alternatives, updates, browser mode,
workflow inputs/recovery and development; [the UI guide](docs/studio.md) covers
observation details and limitations.
