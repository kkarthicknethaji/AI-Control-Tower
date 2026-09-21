const express = require('express');

function rpcFailure(res, error) {
  const message = error && error.message ? error.message : '';
  if (/already connected/i.test(message)) return res.status(409).json({ error: { type: 'conflict', message: 'An app with this name is already connected.' } });
  if (/not an active admin/i.test(message)) return res.status(403).json({ error: { type: 'forbidden', message: 'You do not have permission to manage settings for this company.' } });
  if (/no active app connection/i.test(message)) return res.status(404).json({ error: { type: 'not_found', message: 'This app is no longer connected. Refresh and try again.' } });
  if (/credential already exists/i.test(message)) return res.status(409).json({ error: { type: 'conflict', message: 'A credential already exists. Rotate it instead.' } });
  if (/no active credential/i.test(message)) return res.status(409).json({ error: { type: 'conflict', message: 'No active credential exists. Issue one first.' } });
  if (/payload capture requires/i.test(message)) return res.status(400).json({ error: { type: 'invalid_request', message: 'Payload capture requires payload write scope.' } });
  console.error('[CONTROL TOWER] Settings RPC failed:', error && error.code ? error.code : 'unknown', message);
  const detail = process.env.NODE_ENV === 'production' ? 'Settings operation is unavailable.' : `Settings operation is unavailable: ${message || 'the Settings RPC returned an error.'}`;
  return res.status(503).json({ error: { type: 'server_error', message: detail } });
}

function validExpiry(body) {
  const expiresAt = body && body.expiresAt !== undefined ? body.expiresAt : null;
  return expiresAt === null || (typeof expiresAt === 'string' && !Number.isNaN(Date.parse(expiresAt))) ? expiresAt : undefined;
}

