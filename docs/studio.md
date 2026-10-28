# Dynamic Workflow Studio: UI and observation guide

A local **GitHub Copilot canvas** for observing Dynamic Workflow activity and
reviewing historical outcomes. One pane shares recorded workflow selection,
run history and phase inspection. It does not inspect or edit workflow source.

## Open Studio

Follow the [standalone installation and launch instructions](../README.md).
Requires Node.js 24 with `node:sqlite`; the Copilot canvas also requires the
experimental `createCanvas` API. Standalone browser mode does not need the SDK.
The installed registration is `dynamic-workflow-studio`. It does not register
or run delivery workflows. An explicit project root is required for the canvas.
Renderer dependencies load on first open, not during normal CLI startup.
Use a different canvas instance for each project. The canvas's agent-callable
`snapshot` action reports the selected project's durable runs.
Alternatively, the **...** button next to the header's project name and path
opens the OS folder picker. A successful selection atomically changes session
scope and reloads the whole page, clearing old selections and filters.
Canceling or a picker/load failure leaves the current project intact.

Prefer the global installation or standalone browser to observe an active
project without changing it. A project-only installation writes only its own
extension directory, but may still constitute source drift for an active
legacy fingerprint-guarded workflow.

## Activity

One **Activity** workspace shows both live and past runs: observed agent-task
flowcharts with square activities, start/stop ovals, timing arrows and parallel
rows; entered-phase filters, task cards, wall-time bars, effective limits,
paginated progress and snapshot export.

Use **All / Live / Past** to filter the run list. **Live** includes running runs
with a valid lease; **Past** includes other recorded runs, including paused and
stale runs. These are list filters, not separate visualizations or frozen views.
The selected run refreshes every two seconds while the pane is visible; matching
sessions are rediscovered every ten seconds or immediately with **Refresh**.
Select **Outcome & evidence** in the activity picker to inspect retained status,
result, error, failure and stop reason. When no terminal outcome is recorded,
the view says so; an expired lease does not manufacture a terminal result.

Select an entered phase to filter agents and progress and inspect recorded timing.
The workflow selector lists only workflows with recorded runs; a project with
no runs displays an empty workspace even if it contains workflow source.
Select a run to pin it; **Follow latest live run** returns to automatic selection.
The six activity cards select one view at a time:
**Team Activity Flowchart** (the default), **Progress Journal**, **Query Team
Activity**, **Agent Activity**, **Inspector**, or **Outcome & evidence**. The selection survives refreshes
and run changes; filters and query text are retained when switching.
Use **<<** to collapse the Workspace/run selector into a narrow rail and **>>**
to restore it without changing the selected run, view or filters. Flowchart
controls zoom text, cards and connectors together from **50% to 200%**; select
the percentage to reset to 100%. **Ctrl + mouse wheel** (or **Command + wheel**)
over the chart zooms around the pointer; an unmodified wheel still scrolls.
Zoom and collapse remain in effect during live refresh and view changes within
the open pane. They do not change workflow execution or saved source.
Historical feedback-governance labels identify retired read-only Scrum Master
triage, Architect advice and Product Owner decisions, not current runtime stages
or extra acceptance reviewers.
The `workflow-owner` profile retains stable doer labels; historical
`workflow-doer` activity remains readable.

Activity charts show only agents with a recorded start, never future source
phases or an inferred plan. Repeated agent invocations are separate activities.
Dashed arrows encode timestamp order, **not causal dependencies or proven
spawning**: the store does not retain those relationships. Side-by-side tasks
may overlap, even across the shared Sprint Loop phase. Only a retained terminal
run gets a stop oval; stale observations remain unconfirmed rather than ended.
Dots are green for completed agents or explicit successful application outcomes,
red for errors, and yellow for ongoing, input-needed, blocked, limited or
unconfirmed activity. SDK `completed` alone is not delivery success.

