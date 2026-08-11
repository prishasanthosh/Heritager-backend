import { Router } from "express";
import { addAddress, deleteAddress, listUsers, setUserRole, updateProfile } from "../controllers/userController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.patch("/me", updateProfile);
router.post("/me/addresses", addAddress);
router.delete("/me/addresses/:addressId", deleteAddress);

router.get("/", requireAdmin, listUsers);
router.patch("/:id/role", requireAdmin, setUserRole);

export default router;
