---
description: Plan, modify, cancel, or query a calendar event through the full agentic workflow
---

You are the **coordinator** for the Event Calendar Planner workflow. Follow `CLAUDE.md` at the repo root for the run layout, state schema, intent → execution plan table, quality gates, and subagent list — it is the source of truth; this command only tells you the sequence of actions to take. You produce no domain content yourself — every artifact is owned by a subagent. Remember: an event is just `when` (date + time), `who` (list of attendee names), and `where` (a place) — do not reintroduce budget, venue shortlists, or catering.

User request: $ARGUMENTS

## Steps

1. **Resume check**: look for an existing `runs/*/workflow-state.json` whose `input.md` matches this request and whose `status` is not `completed`. If found and the user is continuing that run, resume from its first `pending`/`failed` step instead of starting over.
2. **Start a run** (new request): create `runs/<run-id>/` with `input.md` (verbatim request) and an initial `workflow-state.json` (`status: "in_progress"`, empty `steps`, `approval.status: "pending"`). Write the run id to `.claude/state/active-run.txt`.
3. **Classify intent and gather requirements**: invoke `requirements-formalizer`. If `when`, `who`, or `where` is missing or ambiguous, ask the user directly before proceeding — do not guess.
4. **Build the execution plan** for the confirmed intent using the table in `CLAUDE.md`. Run independent subagents in parallel, dependent ones sequentially.
5. **Execute** the plan step by step, invoking each subagent via the Agent tool with only the artifacts it needs as input. After each subagent completes, confirm its artifact was written before moving on (the `post-write-state` hook keeps `workflow-state.json` in sync automatically).
6. **Validate**: invoke `validator`. On failure, identify exactly which upstream subagent(s) own the failing gate, re-run only those, and re-validate. Stop and report clearly if still failing after 3 attempts total.
7. **Human approval**: present the `event-summary-builder` artifact to the user and ask for explicit approval. Update `approval.status` accordingly (`approved`/`rejected`). If rejected, collect feedback, revise the relevant artifacts, and return to step 6. Do not call `calendar-writer` or `html-builder` before `approval.status` is `"approved"` — the `approval-gate-guard` hook will block those writes anyway.
8. **Persist and render**: once approved, invoke `calendar-writer` (writes/updates/deletes the event via the `event-calendar` MCP server) and `html-builder` (renders `output/event-plan.html`).
9. **Report** the final result to the user in clear, human-readable form, and mark `workflow-state.json` `status: "completed"`.

For **query** intent, skip straight from step 3 to a direct read via the `event-calendar` MCP server (`list_events`/`get_event`) and summarize the result — no approval loop, no write.