Select a task or start/stop oval for an **in-pane right-side drawer**, without
scrolling away from the flowchart or opening a browser window. Close it with
Close, Escape, or the backdrop; keyboard focus returns to the selected activity.
Its compact label/value layout leads with the recorded work outcome, with
raw IDs, source labels and timestamps collapsed under Technical details.
New workflow reports supply component/flow-aware cards headed by the concrete
role and meaningful action, such as **Developer: Fix database-write access in
QuestionAnswer API**. The graph shows affected scope, failure category and who
must act; the drawer also exposes the affected flow steps, goal, bounded
acceptance, concise code location, evidence, cause/uncertainty and verification.
One file is shown directly, several files in one folder collapse to that folder,
and locations spanning multiple folders stay in Technical details. User action
appears only with an explicit action and supporting evidence. Report agreement
does not change a card's unverified flow into a working one.

Pending assignments can reuse their exact retained SprintPlan task card,
including replacement/continuation scope, resumed assignments and planning round. Reviewer/feedback-coordinator
context describes review/coordination rather than pretending to implement the
planned change. Actual final cards supersede planned context; historical tasks
without semantic fields keep their supported legacy details, not guessed causes.
Work-conserving waiting checkpoints show accepted assignment, partial/pending
sprint and unresolved-blocker counts alongside the actual stop reason. These
are retained construction, not waived acceptance or a live SDK pause. Studio
remains read-only: collecting answers and resuming work in another session
requires an authenticated connection to its owning runtime, not SQLite writes.

Verbose context and
outcomes use a local extractive summary: a few-word heading, a two-sentence
description and at most two paragraphs of five sentences each. Phase progress
is never used as an attributed agent reply. Reviewer `agree:true` is report
agreement, not an invented assignment PASS. Exact same-task/round owner outcomes
and explicit `taskComplete` assessments distinguish agreed rework, scoped
replanning, human input and completion reports. Missing completion context stays
unconfirmed; a reviewer writing "PASS" does not override an owner's rework.
No single review establishes combined assignment acceptance or live capability.
Supported final work responses supply the agent's summary or reviewer feedback.
Scrum Master triage, Architect scope assessments and Product Owner scope
decisions also display their retained structured outcomes, including required
corrections, unresolved questions and reused dispositions. These are feedback
coordination, not original acceptance votes. A retained unsupported response,
malformed structured response and missing final response have distinct notices;
an unsupported display format does not imply the workflow lost its result.
Unambiguous task/sprint IDs are expanded using names from the same run's
retained ReleasePlan/SprintPlan results; unavailable names are not guessed.
Full recorded
progress and the history outcome remain available separately.

For running, in-progress, pending and queued tasks without a final response,
the drawer summarizes the **recorded assignment**: its retained task title
(or task ID/label), reviewer role and recorded phase context. It labels this
as task context, not completed work or an agent reply, and switches to the
actual outcome when one is retained. Pending tasks can be opened from the
agent list before they start; they are not added to the observed-only flowchart.
Paused/stale activity remains explicitly paused/unconfirmed. No prompts,
intermediate messages or tool arguments are read to generate these summaries.

Each process square and its drawer show the **LLM model**, **input tokens**,
**cached tokens** (cache reads), and **output tokens**, summed from exact
per-agent `session.usage_record` records. Multiple observed models are listed,
while a model known only from the requested configuration is marked requested.
Input is the provider-reported input count, not input plus cached or a guessed
uncached count. Live values are recorded-so-far and update after requests finish.
Missing counters show **Not recorded**, never an assumed zero; partial or
malformed metadata is called out. Billing units and session totals are never
used to estimate per-process tokens.
**Query team activity** supports current work, completed work, stop reasons and
agent-label lookups. Answers update with observations; this is a bounded
read-only evidence lookup, not free-form AI reasoning or a conversation with
running agents. No prompt, message or execution control is sent.
The theme toggle switches between **Cream / espresso** and
**Midnight blue / copper**, retaining the existing Studio layout.

