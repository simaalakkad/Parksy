import { Router, type IRouter } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db, parkingLotsTable, districtsTable } from "@workspace/db";
import { ListParkingLotsQueryParams, ListParkingLotsResponse, ListDistrictsResponse, SearchParkingLotsQueryParams } from "@workspace/api-zod";
import { walkingDistances } from "../lib/public-map-services";
import { recentReports } from "../lib/parking-reports";
import { resolveParkingStatus } from "@workspace/parking-status";

const router: IRouter = Router();
const ISTANBUL_CENTER: [number, number] = [41.0082, 28.9784];

router.get("/districts", async (_req, res): Promise<void> => {
  const rows = await db.select().from(districtsTable).orderBy(districtsTable.nameTr);
  res.json(ListDistrictsResponse.parse(rows.map((d) => ({
    id: d.id, name_tr: d.nameTr, name_en: d.nameEn, center_lat: d.centerLat, center_lng: d.centerLng,
  }))));
});

function normalizeSearch(value: string): string {
  return value.replace(/İ/g, "I").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function parseBooleanParam(value: unknown): boolean | undefined | null {
  if (value === undefined) return undefined;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return null;
}

function distanceKm(from: [number, number], to: [number, number]): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRadians(to[0] - from[0]);
  const dLng = toRadians(to[1] - from[1]);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(from[0])) * Math.cos(toRadians(to[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOpenNow(hours: string, nowMinutes: number): boolean {
  if (/^(24\s*saat|24\/7)$/iu.test(hours.trim())) return true;
  const match = hours.trim().match(/^(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})$/u);
  if (!match) return false;
  const [, startHour, startMinute, endHour, endMinute] = match;
  const start = Number(startHour) * 60 + Number(startMinute);
  const end = Number(endHour) * 60 + Number(endMinute);
  if (start > 1439 || end > 1439 || start === end) return false;
  return start < end
    ? nowMinutes >= start && nowMinutes < end
    : nowMinutes >= start || nowMinutes < end;
}

function istanbulMinutesNow(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

const lotsHandler = (globalSearch: boolean) => async (req: import("express").Request, res: import("express").Response): Promise<void> => {
  const covered = parseBooleanParam(req.query.covered);
  const evCharging = parseBooleanParam(req.query.ev_charging);
  const openNow = parseBooleanParam(req.query.open_now);
  const walking = parseBooleanParam(req.query.walking);
  if (covered === null || evCharging === null || openNow === null || walking === null) {
    res.status(400).json({ error: "Boolean filters must be true or false." });
    return;
  }

  const parsed = ListParkingLotsQueryParams.safeParse({
    ...req.query,
    covered,
    ev_charging: evCharging,
    open_now: openNow,
    walking,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (globalSearch && !SearchParkingLotsQueryParams.safeParse(req.query).success) {
    res.status(400).json({ error: "A nonempty search query is required; coordinates must be valid." });
    return;
  }

  const { lat, lng, price_min: priceMin, price_max: priceMax, south, north, west, east, district_id: districtId, q } = parsed.data;
  const boundCount = [south, north, west, east].filter((v) => v !== undefined).length;
  if (boundCount !== 0 && boundCount !== 4 || south !== undefined && north !== undefined && south >= north
    || west !== undefined && east !== undefined && west >= east) {
    res.status(400).json({ error: "Provide all four bounds with south < north and west < east." });
    return;
  }
  if ((lat === undefined) !== (lng === undefined)) {
    res.status(400).json({ error: "lat and lng must be provided together." });
    return;
  }
  if (walking === true && (lat === undefined || lng === undefined)) {
    res.status(400).json({ error: "Walking distance requires a destination lat and lng." });
    return;
  }
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
    res.status(400).json({ error: "price_min cannot exceed price_max." });
    return;
  }

  const conditions = [];
  if (!globalSearch) {
    conditions.push(gte(parkingLotsTable.lat, south ?? 40.7), lte(parkingLotsTable.lat, north ?? 41.65),
      gte(parkingLotsTable.lng, west ?? 27.8), lte(parkingLotsTable.lng, east ?? 30.5));
  }
  if (districtId !== undefined) conditions.push(eq(parkingLotsTable.districtId, districtId));
  if (q?.trim()) {
    const pattern = `%${normalizeSearch(q.trim()).replace(/[\\%_]/g, "\\$&")}%`;
    const searchable = sql`concat_ws(' ', ${parkingLotsTable.name}, ${parkingLotsTable.neighborhood}, ${districtsTable.nameTr}, ${districtsTable.nameEn})`;
    conditions.push(sql`translate(lower(replace(replace(${searchable}, 'İ', 'I'), 'ı', 'i')), 'çğöşüâîû', 'cgosuaiu') LIKE ${pattern}`);
  }
  if (priceMin !== undefined) conditions.push(gte(parkingLotsTable.pricePerHour, priceMin));
  if (priceMax !== undefined) conditions.push(lte(parkingLotsTable.pricePerHour, priceMax));
  if (covered !== undefined) conditions.push(eq(parkingLotsTable.isCovered, covered));
  if (evCharging !== undefined) conditions.push(eq(parkingLotsTable.hasEvCharging, evCharging));

  const origin: [number, number] = lat !== undefined && lng !== undefined ? [lat, lng]
    : south !== undefined && north !== undefined && west !== undefined && east !== undefined
      ? [(south + north) / 2, (west + east) / 2] : ISTANBUL_CENTER;
  const distanceOrder = sql`6371 * 2 * asin(sqrt(least(1,
    power(sin(radians(${parkingLotsTable.lat} - ${origin[0]}) / 2), 2)
    + cos(radians(${origin[0]})) * cos(radians(${parkingLotsTable.lat}))
    * power(sin(radians(${parkingLotsTable.lng} - ${origin[1]}) / 2), 2))))`;
  const query = db.select({ lot: parkingLotsTable, district: districtsTable }).from(parkingLotsTable)
    .innerJoin(districtsTable, eq(parkingLotsTable.districtId, districtsTable.id))
    .where(and(...conditions)).orderBy(distanceOrder);
  const rows = globalSearch ? await query.limit(20) : await query;
  const currentIstanbulMinute = openNow === true ? istanbulMinutesNow() : 0;
  const reportGroups = await recentReports(rows.map(({ lot }) => lot.id));
  const lots = rows
    .filter(({ lot }) => openNow !== true || isOpenNow(lot.hours, currentIstanbulMinute))
    .map(({ lot, district }) => ({
    id: lot.id,
    name: lot.name,
    lat: lot.lat,
    lng: lot.lng,
    capacity: lot.capacity,
    free_spots: lot.freeSpots,
    price_per_hour: lot.pricePerHour,
    hours: lot.hours,
    is_covered: lot.isCovered,
    has_ev_charging: lot.hasEvCharging,
    is_demo: lot.isDemo,
    district_id: district.id,
    district_name_tr: district.nameTr,
    district_name_en: district.nameEn,
    neighborhood: lot.neighborhood,
    updated_at: lot.updatedAt.toISOString(),
    recent_reports: reportGroups.get(lot.id) ?? [],
    effective_status: resolveParkingStatus({ capacity: lot.capacity, free_spots: lot.freeSpots, updated_at: lot.updatedAt.toISOString() }, reportGroups.get(lot.id) ?? []),
    distance_km: distanceKm(origin, [lot.lat, lot.lng]),
    walking_distance_m: null as number | null,
    walking_distance_status: walking === true ? "unavailable" as const : "not_requested" as const,
  }))
    .sort((a, b) => a.distance_km - b.distance_km);
  if (walking === true) {
    const distances = await walkingDistances(origin, lots);
    lots.forEach((lot, i) => {
      lot.walking_distance_m = distances[i] ?? null;
      Object.assign(lot, { walking_distance_status: distances[i] === null ? "unavailable" : "available" });
    });
    lots.sort((a, b) => (a.walking_distance_m ?? Infinity) - (b.walking_distance_m ?? Infinity));
  }

  req.log.info({ count: lots.length, hasLocation: lat !== undefined, openNow }, "Fetched parking lots");
  res.json(ListParkingLotsResponse.parse(lots));
};

router.get("/parking-lots", lotsHandler(false));
router.get("/parking-search", lotsHandler(true));

export default router;
