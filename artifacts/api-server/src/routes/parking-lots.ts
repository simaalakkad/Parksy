import { Router, type IRouter } from "express";
import { db, parkingLotsTable } from "@workspace/db";
import { ListParkingLotsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/parking-lots", async (req, res): Promise<void> => {
  const rows = await db.select().from(parkingLotsTable).orderBy(parkingLotsTable.id);
  const lots = rows.map((lot) => ({
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
  }));

  req.log.info({ count: lots.length }, "Fetched parking lots");
  res.json(ListParkingLotsResponse.parse(lots));
});

export default router;
