import { resolveParkingStatus, type CrowdReport } from '@workspace/parking-status';
export type { LotStatus } from '@workspace/parking-status';

export function getLotStatus(
  lot: { updated_at: string; free_spots: number; capacity: number; recent_reports?: CrowdReport[] },
  now = Date.now(),
): ReturnType<typeof resolveParkingStatus> {
  return resolveParkingStatus(lot, lot.recent_reports, now);
}
