import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db, reportsTable } from "@workspace/db";
import { REPORT_LIFETIME_MS, type CrowdReport } from "@workspace/parking-status";

export async function recentReports(lotIds: number[], now = new Date()) {
  const grouped = new Map<number, CrowdReport[]>();
  if (!lotIds.length) return grouped;
  // Only the latest vote from each device counts, even if it has reported
  // multiple times during the thirty-minute window.
  const rows = await db.selectDistinctOn([reportsTable.lotId, reportsTable.deviceHash], {
    lotId: reportsTable.lotId, status: reportsTable.status, createdAt: reportsTable.createdAt,
  }).from(reportsTable).where(and(
    inArray(reportsTable.lotId, lotIds),
    gt(reportsTable.createdAt, new Date(now.getTime() - REPORT_LIFETIME_MS)),
  )).orderBy(reportsTable.lotId, reportsTable.deviceHash, desc(reportsTable.createdAt));
  for (const row of rows) {
    const votes = grouped.get(row.lotId) ?? [];
    votes.push({ status: row.status, created_at: row.createdAt.toISOString() });
    grouped.set(row.lotId, votes);
  }
  return grouped;
}
