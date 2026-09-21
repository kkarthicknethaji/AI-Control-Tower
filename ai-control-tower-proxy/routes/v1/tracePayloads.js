// AI Cost Control Tower: AI Trace Layer — /v1/trace-payloads
// Ported from Product-Studio-v9.37.01/proxy/routes/v1/tracePayloads.js — same
// Supabase schema/RPCs, no logic changes (adds @openapi JSDoc for this
// repo's auto-generated docs).
//
// Gated by requirePayloadCaptureWrite (req.scopes.payloadsWrite AND
// req.payloadCaptureEnabled, both attached by apiKeyAuth.js) — attached at
// the route level here, on both POST and GET, never globally. GET reuses
// the same gate rather than a separate payloads:read scope — no such scope
// exists in the schema, and this route only ever hands a payload back to
// the exact credential that wrote it.
//
// One payload row per usage event (1:1, mirrors mt_ai_spans.usage_event_id's
// own UNIQUE FK) — only an llm_call span/usage event has a request/response
// to capture.
//
// Idempotency uses insertIdempotentStrict() with a structural, key-order-
// independent `compareFn` for the JSONB columns — Postgres jsonb does not
// preserve object key order on read-back, so a naive string compare would
// spuriously fail an otherwise-legitimate idempotent replay.

const express = require('express');
const { insertIdempotentStrict } = require('../../lib/costTower/idempotencyStrict');
const { requirePayloadCaptureWrite } = require('../../middleware/requirePayloadCaptureWrite');

const REQUIRED_FIELDS = ['usage_event_id'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function _normalizedPayload(value) {
  return value === undefined ? null : value;
}

// Key-order-independent structural equality. Object key lookups are
// hasOwnProperty-guarded against caller-controlled keys resolving inherited
// Object.prototype members.
function _deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!_deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

function _payloadsEqual(a, b) {
  return _deepEqual(_normalizedPayload(a), _normalizedPayload(b));
}

module.exports = function tracePayloadsRouterFactory(supabaseAdmin) {
  const router = express.Router();

  /**
   * @openapi
   * /v1/trace-payloads:
   *   post:
   *     tags: [trace-payloads]
   *     summary: Capture a usage event's raw request/response content
   *     description: >
   *       Gated by the credential's payloads:write scope AND the app's
   *       payload_capture_enabled toggle (both default OFF). Idempotent on
   *       usage_event_id with a structural (key-order-independent) JSONB compare.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [usage_event_id]
   *             properties:
   *               usage_event_id: { type: string, format: uuid }
   *               request_payload: { type: object, nullable: true }
   *               response_payload: { type: object, nullable: true }
   *     responses:
   *       200: { description: Captured (or deduplicated replay). }
   *       400: { description: Missing/invalid field, or usage_event_id not owned. }
   *       403: { description: Credential lacks payloads:write scope, or payload capture disabled for this app. }
   *       409: { description: Replay with the same usage_event_id but different payload content. }
   */
  router.post('/trace-payloads', requirePayloadCaptureWrite, async function (req, res) {
    const body = req.body || {};
    for (const field of REQUIRED_FIELDS) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return res.status(400).json({ error: { type: 'invalid_request', message: 'Missing required field: ' + field } });
      }
    }
    if (!UUID_RE.test(body.usage_event_id)) {
      return res.status(400).json({ error: { type: 'invalid_request', message: 'usage_event_id must be a UUID.' } });
    }
    if (body.request_payload == null && body.response_payload == null) {
      return res.status(400).json({ error: { type: 'invalid_request', message: 'At least one of request_payload/response_payload is required.' } });
    }
    // Reject, don't strip — documented as `type: object`; an array or
    // scalar would otherwise be accepted into this opaque JSONB column
    // unchecked.
    for (const field of ['request_payload', 'response_payload']) {
      const value = body[field];
      if (value != null && (typeof value !== 'object' || Array.isArray(value))) {
        return res.status(400).json({ error: { type: 'invalid_request', message: field + ' must be an object.' } });
      }
    }

    // Ownership check — usage_event_id must belong to this credential's
    // (company_id, app_id).
    const { data: owned, error: ownedError } = await supabaseAdmin
      .from('mt_ai_usage_events')
      .select('id')
      .eq('id', body.usage_event_id)
      .eq('company_id', req.companyId)
      .eq('app_id', req.appId)
      .maybeSingle();
    if (ownedError) {
      console.error('[V1 TRACE-PAYLOADS] ownership check failed:', ownedError.message);
      return res.status(500).json({ error: { type: 'server_error', message: 'Could not create trace payload.' } });
    }
    if (!owned) {
      return res.status(400).json({ error: { type: 'invalid_request', message: 'usage_event_id does not exist or does not belong to this credential.' } });
    }

    const row = {
      usage_event_id: body.usage_event_id,
      company_id: req.companyId, app_id: req.appId,
      request_payload: _normalizedPayload(body.request_payload),
      response_payload: _normalizedPayload(body.response_payload)
    };

    const result = await insertIdempotentStrict(supabaseAdmin, {
      table: 'mt_ai_trace_payloads',
      conflictColumns: ['usage_event_id'],
      row: row, idColumn: 'payload_id',
      compareColumns: ['request_payload', 'response_payload'],
      compareFn: _payloadsEqual,
      extraMatch: { company_id: req.companyId, app_id: req.appId }
    });

    if (result.error) {
      if (result.error.code === 'IDEMPOTENCY_CONFLICT') {
        return res.status(409).json({ error: { type: 'conflict', message: result.error.message } });
      }
      if (result.error.code === '23503') {
        return res.status(400).json({ error: { type: 'invalid_request', message: 'usage_event_id does not exist.' } });
      }
      console.error('[V1 TRACE-PAYLOADS] insert failed:', result.error.message);
      return res.status(500).json({ error: { type: 'server_error', message: 'Could not create trace payload.' } });
    }

    return res.status(200).json({ payload_id: result.id, deduplicated: result.deduplicated });
  });

  /**
   * @openapi
   * /v1/trace-payloads/{usage_event_id}:
   *   get:
   *     tags: [trace-payloads]
   *     summary: Read a captured payload
   *     description: Same scope/toggle gate as POST. Ownership-scoped by (company_id, app_id).
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { name: usage_event_id, in: path, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200: { description: Captured payload. }
   *       403: { description: Credential lacks payloads:write scope, or payload capture disabled for this app. }
   *       404: { description: Trace payload not found or not owned. }
   */
  // GET /v1/trace-payloads/{usage_event_id} — ownership-scoped by
  // (company_id, app_id), full row returned.
  router.get('/trace-payloads/:usage_event_id', requirePayloadCaptureWrite, async function (req, res) {
    if (!UUID_RE.test(req.params.usage_event_id)) {
      return res.status(400).json({ error: { type: 'invalid_request', message: 'usage_event_id must be a UUID.' } });
    }
    const { data, error } = await supabaseAdmin
      .from('mt_ai_trace_payloads')
      .select('payload_id, usage_event_id, request_payload, response_payload, expires_at, created_at')
      .eq('usage_event_id', req.params.usage_event_id)
      .eq('company_id', req.companyId)
      .eq('app_id', req.appId)
      .maybeSingle();

    if (error) {
      console.error('[V1 TRACE-PAYLOADS] read failed:', error.message);
      return res.status(500).json({ error: { type: 'server_error', message: 'Could not read trace payload.' } });
    }
    if (!data) {
      return res.status(404).json({ error: { type: 'not_found', message: 'Trace payload not found.' } });
    }

    return res.status(200).json(data);
  });

  return router;
};
