// AI Cost Control Tower: OpenAPI Ingestion Layer — API-key auth middleware
// Ported from Product-Studio-v9.37.01/proxy/middleware/apiKeyAuth.js — same
// Supabase schema/credential model, no logic changes.
//
// This is deliberately NOT built on requireAuth/requireCompanyAdmin (this
// proxy's existing JWT-based middlewares for /api/control-tower/settings) —
// those assume a human Supabase Auth session, which a machine credential
// never has. This middleware is the one auth path in this proxy that
// intentionally never touches a Supabase Auth session at all.
//
// Resolves the presented Bearer token to (company_id, app_id) by hashing it
// and matching mt_company_apps.credential_hash — the same SHA-256 format
// the credential-issuance RPCs write. Attaches req.companyId/req.appId, plus
// req.scopes/req.payloadCaptureEnabled.
//
// Exported as a factory (needs the caller's own supabaseAdmin client).

const crypto = require('crypto');

// Throttled credential_last_used_at write — module-level state is fine here:
// this proxy runs as a single Node process per instance.
const _credentialLastUsedThrottle = new Map(); // `${company_id}:${app_id}` -> ms timestamp
const CREDENTIAL_LAST_USED_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

function _touchCredentialLastUsedOpportunistic(supabaseAdmin, companyId, appId) {
  const key = companyId + ':' + appId;
  const now = Date.now();
  const last = _credentialLastUsedThrottle.get(key) || 0;
  if (now - last < CREDENTIAL_LAST_USED_THROTTLE_MS) return;
  _credentialLastUsedThrottle.set(key, now);
  // Fire-and-forget, never awaited by the request path and never throws
  // outward — a stale credential_last_used_at is a cosmetic gap, not
  // something worth adding latency or failure risk to every ingestion call.
  supabaseAdmin
    .from('mt_company_apps')
    .update({ credential_last_used_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .eq('app_id', appId)
    .then(function(result) {
      if (result && result.error) console.error('[V1 AUTH] credential_last_used_at update failed:', result.error.message);
    }, function(e) {
      console.error('[V1 AUTH] credential_last_used_at update exception:', e.message);
    });
}

// factory(supabaseAdmin) -> Express middleware
module.exports = function apiKeyAuthFactory(supabaseAdmin) {
  return async function apiKeyAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const presentedKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!presentedKey) {
      return res.status(401).json({
        error: { type: 'auth_error', message: 'Missing or malformed Authorization header. Expected: Bearer <api_key>' }
      });
    }

    if (!supabaseAdmin) {
      console.error('[V1 AUTH] supabaseAdmin not configured — SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing');
      return res.status(500).json({ error: { type: 'server_error', message: 'Ingestion API is not configured.' } });
    }

    // Canonical hash format: sha256, hex-encoded, plain string comparison
    // against credential_hash — same shape the credential-issuance RPCs write.
    const presentedHash = crypto.createHash('sha256').update(presentedKey).digest('hex');

    let row;
    let scopeColumnsAvailable = true;
    try {
      const { data, error } = await supabaseAdmin
        .from('mt_company_apps')
        .select('company_id, app_id, is_active, credential_hash, credential_expires_at, credential_revoked_at, scope_usage_write, scope_traces_write, scope_payloads_write, payload_capture_enabled')
        .eq('credential_hash', presentedHash)
        .maybeSingle();
      if (error) throw error;
      row = data;
    } catch (e) {
      // Postgres/PostgREST's "undefined_column" error (42703) is a specific
      // signal that the scope/toggle columns migration hasn't been applied
      // to this environment yet — falling back to the minimal select for
      // that one error code keeps every existing credential working (with
      // payload-capture simply unavailable) instead of the entire /v1 API
      // going down. Any other error still fails closed.
      if (e && e.code === '42703') {
        try {
          const { data, error: fallbackError } = await supabaseAdmin
            .from('mt_company_apps')
            .select('company_id, app_id, is_active, credential_hash')
            .eq('credential_hash', presentedHash)
            .maybeSingle();
          if (fallbackError) throw fallbackError;
          row = data;
          scopeColumnsAvailable = false;
        } catch (fallbackErr) {
          console.error('[V1 AUTH] credential lookup failed (fallback):', fallbackErr.message);
          return res.status(500).json({ error: { type: 'server_error', message: 'Could not verify credential.' } });
        }
      } else {
        console.error('[V1 AUTH] credential lookup failed:', e.message);
        return res.status(500).json({ error: { type: 'server_error', message: 'Could not verify credential.' } });
      }
    }

    if (!row || !row.is_active || !row.credential_hash || row.credential_revoked_at || (row.credential_expires_at && new Date(row.credential_expires_at).getTime() <= Date.now())) {
      return res.status(401).json({ error: { type: 'auth_error', message: 'Invalid or inactive credential.' } });
    }

    // company_id/app_id resolved here, server-side, from the credential —
    // never accepted as payload fields from the request body.
    req.companyId = row.company_id;
    req.appId = row.app_id;

    // scope_usage_write/scope_traces_write are reserved, non-enforced —
    // requirePayloadCaptureWrite.js is the only current consumer of these.
    // Defaults below (true/true/false/false) match the migration's own
    // column defaults exactly, for the pre-migration fallback above.
    req.scopes = {
      usageWrite: scopeColumnsAvailable ? row.scope_usage_write : true,
      tracesWrite: scopeColumnsAvailable ? row.scope_traces_write : true,
      payloadsWrite: scopeColumnsAvailable ? row.scope_payloads_write : false
    };
    req.payloadCaptureEnabled = scopeColumnsAvailable ? row.payload_capture_enabled : false;

    _touchCredentialLastUsedOpportunistic(supabaseAdmin, row.company_id, row.app_id);

    next();
  };
};
