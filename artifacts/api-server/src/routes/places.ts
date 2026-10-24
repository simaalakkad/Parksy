import { Router } from "express";
import { db, districtsTable, parkingLotsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { SearchPlacesQueryParams, SearchPlacesResponse } from "@workspace/api-zod";
import { geocodeIstanbul, normalize } from "../lib/public-map-services";

const router = Router();
router.get("/place-search", async (req, res): Promise<void> => {
  const parsed = SearchPlacesQueryParams.safeParse(req.query);
  if (!parsed.success || parsed.data.q.trim().length < 3) {
    res.status(400).json({ error: "Enter at least three characters." });
    return;
  }
  const { q, language = "tr" } = parsed.data;
  const needle = normalize(q.trim());
  const districts = await db.select().from(districtsTable);
  const neighborhoods = await db.select({
    name: parkingLotsTable.neighborhood, districtId: parkingLotsTable.districtId,
    lat: sql<number>`avg(${parkingLotsTable.lat})`, lng: sql<number>`avg(${parkingLotsTable.lng})`,
  }).from(parkingLotsTable).groupBy(parkingLotsTable.neighborhood, parkingLotsTable.districtId);
  const areas = [
    ...districts.filter((d) => normalize(`${d.nameTr} ${d.nameEn}`).includes(needle)).map((d) => ({
      id: `district:${d.id}`, kind: "district" as const, name: language === "tr" ? d.nameTr : d.nameEn,
      label: language === "tr" ? "İlçe · İstanbul" : "District · Istanbul", lat: d.centerLat, lng: d.centerLng,
    })),
    ...neighborhoods.filter((n) => n.name && normalize(n.name).includes(needle)).map((n) => ({
      id: `neighborhood:${n.districtId}:${n.name}`, kind: "neighborhood" as const, name: n.name,
      label: districts.find((d) => d.id === n.districtId)?.nameTr ?? "İstanbul", lat: Number(n.lat), lng: Number(n.lng),
    })),
  ];
  let places: Awaited<ReturnType<typeof geocodeIstanbul>> = [];
  let geocodingError: string | null = null;
  try { places = await geocodeIstanbul(q.trim(), language); }
  catch (err) { req.log.warn({ err }, "Place geocoding unavailable"); geocodingError = "geocoding_unavailable"; }
  const extraAreas = places.filter((p) => p.kind === "neighborhood"
    && !areas.some((area) => normalize(area.name) === normalize(p.name)));
  res.json(SearchPlacesResponse.parse({
    areas: [...areas, ...extraAreas].slice(0, 12),
    places: places.filter((p) => p.kind === "place"), geocoding_error: geocodingError,
  }));
});
export default router;
