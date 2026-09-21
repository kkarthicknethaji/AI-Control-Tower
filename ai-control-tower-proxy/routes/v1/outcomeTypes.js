// AI Cost Control Tower: OpenAPI Ingestion Layer — /v1/outcome-types
// Ported from Product-Studio-v9.37.01/proxy/routes/v1/outcomeTypes.js — same
// Supabase schema/RPCs, no logic changes (adds @openapi JSDoc for this
// repo's auto-generated docs).

const express = require('express');

const REQUIRED_FIELDS = ['outcome_type_id', 'name', 'description', 'canvas', 'costing_method', 'unit_label'];
const COSTING_METHODS = ['session_sum', 'yield_ratio'];

module.exports = function outcomeTypesRouterFactory(supabaseAdmin) {
  const router = express.Router();

  /**
   * @openapi
   * /v1/outcome-types:
   *   post:
   *     tags: [outcome-types]
   *     summary: Register (or idempotently re-register) an app's outcome taxonomy
   *     description: >
   *       Idempotent only for IDENTICAL costing_method/unit_label; a mismatched
   *       re-registration is rejected with 409 to avoid corrupting historical
   *       cost interpretation.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [outcome_type_id, name, description, canvas, costing_method, unit_label]
   *             properties:
   *               outcome_type_id: { type: string }
   *               name: { type: string }
   *               description: { type: string }
   *               canvas: { type: string }
   *               costing_method: { type: string, enum: [session_sum, yield_ratio] }
   *               unit_label: { type: string }
   *               abandonment_window_hrs: { type: number, nullable: true }
   *     responses:
   *       200: { description: Created or unchanged. }
   *       400: { description: Missing/invalid field. }
   *       409: { description: Registered with a different costing_method/unit_label, or by a different company. }
   */
  router.post('/outcome-types', async function (req, res) {
    const body = req.body || {};
    for (const field of REQUIRED_FIELDS) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return res.status(400).json({ error: { type: 'invalid_request', message: 'Missing required field: ' + field } });
      }
    }
    if (COSTING_METHODS.indexOf(body.costing_method) === -1) {
      return res.status(400).json({ error: { type: 'invalid_request', message: 'costing_method must be one of: ' + COSTING_METHODS.join(', ') } });
    }

    // company_id has no bearing on the underlying (app_id, outcome_type_id)
    // primary key, so a row with this app_id/outcome_type_id could belong
    // to a different company entirely if the same app_id was ever granted
    // to more than one company. Checked explicitly so that case gets an
    // honest "taken by someone else" conflict instead of either a false 409
    // against your own prior registration or silently matching another
    // company's row.
    const { data: existing, error: selectError } = await supabaseAdmin
      .from('mt_outcome_types')
      .select('company_id, costing_method, unit_label')
      .eq('app_id', req.appId)
      .eq('outcome_type_id', body.outcome_type_id)
      .maybeSingle();

    if (selectError) {
      console.error('[V1 OUTCOME-TYPES] lookup failed:', selectError.message);
      return res.status(500).json({ error: { type: 'server_error', message: 'Could not register outcome type.' } });
    }

    if (existing) {
      if (existing.company_id !== req.companyId) {
        return res.status(409).json({
          error: {
            type: 'conflict',
            message: 'outcome_type_id already registered under this app_id by a different company. Register a new outcome_type_id.'
          }
        });
      }
      if (existing.costing_method !== body.costing_method || existing.unit_label !== body.unit_label) {
        return res.status(409).json({
          error: {
            type: 'conflict',
            message: 'outcome_type_id already registered with a different costing_method or unit_label. Register a new outcome_type_id if your taxonomy genuinely changed.'
          }
        });
      }
      // costing_method/unit_label match (the only fields that would corrupt
      // historical cost interpretation if changed) — but
      // name/description/canvas/abandonment_window_hrs are safe to update
      // on every resubmission.
      const { error: updateError } = await supabaseAdmin
        .from('mt_outcome_types')
        .update({
          name: body.name,
          description: body.description,
          canvas: body.canvas,
          abandonment_window_hrs: body.abandonment_window_hrs != null ? body.abandonment_window_hrs : null
        })
        .eq('app_id', req.appId)
        .eq('company_id', req.companyId)
        .eq('outcome_type_id', body.outcome_type_id);
      if (updateError) {
        console.error('[V1 OUTCOME-TYPES] update failed:', updateError.message);
        return res.status(500).json({ error: { type: 'server_error', message: 'Could not register outcome type.' } });
      }
      return res.status(200).json({ outcome_type_id: body.outcome_type_id, status: 'unchanged' });
    }

    const { error: insertError } = await supabaseAdmin
      .from('mt_outcome_types')
      .insert({
        company_id: req.companyId,
        app_id: req.appId,
        outcome_type_id: body.outcome_type_id,
        name: body.name,
        description: body.description,
        canvas: body.canvas,
        costing_method: body.costing_method,
        unit_label: body.unit_label,
        abandonment_window_hrs: body.abandonment_window_hrs != null ? body.abandonment_window_hrs : null
      });

    if (insertError) {
      console.error('[V1 OUTCOME-TYPES] insert failed:', insertError.message);
      return res.status(500).json({ error: { type: 'server_error', message: 'Could not register outcome type.' } });
    }

    return res.status(200).json({ outcome_type_id: body.outcome_type_id, status: 'created' });
  });

  /**
   * @openapi
   * /v1/outcome-types:
   *   get:
   *     tags: [outcome-types]
   *     summary: List the caller's own registered outcome types
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: List of outcome types registered by this credential's app/company. }
   */
  router.get('/outcome-types', async function (req, res) {
    const { data, error } = await supabaseAdmin
      .from('mt_outcome_types')
      .select('outcome_type_id, name, description, canvas, costing_method, unit_label, abandonment_window_hrs')
      .eq('app_id', req.appId)
      .eq('company_id', req.companyId);

    if (error) {
      console.error('[V1 OUTCOME-TYPES] read failed:', error.message);
      return res.status(500).json({ error: { type: 'server_error', message: 'Could not read outcome types.' } });
    }

    return res.status(200).json({ outcome_types: data || [] });
  });

  return router;
};