module.exports = function createSettingsRouter(supabaseAdmin, apiReferenceUrl) {
  const router = express.Router();
  router.use((req, res, next) => {
    if (!supabaseAdmin && req.path !== '/api-reference') {
      return res.status(503).json({ error: { type: 'server_error', message: 'Control Tower proxy is missing SUPABASE_SERVICE_ROLE_KEY.' } });
    }
    next();
  });

  /**
   * @openapi
   * /api/control-tower/settings/apps:
   *   get:
   *     tags: [settings]
   *     summary: List apps connected to this company
   *     security: [{ jwtAuth: [] }]
   *     parameters:
   *       - { name: X-Company-Id, in: header, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: List of connected apps. }
   */
  router.get('/apps', async (req, res) => {
    const { data, error } = await supabaseAdmin.rpc('self_service_app_connections_list', { p_actor_user_id: req.user.id, p_company_id: req.companyId });
    if (error) return rpcFailure(res, error);
    return res.json({ apps: data || [] });
  });

  /**
   * @openapi
   * /api/control-tower/settings/apps:
   *   post:
   *     tags: [settings]
   *     summary: Connect a new app to this company
   *     security: [{ jwtAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { type: object, required: [displayName], properties: { displayName: { type: string, maxLength: 80 } } }
   *     responses:
   *       201: { description: App connected. }
   *       400: { description: Missing/invalid displayName. }
   *       409: { description: An app with this name is already connected. }
   */
  router.post('/apps', async (req, res) => {
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    if (!displayName || displayName.length > 80) return res.status(400).json({ error: { type: 'invalid_request', message: 'Display name is required and must be 80 characters or fewer.' } });
    const { data, error } = await supabaseAdmin.rpc('self_service_register_app', { p_actor_user_id: req.user.id, p_company_id: req.companyId, p_display_name: displayName });
    if (error) return rpcFailure(res, error);
    const app = (data || [])[0];
    return res.status(201).json({ app: { appId: app.app_id, name: app.name, controlMode: 'monitor_only' } });
  });

  /**
   * @openapi
   * /api/control-tower/settings/apps/{appId}/capture:
   *   patch:
   *     tags: [settings]
   *     summary: Update an app's ingestion scope/capture toggles
   *     security: [{ jwtAuth: [] }]
   *     parameters:
   *       - { name: appId, in: path, required: true, schema: { type: string } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [scopeUsageWrite, scopeTracesWrite, scopePayloadsWrite, payloadCaptureEnabled]
   *             properties:
   *               scopeUsageWrite: { type: boolean }
   *               scopeTracesWrite: { type: boolean }
   *               scopePayloadsWrite: { type: boolean }
   *               payloadCaptureEnabled: { type: boolean }
   *     responses:
   *       200: { description: Updated capture config. }
   *       400: { description: Capture settings must be boolean values, or payload capture requires payload write scope. }
   */
  router.patch('/apps/:appId/capture', async (req, res) => {
    const body = req.body || {};
    const fields = ['scopeUsageWrite', 'scopeTracesWrite', 'scopePayloadsWrite', 'payloadCaptureEnabled'];
    if (!fields.every((field) => typeof body[field] === 'boolean')) return res.status(400).json({ error: { type: 'invalid_request', message: 'Capture settings must be boolean values.' } });
    const { data, error } = await supabaseAdmin.rpc('self_service_update_app_capture_config', {
      p_actor_user_id: req.user.id, p_company_id: req.companyId, p_app_id: req.params.appId,
      p_scope_usage_write: body.scopeUsageWrite, p_scope_traces_write: body.scopeTracesWrite,
      p_scope_payloads_write: body.scopePayloadsWrite, p_payload_capture_enabled: body.payloadCaptureEnabled
    });
    if (error) return rpcFailure(res, error);
    const row = (data || [])[0] || {};
    return res.json({ appId: row.app_id, scopeUsageWrite: row.scope_usage_write, scopeTracesWrite: row.scope_traces_write, scopePayloadsWrite: row.scope_payloads_write, payloadCaptureEnabled: row.payload_capture_enabled });
  });

  async function credentialAction(req, res, functionName) {
    const expiresAt = validExpiry(req.body);
    if (expiresAt === undefined) return res.status(400).json({ error: { type: 'invalid_request', message: 'expiresAt must be an ISO timestamp or null.' } });
    const { data, error } = await supabaseAdmin.rpc(functionName, { p_actor_user_id: req.user.id, p_company_id: req.companyId, p_app_id: req.params.appId, p_expires_at: expiresAt });
    if (error) return rpcFailure(res, error);
    return res.json({ appId: req.params.appId, credential: data, shownOnce: true, message: 'Copy this key now. It will not be shown again.' });
  }

  /**
   * @openapi
   * /api/control-tower/settings/apps/{appId}/credentials/issue:
   *   post:
   *     tags: [settings]
   *     summary: Issue a new ingestion credential for an app
   *     description: The plaintext key is shown exactly once in the response.
   *     security: [{ jwtAuth: [] }]
   *     parameters:
   *       - { name: appId, in: path, required: true, schema: { type: string } }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema: { type: object, properties: { expiresAt: { type: string, format: date-time, nullable: true } } }
   *     responses:
   *       200: { description: Credential issued (shown once). }
   *       409: { description: A credential already exists. Rotate it instead. }
   */
  router.post('/apps/:appId/credentials/issue', (req, res) => credentialAction(req, res, 'self_service_issue_credential'));
  /**
   * @openapi
   * /api/control-tower/settings/apps/{appId}/credentials/rotate:
   *   post:
   *     tags: [settings]
   *     summary: Rotate an app's ingestion credential
   *     description: The old credential is invalidated; the new plaintext key is shown exactly once.
   *     security: [{ jwtAuth: [] }]
   *     parameters:
   *       - { name: appId, in: path, required: true, schema: { type: string } }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema: { type: object, properties: { expiresAt: { type: string, format: date-time, nullable: true } } }
   *     responses:
   *       200: { description: Credential rotated (shown once). }
   *       409: { description: No active credential exists. Issue one first. }
   */
  router.post('/apps/:appId/credentials/rotate', (req, res) => credentialAction(req, res, 'self_service_rotate_credential'));

  /**
   * @openapi
   * /api/control-tower/settings/apps/{appId}/credentials/revoke:
   *   post:
   *     tags: [settings]
   *     summary: Revoke an app's active ingestion credential
   *     security: [{ jwtAuth: [] }]
   *     parameters:
   *       - { name: appId, in: path, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Revoked. }
   */
  router.post('/apps/:appId/credentials/revoke', async (req, res) => {
    const { data, error } = await supabaseAdmin.rpc('self_service_revoke_credential', { p_actor_user_id: req.user.id, p_company_id: req.companyId, p_app_id: req.params.appId });
    if (error) return rpcFailure(res, error);
    const row = (data || [])[0] || {};
    return res.json({ appId: row.app_id, hasCredential: row.has_credential, credentialRevokedAt: row.credential_revoked_at });
  });

  /**
   * @openapi
   * /api/control-tower/settings/apps/{appId}/disconnect:
   *   post:
   *     tags: [settings]
   *     summary: Disconnect an app from this company
   *     security: [{ jwtAuth: [] }]
   *     parameters:
   *       - { name: appId, in: path, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Disconnected. }
   *       404: { description: No active app connection. }
   */
  router.post('/apps/:appId/disconnect', async (req, res) => {
    const { data, error } = await supabaseAdmin.rpc('self_service_disconnect_app', { p_actor_user_id: req.user.id, p_company_id: req.companyId, p_app_id: req.params.appId });
    if (error) return rpcFailure(res, error);
    const row = (data || [])[0] || {};
    return res.json({ appId: row.app_id, isActive: row.is_active, disconnectedAt: row.disconnected_at });
  });

  /**
   * @openapi
   * /api/control-tower/settings/api-reference:
   *   get:
   *     tags: [settings]
   *     summary: Get the configured OpenAPI/API Reference docs URL
   *     security: [{ jwtAuth: [] }]
   *     responses:
   *       200: { description: '{ url }' }
   *       503: { description: API Reference URL is not configured. }
   */
  router.get('/api-reference', (req, res) => {
    if (!apiReferenceUrl) return res.status(503).json({ error: { type: 'server_error', message: 'API Reference URL is not configured.' } });
    return res.json({ url: apiReferenceUrl });
  });

  return router;
};
