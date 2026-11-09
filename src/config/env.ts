import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function withDefaultMongoDatabase(uri: string, database: string): string {
  const parsed = new URL(uri);
  if (!parsed.pathname || parsed.pathname === "/") {
    parsed.pathname = `/${database}`;
  }
  return parsed.toString();
}

const isProd = process.env.NODE_ENV === "production";
const configuredCorsOrigins = (process.env.CORS_ORIGINS ??
  (isProd
    ? "https://indianheritager.org,https://www.indianheritager.org"
    : "http://localhost:5173"))
  .split(",")
  .map((origin) => origin.trim())
  .filter(
    (origin) =>
      Boolean(origin) &&
      (!isProd || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)),
  );

export const env = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd,

  mongoUri: withDefaultMongoDatabase(
    required("MONGODB_URI", "mongodb://127.0.0.1:27017/heritage-heart"),
    "heritage-heart"
  ),

  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSameSite: (process.env.COOKIE_SAME_SITE?.toLowerCase() === "lax"
    ? "lax"
    : process.env.COOKIE_SAME_SITE?.toLowerCase() === "strict"
      ? "strict"
      : "none") as "lax" | "strict" | "none",

  adminBootstrapEmail: (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "").toLowerCase(),

  corsOrigins: Array.from(new Set([
    ...configuredCorsOrigins,
    "https://indianheritager.org",
    "https://www.indianheritager.org",
    "https://admin.indianheritager.org",
    "https://books.indianheritager.org",
  ])),

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },

  email: {
    enabled: process.env.ENABLE_BOOK_DONATION_EMAILS === "true",
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
  },

  shopUrl: process.env.SHOP_URL ?? "https://books.indianheritager.org",
  publicApiUrl: process.env.PUBLIC_API_URL ?? "https://heritager-backend.onrender.com",
  unpaidOrderExpiryMinutes: Number(process.env.UNPAID_ORDER_EXPIRY_MINUTES ?? 60),

  zoho: {
    paymentsEnabled: process.env.ENABLE_ZOHO_PAYMENTS === "true",
    accountId: process.env.ZOHO_PAYMENTS_ACCOUNT_ID ?? "",
    clientId: process.env.ZOHO_PAYMENTS_CLIENT_ID ?? "",
    clientSecret: process.env.ZOHO_PAYMENTS_CLIENT_SECRET ?? "",
    refreshToken: process.env.ZOHO_PAYMENTS_REFRESH_TOKEN ?? "",
    apiDomain: process.env.ZOHO_PAYMENTS_API_DOMAIN ?? "https://payments.zoho.in",
    accountsDomain: process.env.ZOHO_ACCOUNTS_DOMAIN ?? "https://accounts.zoho.in",
    redirectUrl: process.env.ZOHO_PAYMENTS_REDIRECT_URL ?? "http://localhost:5174/order-confirmation",
    donationReturnUrl:
      process.env.ZOHO_PAYMENTS_DONATION_RETURN_URL ?? "http://localhost:8080/donation-success",
  },
};

export const isZohoConfigured = Boolean(
  env.zoho.accountId && env.zoho.clientId && env.zoho.clientSecret && env.zoho.refreshToken
);

export const isZohoPaymentsEnabled = env.zoho.paymentsEnabled && isZohoConfigured;

export const isCloudinaryConfigured = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);
