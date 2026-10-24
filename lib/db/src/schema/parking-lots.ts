import { createInsertSchema } from "drizzle-zod";
import { pgTable, serial, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const parkingLotsTable = pgTable("parking_lots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  capacity: integer("capacity").notNull(),
  freeSpots: integer("free_spots").notNull(),
  pricePerHour: real("price_per_hour").notNull(),
  hours: text("hours").notNull(),
  isCovered: boolean("is_covered").notNull().default(false),
  hasEvCharging: boolean("has_ev_charging").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertParkingLotSchema = createInsertSchema(parkingLotsTable).omit({ id: true });
export type InsertParkingLot = z.infer<typeof insertParkingLotSchema>;
export type ParkingLot = typeof parkingLotsTable.$inferSelect;
