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
  `install.test.mjs`); they are not part of Studio's root test/check commands.

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
UI/UX selection/artifact and native-stack/replay tests remain colocated.
No paths added/deleted; Studio runtime and distribution are unchanged.
Intake ends at an empty queue or blocker, never by merging PRs.
