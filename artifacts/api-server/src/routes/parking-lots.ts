import { Router, type IRouter } from "express";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, parkingLotsTable } from "@workspace/db";
import { ListParkingLotsQueryParams, ListParkingLotsResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const FATIH_CENTER: [number, number] = [41.0186, 28.9397];

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

router.get("/parking-lots", async (req, res): Promise<void> => {
  const covered = parseBooleanParam(req.query.covered);
  const evCharging = parseBooleanParam(req.query.ev_charging);
  const openNow = parseBooleanParam(req.query.open_now);
  if (covered === null || evCharging === null || openNow === null) {
    res.status(400).json({ error: "Boolean filters must be true or false." });
    return;
  }

  const parsed = ListParkingLotsQueryParams.safeParse({
    ...req.query,
    covered,
    ev_charging: evCharging,
    open_now: openNow,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { lat, lng, price_min: priceMin, price_max: priceMax } = parsed.data;
  if ((lat === undefined) !== (lng === undefined)) {
    res.status(400).json({ error: "lat and lng must be provided together." });
    return;
  }
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
    res.status(400).json({ error: "price_min cannot exceed price_max." });
    return;
  }

  const conditions = [];
  if (priceMin !== undefined) conditions.push(gte(parkingLotsTable.pricePerHour, priceMin));
  if (priceMax !== undefined) conditions.push(lte(parkingLotsTable.pricePerHour, priceMax));
  if (covered !== undefined) conditions.push(eq(parkingLotsTable.isCovered, covered));
  if (evCharging !== undefined) conditions.push(eq(parkingLotsTable.hasEvCharging, evCharging));

  const rows = await db.select().from(parkingLotsTable)
    .where(conditions.length ? and(...conditions) : undefined);
  const origin: [number, number] = lat === undefined || lng === undefined ? FATIH_CENTER : [lat, lng];
  const currentIstanbulMinute = openNow === true ? istanbulMinutesNow() : 0;
  const lots = rows
    .filter((lot) => openNow !== true || isOpenNow(lot.hours, currentIstanbulMinute))
    .map((lot) => ({
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
    updated_at: lot.updatedAt.toISOString(),
    distance_km: distanceKm(origin, [lot.lat, lot.lng]),
  }))
    .sort((a, b) => a.distance_km - b.distance_km);

  req.log.info({ count: lots.length, hasLocation: lat !== undefined, openNow }, "Fetched parking lots");
  res.json(ListParkingLotsResponse.parse(lots));
});

export default router;
