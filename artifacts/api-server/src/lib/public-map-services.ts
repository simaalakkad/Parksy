import { z } from "zod/v4";
import { logger } from "./logger";

// Public demo services: bounded in-memory caches, in-flight de-duplication and
// separate serial queues. FOSSGIS explicitly permits at most one request/second.
function publicService(interval: number) {
  let nextStart = 0;
  let pending = 0;
  let tail = Promise.resolve();
  const cache = new Map<string, { until: number; value: unknown }>();
  const inFlight = new Map<string, Promise<unknown>>();
  return async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const cached = cache.get(key);
    if (cached && cached.until > Date.now()) return cached.value as T;
    if (inFlight.has(key)) return inFlight.get(key) as Promise<T>;
    if (pending >= 12) throw new Error("Public map service is busy");
    pending++;
    const request = tail.then(async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, nextStart - Date.now())));
      nextStart = Date.now() + interval;
      const value = await load();
      if (cache.size >= 500) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, until: Date.now() + 5 * 60_000 });
      return value;
    }).finally(() => { pending--; inFlight.delete(key); });
    tail = request.then(() => undefined, () => undefined);
    inFlight.set(key, request);
    return request;
  };
}

const photon = publicService(1000);
const foot = publicService(1100);
export const normalize = (value: string) => value.replace(/İ/g, "I").replace(/ı/g, "i")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const photonResponse = z.object({ features: z.array(z.object({
  geometry: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({
    name: z.string().optional(), street: z.string().optional(), housenumber: z.string().optional(),
    city: z.string().optional(), state: z.string().optional(), district: z.string().optional(),
    countrycode: z.string().optional(), type: z.string().optional(),
    osm_key: z.string().optional(), osm_value: z.string().optional(),
    osm_type: z.string().optional(), osm_id: z.union([z.number(), z.string()]).optional(),
  }),
})) });

export async function geocodeIstanbul(query: string, language: "tr" | "en") {
  return photon(`${normalize(query)}:${language}`, async () => {
    const url = new URL("https://photon.komoot.io/api/");
    // Refine the well-known square query rather than ranking its many transit
    // stops first. Coordinates/names still come exclusively from OSM.
    const providerQuery = normalize(query.trim()) === "taksim" ? "Taksim Meydanı" : query;
    url.search = new URLSearchParams({ q: providerQuery, bbox: "27.8,40.65,30.5,41.7", countrycode: "TR", limit: "12" }).toString();
    if (language === "en") url.searchParams.set("lang", "en");
    const response = await fetch(url, { headers: { "User-Agent": "FatihPark/1.0" }, signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error(`Photon returned ${response.status}`);
    const data = photonResponse.parse(await response.json());
    return data.features.filter(({ geometry, properties: p }) => {
      const [lng, lat] = geometry.coordinates;
      return lat >= 40.65 && lat <= 41.7 && lng >= 27.8 && lng <= 30.5
        && p.countrycode?.toUpperCase() === "TR"
        && normalize(`${p.state ?? ""} ${p.city ?? ""}`).includes("istanbul");
    }).map(({ geometry, properties: p }) => ({
      id: `osm:${p.osm_type ?? ""}:${p.osm_id ?? geometry.coordinates.join(",")}`,
      kind: (["neighbourhood", "suburb", "quarter", "borough", "city_district", "district"].includes(p.osm_value ?? "")
        || ["district", "county"].includes(p.type ?? "") ? "neighborhood" : "place") as "neighborhood" | "place",
      name: p.name ?? [p.street, p.housenumber].filter(Boolean).join(" "),
      label: [...new Set([p.street, p.housenumber, p.district, p.city].filter(Boolean))].join(" · "),
      lat: geometry.coordinates[1], lng: geometry.coordinates[0],
    })).filter((p, index, all) => p.name && all.findIndex((other) => other.id === p.id) === index);
  });
}

const tableResponse = z.object({
  code: z.literal("Ok"),
  distances: z.array(z.array(z.number().nullable())),
  sources: z.array(z.object({ distance: z.number() }).nullable()),
  destinations: z.array(z.object({ distance: z.number() }).nullable()),
});

// Actual foot-profile network distances from parking entrances to destination.
// Null means unavailable; never substitute straight-line/driving distance.
export async function walkingDistances(destination: [number, number], lots: { lat: number; lng: number }[]) {
  const result: (number | null)[] = [];
  for (let offset = 0; offset < lots.length; offset += 49) {
    const batch = lots.slice(offset, offset + 49);
    const coordinates = [destination, ...batch.map((p): [number, number] => [p.lat, p.lng])]
      .map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
    try {
      const values = await foot(coordinates, async () => {
        const url = `https://routing.openstreetmap.de/routed-foot/table/v1/foot/${coordinates}?sources=${batch.map((_, i) => i + 1).join(";")}&destinations=0&annotations=distance`;
        const response = await fetch(url, { headers: { "User-Agent": "FatihPark/1.0" }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error(`Foot routing returned ${response.status}`);
        const data = tableResponse.parse(await response.json());
        if (data.distances.length !== batch.length) throw new Error("Incomplete foot distance matrix");
        return data.distances.map((row, i) => data.sources[i] && data.sources[i]!.distance <= 250
          && data.destinations[0] && data.destinations[0]!.distance <= 250 ? row[0] ?? null : null);
      });
      result.push(...values);
    } catch (err) {
      logger.warn({ err }, "Walking distances unavailable");
      result.push(...batch.map(() => null));
    }
  }
  return result;
}
