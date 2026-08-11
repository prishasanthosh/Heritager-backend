import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  role: "customer" | "admin";
};

export type RefreshTokenPayload = {
  sub: string;
  tokenVersion: number;
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions["expiresIn"] });
}

export function signRefreshToken(payload: RefreshTokenPayload) {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpiresIn as jwt.SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload & jwt.JwtPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload & jwt.JwtPayload;
}

const msPerDay = 24 * 60 * 60 * 1000;

export const accessCookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? ("none" as const) : ("lax" as const),
  domain: env.cookieDomain,
  maxAge: 15 * 60 * 1000,
  path: "/",
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? ("none" as const) : ("lax" as const),
  domain: env.cookieDomain,
  maxAge: 30 * msPerDay,
  path: "/api/auth",
};

export const ACCESS_COOKIE_NAME = "ihf_access_token";
export const REFRESH_COOKIE_NAME = "ihf_refresh_token";
