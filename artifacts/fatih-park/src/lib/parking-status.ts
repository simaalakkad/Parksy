export type LotStatus = 'available' | 'few' | 'full' | 'stale';

export function getLotStatus(
  lot: { updated_at: string; free_spots: number; capacity: number },
  now = Date.now(),
): LotStatus {
  const updatedAt = Date.parse(lot.updated_at);
  if (Number.isFinite(updatedAt) && now - updatedAt > 60 * 60 * 1000) return 'stale';
  if (lot.free_spots <= 0) return 'full';
  return lot.capacity > 0 && lot.free_spots / lot.capacity > 0.3 ? 'available' : 'few';
}
