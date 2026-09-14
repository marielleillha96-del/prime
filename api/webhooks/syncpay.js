import { findInvoiceByIronTransactionHash, findInvoiceByPublicToken, syncInvoiceWithIron } from "../../src/invoices/repository.js";
import { handleOptions, sendJson } from "../_lib/http.js";

const getBearerToken = (authorization) => {
  const value = String(authorization || "").trim();
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : value;
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    return sendJson(req, res, 405, { message: "Método não permitido." });
  }

  try {
    const payload = req.body || {};
    const expectedToken = process.env.SYNCPAY_WEBHOOK_TOKEN;
    const incomingToken =
      getBearerToken(req.headers.authorization) ||
      req.query?.token ||
      req.headers["x-webhook-token"] ||
      req.headers["x-syncpay-token"];

    if (expectedToken && incomingToken !== expectedToken) {
      return sendJson(req, res, 401, { message: "Token de webhook inválido." });
    }

    const transactionId = payload.id || payload.reference_id || payload.identifier || null;
    const invoice =
      (transactionId && (await findInvoiceByIronTransactionHash(transactionId))) ||
      (transactionId && (await findInvoiceByPublicToken(String(transactionId).trim())));

    if (!invoice) {
      return sendJson(req, res, 200, { received: true, matched: false });
    }

    const normalizedTransaction = {
      id: transactionId || invoice.ironTransactionHash || invoice.sigiloTransactionId,
      hash: transactionId || invoice.ironTransactionHash || invoice.sigiloTransactionId,
      status: payload.status || invoice.ironStatus || invoice.sigiloStatus,
      paymentStatus: payload.status || invoice.ironStatus || invoice.sigiloStatus,
      paymentMethod: payload.payment_method || invoice.ironPaymentMethod || invoice.sigiloPaymentMethod || "pix",
      payedAt: String(payload.status || "").toLowerCase() === "completed" ? payload.updated_at || payload.paid_at || null : null,
      pixInformation: {
        qrCode: payload.pix_code || invoice.ironPixCode || invoice.pixCode || null,
        image: invoice.ironPixImage || invoice.pixImage || null
      },
      details: {
        endToEnd: payload.end_to_end || null,
        finalAmount: payload.final_amount || null,
        origin: payload.origin || null
      },
      event: "cashin.updated"
    };

    await syncInvoiceWithIron(invoice, normalizedTransaction);
    return sendJson(req, res, 200, { received: true, matched: true });
  } catch (error) {
    console.error(error);
    return sendJson(req, res, 500, { message: "Erro ao processar webhook da SyncPay." });
  }
}
