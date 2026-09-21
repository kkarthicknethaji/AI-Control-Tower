// AI Cost Control Tower: OpenAPI Ingestion Layer — units-generated report-back
// Ported from Product-Studio-v9.37.01/proxy/lib/costTower/unitsGenerated.js —
// same Supabase schema/RPCs, no logic changes.
// PATCH /v1/usage-events/{client_call_id}/units-generated.
//
// Scoped by (company_id, app_id, client_call_id) — not client_call_id alone,
// matching the actual uniqueness scope of the idempotency constraint on
// mt_ai_usage_events.

async function updateUnitsGenerated(supabaseAdmin, { companyId, appId, clientCallId, unitsGenerated }) {
  const { data, error } = await supabaseAdmin
    .from('mt_ai_usage_events')
    .update({ units_generated: unitsGenerated })
    .eq('company_id', companyId)
    .eq('app_id', appId)
    .eq('client_call_id', clientCallId)
    .select('id')
    .maybeSingle();

  return { data, error };
}

module.exports = { updateUnitsGenerated };
