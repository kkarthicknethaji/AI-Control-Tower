// AI Trace Layer — Payload Capture Infrastructure
// Ported from Product-Studio-v9.37.01/proxy/middleware/requirePayloadCaptureWrite.js —
// no logic changes.
//
// Composed check for POST/GET /v1/trace-payloads — collapses two
// independently-remembered checks (the credential's own payloads:write
// scope, and the app's payload_capture_enabled toggle) into one middleware.
// Route-level only — never mount this globally, unlike apiKeyAuth.
//
// Depends on req.scopes/req.payloadCaptureEnabled, both attached by
// apiKeyAuth.js after its credential lookup.

function requirePayloadCaptureWrite(req, res, next) {
  if (!req.scopes || !req.scopes.payloadsWrite) {
    return res.status(403).json({ error: 'scope_not_allowed', message: 'This credential is not allowed to write this telemetry type.' });
  }
  if (!req.payloadCaptureEnabled) {
    return res.status(403).json({ error: 'payload_capture_disabled', message: 'Payload capture is disabled for this app credential.' });
  }
  next();
}

module.exports = { requirePayloadCaptureWrite };
