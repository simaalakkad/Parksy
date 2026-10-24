import { pgTable, serial, integer, text, timestamp, index, pgEnum } from "drizzle-orm/pg-core";
import { parkingLotsTable } from "./parking-lots";

export const parkingReportStatus = pgEnum("parking_report_status", ["available", "full"]);
export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull().references(() => parkingLotsTable.id, { onDelete: "cascade" }),
  status: parkingReportStatus("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Anonymous HMAC of a signed first-party device cookie; never an IP/address.
  deviceHash: text("device_hash").notNull(),
}, (table) => [
  index("reports_lot_created_idx").on(table.lotId, table.createdAt),
  index("reports_device_lot_created_idx").on(table.deviceHash, table.lotId, table.createdAt),
]);
