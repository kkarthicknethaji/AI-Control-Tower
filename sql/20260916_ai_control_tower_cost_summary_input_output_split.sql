-- AI Control Tower: add total_input_cost / total_output_cost to mt_ai_cost_summary
-- Purpose: let Command Center show a real $ input/output split on "Total AI Spend",
-- mirroring the existing total_input_tokens/total_output_tokens split.
-- Do not run in production without explicit approval after dev verification.
-- This file is intentionally not executed by the application.

BEGIN;

-- CREATE OR REPLACE FUNCTION cannot add/remove RETURNS TABLE (OUT parameter)
-- columns in place, so the function is dropped and recreated. Signature
-- (input arguments) is unchanged; only the output column list grows.
DROP FUNCTION IF EXISTS public.mt_ai_cost_summary(uuid, text, timestamptz, timestamptz);

CREATE FUNCTION public.mt_ai_cost_summary(
  p_company_id uuid,
  p_app_id text,
  p_period_start timestamp with time zone,
  p_period_end timestamp with time zone
)
RETURNS TABLE(
  total_cost numeric,
  total_calls bigint,
  total_input_tokens bigint,
  total_output_tokens bigint,
  total_input_cost numeric,
  total_output_cost numeric,
  priced_calls bigint,
  unpriced_calls bigint,
  failed_calls bigint,
  failed_cost numeric,
  balanced_frontier_calls bigint,
  cache_eligible_input bigint,
  cache_read_tokens bigint,
  cache_savings numeric,
  null_token_calls bigint,
  model_variance_calls bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
-- RETURNS TABLE's output columns include cache_read_tokens, which also
-- names a real mt_ai_usage_events column referenced (unqualified, via the
-- `events` CTE) inside this function — Postgres's default
-- plpgsql.variable_conflict='error' then rejects every bare reference to
-- it as ambiguous (is it the OUT parameter or the CTE column?). This
-- directive resolves the ambiguity in favor of the column, matching
-- ordinary SQL semantics, without requiring every reference in the body
-- to be alias-qualified.
#variable_conflict use_column
BEGIN
  IF NOT _cost_tower_can_access(p_company_id, p_app_id) THEN
    RAISE EXCEPTION 'Not authorized to read cost summary for company %', p_company_id;
  END IF;

  RETURN QUERY
  WITH events AS (
    SELECT
      e.input_tokens, e.output_tokens, e.cache_read_tokens, e.status, e.provider,
      e.response_model, e.requested_model,
      p.id AS pricing_id, p.tier, p.input_price_per_mtok, p.cache_read_price_per_mtok,
      CASE WHEN p.id IS NULL THEN NULL ELSE
          (e.input_tokens::numeric / 1000000) * p.input_price_per_mtok
        + (e.output_tokens::numeric / 1000000) * p.output_price_per_mtok
        + (COALESCE(e.cache_creation_5m_tokens,0)::numeric / 1000000) * p.cache_write_5m_price_per_mtok
        + (COALESCE(e.cache_creation_1h_tokens,0)::numeric / 1000000) * p.cache_write_1h_price_per_mtok
        + (COALESCE(e.cache_read_tokens,0)::numeric / 1000000) * p.cache_read_price_per_mtok
      END AS calc_cost,
      -- Input-side cost: prompt tokens plus every cache write/read component
      -- (cache is an alternate billing path for input tokens, not output).
      -- Null-guard matches calc_cost's own propagation: input_tokens/output_tokens
      -- are not COALESCE'd there, so either being NULL nulls the whole row's cost.
      -- Both split components must null out together or they won't sum back to total_cost.
      CASE WHEN p.id IS NULL OR e.input_tokens IS NULL OR e.output_tokens IS NULL THEN NULL ELSE
          (e.input_tokens::numeric / 1000000) * p.input_price_per_mtok
        + (COALESCE(e.cache_creation_5m_tokens,0)::numeric / 1000000) * p.cache_write_5m_price_per_mtok
        + (COALESCE(e.cache_creation_1h_tokens,0)::numeric / 1000000) * p.cache_write_1h_price_per_mtok
        + (COALESCE(e.cache_read_tokens,0)::numeric / 1000000) * p.cache_read_price_per_mtok
      END AS calc_input_cost,
      CASE WHEN p.id IS NULL OR e.input_tokens IS NULL OR e.output_tokens IS NULL THEN NULL ELSE
          (e.output_tokens::numeric / 1000000) * p.output_price_per_mtok
      END AS calc_output_cost
    FROM mt_ai_usage_events e
    LEFT JOIN mt_model_pricing p
      ON p.provider = e.provider
     AND p.model_name = COALESCE(e.response_model, e.requested_model)
     AND e.request_started_at >= p.effective_from
     AND (p.effective_to IS NULL OR e.request_started_at < p.effective_to)
    WHERE e.company_id = p_company_id
      AND e.app_id = p_app_id
      AND e.request_started_at >= p_period_start
      AND e.request_started_at < p_period_end
  )
  SELECT
    COALESCE(SUM(calc_cost), 0),
    COUNT(*),
    COALESCE(SUM(input_tokens), 0),
    COALESCE(SUM(output_tokens), 0),
    COALESCE(SUM(calc_input_cost), 0),
    COALESCE(SUM(calc_output_cost), 0),
    COUNT(*) FILTER (WHERE pricing_id IS NOT NULL),
    COUNT(*) FILTER (WHERE pricing_id IS NULL),
    COUNT(*) FILTER (WHERE status IN ('error','timeout')),
    COALESCE(SUM(calc_cost) FILTER (WHERE status IN ('error','timeout')), 0),
    COUNT(*) FILTER (WHERE tier IN ('balanced','frontier')),
    COALESCE(SUM(CASE WHEN provider = 'anthropic' THEN COALESCE(input_tokens,0) + COALESCE(cache_read_tokens,0) ELSE COALESCE(input_tokens,0) END), 0),
    COALESCE(SUM(cache_read_tokens), 0),
    COALESCE(SUM(
      CASE WHEN COALESCE(cache_read_tokens,0) > 0 AND pricing_id IS NOT NULL
             AND input_price_per_mtok IS NOT NULL AND cache_read_price_per_mtok IS NOT NULL
        THEN (cache_read_tokens / 1000000.0) * (input_price_per_mtok - cache_read_price_per_mtok)
        ELSE 0 END
    ), 0),
    COUNT(*) FILTER (WHERE input_tokens IS NULL OR output_tokens IS NULL),
    COUNT(*) FILTER (WHERE response_model IS NOT NULL AND requested_model IS NOT NULL AND response_model <> requested_model)
  FROM events;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mt_ai_cost_summary(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_ai_cost_summary(uuid, text, timestamptz, timestamptz) TO authenticated, postgres, service_role;

COMMIT;

-- Manual verification (run on dev after the migration succeeds):
-- 1. Signature/columns:
-- SELECT pg_get_functiondef('public.mt_ai_cost_summary(uuid, text, timestamptz, timestamptz)'::regprocedure);
-- 2. Grants match pre-migration state (authenticated, postgres, service_role only):
-- SELECT grantee, privilege_type FROM information_schema.routine_privileges
-- WHERE routine_schema='public' AND routine_name='mt_ai_cost_summary' ORDER BY grantee;
-- 3. Spot-check totals reconcile for a known company/app/period:
-- SELECT total_cost, total_input_cost, total_output_cost,
--        (total_input_cost + total_output_cost) AS reconciled_total
-- FROM mt_ai_cost_summary('<company_id>', '<app_id>', now() - interval '30 days', now());
-- reconciled_total must equal total_cost (both derived from the same calc_cost split).
-- 4. Do not run production until dev verification and explicit approval are complete.
