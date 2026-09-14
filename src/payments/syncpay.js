const DEFAULT_API_BASE_URL = "https://api.syncpayments.com.br/api/partner/v1";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

const normalizeApiBaseUrl = (value) => {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return DEFAULT_API_BASE_URL;
  }

  const markdownUrlMatch = rawValue.match(/\((https?:\/\/[^)]+)\)/i);
  const plainUrlMatch = rawValue.match(/https?:\/\/[^\s)\]]+/i);
  const normalizedValue = markdownUrlMatch?.[1] || plainUrlMatch?.[0] || rawValue;

  try {
    const url = new URL(normalizedValue);
    const pathname = url.pathname.replace(/\/+$/, "");

    if (!pathname || pathname === "/") {
      url.pathname = "/api/partner/v1";
      return url.toString().replace(/\/+$/, "");
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    return normalizedValue.replace(/\/+$/, "");
  }
};

const getApiBaseUrl = () => normalizeApiBaseUrl(process.env.SYNCPAY_API_BASE_URL || DEFAULT_API_BASE_URL);
const getClientId = () => process.env.SYNCPAY_CLIENT_ID || process.env.SYNC_CLIENT_ID;
const getClientSecret = () => process.env.SYNCPAY_CLIENT_SECRET || process.env.SYNC_CLIENT_SECRET;

const toDigits = (value) => String(value || "").replace(/\D/g, "");

const normalizeAmount = (amount) => {
  const numericAmount = Number(amount || 0);

  if (!Number.isFinite(numericAmount)) {
    return 0;
  }

  return Math.round(numericAmount * 100) / 100;
};

const readJsonResponse = async (response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return { raw: text };
  }
};

const normalizeErrorMessage = (payload, fallback) => {
  if (payload?.message) {
    return payload.message;
  }

  if (payload?.error_description) {
    return payload.error_description;
  }

  if (payload?.errors && typeof payload.errors === "object") {
    const details = Object.values(payload.errors).flat().filter(Boolean).join(" ");
    return details || fallback;
  }

  return fallback;
};

const getAccessToken = async () => {
  const now = Date.now();

  if (cachedToken && cachedTokenExpiresAt - 30000 > now) {
    return cachedToken;
  }

  const clientId = getClientId();
  const clientSecret = getClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais da SyncPay não configuradas.");
  }

  const response = await fetch(`${getApiBaseUrl()}/auth-token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  const payload = await readJsonResponse(response);

  if (!response.ok || payload?.message === "Unauthenticated.") {
    throw new Error(normalizeErrorMessage(payload, "Não foi possível autenticar na SyncPay."));
  }

  cachedToken = payload?.access_token || null;
  cachedTokenExpiresAt = payload?.expires_at
    ? new Date(payload.expires_at).getTime()
    : now + Number(payload?.expires_in || 3600) * 1000;

  if (!cachedToken) {
    throw new Error("A SyncPay não retornou access_token.");
  }

  return cachedToken;
};

const normalizePixBlock = (payload) => {
  const transaction = payload?.transaction || payload?.data || {};

  return {
    code:
      payload?.pix_code ||
      payload?.pixCode ||
      transaction.pix_code ||
      transaction.pixCode ||
      null,
    image: payload?.pix_image || payload?.pixImage || transaction.pix_image || null,
    expiresAt: payload?.expires_at || payload?.expiresAt || null,
    base64: ""
  };
};

const normalizeTransactionPayload = (payload, fallbackPaymentMethod = "pix") => {
  const transaction = payload?.transaction || payload?.data || payload || {};
  const transactionId =
    payload?.identifier ||
    payload?.id ||
    payload?.reference_id ||
    transaction.reference_id ||
    transaction.id ||
    null;
  const paymentStatus = String(
    transaction.status ||
      payload?.status ||
      payload?.payment_status ||
      ""
  ).trim();
  const paymentMethod = String(
    transaction.payment_method || payload?.payment_method || fallbackPaymentMethod || "pix"
  ).trim();

  return {
    id: transactionId,
    hash: transactionId,
    status: paymentStatus || "pending",
    paymentStatus: paymentStatus || "pending",
    paymentMethod,
    amount: transaction.amount ?? payload?.amount ?? null,
    order: { id: transactionId },
    customer: payload?.client || payload?.customer || transaction.client || transaction.customer || null,
    details: payload?.details || null,
    postbackUrl: payload?.webhook_url || payload?.callback_url || null,
    pix: normalizePixBlock(payload),
    raw: payload
  };
};

export const createSyncPixPayment = async ({
  identifier,
  amount,
  client,
  metadata,
  callbackUrl,
  paymentMethod = "pix"
}) => {
  if (!client?.name || !client?.email || !client?.phone || !client?.document) {
    throw new Error("Dados do cliente incompletos para gerar a cobrança na SyncPay.");
  }

  const accessToken = await getAccessToken();
  const body = {
    amount: normalizeAmount(amount),
    description: String(metadata?.invoiceTitle || identifier || "Cobrança PRIME LEILÕES").trim(),
    webhook_url: callbackUrl,
    client: {
      name: String(client.name).trim(),
      cpf: toDigits(client.document),
      email: String(client.email).trim().toLowerCase(),
      phone: toDigits(client.phone)
    }
  };

  const response = await fetch(`${getApiBaseUrl()}/cash-in`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await readJsonResponse(response);

  if (!response.ok || payload?.message === "Unauthenticated." || payload?.errors) {
    throw new Error(normalizeErrorMessage(payload, "Não foi possível gerar a cobrança PIX na SyncPay."));
  }

  return normalizeTransactionPayload(
    {
      ...payload,
      payment_method: paymentMethod,
      status: payload?.status || "pending"
    },
    paymentMethod
  );
};

export const fetchSyncTransaction = async ({ id, identifier }) => {
  const transactionId = String(id || identifier || "").trim();

  if (!transactionId) {
    throw new Error("Identificador da transação SyncPay não informado.");
  }

  const accessToken = await getAccessToken();
  const response = await fetch(`${getApiBaseUrl()}/transaction/${encodeURIComponent(transactionId)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await readJsonResponse(response);

  if (!response.ok || payload?.message === "Unauthenticated.") {
    throw new Error(normalizeErrorMessage(payload, "Não foi possível consultar a transação na SyncPay."));
  }

  return normalizeTransactionPayload(payload);
};

export const createIronPixPayment = createSyncPixPayment;
export const fetchIronTransaction = fetchSyncTransaction;
