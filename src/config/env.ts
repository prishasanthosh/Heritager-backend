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

export const env = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",

  mongoUri: withDefaultMongoDatabase(
    required("MONGODB_URI", "mongodb://127.0.0.1:27017/heritage-heart"),
    "heritage-heart"
  ),

  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,

  adminBootstrapEmail: (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "").toLowerCase(),

  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },

  zoho: {
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

export const isCloudinaryConfigured = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);
