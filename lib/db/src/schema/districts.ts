import { pgTable, serial, text, doublePrecision } from "drizzle-orm/pg-core";

export const districtsTable = pgTable("districts", {
  id: serial("id").primaryKey(),
  nameTr: text("name_tr").notNull().unique(),
  nameEn: text("name_en").notNull(),
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
});
