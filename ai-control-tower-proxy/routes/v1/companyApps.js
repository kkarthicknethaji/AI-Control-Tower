// AI Cost Control Tower: OpenAPI Ingestion Layer — /v1/company-apps
// Ported from Product-Studio-v9.37.01/proxy/routes/v1/companyApps.js — same
// Supabase schema/RPCs, no logic changes (adds @openapi JSDoc for this
// repo's auto-generated docs, see ai-control-tower-proxy/openapi/definition.js).
//
// GET /v1/company-apps/me is a direct query, deliberately never
// mt_company_apps_list — that RPC's authorization depends on
// current_app_user(), which a machine credential never has.

const express = require('express');

module.exports = function companyAppsRouterFactory(supabaseAdmin) {
  const router = express.Router();

  /**
   * @openapi
   * /v1/company-apps/me:
   *   get:
   *     tags: [company-apps]
   *     summary: Self-check on the calling credential
   *     description: Returns the credential's own grant status. Never returns credential_hash.
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Grant status for this credential.
   *       401:
   *         description: Missing/invalid/revoked/expired credential.
   *       404:
   *         description: No grant found for this credential.
   */
  router.get('/company-apps/me', async function (req, res) {
    const { data, error } = await supabaseAdmin
      .from('mt_company_apps')
      .select('company_id, app_id, is_active, credential_created_at')
      .eq('company_id', req.companyId)
      .eq('app_id', req.appId)
      .maybeSingle();

    if (error) {
      console.error('[V1 COMPANY-APPS] read failed:', error.message);
      return res.status(500).json({ error: { type: 'server_error', message: 'Could not read credential status.' } });
    }
    if (!data) {
      // Should not happen — apiKeyAuth already resolved this exact pair —
      // but a genuine 404 is more honest than a 500 if the grant was
      // revoked between auth and this query.
      return res.status(404).json({ error: { type: 'not_found', message: 'No grant found for this credential.' } });
    }

    // credential_hash is never returned, by design.
    return res.status(200).json({
      company_id: data.company_id,
      app_id: data.app_id,
      is_active: data.is_active,
      credential_created_at: data.credential_created_at
    });
  });

  return router;
};