Live and historical views always use the selected run's retained phase records,
not the current source's phases.
The YAML runner records concurrent assigned-work loops under the global
`Sprint Loop` phase to avoid SDK phase races. Their original loop ids appear
in agent labels. Separate declared UI/backend phase entries can remain unentered
even when those assignments executed; use the labeled activity, not a guessed
phase acceptance state.

There are no source inspection, draft editing, save/apply or workflow
start/resume/pause/cancel endpoints. Snapshot exports contain local workflow
results and should be reviewed before sharing.

**Export snapshot** downloads `workflow-<run-id>.json` with the selected run's
currently retrieved details: run identifiers/status/timing, phases, agents and
their projected model/token/outcome fields, limits, retained result/error/failure,
the latest retrieved progress page and an export timestamp. Older progress pages
loaded separately in the journal are not included. It is not a full-history
backup, workflow source export or resumable checkpoint, and does not change
execution.

## Observation boundaries

The supported SDK's observation APIs are restricted to the owning session.
To observe an already-running workflow from a different CLI session without
restarting it, this canvas uses an **experimental, read-only local storage
adapter**, not a cross-session SDK attachment:

- It matches the real project root against session `workspace.yaml` metadata
  under the current user's `.copilot\session-state` (or `COPILOT_HOME`).
- It opens matching `session.db` files with SQLite `readOnly: true` and
  `query_only`, in short read transactions. It never migrates or writes them.
- It accepts workflow storage schema **v1** and reports unsupported schemas,
  query errors and disconnections explicitly. Future CLI storage changes may
  require an adapter update, even without a schema version change.
- It selects workflow run, phase, agent and progress fields, then incrementally
  scans the matching session's `events.jsonl` read-only. Only usage counters,
  model names, exact subagent/run attribution and supported structured
  `final_answer` outcomes are projected. Final JSON can be plain, fenced, or
  wrapped in `<<<WORKFLOW_JSON>>>` markers. Only reviewer agreement/feedback,
  do-er status/summary, governance outcomes, planning ID/title pairs and bounded,
  allowlisted work-card fields (including SprintPlan assignment cards) are retained;
  arbitrary artifacts and the rest of the response are discarded. Malformed card
  metadata is reported explicitly without discarding the supported final outcome.
- The scanner discards prompts, reasoning, intermediate conversation, tool
  arguments and other message text rather than exposing or retaining them.
  It never reads workflow journal payloads, credentials or authentication caches.
  Records are attributed by agent/tool-call IDs (and run bindings where present),
  never by timing or by splitting a session total. Nested agent usage is not
  silently charged to an ancestor's card. No target files or logs are written.
- An expired execution lease is labelled **stale**, never silently called live
  or rewritten as stopped. The adapter cannot observe ephemeral activity or
  establish runtime resume eligibility.
- Visited phases and completed agents are not proof of review acceptance.
  A workflow envelope can be `completed` while its result says `blocked`;
  both are shown. Raw stored billing units are not guessed into credits/cost.

The renderer binds only to loopback, requires an unguessable per-instance URL,
rejects cross-origin requests and unexpected Host headers, loads no remote
assets, and renders untrusted workflow text with DOM text nodes. Closing the
canvas closes its HTTP server; no standalone daemon is left running.
In standalone browser mode, stop the command with Ctrl+C.

## Development

These commands are for this standalone checkout; the installer omits
development tests and browser configuration.

```powershell
npm ci
npm test
npx playwright install chromium
npm run test:ui
```

Unit/integration tests cover observation without source access, scope and symlink boundaries,
database/file invariance, schema rejection, stale leases, retained blocked
results, pagination, removed Design endpoints, and HTTP boundaries. Chromium tests cover unified Activity,
snapshot export without writes, literal rendering of hostile labels,
history pinning, live refresh, observed parallel flow and task selection, bounded
evidence summaries/queries, in-pane drawer/focus handling, exact token attribution,
append/deduplication/partial usage records, final-outcome projection and human task
names, both theme palettes, narrow layouts and visible errors.
