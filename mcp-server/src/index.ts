#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  checkConflicts,
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from "./store.js";
import { dateSchema, eventInputSchema, eventPatchSchema, whenSchema } from "./schemas.js";

const server = new McpServer({
  name: "event-calendar",
  version: "0.1.0",
});

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

server.registerTool(
  "list_events",
  {
    description: "List calendar events, optionally filtered by an inclusive date range (YYYY-MM-DD).",
    inputSchema: { from: dateSchema.optional(), to: dateSchema.optional() },
  },
  async ({ from, to }) => {
    try {
      return json(await listEvents({ from, to }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "get_event",
  {
    description: "Get a single calendar event by id.",
    inputSchema: { id: z.string().min(1) },
  },
  async ({ id }) => {
    try {
      const event = await getEvent(id);
      return event ? json(event) : errorResult(new Error(`event '${id}' not found`));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "create_event",
  {
    description: "Create a new calendar event with when (date+time), who (attendee names), and where (place).",
    inputSchema: eventInputSchema,
  },
  async ({ when, who, where }) => {
    try {
      return json(await createEvent({ when, who, where }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "update_event",
  {
    description: "Update an existing calendar event's when/who/where. Only provided fields change.",
    inputSchema: { id: z.string().min(1), ...eventPatchSchema },
  },
  async ({ id, ...patch }) => {
    try {
      return json(await updateEvent(id, patch));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "delete_event",
  {
    description: "Delete a calendar event by id.",
    inputSchema: { id: z.string().min(1) },
  },
  async ({ id }) => {
    try {
      return json(await deleteEvent(id));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "check_conflicts",
  {
    description:
      "Check whether a proposed when (date+time) overlaps an existing event. " +
      "durationMinutes defaults to 60. Pass excludeId when checking a modify against its own current slot.",
    inputSchema: {
      when: whenSchema,
      durationMinutes: z.number().int().positive().optional(),
      excludeId: z.string().optional(),
    },
  },
  async ({ when, durationMinutes, excludeId }) => {
    try {
      return json(await checkConflicts(when, durationMinutes, excludeId));
    } catch (err) {
      return errorResult(err);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("event-calendar MCP server failed to start:", err);
  process.exit(1);
});
