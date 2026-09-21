// AI Cost Control Tower: OpenAPI Ingestion Layer — /v1/outcomes
// Ported from Product-Studio-v9.37.01/proxy/routes/v1/outcomes.js — same
// Supabase schema/RPCs, no logic changes (adds @openapi JSDoc for this
// repo's auto-generated docs).
//
// POST /v1/outcomes is a plain INSERT, deliberately never a get-or-create
// RPC — that behavior is correct for Product Studio's own internal
// call-grouping, not for an external REST POST contract, where silently
// handing back an existing resource would be surprising.

const express = require('express');
const { insertIdempotent } = require('../../lib/costTower/idempotency');

const REQUIRED_FIELDS = ['outcome_type_id', 'client_outcome_id', 'session_id'];

module.exports = function outcomesRouterFactory(supabaseAdmin) {
  const router = express.Router();

  /**
   * @openapi
   * /v1/outcomes:
   *   post:
   *     tags: [outcomes]
   *     summary: Create an outcome instance
   *     description: Idempotent on (company_id, app_id, client_outcome_id). Never get-or-create.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [outcome_type_id, client_outcome_id, session_id]
   *             properties:
   *               outcome_type_id: { type: string }
   *               client_outcome_id: { type: string, format: uuid }
   *               session_id: { type: string }
   *               user_id: { type: string, nullable: true }
   *     responses:
   *       200: { description: Created (or deduplicated replay). }
   *       400: { description: Missing field, or outcome_type_id not registered. }
   */
  router.post('/outcomes', async function (req, res) {
    const body = req.body || {};
    for (const field of REQUIRED_FIELDS) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return res.status(400).json({ error: { type: 'invalid_request', message: 'Missing required field: ' + field } });
      }
    }

    const row = {
      company_id: req.companyId,
      app_id: req.appId,
      outcome_type_id: body.outcome_type_id,
      client_outcome_id: body.client_outcome_id,
      session_id: body.session_id,
      user_id: body.user_id != null ? body.user_id : null,
      product_id: null // omitted entirely for non-Product-Studio apps
      // status/started_at/last_activity_at intentionally omitted — column
      // defaults on mt_outcomes already set these correctly on insert.
    };

    const result = await insertIdempotent(supabaseAdmin, {
      table: 'mt_outcomes',
      conflictColumns: ['company_id', 'app_id', 'client_outcome_id'],
      row: row,
      idColumn: 'outcome_id'
    });

    if (result.error) {
      // 23503 = foreign_key_violation — outcome_type_id isn't registered
      // for this app. A friendlier 400 than a bare 500.
      if (result.error.code === '23503') {
        return res.status(400).json({ error: { type: 'invalid_request', message: 'outcome_type_id is not registered for this app. Register it first via POST /v1/outcome-types.' } });
      }
      console.error('[V1 OUTCOMES] insert failed:', result.error.message);
      return res.status(500).json({ error: { type: 'server_error', message: 'Could not create outcome.' } });
    }

    return res.status(200).json({ outcome_id: result.id, deduplicated: result.deduplicated });
  });

  /**
   * @openapi
   * /v1/outcomes/{id}:
   *   patch:
   *     tags: [outcomes]
   *     summary: Mark an outcome completed
   *     description: Ownership-scoped by (company_id, app_id); only transitions from in_progress.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { type: object, required: [status], properties: { status: { type: string, enum: [completed] } } }
   *     responses:
   *       200: { description: Completed. }
   *       400: { description: status must be 'completed'. }
   *       404: { description: Outcome not found, not owned, or already completed. }
   */
  // PATCH /v1/outcomes/{id} — { status: 'completed' }. Ownership-checked:
  // scoped by company_id/app_id, not outcome_id alone. Also scoped to
  // status='in_progress' so a repeat completion call can't silently
  // overwrite an already-recorded completed_at. 404 either way — doesn't
  // exist, doesn't belong to the caller, or already completed —
  // deliberately not distinguished.
  router.patch('/outcomes/:id', async function (req, res) {
    const status = req.body ? req.body.status : undefined;
    if (status !== 'completed') {
      return res.status(400).json({ error: { type: 'invalid_request', message: "status must be 'completed'." } });
    }

    const completedAt = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('mt_outcomes')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('outcome_id', req.params.id)
      .eq('company_id', req.companyId)
      .eq('app_id', req.appId)
      .eq('status', 'in_progress')
      .select('outcome_id')
      .maybeSingle();

    if (error) {
      console.error('[V1 OUTCOMES] completion failed:', error.message);
      return res.status(500).json({ error: { type: 'server_error', message: 'Could not complete outcome.' } });
    }
    if (!data) {
      return res.status(404).json({ error: { type: 'not_found', message: 'Outcome not found.' } });
    }

    return res.status(200).json({ outcome_id: data.outcome_id, status: 'completed', completed_at: completedAt });
  });

  return router;
};
