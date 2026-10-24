import { eq, sql } from "drizzle-orm";
import { db, parkingLotsTable } from "@workspace/db";
import { logger } from "./logger";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// No automatic row classification: seed/setup must explicitly flag sample rows.
// Real and imported rows default to is_demo=false and are excluded from every tick.
async function refreshDemoParking(): Promise<void> {
  const updated = await db.update(parkingLotsTable).set({
    updatedAt: new Date(),
    freeSpots: sql`greatest(0, least(${parkingLotsTable.capacity}, ${parkingLotsTable.freeSpots} + floor(random() * 7)::integer - 3))`,
  }).where(eq(parkingLotsTable.isDemo, true)).returning({ id: parkingLotsTable.id });
  logger.info({ count: updated.length }, "Refreshed explicitly marked demo parking data");
}

export async function startDemoParkingRefresh(): Promise<void> {
  // Must not run during production, tests, or environments with an unset NODE_ENV.
  if (process.env.NODE_ENV !== "development") return;
  const tick = async () => {
    try {
      await refreshDemoParking();
    } catch (err) {
      logger.error({ err }, "Demo parking refresh failed");
    }
  };
  await tick();
  const timer = setInterval(() => void tick(), REFRESH_INTERVAL_MS);
  timer.unref();
}
