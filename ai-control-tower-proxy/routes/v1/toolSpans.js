// AI Cost Control Tower: AI Trace Layer — /v1/tool-spans
// Ported from Product-Studio-v9.37.01/proxy/routes/v1/toolSpans.js — same
// Supabase schema/RPCs, no logic changes (adds @openapi JSDoc for this
// repo's auto-generated docs).
//
// The external-facing counterpart to mt_ai_record_tool_span() — an app
// reporting a tool-call step it performed, whether or not that step
// involved an LLM API call. No idempotency key on this endpoint — unlike
// usage events and traces, a tool call has no natural client-generated
// identity to dedupe on.

const express = require('express');
const { requireIngestionScope } = require('../../middleware/requireIngestionScope');

const REQUIRED_FIELDS = ['agent_name', 'client_trace_id', 'tool_name', 'status'];
const STATUS_VALUES = ['success', 'error', 'timeout']; // matches usageEvents.js's own STATUS_VALUES

module.exports = function toolSpansRouterFactory(supabaseAdmin) {
  const router = express.Router();

  /**
   * @openapi
   * /v1/tool-spans:
   *   post:
   *     tags: [tool-spans]
   *     summary: Record a tool-call step
   *     description: With or without an accompanying LLM call. No idempotency key.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [agent_name, client_trace_id, tool_name, status]
   *             properties:
   *               agent_name: { type: string }
   *               client_trace_id: { type: string, format: uuid }
   *               tool_name: { type: string }
   *               status: { type: string, enum: [success, error, timeout] }
   *               parent_span_id: { type: string, nullable: true }
   *               attempt_number: { type: integer, minimum: 1, nullable: true }
   *               duration_ms: { type: integer, nullable: true }
   *     responses:
   *       200: { description: Span recorded. }
   *       400: { description: Missing/invalid field. }
   *       409: { description: Conflict (span constraint violation). }
   */
  router.post('/tool-spans', requireIngestionScope('traces'), async function (req, res) {
    const body = req.body || {};
    for (const field of REQUIRED_FIELDS) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return res.status(400).json({ error: { type: 'invalid_request', message: 'Missing required field: ' + field } });
      }
    }
    if (STATUS_VALUES.indexOf(body.status) === -1) {
      return res.status(400).json({ error: { type: 'invalid_request', message: 'status must be one of: ' + STATUS_VALUES.join(', ') } });
    }
    // mt_ai_spans' own attempt_number CHECK (>= 1) is SQLSTATE 23514, the
    // same code this handler maps to 409 for genuine idempotency conflicts.
    // Validated here first so a bad value gets 400, not a misleading 409.
    if (body.attempt_number != null && (!Number.isInteger(body.attempt_number) || body.attempt_number < 1)) {
      return res.status(400).json({ error: { type: 'invalid_request', message: 'attempt_number must be an integer >= 1.' } });
    }

    const { data, error } = await supabaseAdmin.rpc('mt_ai_record_tool_span', {
      p_company_id: req.companyId, p_app_id: req.appId,
      p_client_trace_id: body.client_trace_id, p_agent_name: body.agent_name,
      p_tool_name: body.tool_name,
      p_parent_span_id: body.parent_span_id != null ? body.parent_span_id : null,
      p_attempt_number: body.attempt_number != null ? body.attempt_number : null,
      p_status: body.status,
      p_duration_ms: body.duration_ms != null ? body.duration_ms : null
    });

    if (error) {
      if (error.code === '23514') {
        return res.status(409).json({ error: { type: 'conflict', message: error.message } });
      }
      console.error('[V1 TOOL-SPANS] rpc failed:', error.message);
      return res.status(500).json({ error: { type: 'server_error', message: 'Could not record tool span.' } });
    }

    return res.status(200).json({ span_id: data[0].span_id, trace_id: data[0].trace_id });
  });

  return router;
};
