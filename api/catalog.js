import {
  findPublicCatalogItemBySlug,
  listPublicCatalogItems
} from "../src/admin/repository.js";
import { handleOptions, sendJson, getQueryParam } from "./_lib/http.js";

const setNoCache = (res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) {
    return;
  }

  setNoCache(res);

  if (req.method !== "GET") {
    return sendJson(req, res, 405, { message: "Método não permitido." });
  }

  const action = getQueryParam(req, "action");

  try {
    if (action === "items") {
      const rawLimit = getQueryParam(req, "limit");
      const numericLimit = rawLimit ? Number(rawLimit) : null;
      const limit = Number.isFinite(numericLimit) && numericLimit > 0
        ? Math.floor(numericLimit)
        : null;

      const items = await listPublicCatalogItems({
        section: getQueryParam(req, "section") || null,
        category: getQueryParam(req, "category") || null,
        search: getQueryParam(req, "search") || null,
        excludeSlug: getQueryParam(req, "excludeSlug") || null,
        limit
      });

      return sendJson(req, res, 200, { items });
    }

    if (action === "detail") {
      const slug = String(getQueryParam(req, "slug") || "").trim();
      if (!slug) {
        return sendJson(req, res, 400, { message: "Slug do item não informado." });
      }

      const item = await findPublicCatalogItemBySlug(slug);
      if (!item) {
        return sendJson(req, res, 404, { message: "Item não encontrado." });
      }

      return sendJson(req, res, 200, { item });
    }

    return sendJson(req, res, 404, { message: "Rota do catálogo não encontrada." });
  } catch (error) {
    console.error(error);
    return sendJson(req, res, 500, { message: "Erro ao carregar o catálogo." });
  }
}
