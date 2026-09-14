import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface EventWhen {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}

export interface EventInput {
  when: EventWhen;
  who: string[];
  where: string;
}

export interface EventRecord extends EventInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const DATA_FILE =
  process.env.EVENT_CALENDAR_DATA_FILE ?? join(moduleDir, "..", "data", "events.json");

const DEFAULT_DURATION_MINUTES = 60;

// Serializes reads/writes so concurrent tool calls never interleave a
// read-modify-write cycle against the JSON file.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.catch(() => undefined);
  return result;
}

async function readAll(): Promise<EventRecord[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return raw.trim() ? (JSON.parse(raw) as EventRecord[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(events: EventRecord[]): Promise<void> {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(events, null, 2) + "\n", "utf8");
}

function toInstant(when: EventWhen): number {
  return new Date(`${when.date}T${when.time}:00`).getTime();
}

function overlaps(a: EventWhen, b: EventWhen, durationMinutes: number): boolean {
  const startA = toInstant(a);
  const endA = startA + durationMinutes * 60_000;
  const startB = toInstant(b);
  const endB = startB + durationMinutes * 60_000;
  return startA < endB && startB < endA;
}

export async function listEvents(filter?: { from?: string; to?: string }): Promise<EventRecord[]> {
  const events = await readAll();
  if (!filter?.from && !filter?.to) return events;
  return events.filter((e) => {
    if (filter.from && e.when.date < filter.from) return false;
    if (filter.to && e.when.date > filter.to) return false;
    return true;
  });
}

export async function getEvent(id: string): Promise<EventRecord | null> {
  const events = await readAll();
  return events.find((e) => e.id === id) ?? null;
}

export async function createEvent(input: EventInput): Promise<EventRecord> {
  return serialized(async () => {
    const events = await readAll();
    const now = new Date().toISOString();
    const record: EventRecord = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
    events.push(record);
    await writeAll(events);
    return record;
  });
}

export async function updateEvent(id: string, patch: Partial<EventInput>): Promise<EventRecord> {
  return serialized(async () => {
    const events = await readAll();
    const index = events.findIndex((e) => e.id === id);
    if (index === -1) throw new Error(`event '${id}' not found`);
    const updated: EventRecord = {
      ...events[index],
      ...patch,
      id: events[index].id,
      createdAt: events[index].createdAt,
      updatedAt: new Date().toISOString(),
    };
    events[index] = updated;
    await writeAll(events);
    return updated;
  });
}

export async function deleteEvent(id: string): Promise<EventRecord> {
  return serialized(async () => {
    const events = await readAll();
    const index = events.findIndex((e) => e.id === id);
    if (index === -1) throw new Error(`event '${id}' not found`);
    const [removed] = events.splice(index, 1);
    await writeAll(events);
    return removed;
  });
}

export async function checkConflicts(
  when: EventWhen,
  durationMinutes = DEFAULT_DURATION_MINUTES,
  excludeId?: string
): Promise<{ conflict: boolean; events: EventRecord[] }> {
  const events = await readAll();
  const conflicting = events.filter(
    (e) => e.id !== excludeId && overlaps(e.when, when, durationMinutes)
  );
  return { conflict: conflicting.length > 0, events: conflicting };
}
