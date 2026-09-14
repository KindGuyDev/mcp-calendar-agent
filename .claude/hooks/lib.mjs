import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Shared helpers for the workflow's hooks. Hooks receive a JSON payload on
// stdin (session_id, cwd, hook_event_name, tool_name, tool_input, ...) and
// signal a block by exiting with code 2 and a reason on stderr.

export function readHookInput() {
  const raw = readFileSync(0, "utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

export function repoRoot(input) {
  return input.cwd || process.cwd();
}

export function activeRunId(root) {
  const pointer = path.join(root, ".claude", "state", "active-run.txt");
  if (!existsSync(pointer)) return null;
  const id = readFileSync(pointer, "utf8").trim();
  return id || null;
}

export function readWorkflowState(root, runId) {
  const statePath = path.join(root, "runs", runId, "workflow-state.json");
  if (!existsSync(statePath)) return null;
  return { statePath, state: JSON.parse(readFileSync(statePath, "utf8")) };
}

export function block(reason) {
  console.error(reason);
  process.exit(2);
}

export function allow() {
  process.exit(0);
}
