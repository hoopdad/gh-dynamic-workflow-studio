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
  snapshot exports. Retained outcomes appear independently of list filters.
- `bin/dynamic-workflow-studio.mjs`: terminal server and installation commands.
- `scripts/install.mjs`: standalone distribution manifest, scoped replacement,
  production dependencies and project/global registration.
- `scripts/build.mjs`: copies distribution into `dist/dynamic-workflow-studio`.
- `test/`: Node regression tests and Playwright `studio.spec.mjs`.

## Navigation and checks

Start with `README.md` for install/launch; `docs/studio.md` covers UI semantics.
Runtime source has no fleet-controller dependencies. Keep distribution paths in
`scripts/install.mjs` aligned with runtime additions and npm `files`.
`npm-shrinkwrap.json` is intentionally distributable; restore with `npm ci`.
Use `npm run check`, `npm test`, `npm run test:ui`, `npm run build`.
CI runs those checks on Windows, Ubuntu and macOS with Node 24.
SDK imports resolve from Copilot at canvas launch, not npm dependencies.
There are no production npm dependencies. Workflow selection comes only from
recorded runs, not installed source. The HTTP API exposes project scope,
snapshot/progress reads and discovery refresh; no Design/preview/source APIs.

## Freshness

2026-10-27: reviewed through `9efc5b3` and the unified Activity change.
Removed `src/source.mjs`, `test/source.test.mjs` and `test/fixtures/loops.yml`,
source/draft UI and APIs, and Acorn/YAML dependencies. Replaced Observe/History
tabs with Activity and automatic retained outcomes. Considered runtime,
distribution manifest, package metadata, docs and regression tests.
No workflow runner or fleet scaffold copied.
