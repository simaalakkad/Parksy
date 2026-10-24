import { Router, type IRouter } from "express";
import healthRouter from "./health";
import parkingLotsRouter from "./parking-lots";

const router: IRouter = Router();

router.use(healthRouter);
router.use(parkingLotsRouter);

export default router;
