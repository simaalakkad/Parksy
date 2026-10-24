import { db, pool, districtsTable, parkingLotsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { hubCoordinates, istanbulDistricts } from "./data/istanbul-districts";

// Explicit manual development setup, never invoked from startup or publishing.
if (process.env.NODE_ENV === "production") throw new Error("Demo seeding is prohibited in production.");
try {
  await db.transaction(async (tx) => {
    for (const [nameTr, nameEn, centerLat, centerLng, areas] of istanbulDistricts) {
      const [district] = await tx.insert(districtsTable).values({ nameTr, nameEn, centerLat, centerLng })
        .onConflictDoUpdate({ target: districtsTable.nameTr, set: { nameEn, centerLat, centerLng } }).returning();
      if (nameTr === "Fatih") {
        // Only the already-marked original demo fixtures; never classify imports by name.
        await tx.update(parkingLotsTable).set({ districtId: district.id, source: "demo", neighborhood: "Fatih" })
          .where(and(eq(parkingLotsTable.isDemo, true), isNull(parkingLotsTable.districtId)));
      }
      for (let i = 0; i < areas.length; i++) {
        const [lat, lng] = hubCoordinates[nameTr]?.[i] ?? [centerLat + (i - 2) * 0.0015, centerLng + (i % 3 - 1) * 0.002];
        const capacity = 40 + i * 25;
        await tx.insert(parkingLotsTable).values({
          demoKey: `istanbul:${nameEn}:${i}`, source: "demo", isDemo: true,
          districtId: district.id, neighborhood: areas[i],
          name: `${areas[i]} Örnek Otoparkı`, lat, lng, capacity,
          freeSpots: [0, 4, 35, 8, 80][i], pricePerHour: 60 + i * 20,
          hours: i % 2 === 0 ? "24 saat" : "07:00–23:00",
          isCovered: i % 2 === 0, hasEvCharging: i === 2 || i === 4, updatedAt: new Date(),
        }).onConflictDoNothing({ target: parkingLotsTable.demoKey });
      }
    }
    const unassigned = await tx.select({ id: parkingLotsTable.id }).from(parkingLotsTable).where(isNull(parkingLotsTable.districtId));
    if (unassigned.length) throw new Error("Unassigned non-demo lots exist. Assign their districts explicitly before enforcing district_id.");
  });
  console.info("Istanbul demo setup complete: 39 districts; 5 fictional lots per district. Existing demo lots preserved.");
} finally {
  await pool.end();
}
