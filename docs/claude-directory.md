# The `.claude/` directory, explained

This document walks through every file under `.claude/` — what it is, why it exists, and which assignment requirement (from `intro.md`) it satisfies. `CLAUDE.md` at the repo root is the operational reference Claude reads at run time; this document is the human-readable companion explaining the reasoning behind it.

## Layout at a glance

```
.claude/
  settings.json              # wires the hooks below into PreToolUse/PostToolUse
  commands/
    event.md                  # /event — the coordinator
  agents/
    requirements-formalizer.md
    calendar-conflict-checker.md
    location-resolver.md
    validator.md
    event-summary-builder.md
    calendar-writer.md
    html-builder.md
  skills/
    artifact-validator/SKILL.md
    event-html-theme-builder/SKILL.md
  hooks/
    lib.mjs
    approval-gate-guard.mjs
    no-leak-guard.mjs
    post-write-state.mjs
  state/
    active-run.txt            # transient, git-ignored — points at the in-progress run
```

## `commands/event.md` — the coordinator

This is what `/event` actually runs. It is deliberately thin: it doesn't plan or produce any domain content itself. Its job is orchestration —

- resume-or-start a run under `runs/<run-id>/`,
- classify intent and gather requirements via `requirements-formalizer`,
- build and execute the intent-specific plan from `CLAUDE.md` (parallel where subagents are independent, sequential where they depend on each other),
- run `validator` and retry only the owning subagent(s) of a failed gate (≤3 attempts),
- hold the line on human approval before any write to the calendar or final output,
- persist and render once approved.

**Why a single coordinator file and not code**: the assignment requires a "model-driven, hub-and-spoke architecture" invoked via a slash command — the coordinator's plan-building and failure-routing logic needs judgment (which agent owns a failing gate, whether an answer to a clarifying question is sufficient), which is exactly what a prompt-driven agent is for rather than a fixed script.

## `agents/*.md` — the subagents

Each file is a single-responsibility subagent with one owned artifact, satisfying "each subagent has a single responsibility and explicit artifact ownership."

| File | Responsibility | Why it's separate from the others |
|---|---|---|
| `requirements-formalizer.md` | Classifies intent (create/modify/cancel/query) and extracts `when`/`who`/`where`; flags anything missing so the coordinator asks the user instead of guessing | Every other agent depends on structured input existing first — this is the only agent allowed to talk to the user's raw text |
| `calendar-conflict-checker.md` | Calls the `event-calendar` MCP server to check the proposed `when` against existing events | Isolates the one check that needs the calendar's current state (MCP), so it can be retried alone if the gate it feeds fails |
| `location-resolver.md` | Web-searches to confirm `where` is a real place and attaches an address + source link | This is the subagent that satisfies the "must use external information sources, including web search — must not rely solely on the model's internal knowledge" requirement. It runs in parallel with `calendar-conflict-checker` since neither depends on the other |
| `validator.md` | Runs the four quality gates against the artifacts above, reports pass/fail with evidence | Centralizing gate logic in one agent (rather than each planner self-certifying) is what makes "explicit quality gates" and "targeted retry of only the affected work" possible — the coordinator reads *this* artifact to decide what to re-run |
| `event-summary-builder.md` | Merges validated artifacts into one plain-language summary | The "dedicated synthesis subagent" the requirements call out — only runs after `validator` passes, and is exactly what gets shown to the user for approval |
| `calendar-writer.md` | Calls the `event-calendar` MCP server's `create_event`/`update_event`/`delete_event` | The only agent allowed to mutate calendar state — narrow tool grant (see its frontmatter `tools:` list) makes the approval gate enforceable at the tool level, not just by convention |
| `html-builder.md` | Renders the approved summary as standalone HTML | Kept separate from `event-summary-builder` so the human-readable *content* (summary) and the *rendering* (HTML/theme) can change independently, and so both are covered by the approval gate |

Two agents were deliberately **not** built (worth noting since the first draft had them): `venue-planner`/`catering-planner`/`vendor-planner`/`budget-aggregator`/`schedule-builder`. The domain was simplified to just `when`/`who`/`where`, which removed the need for them — see the "Why so few fields" note below.

## `skills/*` — reusable capabilities

The assignment requires "common workflow capabilities... implemented as reusable skills" (≥2).

- **`artifact-validator/SKILL.md`** — the structural + citation check `validator` applies to *every* artifact (right sections present, every claim backed by a real source link, numbers consistent across artifacts). It's a skill rather than being folded into `validator.md` because the same check logic is reusable by any future agent that wants to self-check its own output before writing.
- **`event-html-theme-builder/SKILL.md`** — the HTML template and rendering rules (`when`/`who`/`where` layout, self-contained CSS, no internal leakage) used by `html-builder`. Kept as a skill so the visual template can be revised without touching the agent's orchestration logic.

## `hooks/*` — enforced, not just requested

The assignment requires PreToolUse *and* PostToolUse hooks actually used by the workflow. These are plain Node ESM scripts (no build step) invoked via `.claude/settings.json`, reading the tool-call JSON from stdin and signaling a block with exit code `2`.

- **`lib.mjs`** — shared helpers: read hook stdin, locate the active run via `.claude/state/active-run.txt`, read/write `workflow-state.json`, `block()`/`allow()` wrappers around the exit-code protocol.
- **`approval-gate-guard.mjs`** (PreToolUse) — blocks any write under `runs/*/output/**` and blocks the three calendar-mutating MCP tools (`create_event`/`update_event`/`delete_event`) unless the active run's `workflow-state.json` has `approval.status === "approved"`. This is what makes "final output generation requires explicit human approval that is **deterministically verified**" actually true — approval isn't just a prompt instruction the coordinator could skip, it's a hard gate enforced outside the model.
- **`no-leak-guard.mjs`** (PreToolUse) — blocks the final HTML write if its content contains internal details (run ids, artifact paths, agent names). Keeps the "clear, human-readable" output free of workflow plumbing.
- **`post-write-state.mjs`** (PostToolUse) — after every artifact write or calendar MCP write, updates the active run's `workflow-state.json` (marks the step `completed`, records the calendar write). This is what makes resume-after-interruption possible: the coordinator doesn't have to remember what it already did — it reads this file back.

## `settings.json`

Wires the three hooks above into `PreToolUse`/`PostToolUse` matchers (by tool name / MCP tool name). No permissions or other config lives here yet — kept minimal on purpose.

## `state/active-run.txt`

A single-line pointer to the currently active `runs/<run-id>/`, written by the coordinator as its first action each run. Hooks read this file rather than trying to infer the run from tool arguments (an MCP `create_event` call, for instance, carries no file path to parse a run id out of). Git-ignored — it's process state, not a deliverable.

## Why so few fields (`when`/`who`/`where`)

The first draft mirrored the Travel Planner example closely (venue/catering/vendor/budget/schedule subagents). That was dropped in favor of a minimal event model for two reasons: it was redundant with the provided example rather than a distinct domain, and the assignment's bar (≥5 subagents, ≥2 skills, explicit gates, retries, approval, resumable state) is fully met by the smaller model — extra subagents would have been padding, not additional coverage of a requirement.
