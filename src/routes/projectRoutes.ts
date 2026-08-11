import { Router } from "express";
import { createProject, deleteProject, listActiveProjects, listAllProjects, updateProject } from "../controllers/projectController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", listActiveProjects);
router.get("/all", requireAuth, requireAdmin, listAllProjects);
router.post("/", requireAuth, requireAdmin, createProject);
router.put("/:id", requireAuth, requireAdmin, updateProject);
router.delete("/:id", requireAuth, requireAdmin, deleteProject);

export default router;
