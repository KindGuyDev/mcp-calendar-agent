import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Drives the *compiled* server over real stdio JSON-RPC, the same way
// Claude Code (via .mcp.json) does — run `npm run build` first.

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(here, "..", "dist", "index.js");

let client: Client;
let dataDir: string;

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "event-calendar-it-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: { ...process.env, EVENT_CALENDAR_DATA_FILE: join(dataDir, "events.json") },
  });
  client = new Client({ name: "event-calendar-test-client", version: "0.0.0" });
  await client.connect(transport);
});

after(async () => {
  await client.close();
  await rm(dataDir, { recursive: true, force: true });
});

function parse(result: Awaited<ReturnType<Client["callTool"]>>) {
  const content = result.content as Array<{ type: string; text: string }>;
  return JSON.parse(content[0].text);
}

test("lists exactly the six calendar tools", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "check_conflicts",
    "create_event",
    "delete_event",
    "get_event",
    "list_events",
    "update_event",
  ]);
});

test("full create -> conflict -> update -> delete roundtrip over MCP", async () => {
  const createResult = await client.callTool({
    name: "create_event",
    arguments: {
      when: { date: "2026-11-05", time: "14:00" },
      who: ["Jane Doe", "John Smith"],
      where: "Central Library",
    },
  });
  const created = parse(createResult);
  assert.ok(created.id);

  const conflictResult = await client.callTool({
    name: "check_conflicts",
    arguments: { when: { date: "2026-11-05", time: "14:15" } },
  });
  const conflict = parse(conflictResult);
  assert.equal(conflict.conflict, true);

  const updateResult = await client.callTool({
    name: "update_event",
    arguments: { id: created.id, where: "Main Hall" },
  });
  const updated = parse(updateResult);
  assert.equal(updated.where, "Main Hall");
  assert.equal(updated.id, created.id);

  const listResult = await client.callTool({ name: "list_events", arguments: {} });
  assert.equal(parse(listResult).length, 1);

  const deleteResult = await client.callTool({
    name: "delete_event",
    arguments: { id: created.id },
  });
  assert.equal(parse(deleteResult).id, created.id);

  const afterDelete = await client.callTool({ name: "get_event", arguments: { id: created.id } });
  assert.equal(afterDelete.isError, true);
});

test("create_event rejects an empty attendee list via schema validation", async () => {
  const result = await client.callTool({
    name: "create_event",
    arguments: { when: { date: "2026-11-05", time: "14:00" }, who: [], where: "Somewhere" },
  });
  assert.equal(result.isError, true);
});
