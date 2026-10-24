import { readFile } from "node:fs/promises";
import { z } from "zod";
import { db, pool, districtsTable, parkingLotsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const arg = (name: string) => process.argv[process.argv.indexOf(name) + 1];
const file = process.argv.includes("--file") ? arg("--file") : undefined;
const source = process.argv.includes("--source") ? arg("--source") : undefined;
if (!file || !source || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(source) || source === "demo") {
  throw new Error("Usage: import:parking --file path.json --source provider-name [--apply]. Source cannot be demo.");
}

const recordSchema = z.object({
  external_id: z.string().min(1).max(200),
  name: z.string().min(1).max(300),
  district: z.string().min(1),
  neighborhood: z.string().min(1).max(200),
  lat: z.number().min(40.65).max(41.7),
  lng: z.number().min(27.8).max(30.5),
  capacity: z.number().int().positive(),
  free_spots: z.number().int().min(0),
  price_per_hour: z.number().min(0),
  hours: z.string().regex(/^(?:24\s*saat|24\/7|(?:[01]?\d|2[0-3]):[0-5]\d\s*[–—-]\s*(?:[01]?\d|2[0-3]):[0-5]\d)$/u, "Convert source schedules to a supported format; do not guess missing hours"),
  is_covered: z.boolean(),
  has_ev_charging: z.boolean(),
  updated_at: z.string().datetime({ offset: true }),
}).strict().refine((r) => r.free_spots <= r.capacity, { message: "free_spots cannot exceed capacity" });

// Provider adapters should produce this canonical format. Do not guess missing
// availability/prices/timestamps or treat a downloaded feed as demo data.
export function adaptCanonicalRecords(input: unknown) {
  return z.array(recordSchema).min(1).parse(input);
}
const normalize = (v: string) => v.replace(/İ/g, "I").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

try {
  const records = adaptCanonicalRecords(JSON.parse(await readFile(file, "utf8")));
  const districts = await db.select().from(districtsTable);
  const districtMap = new Map(districts.flatMap((d) => [[normalize(d.nameTr), d.id], [normalize(d.nameEn), d.id]] as [string, number][]));
  const seen = new Set<string>();
  const rows = records.map((r) => {
    const districtId = districtMap.get(normalize(r.district));
    if (!districtId) throw new Error(`Unknown district: ${r.district}`);
    if (seen.has(r.external_id)) throw new Error(`Duplicate external_id: ${r.external_id}`);
    seen.add(r.external_id);
    return {
      externalId: r.external_id, source, isDemo: false, demoKey: null, districtId,
      name: r.name, neighborhood: r.neighborhood, lat: r.lat, lng: r.lng,
      capacity: r.capacity, freeSpots: r.free_spots, pricePerHour: r.price_per_hour,
      hours: r.hours, isCovered: r.is_covered, hasEvCharging: r.has_ev_charging,
      updatedAt: new Date(r.updated_at),
    };
  });
  if (!process.argv.includes("--apply")) {
    console.info(`Validated ${rows.length} non-demo records for ${source}. Dry run only; use --apply to import.`);
  } else {
    await db.transaction(async (tx) => {
      for (let start = 0; start < rows.length; start += 250) {
        await tx.insert(parkingLotsTable).values(rows.slice(start, start + 250)).onConflictDoUpdate({
          target: [parkingLotsTable.source, parkingLotsTable.externalId],
          setWhere: eq(parkingLotsTable.isDemo, false),
          set: {
            name: sql`excluded.name`, districtId: sql`excluded.district_id`, neighborhood: sql`excluded.neighborhood`,
            lat: sql`excluded.lat`, lng: sql`excluded.lng`, capacity: sql`excluded.capacity`,
            freeSpots: sql`excluded.free_spots`, pricePerHour: sql`excluded.price_per_hour`,
            hours: sql`excluded.hours`, isCovered: sql`excluded.is_covered`,
            hasEvCharging: sql`excluded.has_ev_charging`, updatedAt: sql`excluded.updated_at`,
          },
        });
      }
    });
    console.info(`Imported ${rows.length} non-demo records for ${source}. Demo rows were not changed.`);
  }
} finally {
  await pool.end();
}
