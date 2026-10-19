import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  accessCookieOptions,
  refreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { env } from "../config/env.js";

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  phone: z.string().min(6).max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function issueSession(res: Response, user: { id: string; role: "customer" | "admin"; refreshTokenVersion: number }) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.refreshTokenVersion });
  res.cookie(ACCESS_COOKIE_NAME, accessToken, accessCookieOptions);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, phone } = registerSchema.parse(req.body);

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const role = env.adminBootstrapEmail && email.toLowerCase() === env.adminBootstrapEmail ? "admin" : "customer";

  const user = await User.create({ name, email: email.toLowerCase(), passwordHash, phone, role });

  await issueSession(res, { id: user.id, role: user.role, refreshTokenVersion: user.refreshTokenVersion });
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password");
  }

  await issueSession(res, { id: user.id, role: user.role, refreshTokenVersion: user.refreshTokenVersion });
  res.json({ user });
});

export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || user.role !== "admin") {
    throw new ApiError(401, "Invalid admin credentials");
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    throw new ApiError(401, "Invalid admin credentials");
  }

  await issueSession(res, { id: user.id, role: user.role, refreshTokenVersion: user.refreshTokenVersion });
  res.json({ user });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await User.findById(req.user!.sub);
  if (!user || user.role !== "admin") {
    throw new ApiError(403, "Admin access required");
  }

  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, "Current password is incorrect");
  }
  if (await user.comparePassword(newPassword)) {
    throw new ApiError(400, "New password must be different from your current password");
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.refreshTokenVersion += 1;
  await user.save();
  await issueSession(res, { id: user.id, role: user.role, refreshTokenVersion: user.refreshTokenVersion });
  res.json({ message: "Password changed successfully" });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw new ApiError(401, "Not authenticated");
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, "Session expired, please log in again");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.refreshTokenVersion !== payload.tokenVersion) {
    throw new ApiError(401, "Session expired, please log in again");
  }

  await issueSession(res, { id: user.id, role: user.role, refreshTokenVersion: user.refreshTokenVersion });
  res.json({ user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await User.findByIdAndUpdate(payload.sub, { $inc: { refreshTokenVersion: 1 } });
    } catch {
      // token already invalid — nothing to invalidate server-side
    }
  }
  res.clearCookie(ACCESS_COOKIE_NAME, { ...accessCookieOptions, maxAge: 0 });
  res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions, maxAge: 0 });
  res.json({ message: "Logged out" });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Not authenticated");
  }
  const user = await User.findById(req.user.sub);
  if (!user) {
    throw new ApiError(401, "Not authenticated");
  }
  res.json({ user });
});
