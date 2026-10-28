# Dynamic Workflow examples

These are standalone examples for installation into **another repository**, not
workflows used by Dynamic Workflow Studio. Nothing here is automatically
registered, installed or run. Each example keeps its runtime, installer,
documentation and offline tests together; Studio's application, checks and
distribution do not depend on them.

| Workflow | Installation guide | Purpose |
| --- | --- | --- |
| `issue-driven-delivery` | [README](issue-driven-delivery/README.md) | Drain the ready issue queue through Architect, optional authoritative UI/UX design, parallel tiers, tests/deployment and native GitHub stacked PRs |

## Install through an AI agent

Example request:

> Install the issue-driven-delivery workflow from the example-workflows folder
> in hoopdad/gh-dynamic-workflow-studio into my current application repository.
> Install only; do not run it.

The source repository may be any trusted fork/revision containing the example.
The installing agent should:

1. Resolve the requested source repository/revision and read the selected
   example's README and installer before executing its code.
2. Resolve the **target application's Git repository root** separately. If the
   destination is ambiguous, ask; never assume the downloaded source checkout
   is the destination.
3. Follow that example's AI installation contract. Do not copy Studio, install
   this repository's npm package, or modify unrelated target files.
4. Report exactly what was installed and whether registration was verified.
   Installation does not authorize GitHub writes, workflow execution or deployment.
