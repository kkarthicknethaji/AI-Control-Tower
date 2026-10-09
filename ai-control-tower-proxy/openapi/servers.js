// Resolves the OpenAPI `servers` entry for /docs/openapi.json.
// Precedence: PUBLIC_BASE_URL (validated) > request host (validated) > fallback.
const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$|^\[[0-9a-f:]+\](:\d{1,5})?$/i;

// Returns a normalized origin-style base URL, or null if unset/invalid.
function parsePublicBaseUrl(raw) {
  const value = (raw || '').trim().replace(/\/+$/, '');
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return value;
  } catch {
    return null;
  }
}

function resolveServers(req, { publicBaseUrl, fallbackPort }) {
  if (publicBaseUrl) return [{ url: publicBaseUrl, description: 'Configured public URL' }];
  // Prefer X-Forwarded-Host (first value) — Express only trusts it via `trust proxy`.
  const forwarded = req.app.get('trust proxy') ? (req.get('x-forwarded-host') || '').split(',')[0].trim() : '';
  const host = forwarded || req.get('host') || '';
  if (!HOST_RE.test(host)) {
    return [{ url: `http://127.0.0.1:${fallbackPort}`, description: 'Local development (this proxy)' }];
  }
  return [{ url: `${req.protocol}://${host}`, description: 'This server' }];
}

module.exports = { parsePublicBaseUrl, resolveServers };
