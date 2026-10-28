# Repository index

## Areas and boundaries

- `src/extension.mjs`: Copilot canvas registration, lazy-loads `server.mjs`.
  Root `extension.mjs` is the installed discovery entry point.
- `src/server.mjs`: tokenized loopback HTTP server shared by canvas and CLI.
- `src/directory-picker.mjs`: native Windows/macOS/Linux folder selection;
  the protected project-pick endpoint atomically swaps source and session scope.
  The header ellipsis reloads the UI after a successful selection.
- `src/source.mjs`: bounded, nonexecuting Acorn/YAML source inspection.
- `src/store.mjs` -> `src/usage.mjs`: project-scoped read-only SQLite and
  allowlisted event projection. Never controls the workflow runtime.
- `src/app.mjs`, `observed.mjs`, `index.html`, `style.css`: browser UI,
  observations, graph/drawer and draft exports.
- `bin/dynamic-workflow-studio.mjs`: terminal server and installation commands.
- `scripts/install.mjs`: standalone distribution manifest, scoped replacement,
  production dependencies and project/global registration.
- `scripts/build.mjs`: copies distribution into `dist/dynamic-workflow-studio`.
- `test/`: Node regression tests and Playwright `studio.spec.mjs`.
  `test/fixtures/loops.yml` is data, not a workflow engine or registration.

## Navigation and checks

Start with `README.md` for install/launch; `docs/studio.md` covers UI semantics.
Runtime source has no fleet-controller dependencies. Keep distribution paths in
`scripts/install.mjs` aligned with runtime additions and npm `files`.
`npm-shrinkwrap.json` is intentionally distributable; restore with `npm ci`.
Use `npm run check`, `npm test`, `npm run test:ui`, `npm run build`.
CI runs those checks on Windows, Ubuntu and macOS with Node 24.
SDK imports resolve from Copilot at canvas launch, not npm dependencies.

## Freshness

2026-10-27: standalone extraction from source commit `d168e7a` into destination
baseline `16590b5`. Considered all added runtime, CLI, scripts, docs, fixtures,
tests, package metadata and CI paths. Updated for native project selection,
mutable project scope and full-page reload. No workflow runner or fleet scaffold copied.
