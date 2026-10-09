// Mints a long-lived "service_role" JWT for the enterprise proxy to send to
// a self-hosted PostgREST instance as CT_DATA_API_SERVICE_KEY — the
// PostgREST-fronted equivalent of a Supabase project's service_role key.
//
// PostgREST only needs a JWT whose payload satisfies its configured
// PGRST_JWT_ROLE_CLAIM_KEY (default: .role) — it does not use Supabase's
// GoTrue token shape at all. Run with:
//   PGRST_JWT_SECRET=... node scripts/generate-postgrest-service-jwt.js

const jwt = require('jsonwebtoken');

const secret = process.env.PGRST_JWT_SECRET;
if (!secret) {
  console.error('Set PGRST_JWT_SECRET in the environment before running this script.');
  process.exit(1);
}

const token = jwt.sign(
  { role: 'service_role' },
  secret,
  { algorithm: 'HS256' } // no expiry: this is a server-to-server credential, rotate via PGRST_JWT_SECRET change, not token expiry
);

console.log(token);
