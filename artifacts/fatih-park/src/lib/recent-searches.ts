import { useEffect, useState } from 'react';
import type { GeographicPlace, ParkingLot } from '@workspace/api-client-react';

export type RecentSearch = { id: string; name: string; label: string } & (
  { kind: 'parking'; lot: ParkingLot } | { kind: 'destination'; place: GeographicPlace }
);
const KEY = 'fatih-park-recent-searches';
const EVENT = 'fatih-search-history-changed';
function readHistory(): RecentSearch[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(values)) return [];
    return values.filter((value): value is RecentSearch => {
      if (!value || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.label !== 'string') return false;
      const p = value.kind === 'parking' ? value.lot : value.kind === 'destination' ? value.place : null;
      return p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
        && typeof p.name === 'string' && (value.kind !== 'parking' || typeof p.id === 'number' && typeof p.updated_at === 'string');
    }).slice(0, 5);
  } catch { return []; }
}

export function useRecentSearches() {
  const [recent, setRecent] = useState(readHistory);
  useEffect(() => {
    const sync = () => setRecent(readHistory());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const save = (item: RecentSearch) => {
    const next = [item, ...readHistory().filter((old) => old.id !== item.id)].slice(0, 5);
    try { localStorage.setItem(KEY, JSON.stringify(next)); window.dispatchEvent(new Event(EVENT)); }
    catch { /* In private/storage-blocked contexts, retain an in-session history. */ }
    setRecent(next);
  };
  const clear = () => {
    try { localStorage.removeItem(KEY); window.dispatchEvent(new Event(EVENT)); } catch { /* Optional device storage. */ }
    setRecent([]);
  };
  return { recent, save, clear };
}
