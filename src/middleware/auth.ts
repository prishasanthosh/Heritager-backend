import type { NextFunction, Request, Response } from "express";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "../utils/jwt.js";
import { ApiError } from "../utils/asyncHandler.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_COOKIE_NAME];
  if (!token) {
    return next(new ApiError(401, "Not authenticated"));
  }
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new ApiError(401, "Session expired, please log in again"));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_COOKIE_NAME];
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // ignore invalid/expired token for optional auth
    }
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new ApiError(401, "Not authenticated"));
  }
  if (req.user.role !== "admin") {
    return next(new ApiError(403, "Admin access required"));
  }
  next();
}
