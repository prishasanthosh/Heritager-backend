import { env, isZohoConfigured } from "../config/env.js";
import { ApiError } from "../utils/asyncHandler.js";

/**
 * Thin client for the Zoho Payments REST API.
 * Docs: https://www.zoho.com/payments/api/v1/
 *
 * Auth flow: a long-lived refresh token (generated once via Zoho's self-client
 * flow in the API console) is exchanged for a short-lived OAuth access token,
 * which is then sent as `Authorization: Zoho-oauthtoken <token>` on every call.
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    refresh_token: env.zoho.refreshToken,
    client_id: env.zoho.clientId,
    client_secret: env.zoho.clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(`${env.zoho.accountsDomain}/oauth/v2/token?${params.toString()}`, {
    method: "POST",
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };

  if (!res.ok || !data.access_token) {
    throw new ApiError(502, `Failed to authenticate with Zoho Payments: ${data.error ?? res.statusText}`);
  }

  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

async function zohoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const url = `${env.zoho.apiDomain}${path}${path.includes("?") ? "&" : "?"}account_id=${env.zoho.accountId}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Zoho-oauthtoken ${token}`,
      ...(init.headers ?? {}),
    },
  });

  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    throw new ApiError(502, `Zoho Payments error: ${data.message ?? res.statusText}`);
  }
  return data;
}

export type ZohoPaymentSession = {
  payments_session_id: string;
  access_key: string;
  status: string;
};

export async function createPaymentSession(params: {
  amountInRupees: number;
  currency?: string;
  description: string;
  orderId: string;
  customerEmail: string;
  customerPhone?: string;
  successUrl?: string;
  failureUrl?: string;
}) {
  if (!isZohoConfigured) {
    throw new ApiError(
      503,
      "Zoho Payments is not configured yet. Set the ZOHO_PAYMENTS_* variables in the backend environment."
    );
  }

  const successUrl = new URL(params.successUrl ?? env.zoho.redirectUrl);
  const failureUrl = new URL(params.failureUrl ?? env.zoho.redirectUrl);
  if (!params.successUrl) successUrl.searchParams.set("paymentResult", "success");
  if (!params.failureUrl) failureUrl.searchParams.set("paymentResult", "failure");

  const response = await zohoRequest<{ payments_session: ZohoPaymentSession }>("/api/v1/paymentsessions", {
    method: "POST",
    body: JSON.stringify({
      amount: params.amountInRupees.toFixed(2),
      currency: params.currency ?? "INR",
      invoice_number: params.orderId,
      meta_data: [{ key: "order_id", value: params.orderId }],
      configurations: {
        hosted_checkout_parameters: {
          success_url: successUrl.toString(),
          failure_url: failureUrl.toString(),
          description: params.description,
          email: params.customerEmail,
          ...(params.customerPhone ? { phone: params.customerPhone } : {}),
        },
      },
    }),
  });

  if (!response.payments_session?.payments_session_id || !response.payments_session.access_key) {
    throw new ApiError(502, "Zoho Payments did not return a valid checkout session");
  }

  return response.payments_session;
}

export type ZohoPayment = {
  payment_id: string;
  status: "succeeded" | "failed" | "pending" | "cancelled" | string;
  amount: string;
  currency: string;
  payments_session_id: string;
};

export async function getPaymentStatus(paymentId: string) {
  return zohoRequest<{ payment: ZohoPayment }>(
    `/api/v1/payments/${encodeURIComponent(paymentId)}`,
  );
}

export { isZohoConfigured };
