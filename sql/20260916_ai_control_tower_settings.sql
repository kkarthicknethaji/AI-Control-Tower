-- AI Control Tower Settings self-service migration
-- Execution order: pgt-dev first. Verify every query in the companion section below.
-- Do not run in production without explicit approval after dev verification.
-- This file is intentionally not executed by the application.

BEGIN;

ALTER TABLE public.mt_company_apps
  ADD COLUMN IF NOT EXISTS credential_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS credential_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS credential_revoked_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz,
  ADD COLUMN IF NOT EXISTS disconnected_by uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public._ct_require_company_admin(
  p_actor_user_id uuid,
  p_company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user required';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company id is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.mt_users_companies uc
    WHERE uc.user_id = p_actor_user_id
      AND uc.company_id = p_company_id
      AND uc.role = 'admin'
      AND uc.is_active = true
  ) THEN
    RAISE EXCEPTION 'Not an active admin of this company.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.self_service_app_connections_list(
  p_actor_user_id uuid,
  p_company_id uuid
)
RETURNS TABLE(
  app_id text,
  name text,
  is_active boolean,
  granted_at timestamptz,
  supports_enforcement boolean,
  control_mode text,
  has_credential boolean,
  credential_status text,
  credential_created_at timestamptz,
  credential_last_used_at timestamptz,
  credential_expires_at timestamptz,
  credential_revoked_at timestamptz,
  scope_usage_write boolean,
  scope_traces_write boolean,
  scope_payloads_write boolean,
  payload_capture_enabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);
  RETURN QUERY
  SELECT ca.app_id, a.name, ca.is_active, ca.granted_at,
    a.supports_enforcement,
    CASE WHEN a.supports_enforcement THEN 'enforceable' ELSE 'monitor_only' END,
    ca.credential_hash IS NOT NULL,
    CASE
      WHEN ca.credential_hash IS NULL THEN 'not_issued'
      WHEN ca.credential_expires_at IS NOT NULL AND ca.credential_expires_at < now() THEN 'expired'
      WHEN ca.credential_revoked_at IS NOT NULL THEN 'not_issued'
      ELSE 'active'
    END,
    ca.credential_created_at, ca.credential_last_used_at,
    ca.credential_expires_at, ca.credential_revoked_at,
    ca.scope_usage_write, ca.scope_traces_write, ca.scope_payloads_write,
    ca.payload_capture_enabled
  FROM public.mt_company_apps ca
  JOIN public.mt_apps a ON a.app_id = ca.app_id
  WHERE ca.company_id = p_company_id AND ca.is_active = true
  ORDER BY ca.granted_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.self_service_register_app(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_display_name text
)
RETURNS TABLE(app_id text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_slug text;
  v_app_id text;
  v_suffix text;
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);
  IF nullif(trim(p_display_name), '') IS NULL THEN
    RAISE EXCEPTION 'App name is required.';
  END IF;
  IF length(trim(p_display_name)) > 80 THEN
    RAISE EXCEPTION 'App name must be 80 characters or fewer.';
  END IF;

  v_slug := lower(regexp_replace(trim(p_display_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN
    RAISE EXCEPTION 'App name must include at least one letter or number.';
  END IF;
  v_suffix := substr(replace(p_company_id::text, '-', ''), 1, 8);
  v_app_id := v_slug || '-' || v_suffix;

  IF EXISTS (
    SELECT 1 FROM public.mt_company_apps ca
    WHERE ca.company_id = p_company_id AND ca.app_id = v_app_id AND ca.is_active = true
  ) THEN
    RAISE EXCEPTION 'An app with this name is already connected for your company.';
  END IF;

  INSERT INTO public.mt_apps (app_id, name, supports_enforcement)
  VALUES (v_app_id, trim(p_display_name), false)
  ON CONFLICT ON CONSTRAINT mt_apps_pkey DO UPDATE SET name = EXCLUDED.name;

  INSERT INTO public.mt_company_apps (
    company_id, app_id, is_active, granted_at, granted_by,
    scope_usage_write, scope_traces_write, scope_payloads_write,
    payload_capture_enabled, disconnected_at, disconnected_by,
    credential_hash, credential_created_at, credential_expires_at,
    credential_revoked_at, credential_revoked_by
  ) VALUES (
    p_company_id, v_app_id, true, now(), p_actor_user_id,
    true, true, false, false, null, null,
    null, null, null, null, null
  )
  ON CONFLICT ON CONSTRAINT mt_company_apps_pkey DO UPDATE SET
    is_active = true, granted_at = now(), granted_by = p_actor_user_id,
    scope_usage_write = true, scope_traces_write = true,
    scope_payloads_write = false, payload_capture_enabled = false,
    disconnected_at = null, disconnected_by = null,
    credential_hash = null, credential_created_at = null,
    credential_expires_at = null, credential_revoked_at = null,
    credential_revoked_by = null;

  RETURN QUERY SELECT v_app_id, trim(p_display_name);
END;
$function$;

CREATE OR REPLACE FUNCTION public.self_service_update_app_capture_config(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_app_id text,
  p_scope_usage_write boolean,
  p_scope_traces_write boolean,
  p_scope_payloads_write boolean,
  p_payload_capture_enabled boolean
)
RETURNS TABLE(app_id text, scope_usage_write boolean, scope_traces_write boolean, scope_payloads_write boolean, payload_capture_enabled boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);
  IF p_app_id IS NULL OR trim(p_app_id) = '' THEN RAISE EXCEPTION 'App id is required.'; END IF;
  IF p_payload_capture_enabled AND NOT p_scope_payloads_write THEN
    RAISE EXCEPTION 'Payload capture requires payload write scope.';
  END IF;
  UPDATE public.mt_company_apps ca
  SET scope_usage_write = coalesce(p_scope_usage_write, false),
      scope_traces_write = coalesce(p_scope_traces_write, false),
      scope_payloads_write = coalesce(p_scope_payloads_write, false),
      payload_capture_enabled = coalesce(p_payload_capture_enabled, false)
  WHERE ca.company_id = p_company_id AND ca.app_id = p_app_id AND ca.is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active app connection found for this company.'; END IF;
  RETURN QUERY SELECT ca.app_id, ca.scope_usage_write, ca.scope_traces_write,
    ca.scope_payloads_write, ca.payload_capture_enabled
  FROM public.mt_company_apps ca
  WHERE ca.company_id = p_company_id AND ca.app_id = p_app_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.self_service_issue_credential(
  p_actor_user_id uuid, p_company_id uuid, p_app_id text, p_expires_at timestamptz DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'extensions', 'public', 'pg_temp'
AS $function$
DECLARE v_plaintext text; v_has_credential boolean;
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);
  SELECT credential_hash IS NOT NULL INTO v_has_credential
  FROM public.mt_company_apps WHERE company_id = p_company_id AND app_id = p_app_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active app connection found for this company.'; END IF;
  IF v_has_credential THEN RAISE EXCEPTION 'A credential already exists for this app. Rotate it instead.'; END IF;
  v_plaintext := public.admin_issue_company_app_credential(p_company_id, p_app_id);
  UPDATE public.mt_company_apps SET credential_expires_at = p_expires_at,
    credential_revoked_at = null, credential_revoked_by = null
  WHERE company_id = p_company_id AND app_id = p_app_id;
  RETURN v_plaintext;
END;
$function$;

CREATE OR REPLACE FUNCTION public.self_service_rotate_credential(
  p_actor_user_id uuid, p_company_id uuid, p_app_id text, p_expires_at timestamptz DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'extensions', 'public', 'pg_temp'
AS $function$
DECLARE v_plaintext text; v_has_credential boolean;
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);
  SELECT credential_hash IS NOT NULL INTO v_has_credential
  FROM public.mt_company_apps WHERE company_id = p_company_id AND app_id = p_app_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active app connection found for this company.'; END IF;
  IF NOT v_has_credential THEN RAISE EXCEPTION 'No active credential exists for this app. Issue one first.'; END IF;
  v_plaintext := public.admin_rotate_company_app_credential(p_company_id, p_app_id);
  UPDATE public.mt_company_apps SET credential_expires_at = p_expires_at,
    credential_revoked_at = null, credential_revoked_by = null
  WHERE company_id = p_company_id AND app_id = p_app_id;
  RETURN v_plaintext;
END;
$function$;

CREATE OR REPLACE FUNCTION public.self_service_revoke_credential(
  p_actor_user_id uuid, p_company_id uuid, p_app_id text
)
RETURNS TABLE(app_id text, has_credential boolean, credential_revoked_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);
  UPDATE public.mt_company_apps ca
  SET credential_hash = null, credential_created_at = null,
      credential_expires_at = null, credential_revoked_at = now(),
      credential_revoked_by = p_actor_user_id
  WHERE ca.company_id = p_company_id AND ca.app_id = p_app_id AND ca.is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active app connection found for this company.'; END IF;
  RETURN QUERY SELECT ca.app_id, ca.credential_hash IS NOT NULL, ca.credential_revoked_at
  FROM public.mt_company_apps ca WHERE ca.company_id = p_company_id AND ca.app_id = p_app_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.self_service_disconnect_app(
  p_actor_user_id uuid, p_company_id uuid, p_app_id text
)
RETURNS TABLE(app_id text, is_active boolean, disconnected_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);
  UPDATE public.mt_company_apps ca
  SET is_active = false, credential_hash = null, credential_created_at = null,
      credential_expires_at = null, credential_revoked_at = now(),
      credential_revoked_by = p_actor_user_id, disconnected_at = now(),
      disconnected_by = p_actor_user_id
  WHERE ca.company_id = p_company_id AND ca.app_id = p_app_id AND ca.is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active app connection found for this company.'; END IF;
  RETURN QUERY SELECT ca.app_id, ca.is_active, ca.disconnected_at
  FROM public.mt_company_apps ca WHERE ca.company_id = p_company_id AND ca.app_id = p_app_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public._ct_require_company_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.self_service_app_connections_list(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.self_service_register_app(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.self_service_update_app_capture_config(uuid, uuid, text, boolean, boolean, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.self_service_issue_credential(uuid, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.self_service_rotate_credential(uuid, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.self_service_revoke_credential(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.self_service_disconnect_app(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ct_require_company_admin(uuid, uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.self_service_app_connections_list(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.self_service_register_app(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.self_service_update_app_capture_config(uuid, uuid, text, boolean, boolean, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.self_service_issue_credential(uuid, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.self_service_rotate_credential(uuid, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.self_service_revoke_credential(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.self_service_disconnect_app(uuid, uuid, text) TO service_role;

COMMIT;

-- Manual verification (run on pgt-dev after the migration succeeds):
-- 1. Columns:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='mt_company_apps'
-- AND column_name IN ('credential_expires_at','credential_revoked_at','credential_revoked_by','disconnected_at','disconnected_by')
-- ORDER BY column_name;
-- 2. Functions/grants:
-- SELECT routine_name, grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema='public' AND routine_name IN
-- ('_ct_require_company_admin','self_service_app_connections_list','self_service_register_app','self_service_update_app_capture_config','self_service_issue_credential','self_service_rotate_credential','self_service_revoke_credential','self_service_disconnect_app')
-- ORDER BY routine_name, grantee;
-- 3. Must return zero rows for public callers:
-- SELECT routine_name, grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema='public' AND routine_name IN
-- ('_ct_require_company_admin','self_service_app_connections_list','self_service_register_app','self_service_update_app_capture_config','self_service_issue_credential','self_service_rotate_credential','self_service_revoke_credential','self_service_disconnect_app')
-- AND grantee IN ('PUBLIC','anon','authenticated');
-- 4. Do not run production until dev verification and explicit approval are complete.
