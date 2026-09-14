# Event Calendar Planner — Workflow

## Overview

`/event` is a hub-and-spoke agentic workflow. A coordinator classifies the user's intent, builds an execution plan, runs the required subagents (sequentially or in parallel based on dependencies), validates artifacts against quality gates, enforces human approval before any write to the calendar or final output, and persists progress so a run can resume after interruption.

Domain: a minimal personal event calendar. An event has exactly three facts: **when** (date + time), **who** (a list of attendee name strings), and **where** (a free-text location). Events are stored as JSON via the `event-calendar` MCP server (see `mcp-server/`).

## Run layout

Every invocation creates or resumes a run directory:

```
runs/<run-id>/
  input.md                 # original user request, verbatim
  workflow-state.json       # persisted execution state (see schema below)
  artifacts/                 # one file per subagent, <agent-name>.md
  output/                    # final human-readable output (html/md)
```

`<run-id>` is a short slug + timestamp, e.g. `2026-09-14-team-lunch`.

The coordinator writes `.claude/state/active-run.txt` (single line: the current run id) as its first action in a run. Hooks read this pointer to find the active `workflow-state.json` — they never infer the run from tool arguments.

## workflow-state.json schema

```json
{
  "runId": "2026-09-14-team-lunch",
  "intent": "create | modify | cancel | query",
  "status": "in_progress | awaiting_approval | completed | failed",
  "steps": [
    { "agent": "requirements-formalizer", "status": "completed", "artifact": "artifacts/requirements-formalizer.md", "timestamp": "..." }
  ],
  "approval": { "status": "pending | approved | rejected", "feedback": "" },
  "retries": { "<agent-name>": 0 }
}
```

Resuming a run re-reads this file, skips steps already `completed`, and continues from the first `pending`/`failed` step.

## Intent → execution plan

- **create**: `requirements-formalizer` → `[calendar-conflict-checker, location-resolver]` (parallel) → `validator` (gates; targeted retry, max 3) → `event-summary-builder` → **human approval** (revision loop on reject) → `calendar-writer` → `html-builder`
- **modify**: `requirements-formalizer` → only the affected checker(s) re-run (`calendar-conflict-checker` if when changed, `location-resolver` if where changed) → `validator` → **human approval** → `calendar-writer` → `html-builder`
- **cancel**: `requirements-formalizer` → **human approval** → `calendar-writer` (delete)
- **query**: `requirements-formalizer` → direct `event-calendar` MCP read (`list_events`/`get_event`) → summarized to the user; no approval, no calendar write

On a gate failure, the coordinator re-runs only the subagent(s) that own the failing artifact, up to 3 attempts, then reports the unresolved failure and halts.

## Quality gates (validator)

1. Date/time is a valid, well-formed, non-past date (unless the user explicitly confirms a past/backfilled entry)
2. No conflict with an existing calendar event (from `check_conflicts`)
3. `where` resolves to a real, verifiable place with a source link (from `location-resolver`)
4. `who` is non-empty and contains no duplicate names

## Subagents

| Agent | Responsibility | Reads | Owns |
|---|---|---|---|
| requirements-formalizer | Intent + structured when/who/where | user input | `artifacts/requirements-formalizer.md` |
| calendar-conflict-checker | Checks the new/changed `when` against existing events (MCP) | requirements | `artifacts/calendar-conflict-checker.md` |
| location-resolver | Validates and enriches `where` via web search (real place, address, source link) | requirements | `artifacts/location-resolver.md` |
| validator | Runs the quality gates | all prior artifacts | `artifacts/validator.md` |
| event-summary-builder | Merges validated artifacts into one plan | all validated artifacts | `artifacts/event-summary-builder.md` |
| calendar-writer | Persists the approved event (MCP create/update/delete) | event-summary-builder | calendar JSON (via MCP) |
| html-builder | Renders the approved plan | event-summary-builder | `output/event-plan.html` |

The coordinator itself produces no domain content.

## Skills

- `artifact-validator` — reusable structural + citation check, applied by `validator` to each artifact.
- `event-html-theme-builder` — reusable HTML rendering rules/template used by `html-builder`.

## Hooks

- **PreToolUse** — `approval-gate-guard.mjs` blocks writes to `runs/*/output/**` and calls to the `create_event`/`update_event`/`delete_event` MCP tools unless `approval.status` is `"approved"` in the active run's `workflow-state.json`. `no-leak-guard.mjs` blocks final-output writes whose content references internal artifact paths (`runs/...`, agent names).
- **PostToolUse** — `post-write-state.mjs` updates the active run's `workflow-state.json` after every artifact write or MCP calendar write.

## MCP

`event-calendar` (custom, TypeScript, `mcp-server/`) — JSON-file-backed calendar store. Event shape: `{ id, when: { date, time }, who: string[], where: string }`. Tools: `list_events`, `get_event`, `create_event`, `update_event`, `delete_event`, `check_conflicts`.

## Secrets

None required for the MCP server (local JSON file). If a web-search provider needs an API key later, document it in `README.md` and load it from an untracked `.env`.
