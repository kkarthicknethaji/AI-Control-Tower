-- AI Control Tower: add group_input_cost / group_output_cost to mt_ai_cost_grouped
-- Purpose: let Command Center show a real $ input/output split on Outcome-Attributed
-- Spend and Outcome-Unattributed Spend (derived client-side from this + total),
-- mirroring the total_input_cost/total_output_cost split already added to
-- mt_ai_cost_summary (see 20260916_ai_control_tower_cost_summary_input_output_split.sql).
-- Do not run in production without explicit approval after dev verification.
-- This file is intentionally not executed by the application.

BEGIN;

-- CREATE OR REPLACE FUNCTION cannot add/remove RETURNS TABLE (OUT parameter)
-- columns in place, so the function is dropped and recreated. Signature
-- (input arguments) is unchanged; only the output column list grows.
DROP FUNCTION IF EXISTS public.mt_ai_cost_grouped(uuid, text, timestamptz, timestamptz, text);

CREATE FUNCTION public.mt_ai_cost_grouped(
  p_company_id uuid,
  p_app_id text,
  p_period_start timestamp with time zone,
  p_period_end timestamp with time zone,
  p_group_by text
)
RETURNS TABLE(
  group_key1 text,
  group_key2 text,
  calls bigint,
  cost numeric,
  group_input_cost numeric,
  group_output_cost numeric,
  failed_calls bigint,
  failed_cost numeric,
  input_tokens bigint,
  output_tokens bigint,
  units_generated_sum numeric,
  units_resolved_count bigint,
  first_seen timestamp with time zone,
  last_seen timestamp with time zone,
  sample_tier text,
  sample_user_role text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
-- RETURNS TABLE's input_tokens/output_tokens output columns collide with
-- the same-named mt_ai_usage_events columns referenced (unqualified, via
-- the `events` CTE) throughout the SELECT/GROUP BY below — see
-- mt_ai_cost_summary's identical comment above.
#variable_conflict use_column
BEGIN
  IF NOT _cost_tower_can_access(p_company_id, p_app_id) THEN
    RAISE EXCEPTION 'Not authorized to read cost breakdown for company %', p_company_id;
  END IF;
  IF p_group_by NOT IN ('feature','product','model','user','prompt_version','selection_rule','tier','user_role','unpriced_drill','outcome_type','failure_phase','variance_cause') THEN
    RAISE EXCEPTION 'Invalid group_by: %', p_group_by;
  END IF;

  RETURN QUERY
  WITH events AS (
    SELECT
      e.caller, e.product_id, e.user_id, e.prompt_version, e.selection_rule,
      e.user_role_at_call, e.status, e.input_tokens, e.output_tokens,
      e.units_generated, e.provider, e.requested_model, e.response_model,
      e.request_started_at, e.failure_phase, e.error_type,
      p.tier,
      CASE WHEN p.id IS NULL THEN NULL ELSE
          (e.input_tokens::numeric / 1000000) * p.input_price_per_mtok
        + (e.output_tokens::numeric / 1000000) * p.output_price_per_mtok
        + (COALESCE(e.cache_creation_5m_tokens,0)::numeric / 1000000) * p.cache_write_5m_price_per_mtok
        + (COALESCE(e.cache_creation_1h_tokens,0)::numeric / 1000000) * p.cache_write_1h_price_per_mtok
        + (COALESCE(e.cache_read_tokens,0)::numeric / 1000000) * p.cache_read_price_per_mtok
      END AS calc_cost,
      -- Split components must null out together (same condition as calc_cost's
      -- own NULL propagation via un-COALESCE'd input_tokens/output_tokens) or
      -- SUM(calc_input_cost)+SUM(calc_output_cost) won't reconcile to SUM(calc_cost)
      -- — see the cost_summary migration's null-guard gotcha for the bug this avoids.
      CASE WHEN p.id IS NULL OR e.input_tokens IS NULL OR e.output_tokens IS NULL THEN NULL ELSE
          (e.input_tokens::numeric / 1000000) * p.input_price_per_mtok
        + (COALESCE(e.cache_creation_5m_tokens,0)::numeric / 1000000) * p.cache_write_5m_price_per_mtok
        + (COALESCE(e.cache_creation_1h_tokens,0)::numeric / 1000000) * p.cache_write_1h_price_per_mtok
        + (COALESCE(e.cache_read_tokens,0)::numeric / 1000000) * p.cache_read_price_per_mtok
      END AS calc_input_cost,
      CASE WHEN p.id IS NULL OR e.input_tokens IS NULL OR e.output_tokens IS NULL THEN NULL ELSE
          (e.output_tokens::numeric / 1000000) * p.output_price_per_mtok
      END AS calc_output_cost,
      o.outcome_type_id,
      -- Completed and abandoned are mutually exclusive by construction
      -- (is_abandoned only ever applies to a still-in_progress outcome,
      -- per mt_outcomes_list's own SQL) — mirrors buildOutcomeTypes()'s
      -- completedIds/abandonedIds split exactly.
      CASE
        WHEN o.outcome_id IS NULL THEN NULL
        WHEN o.status = 'completed' THEN 'completed'
        WHEN o.is_abandoned THEN 'abandoned'
        ELSE 'other'
      END AS completion_bucket
    FROM mt_ai_usage_events e
    LEFT JOIN mt_model_pricing p
      ON p.provider = e.provider
     AND p.model_name = COALESCE(e.response_model, e.requested_model)
     AND e.request_started_at >= p.effective_from
     AND (p.effective_to IS NULL OR e.request_started_at < p.effective_to)
    LEFT JOIN LATERAL (
      SELECT mo.outcome_id, mo.outcome_type_id, mo.status,
        (mo.status = 'in_progress'
          AND ot.abandonment_window_hrs IS NOT NULL
          AND now() - mo.last_activity_at > (ot.abandonment_window_hrs || ' hours')::interval
        ) AS is_abandoned
      FROM mt_outcomes mo
      JOIN mt_outcome_types ot ON ot.app_id = mo.app_id AND ot.outcome_type_id = mo.outcome_type_id
      WHERE mo.outcome_id = e.outcome_id
        AND mo.company_id = e.company_id
        AND mo.app_id = e.app_id
        AND mo.started_at >= p_period_start
        AND mo.started_at < p_period_end
    ) o ON true
    WHERE e.company_id = p_company_id
      AND e.app_id = p_app_id
      AND e.request_started_at >= p_period_start
      AND e.request_started_at < p_period_end
  )
  SELECT
    CASE p_group_by
      WHEN 'feature' THEN caller
      WHEN 'product' THEN caller
      WHEN 'model' THEN COALESCE(response_model, requested_model)
      WHEN 'user' THEN user_id::text
      WHEN 'prompt_version' THEN caller
      WHEN 'selection_rule' THEN selection_rule
      WHEN 'tier' THEN tier
      WHEN 'user_role' THEN user_role_at_call
      WHEN 'unpriced_drill' THEN COALESCE(provider, '?')
      WHEN 'outcome_type' THEN outcome_type_id
      WHEN 'failure_phase' THEN COALESCE(failure_phase, 'unspecified')
      WHEN 'variance_cause' THEN COALESCE(error_type, failure_phase, 'mixed')
    END::text AS group_key1,
    CASE p_group_by
      WHEN 'feature' THEN product_id::text
      WHEN 'product' THEN product_id::text
      WHEN 'prompt_version' THEN prompt_version
      WHEN 'unpriced_drill' THEN COALESCE(requested_model,'?') || ' → ' || COALESCE(response_model,'—')
      WHEN 'outcome_type' THEN completion_bucket
      ELSE NULL
    END::text AS group_key2,
    COUNT(*)::bigint,
    COALESCE(SUM(calc_cost), 0)::numeric,
    COALESCE(SUM(calc_input_cost), 0)::numeric,
    COALESCE(SUM(calc_output_cost), 0)::numeric,
    COUNT(*) FILTER (WHERE status IN ('error','timeout'))::bigint,
    COALESCE(SUM(calc_cost) FILTER (WHERE status IN ('error','timeout')), 0)::numeric,
    COALESCE(SUM(input_tokens), 0)::bigint,
    COALESCE(SUM(output_tokens), 0)::bigint,
    COALESCE(SUM(units_generated), 0)::numeric,
    COUNT(*) FILTER (WHERE units_generated IS NOT NULL)::bigint,
    MIN(request_started_at),
    MAX(request_started_at),
    MAX(tier)::text,
    MAX(user_role_at_call)::text
  FROM events
  WHERE (p_group_by <> 'unpriced_drill' OR calc_cost IS NULL)
    AND (p_group_by <> 'outcome_type' OR outcome_type_id IS NOT NULL)
    AND (p_group_by <> 'failure_phase' OR status IN ('error','timeout'))
    AND (p_group_by <> 'variance_cause' OR (response_model IS NOT NULL AND requested_model IS NOT NULL AND response_model <> requested_model))
  GROUP BY 1, 2;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mt_ai_cost_grouped(uuid, text, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_ai_cost_grouped(uuid, text, timestamptz, timestamptz, text) TO authenticated, postgres, service_role;

COMMIT;

-- Manual verification (run on dev after the migration succeeds):
-- 1. Signature/columns:
-- SELECT pg_get_functiondef('public.mt_ai_cost_grouped(uuid, text, timestamptz, timestamptz, text)'::regprocedure);
-- 2. Grants match pre-migration state (authenticated, postgres, service_role only):
-- SELECT grantee, privilege_type FROM information_schema.routine_privileges
-- WHERE routine_schema='public' AND routine_name='mt_ai_cost_grouped' ORDER BY grantee;
-- 3. Spot-check totals reconcile for a known company/app/period/group_by:
-- SELECT SUM(cost) AS total_cost, SUM(group_input_cost) AS total_input_cost,
--        SUM(group_output_cost) AS total_output_cost,
--        SUM(cost) - (SUM(group_input_cost) + SUM(group_output_cost)) AS drift
-- FROM mt_ai_cost_grouped('<company_id>', '<app_id>', now() - interval '30 days', now(), 'outcome_type');
-- drift must be zero (all three sums are derived from the same calc_cost split).
-- 4. Do not run production until dev verification and explicit approval are complete.
