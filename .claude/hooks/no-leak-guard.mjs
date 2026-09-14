import { readHookInput, block, allow } from "./lib.mjs";

// PreToolUse: keeps internal workflow details (run ids, artifact paths,
// agent names) out of the user-facing HTML output.

const LEAK_PATTERNS = [
  /runs[\\/][^\s"'`]+/i,
  /workflow-state\.json/i,
  /\bartifacts[\\/]/i,
  /\b(requirements-formalizer|calendar-conflict-checker|location-resolver|event-summary-builder|calendar-writer|html-builder)\b/i,
];

const input = readHookInput();
const { tool_name: toolName, tool_input: toolInput = {} } = input;

const isOutputWrite =
  toolName === "Write" &&
  typeof toolInput.file_path === "string" &&
  /runs[\\/][^\\/]+[\\/]output[\\/]/.test(toolInput.file_path);

if (!isOutputWrite) {
  allow();
}

const content = String(toolInput.content ?? "");
const hit = LEAK_PATTERNS.find((pattern) => pattern.test(content));

if (hit) {
  block(
    `no-leak-guard: blocked write to '${toolInput.file_path}' — content matches internal-detail ` +
      `pattern ${hit}. Remove run ids, artifact paths, and agent names from user-facing output.`
  );
}

allow();
