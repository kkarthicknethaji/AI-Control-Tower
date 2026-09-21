const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

function createAuthMiddleware(supabaseUrl) {
  const issuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : '';
  const jwksClient = supabaseUrl ? jwksRsa({ jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`, cache: true, cacheMaxEntries: 5, cacheMaxAge: 600000 }) : null;

  return function requireAuth(req, res, next) {
    if (req.method === 'OPTIONS') return next();
    const token = req.headers['x-auth-token'];
    if (!token || !jwksClient || !issuer) {
      return res.status(401).json({ error: { type: 'auth_error', message: 'Not authenticated.' } });
    }
    function getSigningKey(header, callback) {
      jwksClient.getSigningKey(header.kid, (error, key) => callback(error, key && key.getPublicKey()));
    }
    jwt.verify(token, getSigningKey, { algorithms: ['ES256', 'RS256'], issuer, audience: 'authenticated' }, (error, decoded) => {
      if (error || !decoded || typeof decoded.sub !== 'string') {
        return res.status(401).json({ error: { type: 'auth_error', message: 'Session expired or invalid.' } });
      }
      req.user = { id: decoded.sub, email: decoded.email };
      next();
    });
  };
}

module.exports = { createAuthMiddleware };
