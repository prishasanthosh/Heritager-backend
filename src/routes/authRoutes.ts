import { Router } from "express";
import rateLimit from "express-rate-limit";
import { adminLogin, changePassword, login, logout, me, refresh, register } from "../controllers/authController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/admin/login", authLimiter, adminLogin);
router.post("/change-password", requireAuth, requireAdmin, changePassword);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
