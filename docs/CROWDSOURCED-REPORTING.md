# Crowdsourced availability

Reports supplement lot inventory; they never alter `free_spots`, capacity, or the source's update timestamp. The displayed color is the combined status, while numeric spot counts remain the operator/demo/imported data.

## Status calculation

- Consider only reports younger than 30 minutes.
- Count only the latest report from each anonymous device for each lot.
- Fresh inventory (updated within 60 minutes) contributes one available/full vote, based on whether its free count is positive.
- A new report contributes two votes. Its weight halves every ten minutes and becomes zero at exactly thirty minutes.
- A full-vote majority produces red/full. An available-vote majority preserves green only when fresh inventory confirms more than 30% capacity free; otherwise it produces amber/few. A report saying “Spot available” does not establish how many spaces exist.
- Ties retain the inventory category, or amber if inventory is stale.
- With no active reports, use the original capacity ratio and 60-minute stale rule.

The same pure resolver is used by the server and every client marker/list/card, including car mode. Report expiry is also scheduled locally; visible lots refresh every 30 seconds to pick up other devices' reports.

## Device limit and privacy

The reporting-state GET initializes an HttpOnly, SameSite=Lax, signed first-party cookie. Only its HMAC-derived identifier is stored with reports; no IP, account, location fingerprint, or raw cookie is stored in the table or returned publicly. The server uses the existing session secret.

POST requires that initialized device cookie. A PostgreSQL transaction and per-device/lot advisory lock enforce the ten-minute cooldown, including simultaneous submissions across server instances. Cooldown responses are HTTP 429 with `Retry-After` and the next allowed time.

This is anonymous browser/device recognition, not proof of a physical device. Clearing cookies or using another browser creates a new identity. Stronger anti-abuse protection would need a separate product/privacy decision.

Expired records remain stored but no longer influence availability. Demo inventory refresh routines do not update reports.

## Checks

- `pnpm --filter @workspace/parking-status test`
- `node --experimental-strip-types --test artifacts/fatih-park/src/lib/parking-status.test.ts`
- `pnpm run typecheck`

Live API checks cover persisted submissions, simultaneous 201/429 outcomes, per-lot/device isolation, signed-cookie enforcement, exclusion of expired reports, and latest-report-per-device aggregation. Test fixtures are temporary and removed afterward.
