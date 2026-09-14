import { writeFileSync } from "node:fs";
import path from "node:path";
import { readHookInput, repoRoot, activeRunId, readWorkflowState, allow } from "./lib.mjs";

// PostToolUse: keeps the active run's workflow-state.json in sync whenever
// an artifact is written or a calendar-mutating MCP tool completes.
// Never blocks — this hook only observes and persists.

const input = readHookInput();
const { tool_name: toolName, tool_input: toolInput = {}, tool_response: toolResponse = {} } = input;

const root = repoRoot(input);
const runId = activeRunId(root);
if (!runId) allow();

const result = readWorkflowState(root, runId);
if (!result) allow();

const { statePath, state } = result;
const now = new Date().toISOString();
state.steps ??= [];

if (toolName === "Write" && typeof toolInput.file_path === "string") {
  const relPath = path.relative(path.join(root, "runs", runId), toolInput.file_path).replace(/\\/g, "/");

  const artifactMatch = relPath.match(/^artifacts\/([^/]+)\.md$/);
  if (artifactMatch) {
    const agent = artifactMatch[1];
    const existing = state.steps.find((s) => s.agent === agent);
    const entry = { agent, status: "completed", artifact: relPath, timestamp: now };
    if (existing) Object.assign(existing, entry);
    else state.steps.push(entry);
  }

  if (relPath.startsWith("output/")) {
    state.status = "completed";
  }
} else if (
  toolName === "mcp__event-calendar__create_event" ||
  toolName === "mcp__event-calendar__update_event" ||
  toolName === "mcp__event-calendar__delete_event"
) {
  state.calendarWrite = {
    tool: toolName,
    eventId: toolResponse?.eventId ?? toolResponse?.id ?? null,
    timestamp: now,
  };
}

writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
allow();
