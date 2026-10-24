import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, parkingLotsTable, reportsTable } from "@workspace/db";
import { CreateParkingReportBody, GetLotReportingStatusResponse } from "@workspace/api-zod";
import { REPORT_COOLDOWN_MS, resolveParkingStatus } from "@workspace/parking-status";
import { reportDevice } from "../lib/report-device";
import { recentReports } from "../lib/parking-reports";

const router: IRouter = Router();
async function stateFor(lotId: number, deviceHash: string) {
  const now = new Date();
  const [lot] = await db.select().from(parkingLotsTable).where(eq(parkingLotsTable.id, lotId));
  if (!lot) return null;
  const [last] = await db.select({ createdAt: reportsTable.createdAt }).from(reportsTable)
    .where(and(eq(reportsTable.lotId, lotId), eq(reportsTable.deviceHash, deviceHash)))
    .orderBy(desc(reportsTable.createdAt)).limit(1);
  const votes = (await recentReports([lotId], now)).get(lotId) ?? [];
  const next = last ? new Date(last.createdAt.getTime() + REPORT_COOLDOWN_MS) : null;
  return GetLotReportingStatusResponse.parse({
    lot_id: lotId, server_time: now.toISOString(),
    next_allowed_at: next && next > now ? next.toISOString() : null,
    effective_status: resolveParkingStatus({ capacity: lot.capacity, free_spots: lot.freeSpots, updated_at: lot.updatedAt.toISOString() }, votes, now.getTime()),
    recent_report_count: votes.length,
  });
}
router.get("/parking-lots/:lotId/reports", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const lotId = Number(req.params.lotId);
  if (!Number.isSafeInteger(lotId) || lotId <= 0) { res.status(400).json({ error: "invalid_lot_id" }); return; }
  const device = reportDevice(req, res, true)!;
  const state = await stateFor(lotId, device);
  if (!state) { res.status(404).json({ error: "lot_not_found" }); return; }
  res.json(state);
});
router.post("/parking-lots/:lotId/reports", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const lotId = Number(req.params.lotId);
  const body = CreateParkingReportBody.safeParse(req.body);
  if (!Number.isSafeInteger(lotId) || lotId <= 0 || !body.success) { res.status(400).json({ error: "invalid_report" }); return; }
  const device = reportDevice(req, res, false);
  if (!device) { res.status(403).json({ error: "initialize_reporting_device" }); return; }
  const outcome = await db.transaction(async (tx) => {
    // Serialize this device/lot pair across all server instances. Two parallel
    // submissions cannot both pass the cooldown check.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${device}:${lotId}`}, 0))`);
    const [lot] = await tx.select({ id: parkingLotsTable.id }).from(parkingLotsTable).where(eq(parkingLotsTable.id, lotId));
    if (!lot) return "missing";
    const time = await tx.execute<{ now: string }>(sql`select clock_timestamp() as now`);
    const now = new Date(time.rows[0]!.now);
    const [last] = await tx.select({ createdAt: reportsTable.createdAt }).from(reportsTable)
      .where(and(eq(reportsTable.lotId, lotId), eq(reportsTable.deviceHash, device)))
      .orderBy(desc(reportsTable.createdAt)).limit(1);
    if (last && now.getTime() - last.createdAt.getTime() < REPORT_COOLDOWN_MS) return "cooldown";
    await tx.insert(reportsTable).values({ lotId, status: body.data.status, deviceHash: device, createdAt: now });
    return "saved";
  });
  if (outcome === "missing") { res.status(404).json({ error: "lot_not_found" }); return; }
  const state = await stateFor(lotId, device);
  if (outcome === "cooldown") {
    const next = state?.next_allowed_at;
    const nextMs = next instanceof Date ? next.getTime() : next ? Date.parse(String(next)) : Date.now() + 1000;
    res.set("Retry-After", String(Math.max(1, Math.ceil((nextMs - Date.now()) / 1000))));
  }
  res.status(outcome === "saved" ? 201 : 429).json(state);
});
export default router;
