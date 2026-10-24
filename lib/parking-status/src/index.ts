export type LotStatus = 'available' | 'few' | 'full' | 'stale';
export type CrowdReport = { status: 'available' | 'full'; created_at: string };
export type AvailabilityLot = { updated_at: string; free_spots: number; capacity: number };
export const REPORT_LIFETIME_MS = 30 * 60_000;
export const REPORT_COOLDOWN_MS = 10 * 60_000;

export function resolveParkingStatus(lot: AvailabilityLot, reports: CrowdReport[] = [], now = Date.now()): LotStatus {
  const updatedAt = Date.parse(lot.updated_at);
  const baseline: LotStatus = Number.isFinite(updatedAt) && now - updatedAt > 60 * 60_000 ? 'stale'
    : lot.free_spots <= 0 ? 'full' : lot.capacity > 0 && lot.free_spots / lot.capacity > .3 ? 'available' : 'few';
  const active = reports.filter((report) => {
    const age = now - Date.parse(report.created_at);
    return Number.isFinite(age) && age >= 0 && age < REPORT_LIFETIME_MS;
  });
  if (!active.length) return baseline;
  // Fresh inventory is one vote. A new device report is two votes and halves
  // every ten minutes; it contributes nothing at/after thirty minutes.
  let available = baseline !== 'stale' && lot.free_spots > 0 ? 1 : 0;
  let full = baseline === 'full' ? 1 : 0;
  for (const report of active) {
    const weight = 2 * 2 ** (-(now - Date.parse(report.created_at)) / REPORT_COOLDOWN_MS);
    if (report.status === 'full') full += weight;
    else available += weight;
  }
  if (full > available) return 'full';
  // A "spot available" report confirms some space, not >30% capacity.
  if (available > full) return baseline === 'available' ? 'available' : 'few';
  return baseline === 'stale' ? 'few' : baseline;
}
