import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message });
  }

  if (err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === 11000) {
    return res.status(409).json({ message: "A record with these details already exists" });
  }

  if (err && typeof err === "object" && "name" in err && (err as { name: unknown }).name === "ValidationError") {
    return res.status(400).json({ message: (err as Error).message });
  }

  console.error(err);
  res.status(500).json({
    message: "Something went wrong on our end",
    ...(env.isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
}
