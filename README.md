# Heritage Heart backend

## Volunteer migration

The migration command is read-only unless `--apply` is passed. It reports the
environment and sanitized database target, volunteer/donation counts, existing
records that need defaults or email normalization, duplicate volunteer emails,
and conflicting indexes.

### Required execution checklist

1. Select the intended deployment environment and verify its
   `MONGODB_URI` target. Never rely on a developer machine's `.env` for a
   production run.
2. In MongoDB Atlas, verify the project, cluster, and database name. Create an
   on-demand snapshot or verify a recent completed Atlas backup exists and is
   restorable. Record its completion time. A backup's existence cannot be
   proven by this script.
3. Run the preflight below from the backend repository. Confirm the printed
   environment and sanitized host/database match the approved target. Resolve
   every reported duplicate-email group or index conflict before applying.
4. Confirm the report's expected data changes with the data owner. Existing
   volunteer email values are trimmed/lowercased; missing registration sources
   become `standalone`; missing interest lists become `[]`. Donation/order
   records are not modified.
5. Only after backup and preflight checks pass, run the apply command with the
   exact target string printed by the preflight. The operator must explicitly
   approve the production change before running it.

Run the preflight against the intended environment:

```powershell
npm run migrate:volunteers
```

Before applying, verify the reported target and environment, resolve any
duplicate email groups or index conflicts, and make and verify a restorable
database backup/snapshot. Existing volunteer email values that contain casing
or surrounding whitespace will be normalized; records without a source will be
marked `standalone`, and records without an interest list will receive an empty
list. No volunteer, donation, or order records are deleted, and the migration
does not modify donation or order contents. It creates volunteer email,
source/date, donation, and order indexes plus a partial unique donation
idempotency-key index.

Only after explicit approval and backup verification, copy the exact target
printed by the preflight into this command:

```powershell
npm run migrate:volunteers -- --apply --backup-confirmed --confirm-target="HOST/DATABASE"
```

`--backup-confirmed` is an operator attestation; the script cannot inspect
MongoDB Atlas backup settings. `--confirm-target` must exactly match the
sanitized host/database reported by the preflight. The apply mode stops before
writing if normalized duplicate volunteer emails or incompatible indexes are
found.

Do not run apply mode against a production database until the environment,
duplicates, index compatibility, and backup have been independently verified.

## Book donation email

Automated delivery is disabled unless `ENABLE_BOOK_DONATION_EMAILS=true`.
Keep it `false` for this deployment; book-donation submissions are stored and
volunteer registration is unaffected. When later enabled, confirmations use
SMTP configured through `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASSWORD`. The sender and Reply-To are
fixed to `info@indianheritager.com`. The receiving mailbox, domain mail
records, and ability to accept replies/attachments must be configured and
verified with the mail provider separately.

After setting SMTP variables in the backend deployment environment, run
`npm run verify:smtp` to authenticate the transport without sending an email.
Template content checks run with `npm run test:email`. To verify delivery in
production, use an approved internal recipient and a real book-donation
submission; the returned email status and message ID are saved with the
donation. SMTP alone does not configure inbound mail; set up the mailbox,
MX/SPF/DKIM/DMARC with the domain's mail provider and verify replies and
attachments in that mailbox.

## Zoho Payments for book orders

Online payments are disabled unless `ENABLE_ZOHO_PAYMENTS=true` and valid Zoho
credentials are present. Keep the backend flag and both frontend build flags
(`VITE_ZOHO_PAYMENTS_ENABLED`) false for this deployment. Book checkout
continues to offer Cash on Delivery; the backend rejects any direct Zoho
checkout request while disabled. General online donations show an unavailable
message and the backend does not create a pending donation or payment session.
The Zoho implementation and verification callbacks remain in place for later
enablement.

The shop checkout creates a Zoho payment session, redirects to the hosted
checkout URL, and returns through
`{PUBLIC_API_URL}/api/orders/{orderId}/zoho-callback`. The return handler fetches
the payment from Zoho and checks payment ID, session ID, amount, and currency
before marking an order paid or creating its linked volunteer application.
Unpaid Zoho orders are cancelled and stock is released after
`UNPAID_ORDER_EXPIRY_MINUTES` (minimum 15 minutes). A late verified payment is
left for manual review instead of creating a volunteer registration.

Optionally configure the Zoho Payments dashboard webhook to POST payment
events containing `payment_id` to
`{PUBLIC_API_URL}/api/orders/zoho-webhook`. The handler does not trust webhook
status or amount fields; it fetches the payment from Zoho before changing an
order. The endpoint is rate-limited. Ensure the Zoho account has the required
payment-read scope and test the dashboard event payload and return parameters
in the provider's test environment before enabling it in production.

Required deployment values include the existing `ZOHO_PAYMENTS_*` credentials,
`PUBLIC_API_URL`, `SHOP_URL`, and `UNPAID_ORDER_EXPIRY_MINUTES`. The configured
success/failure return flow assumes Zoho returns the payment ID as
`payment_id` or `paymentId`; verify this parameter shape in Zoho's current
account-specific documentation before production rollout.

## Deployment configuration checklist

- Backend: set `NODE_ENV=production`, the verified `MONGODB_URI`, long random
  JWT secrets, `COOKIE_SAME_SITE=none` while the API uses the Render hostname,
  `ENABLE_BOOK_DONATION_EMAILS=false`, and `ENABLE_ZOHO_PAYMENTS=false`.
- Set backend `CORS_ORIGINS` to the deployed main-site, admin, and books-site
  origins. Production configuration filters localhost origins; the API
  explicitly allows `https://indianheritager.org`,
  `https://www.indianheritager.org`, `https://admin.indianheritager.org`, and
  `https://books.indianheritager.org`.
- Set frontend build-time `VITE_API_URL=https://heritager-backend.onrender.com/api`
  for the main site, shop, and admin. Set `VITE_ZOHO_PAYMENTS_ENABLED=false`
  for the main site and shop builds. Do not copy developer `.env` files into
  production.
- `COOKIE_DOMAIN` should remain empty while the API is served from
  `onrender.com`. Cross-site cookies can be restricted by browser privacy
  settings; a same-site custom API domain and production login tests may be
  required before relying on authenticated shop/admin sessions.
- The configured production database target was previously read-only checked
  as `cluster0.udjjrkz.mongodb.net/heritage-heart`. The migration has not been
  applied. After explicit approval, confirming a restorable backup, and
  rerunning a clean preflight against this exact target, the guarded command
  is:

```powershell
npm run migrate:volunteers -- --apply --backup-confirmed --confirm-target="cluster0.udjjrkz.mongodb.net/heritage-heart"
```

Do not run this command without explicit approval. The prior read-only check
found 2 volunteer records and 20 book donations, no duplicate normalized
volunteer emails, no conflicting indexes, and no existing donation records
expected to change; independently rerun the preflight because production data
may have changed.
