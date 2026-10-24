import { createInsertSchema } from "drizzle-zod";
import { pgTable, serial, text, integer, real, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { districtsTable } from "./districts";
import { z } from "zod/v4";

export const parkingLotsTable = pgTable("parking_lots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  districtId: integer("district_id").notNull().references(() => districtsTable.id),
  neighborhood: text("neighborhood").notNull().default(""),
  source: text("source"),
  externalId: text("external_id"),
  demoKey: text("demo_key"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  capacity: integer("capacity").notNull(),
  freeSpots: integer("free_spots").notNull(),
  pricePerHour: real("price_per_hour").notNull(),
  hours: text("hours").notNull(),
  isCovered: boolean("is_covered").notNull().default(false),
  hasEvCharging: boolean("has_ev_charging").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("parking_lots_lat_lng_idx").on(table.lat, table.lng),
  index("parking_lots_lng_lat_idx").on(table.lng, table.lat),
  index("parking_lots_district_id_idx").on(table.districtId),
  uniqueIndex("parking_lots_source_external_idx").on(table.source, table.externalId),
  uniqueIndex("parking_lots_demo_key_idx").on(table.demoKey),
]);

// Regular/imported lots cannot opt into the development demo simulator.
export const insertParkingLotSchema = createInsertSchema(parkingLotsTable).omit({ id: true, isDemo: true });
export type InsertParkingLot = z.infer<typeof insertParkingLotSchema>;
export type ParkingLot = typeof parkingLotsTable.$inferSelect;
