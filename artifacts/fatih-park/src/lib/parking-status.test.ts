import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLotStatus } from './parking-status.ts';

const now = Date.parse('2026-10-24T12:00:00Z');
const lot = { updated_at: '2026-10-24T11:59:00Z', capacity: 100, free_spots: 31 };

test('availability uses a strictly greater than 30% boundary', () => {
  assert.equal(getLotStatus(lot, now), 'available');
  assert.equal(getLotStatus({ ...lot, free_spots: 30 }, now), 'few');
  assert.equal(getLotStatus({ ...lot, free_spots: 1 }, now), 'few');
  assert.equal(getLotStatus({ ...lot, free_spots: 0 }, now), 'full');
});

test('only timestamps older than 60 minutes are stale', () => {
  assert.equal(getLotStatus({ ...lot, updated_at: '2026-10-24T11:00:00Z' }, now), 'available');
  assert.equal(getLotStatus({ ...lot, updated_at: '2026-10-24T10:59:59.999Z' }, now), 'stale');
  assert.equal(getLotStatus({ ...lot, updated_at: '2026-10-24T14:59:00+03:00' }, now), 'available');
  assert.equal(getLotStatus({ ...lot, updated_at: '2026-10-24T12:01:00Z' }, now), 'available');
});
