import { z } from "zod";

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

export const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "time must be HH:mm (24h)");

export const whenSchema = z.object({
  date: dateSchema,
  time: timeSchema,
});

export const whoSchema = z
  .array(z.string().min(1, "attendee name must not be empty"))
  .min(1, "at least one attendee is required");

export const whereSchema = z.string().min(1, "where must not be empty");

export const eventInputSchema = {
  when: whenSchema,
  who: whoSchema,
  where: whereSchema,
};

export const eventPatchSchema = {
  when: whenSchema.optional(),
  who: whoSchema.optional(),
  where: whereSchema.optional(),
};
