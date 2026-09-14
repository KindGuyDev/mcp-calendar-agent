---
name: artifact-validator
description: Reusable structural and citation check for a workflow artifact — confirms it has the expected sections and that every recommendation cites a real source link. Use from the validator subagent (and from any subagent re-checking its own output before writing).
---

# Artifact validator

A lightweight, consistent check applied to any artifact under `runs/<run-id>/artifacts/` before dependent work proceeds.

## Checks

1. **Structure**: the artifact has the sections its owning agent's output contract specifies (see the agent's `.md` file in `.claude/agents/`). Missing a required section is a fail.
2. **Citations**: every recommendation (venue, catering option, vendor) includes a real, fetchable URL — not a placeholder like "example.com" or a bare name with no link. If unsure a URL is real, prefer flagging it over guessing.
3. **Internal consistency**: numbers referenced from another artifact (e.g. guest count, budget limit) match the source artifact — no silently drifted values.

## How to apply

- Read the artifact and its declared inputs.
- List each check as pass/fail with the specific evidence (quote the line, not just "looks fine").
- A single failed check on this level is enough to fail the whole artifact; report all failures found, not just the first.
