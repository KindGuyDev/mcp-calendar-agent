import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";

// The data file path is read once, at module-load time, from
// EVENT_CALENDAR_DATA_FILE — so it must be set before store.ts is imported.
let dataDir: string;
let dataFile: string;
let store: typeof import("../src/store.js");

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "event-calendar-store-test-"));
  dataFile = join(dataDir, "events.json");
  process.env.EVENT_CALENDAR_DATA_FILE = dataFile;
  store = await import("../src/store.js");
});

beforeEach(async () => {
  await writeFile(dataFile, "[]\n", "utf8");
});

after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

const sample = {
  when: { date: "2026-11-01", time: "10:00" },
  who: ["Ann Lee"],
  where: "Cafe Nero",
};

test("createEvent assigns an id and timestamps", async () => {
  const event = await store.createEvent(sample);
  assert.ok(event.id);
  assert.equal(event.createdAt, event.updatedAt);
  assert.deepEqual(event.who, sample.who);
});

test("listEvents returns everything with no filter", async () => {
  await store.createEvent(sample);
  await store.createEvent({ ...sample, when: { date: "2026-12-01", time: "09:00" } });
  const events = await store.listEvents();
  assert.equal(events.length, 2);
});

test("listEvents filters by inclusive date range", async () => {
  await store.createEvent({ ...sample, when: { date: "2026-11-01", time: "10:00" } });
  await store.createEvent({ ...sample, when: { date: "2026-12-15", time: "10:00" } });
  const events = await store.listEvents({ from: "2026-12-01", to: "2026-12-31" });
  assert.equal(events.length, 1);
  assert.equal(events[0].when.date, "2026-12-15");
});

test("getEvent returns null for an unknown id", async () => {
  assert.equal(await store.getEvent("does-not-exist"), null);
});

test("updateEvent patches only the given fields and bumps updatedAt", async () => {
  const created = await store.createEvent(sample);
  await new Promise((r) => setTimeout(r, 5));
  const updated = await store.updateEvent(created.id, { where: "New Venue" });
  assert.equal(updated.id, created.id);
  assert.equal(updated.createdAt, created.createdAt);
  assert.notEqual(updated.updatedAt, created.updatedAt);
  assert.equal(updated.where, "New Venue");
  assert.deepEqual(updated.who, sample.who);
});

test("updateEvent throws for an unknown id", async () => {
  await assert.rejects(() => store.updateEvent("missing", { where: "X" }));
});

test("deleteEvent removes the event and returns it", async () => {
  const created = await store.createEvent(sample);
  const deleted = await store.deleteEvent(created.id);
  assert.equal(deleted.id, created.id);
  assert.equal(await store.getEvent(created.id), null);
});

test("deleteEvent throws for an unknown id", async () => {
  await assert.rejects(() => store.deleteEvent("missing"));
});

test("checkConflicts detects an overlapping slot on the same day", async () => {
  await store.createEvent({ ...sample, when: { date: "2026-11-01", time: "10:00" } });
  const result = await store.checkConflicts({ date: "2026-11-01", time: "10:30" });
  assert.equal(result.conflict, true);
  assert.equal(result.events.length, 1);
});

test("checkConflicts reports no conflict outside the duration window", async () => {
  await store.createEvent({ ...sample, when: { date: "2026-11-01", time: "10:00" } });
  const result = await store.checkConflicts({ date: "2026-11-01", time: "12:00" });
  assert.equal(result.conflict, false);
});

test("checkConflicts excludes the event's own id (for modify checks)", async () => {
  const created = await store.createEvent({ ...sample, when: { date: "2026-11-01", time: "10:00" } });
  const result = await store.checkConflicts(
    { date: "2026-11-01", time: "10:00" },
    60,
    created.id
  );
  assert.equal(result.conflict, false);
});
