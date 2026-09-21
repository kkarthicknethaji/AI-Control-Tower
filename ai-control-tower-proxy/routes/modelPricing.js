const express = require('express');

function queryFailure(res, error) {
  console.error('[CONTROL TOWER] Model pricing query failed:', error && error.code ? error.code : 'unknown', error && error.message);
  const detail = process.env.NODE_ENV === 'production' ? 'Model pricing is unavailable.' : `Model pricing is unavailable: ${(error && error.message) || 'the query returned an error.'}`;
  return res.status(503).json({ error: { type: 'server_error', message: detail } });
}

const PRICING_COLUMNS = 'id, provider, model_name, tier, input_price_per_mtok, output_price_per_mtok, cache_write_5m_price_per_mtok, cache_write_1h_price_per_mtok, cache_read_price_per_mtok, effective_from, effective_to';

module.exports = function createModelPricingRouter(supabaseAdmin) {
  const router = express.Router();
  router.use((req, res, next) => {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: { type: 'server_error', message: 'Control Tower proxy is missing SUPABASE_SERVICE_ROLE_KEY.' } });
    }
    next();
  });

  /**
   * @openapi
   * /api/control-tower/model-pricing:
   *   get:
   *     tags: [model-pricing]
   *     summary: List effective-dated model pricing rows (global reference catalog, not company-scoped)
   *     security: [{ jwtAuth: [] }]
   *     parameters:
   *       - { name: provider, in: query, required: false, schema: { type: string }, description: 'Filter to a single provider, e.g. anthropic.' }
   *       - { name: model_name, in: query, required: false, schema: { type: string }, description: 'Filter to a single resolved model name.' }
   *     responses:
   *       200: { description: List of pricing rows. }
   *       401: { description: Not authenticated. }
   *       503: { description: Model pricing is unavailable. }
   */
  router.get('/', async (req, res) => {
    let query = supabaseAdmin.from('mt_model_pricing').select(PRICING_COLUMNS);
    if (typeof req.query.provider === 'string' && req.query.provider) query = query.eq('provider', req.query.provider);
    if (typeof req.query.model_name === 'string' && req.query.model_name) query = query.eq('model_name', req.query.model_name);
    const { data, error } = await query.order('provider').order('model_name').order('effective_from');
    if (error) return queryFailure(res, error);
    return res.json({ pricing: data || [] });
  });

  return router;
};
