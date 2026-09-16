export const PRODUCTION_ORIGIN = 'https://primeveiculosemaquinas.com.br';
export function publicOrigin(configured = PRODUCTION_ORIGIN) {
  try {
    const url = new URL(configured);
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return url.origin;
  } catch (_) { /* Use the company's public domain. */ }
  return PRODUCTION_ORIGIN;
}
export const clientLink = (page, token, origin) => `${publicOrigin(origin)}/${page}?token=${encodeURIComponent(token || '')}`;
