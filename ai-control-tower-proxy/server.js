const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const { createClient } = require('@supabase/supabase-js');
const { createAuthMiddleware } = require('./middleware/requireAuth');
const { createCompanyAdminMiddleware } = require('./middleware/requireCompanyAdmin');
const apiKeyAuth = require('./middleware/apiKeyAuth');
const createSettingsRouter = require('./routes/settings');
const createModelPricingRouter = require('./routes/modelPricing');
const usageEventsRouter = require('./routes/v1/usageEvents');
const outcomesRouter = require('./routes/v1/outcomes');
const outcomeTypesRouter = require('./routes/v1/outcomeTypes');
const companyAppsRouter = require('./routes/v1/companyApps');
const tracesRouter = require('./routes/v1/traces');
const toolSpansRouter = require('./routes/v1/toolSpans');
const tracePayloadsRouter = require('./routes/v1/tracePayloads');

const app = express();
const port = Number(process.env.PORT || 3001);
const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://127.0.0.1:5174,http://localhost:5174').split(',').map((origin) => origin.trim()).filter(Boolean);
const apiReferenceUrl = String(process.env.CT_API_REFERENCE_URL || '').trim();
const supabaseAdmin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
const RATE_LIMIT_MAX = 100; // requests per window per IP, matches the ported /v1 ingestion contract
const RATE_LIMIT_WINDOW_MIN = 1;

app.use(cors({ origin: allowedOrigins, credentials: false }));
app.get('/', (req, res) => res.json({ status: 'ok', service: 'ai-control-tower-proxy' }));

// ── AI Cost Control Tower: Ingestion API (/v1) ───────────────────────────────
// Ported from Product-Studio-v9.37.01/proxy/server.js — same shared Supabase
// tables/RPCs, standard HTTP status codes (not this proxy's settings-route
// convention). Rate limiter mounted ahead of apiKeyAuth so an over-limit
// caller is rejected before a credential lookup is spent on it; apiKeyAuth
// runs before express.json() so an invalid credential is rejected before any
// effort is spent parsing a potentially large, untrusted batch body.
const v1IngestionLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    error: { type: 'rate_limit_error', message: `Too many requests — limit is ${RATE_LIMIT_MAX} per minute. Please wait and try again.` }
  })
});
app.use('/v1', v1IngestionLimiter);
app.use('/v1', apiKeyAuth(supabaseAdmin));
app.use('/v1', express.json({ limit: '2mb' }));
app.use('/v1', function (err, req, res, next) {
  if (err) return res.status(400).json({ error: { type: 'invalid_request', message: 'Malformed JSON body or payload too large.' } });
  next();
});
app.use('/v1', usageEventsRouter(supabaseAdmin));
app.use('/v1', outcomesRouter(supabaseAdmin));
app.use('/v1', outcomeTypesRouter(supabaseAdmin));
app.use('/v1', companyAppsRouter(supabaseAdmin));
app.use('/v1', tracesRouter(supabaseAdmin));
app.use('/v1', toolSpansRouter(supabaseAdmin));
app.use('/v1', tracePayloadsRouter(supabaseAdmin));
app.use('/v1', (req, res) => res.status(404).json({ error: { type: 'not_found', message: `Route not found: ${req.method} ${req.path}` } }));

// ── AI Cost Control Tower: Settings API ──────────────────────────────────────
const settingsLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.options('/api/control-tower/settings/*', cors({ origin: allowedOrigins }));
app.use('/api/control-tower/settings', settingsLimiter);
app.use('/api/control-tower/settings', express.json({ limit: '20kb' }));
app.use('/api/control-tower/settings', createAuthMiddleware(supabaseUrl));
app.use('/api/control-tower/settings', createCompanyAdminMiddleware(supabaseAdmin));
app.use('/api/control-tower/settings', createSettingsRouter(supabaseAdmin, apiReferenceUrl));

// ── AI Cost Control Tower: Model Pricing (read-only, global catalog) ────────
// Deliberately its own mount, not nested under /api/control-tower/settings —
// that stack requires company-admin + X-Company-Id, but mt_model_pricing has
// no company_id column, so any authenticated user can read it here.
const modelPricingLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.options('/api/control-tower/model-pricing*', cors({ origin: allowedOrigins }));
app.use('/api/control-tower/model-pricing', modelPricingLimiter);
app.use('/api/control-tower/model-pricing', createAuthMiddleware(supabaseUrl));
app.use('/api/control-tower/model-pricing', createModelPricingRouter(supabaseAdmin));

// ── Unified, auto-generated OpenAPI docs (/docs) ─────────────────────────────
// Every path/schema below is built from @openapi JSDoc blocks above each
// route handler in routes/**/*.js, re-parsed fresh on every process start —
// add a route + its @openapi block, restart, and it's documented. No manual
// YAML file to edit. See openapi/definition.js for the static info/servers.
const openApiSpec = swaggerJsdoc({
  definition: require('./openapi/definition'),
  // Forward slashes required — swagger-jsdoc's glob matching does not
  // resolve Windows backslash paths from path.join() on Windows hosts.
  apis: [__dirname.replace(/\\/g, '/') + '/routes/**/*.js']
});
app.get('/docs/openapi.json', (req, res) => res.json(openApiSpec));
// Deliberately app.use (not app.get) — bare /docs vs /docs/ must be
// distinguishable so the redirect below can't loop on itself (Express's
// default non-strict routing treats them as the same route under app.get).
app.use('/docs', (req, res, next) => {
  if (req.path === '') return res.redirect(301, req.originalUrl + '/');
  next();
});
app.use('/docs', express.static(path.join(__dirname, 'openapi'), { index: 'docs.html' }));

app.use((req, res) => res.status(404).json({ error: { type: 'not_found', message: `Route not found: ${req.method} ${req.path}` } }));

if (!supabaseUrl) console.warn('[CONTROL TOWER] SUPABASE_URL is not set.');
if (!serviceRoleKey) console.warn('[CONTROL TOWER] SUPABASE_SERVICE_ROLE_KEY is not set. Settings data routes will be unavailable.');
if (!apiReferenceUrl) console.warn('[CONTROL TOWER] CT_API_REFERENCE_URL is not set.');
app.listen(port, () => console.log(`[CONTROL TOWER] Proxy listening on http://127.0.0.1:${port}`));
