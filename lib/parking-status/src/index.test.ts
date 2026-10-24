import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveParkingStatus, REPORT_LIFETIME_MS } from './index.ts';

const now = Date.parse('2026-10-24T12:00:00Z');
const lot = { capacity: 100, free_spots: 70, updated_at: new Date(now).toISOString() };
const report = (status: 'available' | 'full', minutes = 0) => ({ status, created_at: new Date(now - minutes * 60_000).toISOString() });
test('a fresh report can override inventory without modifying its free_spots', () => {
  assert.equal(resolveParkingStatus(lot, [report('full')], now), 'full');
  assert.equal(resolveParkingStatus({ ...lot, free_spots: 0 }, [report('available')], now), 'few');
  assert.equal(lot.free_spots, 70);
});
test('newer contradictory reports count more', () => {
  const stale = { ...lot, updated_at: new Date(now - 61 * 60_000).toISOString() };
  assert.equal(resolveParkingStatus(stale, [report('available', 20), report('full', 1)], now), 'full');
  assert.equal(resolveParkingStatus(stale, [report('full', 20), report('available', 1)], now), 'few');
});
test('reports expire at exactly thirty minutes and invalid/future votes are ignored', () => {
  assert.equal(resolveParkingStatus(lot, [report('full', 30)], now), 'available');
  assert.equal(resolveParkingStatus(lot, [{ status: 'full', created_at: 'invalid' }, report('full', -1)], now), 'available');
  assert.equal(REPORT_LIFETIME_MS, 1_800_000);
});
test('stale inventory is grey only when there is no current report signal', () => {
  const stale = { ...lot, updated_at: new Date(now - 61 * 60_000).toISOString() };
  assert.equal(resolveParkingStatus(stale, [], now), 'stale');
  assert.equal(resolveParkingStatus(stale, [report('full')], now), 'full');
  assert.equal(resolveParkingStatus(stale, [report('available')], now), 'few');
  assert.equal(resolveParkingStatus(stale, [report('full', 29)], now), 'full');
  assert.equal(resolveParkingStatus(stale, [report('full', 30)], now), 'stale');
});
