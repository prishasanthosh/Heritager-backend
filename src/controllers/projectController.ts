import type { Request, Response } from "express";
import { z } from "zod";
import { Project } from "../models/Project.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const listActiveProjects = asyncHandler(async (_req: Request, res: Response) => {
  const projects = await Project.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  res.json({ projects });
});

// --- Admin ---

export const listAllProjects = asyncHandler(async (_req: Request, res: Response) => {
  const projects = await Project.find().sort({ sortOrder: 1, name: 1 });
  res.json({ projects });
});

const projectSchema = z.object({
  name: z.string().min(2).max(80),
  sortOrder: z.coerce.number().optional().default(0),
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const data = projectSchema.parse(req.body);
  const project = await Project.create({ ...data, slug: slugify(data.name) });
  res.status(201).json({ project });
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const data = projectSchema.partial().extend({ isActive: z.boolean().optional() }).parse(req.body);
  const update: Record<string, unknown> = { ...data };
  if (data.name) update.slug = slugify(data.name);

  const project = await Project.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!project) throw new ApiError(404, "Project not found");
  res.json({ project });
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await Project.findByIdAndDelete(req.params.id);
  if (!project) throw new ApiError(404, "Project not found");
  res.json({ message: "Project deleted" });
});
