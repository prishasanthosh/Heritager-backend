import { Router } from "express";
import { getAdminDashboardOverview } from "../controllers/adminDashboardController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/dashboard", requireAuth, requireAdmin, getAdminDashboardOverview);

export default router;
