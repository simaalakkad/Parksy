import { Router, type IRouter } from "express";
import healthRouter from "./health";
import parkingLotsRouter from "./parking-lots";
import placesRouter from "./places";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(parkingLotsRouter);
router.use(placesRouter);
router.use(reportsRouter);

export default router;
