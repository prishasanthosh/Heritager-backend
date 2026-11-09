import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { expireUnpaidZohoOrders } from "./services/expireUnpaidOrders.js";

async function main() {
  await connectDB();
  const app = createApp();
  const expirationTimer = setInterval(() => {
    void expireUnpaidZohoOrders()
      .then((count) => {
        if (count > 0) console.log(`[orders] expired ${count} unpaid Zoho checkout(s)`);
      })
      .catch((error: unknown) => console.error("[orders] unpaid checkout expiration failed", error));
  }, 5 * 60 * 1000);
  expirationTimer.unref();
  app.listen(env.port, () => {
    console.log(`[server] heritage-heart-backend listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error("[server] failed to start", err);
  process.exit(1);
});
