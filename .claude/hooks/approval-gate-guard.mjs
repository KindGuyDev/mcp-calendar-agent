import { readHookInput, repoRoot, activeRunId, readWorkflowState, block, allow } from "./lib.mjs";

// PreToolUse: blocks the final output write and the calendar-mutating MCP
// tools until the active run's workflow-state.json records human approval.

const CALENDAR_WRITE_TOOLS = new Set([
  "mcp__event-calendar__create_event",
  "mcp__event-calendar__update_event",
  "mcp__event-calendar__delete_event",
]);

const input = readHookInput();
const { tool_name: toolName, tool_input: toolInput = {} } = input;

const isOutputWrite =
  toolName === "Write" &&
  typeof toolInput.file_path === "string" &&
  /runs[\\/][^\\/]+[\\/]output[\\/]/.test(toolInput.file_path);

const isCalendarWrite = CALENDAR_WRITE_TOOLS.has(toolName);

if (!isOutputWrite && !isCalendarWrite) {
  allow();
}

const root = repoRoot(input);
const runId = activeRunId(root);

if (!runId) {
  block(
    "approval-gate-guard: no active run found (.claude/state/active-run.txt is missing). " +
      "The coordinator must set the active run before writing output or calendar changes."
  );
}

const result = readWorkflowState(root, runId);
if (!result) {
  block(`approval-gate-guard: workflow-state.json not found for run '${runId}'.`);
}

const approvalStatus = result.state?.approval?.status;
if (approvalStatus !== "approved") {
  block(
    `approval-gate-guard: blocked ${toolName} — run '${runId}' approval status is ` +
      `'${approvalStatus ?? "unset"}', not 'approved'. Get explicit human approval first.`
  );
}

allow();
