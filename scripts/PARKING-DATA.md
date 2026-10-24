# Istanbul parking data

## Demo setup

Run `pnpm --filter @workspace/scripts run seed:istanbul-demo` against development.
This manual, idempotent setup creates all 39 districts and five **fictional**
lots per district, preserving the original Fatih demo lots. Coordinates are
approximate neighborhood hubs, not surveyed parking entrances. Names, prices,
capacity and availability must never be described as verified real facilities.
Every sample is `is_demo=true`, `source=demo`, and new samples have a stable
`demo_key`. Seeding is prohibited when NODE_ENV is production; it is not part of
server startup or publishing.

## Real provider import

No real provider feed is downloaded or invented by this project. Obtain an
authorized dataset (for example from data.ibb.gov.tr), review its license and
fields, and write a provider-specific adapter into the canonical JSON format
accepted by `src/import-parking.ts`. Its exported `adaptCanonicalRecords` is the
validation boundary. Do not fill unknown occupancy, price, or timestamps with
fictional values; resolve missing required fields before importing.

Input: a JSON array of objects containing:

| Field | Type |
| --- | --- |
| external_id | Nonempty stable provider ID |
| name | Facility name |
| district | Turkish or English district name, accents optional |
| neighborhood | Mahalle/local area |
| lat, lng | Numeric coordinates within Istanbul |
| capacity, free_spots | Integers; 0 ≤ free_spots ≤ capacity |
| price_per_hour | Nonnegative number |
| hours | Existing app format: `24 saat`, `24/7`, or `07:00–23:00` |
| is_covered, has_ev_charging | Booleans |
| updated_at | Source observation timestamp as ISO 8601 with Z or explicit offset |

Validate first (no writes):

`pnpm --filter @workspace/scripts run import:parking --file /path/to/reviewed.json --source ibb-ispark`

Apply after review:

`pnpm --filter @workspace/scripts run import:parking --file /path/to/reviewed.json --source ibb-ispark --apply`

The full file is validated before writing; writes use one transaction in batches
of 250. Duplicate IDs in a file and unknown districts fail explicitly. Reimports
upsert only the same `(source, external_id)`. `is_demo` is always false and cannot
be supplied in input. The reserved source `demo` is rejected; conflicts with a
demo row are never updated. Source observation timestamps are preserved, so stale
real data stays grey. The development simulator updates only explicitly marked
demo rows and never imports. No deletion or production migration is performed.
