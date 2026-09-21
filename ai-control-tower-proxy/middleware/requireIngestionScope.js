// Ported from Product-Studio-v9.37.01/proxy/middleware/requireIngestionScope.js —
// no logic changes. Depends on req.scopes, attached by apiKeyAuth.js.
function requireIngestionScope(scope) {
  return function ingestionScopeGuard(req, res, next) {
    const allowed = scope === 'usage' ? req.scopes && req.scopes.usageWrite : scope === 'traces' ? req.scopes && req.scopes.tracesWrite : false;
    if (!allowed) {
      return res.status(403).json({ error: 'scope_not_allowed', message: 'This credential is not allowed to write this telemetry type.' });
    }
    next();
  };
}

module.exports = { requireIngestionScope };
