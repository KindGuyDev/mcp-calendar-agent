# Event Calendar Planner

An agentic workflow, built entirely with Claude Code (slash command + subagents + skills + hooks), that turns a plain-language request into a calendar event — gathering the missing details, checking for scheduling conflicts, validating the location, getting your explicit approval, and only then persisting the event through a custom MCP server.

An event is deliberately minimal: **when** (date + time), **who** (attendee names), **where** (a place).

See [`CLAUDE.md`](CLAUDE.md) for the full workflow specification (run layout, state schema, intent → execution plan, quality gates) and [`docs/claude-directory.md`](docs/claude-directory.md) for a guided walkthrough of what every file under `.claude/` does and why.

## Prerequisites

- [Claude Code](https://claude.com/claude-code) CLI, with an active Anthropic account/subscription (this workflow runs entirely through Claude Code's own agent — no separate Anthropic API key is needed).
- Node.js 20 or later, and npm (to build and run the custom MCP server).
- No credentials, API keys, or secrets are required for anything in this repository. Web search is Claude Code's built-in `WebSearch` tool; the calendar store is a local JSON file.

## Setup (clean checkout)

```sh
git clone <this-repo-url>
cd mcp-calendar-agent

cd mcp-server
npm install
npm run build      # compiles src/ -> dist/, which .mcp.json points Claude Code at
cd ..
```

That's the whole setup — nothing else to configure. `mcp-server/data/events.json` starts as an empty `[]`; it's the calendar's data file and is created automatically if missing.

## Running the workflow

From the repository root, start Claude Code:

```sh
claude
```

On first launch in this directory, Claude Code will ask you to approve the project's MCP server (defined in `.mcp.json`) — approve it so the `/event` command can reach the calendar.

Then invoke the coordinator with the `/event` slash command, followed by your request in plain language:

```
/event Set up a team lunch next Friday at 1pm with Jane Doe, John Smith, and Priya Nair at Cafe Nero on Main Street.
```

What happens next:

1. The coordinator classifies your intent (here: `create`) and asks the `requirements-formalizer` subagent to extract `when`/`who`/`where`. If anything's missing or ambiguous, **it will ask you directly** — reply in the same conversation.
2. It checks the proposed time against your existing calendar (`calendar-conflict-checker`) and verifies the place is real via web search (`location-resolver`) — in parallel, since neither depends on the other.
3. `validator` checks the result against the quality gates (valid non-past date, no conflict, resolvable location, non-empty attendee list). On a failure, only the responsible subagent is re-run (up to 3 attempts) — you'll see what failed and why if it can't resolve.
4. `event-summary-builder` merges everything into one plain-language summary and **asks for your explicit approval** before anything is written. Reply approving it, or explain what to change — rejecting sends it back for revision and another approval pass.
5. Once approved, `calendar-writer` persists the event via the `event-calendar` MCP server, and `html-builder` renders a standalone summary page. Both writes are hook-enforced to be impossible before approval (`.claude/hooks/approval-gate-guard.mjs`) — this isn't just a prompt instruction the coordinator could skip.
6. You get a plain-language confirmation, plus the path to the rendered HTML page.

### Other intents

The same `/event` command handles more than creation:

```
/event Move my team lunch on Friday to 2pm instead.
/event Cancel the team lunch on Friday.
/event What do I have on my calendar next week?
```

`modify` and `cancel` go through the same conflict-check → validate → approve → persist pipeline (scoped to just what changed). `query` skips straight to a direct, read-only calendar lookup — no approval step, nothing is written.

## Resuming an interrupted run

Every invocation persists its progress under `runs/<run-id>/workflow-state.json` as it goes (kept in sync automatically by the `post-write-state` hook after every artifact write). If a run is interrupted — you close the terminal, Claude Code restarts, anything — just run `/event` again, referencing the same request or run:

```
/event Continue the team lunch run from before.
```

The coordinator looks for a matching run whose `status` isn't `completed`, and resumes from the first `pending`/`failed` step rather than starting over — completed subagent artifacts are read from disk, not regenerated.

## Repository structure

```
.claude/
  commands/event.md        # the /event coordinator
  agents/                   # 7 single-responsibility subagents
  skills/                    # 2 reusable skills (validation, HTML rendering)
  hooks/                      # PreToolUse/PostToolUse hooks (approval gate, leak guard, state sync)
  settings.json               # wires the hooks above
.mcp.json                    # registers the event-calendar MCP server
mcp-server/                   # custom TypeScript MCP server (JSON-file calendar store)
  src/                         # store.ts (CRUD + conflict detection), schemas.ts, index.ts
  test/                        # unit + MCP-integration tests (node:test)
  data/events.json              # the calendar's data file
runs/                          # created on first run: one directory per workflow run
  <run-id>/
    input.md                     # the original request
    workflow-state.json           # persisted execution state
    artifacts/                     # one file per subagent
    output/event-plan.html          # final rendered result
docs/
  claude-directory.md            # walkthrough of every .claude/ file
CLAUDE.md                     # the workflow's operational specification
```

## Testing the MCP server

```sh
cd mcp-server
npm test
```

Builds the server, then runs unit tests against the store logic and integration tests that drive the compiled server over real MCP stdio (tool discovery, a full create → conflict-check → update → delete roundtrip, schema-validation errors). See [`docs/claude-directory.md`](docs/claude-directory.md) for why the calendar's JSON file is only ever touched through this server, never directly by a subagent.

## Environment configuration

None required today — see Prerequisites above. If a future subagent needs an external API key (e.g. a paid search/geocoding provider), it should be read from an untracked `.env` file (already covered by `.gitignore`) and documented here before being relied on; nothing currently in this repo needs one.
