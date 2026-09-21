# AI Control Tower Settings - App Connections, Credentials, Capture, and Budget & Alerts Implementation Spec v1.1

Status: Draft for critic review. Not approved for build until Nethaji confirms the build list.

Prototype basis: `ai-control-tower-settings-v7.html`.
Reference spec basis: `self-service-app-registration-spec.md`.
Target product: AI Control Tower settings experience inside the existing Control Tower shell.

---

## 1. Executive summary

This spec turns the finalized Settings prototype into an implementation plan.

The current manual Supabase-admin process for app registration and API key issuance will be replaced by an admin-facing Settings page inside AI Control Tower. The experience must let an authorized company admin:

1. Open Settings from the bottom-left user menu.
2. Register/connect an app without running SQL.
3. Configure capture and credential scopes as part of the same app onboarding flow.
4. Issue a company-scoped ingestion credential and see the plaintext key exactly once.
5. Manage each connected app through a row-level three-dot menu.
6. Rotate, revoke, or disconnect a connected app safely.
7. Open an app-specific Quick Start Guide from the row menu.
8. Open the full API reference from the page-level API Reference link.
9. Manage Budget & Alerts inside Settings by reusing the existing Governance screen layout and logic.

The main product navigation should remain focused on observability and traceability. Settings is an admin configuration destination, not another analytics workspace.

---

## 2. Design decisions already finalized

### 2.1 Navigation and entry point

Current user-menu item:

```text
Team Settings
```

must become:

```text
Settings
```

Clicking it opens the Settings page in the main content area.

Do not add a second Settings left panel. Do not create nested left navigation inside Settings.

### 2.2 Main left navigation

The main left navigation should remain focused on observability workflows:

- Command Center
- Outcome Economics
- Cost Analytics
- Trace Explorer

Governance should no longer be a top-level nav item once Budget & Alerts is moved into Settings.

If the team wants a transitional release, Governance may remain temporarily hidden behind a feature flag, but the final product state is: no top-level Governance nav item.

### 2.3 Settings page header

Settings must not show the analytics header controls:

- no App selector in the top-right header
- no Period selector
- no Export button

Settings header copy:

```text
Settings
Configure connected apps, ingestion credentials, capture controls, and budget rules.
```

### 2.4 Settings tabs

Settings has exactly two top-level horizontal tabs:

1. App connections
2. Budget & alerts

No stacked all-in-one page. No secondary left nav.

### 2.5 App connections UX model

App registration, scope/capture setup, and credential creation are one cohesive guided flow.

The user should not have to:

1. register the app in one section,
2. move to another section to configure scopes,
3. move to another section to create credentials.

A single Connect app drawer owns the initial setup flow.

### 2.6 Quick Start Guide and API reference

The page-level CTA is:

```text
Open API Reference ↗
```

This opens the full OpenAPI/API docs page. The URL must come from environment/config, not from a hardcoded dev Render URL.

The row-level three-dot menu item is:

```text
Quick Start Guide
```

The Quick Start Guide is app-specific and curated. It must not duplicate the full OpenAPI endpoint list. It should include only the minimal code needed to start sending telemetry for that app, plus a link to the full API reference.

The existing Quick Start visual style must be preserved:

- Base URL block
- Endpoints/helper area
- Code Examples panel
- language selector
- endpoint selector if useful
- code block
- copy buttons

### 2.7 Control mode

The app table column formerly discussed as Enforcement must be named:

```text
Control mode
```

It is read-only.

Values:

- Enforceable: `mt_apps.supports_enforcement = true`
- Monitor only: `mt_apps.supports_enforcement = false`

Company admins must not be able to set or change `supports_enforcement` during self-service app registration.

Self-registered apps always start as Monitor only.

Rationale: `supports_enforcement = true` means Control Tower can physically intercept the app's live AI traffic before the model call happens. Today that is true for Product Studio because its live AI calls pass through the proxy enforcement path. Apps that only report telemetry after the fact through `/v1` ingestion endpoints are Monitor only because Control Tower cannot block or downgrade their live AI calls.

### 2.8 Budget & alerts

Budget & Alerts must reuse the existing Governance implementation and visual layout.

Do not invent new budget widgets.
Do not invent new alert cards.
Do not add the previous banner copy:

```text
Admin and member access
Budget posture analysis, alert responses, and enforcement decisions for this app.
```

Budget & Alerts should show the same functional content that Governance already shows:

- Budget Posture card
- spend MTD
- budget
- warning threshold
- escalation threshold
- Update controls action
- current Alerts card/empty state
- existing alert acknowledge/dismiss behavior, if already wired

If multiple connected apps exist, the Budget & Alerts tab may include a small local app selector inside the tab content. This is not the global header App filter. It is required only because budgets are app-scoped.

There is no Period selector because the current budget model is monthly.

---

## 3. Scope of this implementation

### 3.1 In scope

Frontend:

- Rename user-menu item from Team Settings to Settings.
- Add Settings page to the main content router/state.
- Remove or hide Governance from main left nav once the Budget & Alerts tab is available.
- Add Settings tabs: App connections, Budget & alerts.
- Implement App connections table.
- Implement Connect app drawer.
- Implement row-level three-dot menu.
- Implement drawers/modals for all row actions.
- Restore existing Quick Start visual style in the Quick Start Guide drawer.
- Add Open API Reference page-level CTA.
- Move/reuse existing Governance Budget & Alerts UI into Settings.

Backend/API:

- Add safe self-service app registration endpoint/RPC.
- Add app connection listing endpoint/RPC that returns sanitized credential and scope metadata.
- Add safe capture/scope update endpoint/RPC.
- Add self-service credential issue, rotate, and revoke endpoint/RPC.
- Add disconnect app endpoint/RPC.
- Add `credential_expires_at` support from the reference spec.
- Add minimal lifecycle columns for revocation/disconnect so the product state is not ambiguous.
- Ensure no plaintext credential is logged or returned after the one-time creation/rotation response.
- Ensure the client never writes directly to `mt_apps` or `mt_company_apps`.

Ingestion middleware:

- Ensure API-key authentication rejects inactive app grants.
- Ensure revoked credentials are invalid immediately.
- Ensure expired credentials are invalid when `credential_expires_at` is non-null and in the past.
- Ensure scope/capture settings are real controls, not decorative UI.

Documentation/config:

- Add environment/config key for API reference URL.
- Update README/hand-off docs.
- Update project map/changelog/file manifest as applicable.

### 3.2 Out of scope

- Multiple named keys per app.
- Per-user personal API keys.
- Showing or recovering an existing plaintext key.
- Full app deletion from global `mt_apps`.
- Full audit event ledger.
- New alert UX beyond moving the existing Governance content.
- Redesigning Budget & Alerts.
- Redesigning the OpenAPI docs page.
- Letting company admins enable `supports_enforcement`.
- Supporting `restrict_tier` or `stop` for Monitor only apps.

---

## 4. Source-of-truth data model

### 4.1 Existing tables used

Existing tables:

- `mt_apps`
- `mt_company_apps`
- `mt_ai_budgets`
- `mt_ai_alerts`
- `mt_companies`
- `mt_users_companies`

### 4.2 Existing app registry fields

`mt_apps` fields used by this design:

- `app_id text primary key`
- `name text`
- `supports_enforcement boolean not null default false`
- `created_at timestamptz default now()`

### 4.3 Existing company-app grant fields

`mt_company_apps` fields used by this design:

- `company_id uuid`
- `app_id text`
- `is_active boolean default true`
- `granted_at timestamptz default now()`
- `granted_by uuid null`
- `credential_hash text null`
- `credential_created_at timestamptz null`
- `credential_last_used_at timestamptz null`
- `scope_usage_write boolean default true`
- `scope_traces_write boolean default true`
- `scope_payloads_write boolean default false`
- `payload_capture_enabled boolean default false`

### 4.4 New fields required

Add the following fields to `mt_company_apps`:

```sql
ALTER TABLE public.mt_company_apps
  ADD COLUMN IF NOT EXISTS credential_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS credential_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS credential_revoked_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz,
  ADD COLUMN IF NOT EXISTS disconnected_by uuid REFERENCES auth.users(id);
```

Why these are needed:

- `credential_expires_at`: carried forward from the self-service credential reference spec; needed so API-key auth can expire keys without deleting rows.
- `credential_revoked_at` and `credential_revoked_by`: needed because Revoke is now a finalized row action. Without these, a revoked credential is indistinguishable from one never issued.
- `disconnected_at` and `disconnected_by`: needed because Disconnect app is now a finalized row action. Without these, support/debugging cannot tell whether `is_active=false` was intentional.

This is not a full audit trail. It is minimal lifecycle state for actions exposed in the UI.

Payload capture default posture is a deliberate tightening from historical practice, where payload capture defaulted on for existing operator-created app grants. Self-service registrations must default `payload_capture_enabled = false`; admins must explicitly opt in per app through the Configure capture & scopes action or Step 2 of the Connect app flow. This prevents raw prompt/response capture from being silently enabled for self-registered third-party apps.

---

## 5. Security model

### 5.1 No direct client writes to sensitive tables

The frontend must not directly insert/update/delete from:

- `mt_apps`
- `mt_company_apps`

All app registration, scope configuration, credential, revoke, and disconnect operations must go through server routes or service-role-only RPCs.

### 5.2 Company admin authorization

Every write operation must prove:

- the caller is authenticated,
- the caller is an active member of the target company,
- the caller's role for that company is `admin`,
- the target app belongs to the target company where applicable.

Do not trust any `company_id`, `user_id`, `role`, or `app_id` from the browser without server verification.

### 5.3 Actor identity in service-role RPCs

Important correction to avoid an implementation loophole:

If a function is revoked from `authenticated` and called only by the proxy with `service_role`, it must not rely on `current_app_user()` to identify the end user. The service-role call may not carry the user's Supabase auth context in a way `current_app_user()` can safely read.

Therefore, all new service-role-only self-service RPCs in this spec take:

```sql
p_actor_user_id uuid
```

The proxy derives `p_actor_user_id` from the verified Supabase JWT. The browser never sends this value.

This keeps both safeguards:

1. the browser cannot call the RPC directly;
2. the database still verifies that the actor is a company admin.

### 5.4 Credential secrecy

Rules:

- Plaintext keys are shown exactly once after issue or rotate.
- Plaintext keys are never stored.
- Plaintext keys are never logged by the server.
- `credential_hash` is never returned to the frontend.
- Existing keys can never be viewed later.
- Revoke and disconnect invalidate existing keys immediately.

### 5.5 Control mode safety

Rules:

- `supports_enforcement` is never accepted from self-service registration requests.
- `self_service_register_app` always writes `supports_enforcement = false` for new apps.
- Product Studio and future enforceable apps require platform/operator upgrade outside this Settings UI.
- Budget & Alerts must not show Stop/Restrict controls for Monitor only apps.

---

## 6. Database/RPC implementation

### 6.1 Helper: require company admin

`_ct_require_company_admin` must be a new helper for this Settings/self-service surface. Do not delegate to or wrap any existing helper such as `_pgt_is_company_admin`, `_cost_tower_can_access`, or `_cost_tower_can_manage_governance`. Those helpers call `current_app_user()` internally, which is unsafe for the new service-role proxy execution path described in §5.3 because the RPC must authorize the actual end user, not the service-role session.

The role bar is intentionally admin-only. Self-service app registration, credential issuance, credential rotation, credential revocation, capture/scope changes, and disconnect create or modify durable app grants and secrets, so `member` access is not sufficient for this Settings feature. This follows the safer `_pgt_is_company_admin` role convention while avoiding its `current_app_user()` dependency.

```sql
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

REVOKE EXECUTE ON FUNCTION public._ct_require_company_admin(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._ct_require_company_admin(uuid, uuid)
TO postgres, service_role;
```

This function is an internal helper. It does not need to be callable from the frontend.

Platform-owner note, outside this spec's scope: live metadata shows `_pgt_is_company_admin` has EXECUTE granted to `PUBLIC`/`anon`/`authenticated`. It appears to fail closed for non-members, so this is not treated here as an active vulnerability, but it is inconsistent with the tighter governance/self-service access pattern and should be raised separately.

### 6.2 List app connections

Create a new RPC rather than changing `mt_company_apps_list`, because existing code may depend on that RPC's current return shape.

```sql
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
  SELECT
    ca.app_id,
    a.name,
    ca.is_active,
    ca.granted_at,
    a.supports_enforcement,
    CASE WHEN a.supports_enforcement THEN 'enforceable' ELSE 'monitor_only' END AS control_mode,
    (ca.credential_hash IS NOT NULL) AS has_credential,
    CASE
      WHEN ca.credential_hash IS NULL THEN 'not_issued'
      WHEN ca.credential_expires_at IS NOT NULL AND ca.credential_expires_at < now() THEN 'expired'
      ELSE 'active'
    END AS credential_status,
    ca.credential_created_at,
    ca.credential_last_used_at,
    ca.credential_expires_at,
    ca.credential_revoked_at,
    ca.scope_usage_write,
    ca.scope_traces_write,
    ca.scope_payloads_write,
    ca.payload_capture_enabled
  FROM public.mt_company_apps ca
  JOIN public.mt_apps a ON a.app_id = ca.app_id
  WHERE ca.company_id = p_company_id
    AND ca.is_active = true
  ORDER BY ca.granted_at ASC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.self_service_app_connections_list(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_service_app_connections_list(uuid, uuid)
TO service_role;
```

Frontend must never receive `credential_hash`.

### 6.3 Register/connect app

The admin enters only display name. The app ID is derived server-side.

This implementation extends the reference spec in one important way: if the app was previously disconnected, registering the same display name reconnects the existing company-scoped app instead of leaving the user stuck.

```sql
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
  v_existing_active boolean;
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);

  IF nullif(trim(p_display_name), '') IS NULL THEN
    RAISE EXCEPTION 'App name is required.';
  END IF;

  v_slug := lower(regexp_replace(trim(p_display_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);

  IF v_slug = '' THEN
    RAISE EXCEPTION 'App name must include at least one letter or number.';
  END IF;

  v_suffix := substr(replace(p_company_id::text, '-', ''), 1, 8);
  v_app_id := v_slug || '-' || v_suffix;

  SELECT EXISTS (
    SELECT 1
    FROM public.mt_company_apps ca
    WHERE ca.company_id = p_company_id
      AND ca.app_id = v_app_id
      AND ca.is_active = true
  ) INTO v_existing_active;

  IF v_existing_active THEN
    RAISE EXCEPTION 'An app with this name is already connected for your company.';
  END IF;

  INSERT INTO public.mt_apps (app_id, name, supports_enforcement)
  VALUES (v_app_id, trim(p_display_name), false)
  ON CONFLICT ON CONSTRAINT mt_apps_pkey DO UPDATE
    SET name = EXCLUDED.name;

  INSERT INTO public.mt_company_apps (
    company_id,
    app_id,
    is_active,
    granted_at,
    granted_by,
    scope_usage_write,
    scope_traces_write,
    scope_payloads_write,
    payload_capture_enabled,
    disconnected_at,
    disconnected_by
  )
  VALUES (
    p_company_id,
    v_app_id,
    true,
    now(),
    p_actor_user_id,
    true,
    true,
    false,
    false,
    null,
    null
  )
  ON CONFLICT ON CONSTRAINT mt_company_apps_pkey DO UPDATE
    SET is_active = true,
        granted_at = now(),
        granted_by = p_actor_user_id,
        scope_usage_write = true,
        scope_traces_write = true,
        scope_payloads_write = false,
        payload_capture_enabled = false,
        disconnected_at = null,
        disconnected_by = null;

  RETURN QUERY SELECT v_app_id, trim(p_display_name);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.self_service_register_app(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_service_register_app(uuid, uuid, text)
TO service_role;
```

Notes:

- Self-registered apps are always `supports_enforcement = false`.
- Self-service registration deliberately defaults `payload_capture_enabled = false`, even though historical operator-created grants may have payload capture enabled. This is intentional because raw payload capture is the most sensitive setting and must require explicit per-app opt-in.
- Reconnecting a previously disconnected app resets `scope_usage_write = true`, `scope_traces_write = true`, `scope_payloads_write = false`, and `payload_capture_enabled = false` regardless of the values present when the app was disconnected. Reconnect is treated as fresh registration for scope/capture purposes, so the admin must explicitly re-enable payload capture through Step 2 or Configure capture & scopes.
- The raw app ID may be shown in details, but it is not the primary UX concept.
- Quick Start Guide should focus on the API key and ingestion examples.

### 6.4 Update capture and scopes

This function backs the Configure capture & scopes drawer.

```sql
CREATE OR REPLACE FUNCTION public.self_service_update_app_capture_config(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_app_id text,
  p_scope_usage_write boolean,
  p_scope_traces_write boolean,
  p_scope_payloads_write boolean,
  p_payload_capture_enabled boolean
)
RETURNS TABLE(
  app_id text,
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

  IF p_app_id IS NULL OR trim(p_app_id) = '' THEN
    RAISE EXCEPTION 'App id is required.';
  END IF;

  IF p_payload_capture_enabled = true AND p_scope_payloads_write = false THEN
    RAISE EXCEPTION 'Payload capture requires payload write scope.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.mt_company_apps ca
    WHERE ca.company_id = p_company_id
      AND ca.app_id = p_app_id
      AND ca.is_active = true
  ) THEN
    RAISE EXCEPTION 'No active app connection found for this company.';
  END IF;

  UPDATE public.mt_company_apps ca
  SET scope_usage_write = coalesce(p_scope_usage_write, false),
      scope_traces_write = coalesce(p_scope_traces_write, false),
      scope_payloads_write = coalesce(p_scope_payloads_write, false),
      payload_capture_enabled = coalesce(p_payload_capture_enabled, false)
  WHERE ca.company_id = p_company_id
    AND ca.app_id = p_app_id
    AND ca.is_active = true;

  RETURN QUERY
  SELECT
    ca.app_id,
    ca.scope_usage_write,
    ca.scope_traces_write,
    ca.scope_payloads_write,
    ca.payload_capture_enabled
  FROM public.mt_company_apps ca
  WHERE ca.company_id = p_company_id
    AND ca.app_id = p_app_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.self_service_update_app_capture_config(uuid, uuid, text, boolean, boolean, boolean, boolean)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_service_update_app_capture_config(uuid, uuid, text, boolean, boolean, boolean, boolean)
TO service_role;
```

Critical implementation rule:

If the UI exposes Usage, Trace, and Payload scopes as editable controls, the ingestion API must enforce those scopes. Otherwise they are fake controls. See section 8.

### 6.5 Issue credential

```sql
CREATE OR REPLACE FUNCTION public.self_service_issue_credential(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_app_id text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'extensions', 'public', 'pg_temp'
AS $function$
DECLARE
  v_plaintext text;
  v_has_credential boolean;
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);

  SELECT (ca.credential_hash IS NOT NULL)
  INTO v_has_credential
  FROM public.mt_company_apps ca
  WHERE ca.company_id = p_company_id
    AND ca.app_id = p_app_id
    AND ca.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active app connection found for this company.';
  END IF;

  IF v_has_credential THEN
    RAISE EXCEPTION 'A credential already exists for this app. Rotate it instead.';
  END IF;

  v_plaintext := public.admin_issue_company_app_credential(p_company_id, p_app_id);

  UPDATE public.mt_company_apps
  SET credential_expires_at = p_expires_at,
      credential_revoked_at = null,
      credential_revoked_by = null
  WHERE company_id = p_company_id
    AND app_id = p_app_id;

  RETURN v_plaintext;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.self_service_issue_credential(uuid, uuid, text, timestamptz)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_service_issue_credential(uuid, uuid, text, timestamptz)
TO service_role;
```

The `v_has_credential` pre-check intentionally duplicates `admin_issue_company_app_credential`'s own atomic `ON CONFLICT ... WHERE credential_hash IS NULL` guard so the self-service path returns a clearer, app-specific error before falling through to the original operator-level exception.

### 6.6 Rotate credential

```sql
CREATE OR REPLACE FUNCTION public.self_service_rotate_credential(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_app_id text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'extensions', 'public', 'pg_temp'
AS $function$
DECLARE
  v_plaintext text;
  v_has_credential boolean;
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);

  SELECT (ca.credential_hash IS NOT NULL)
  INTO v_has_credential
  FROM public.mt_company_apps ca
  WHERE ca.company_id = p_company_id
    AND ca.app_id = p_app_id
    AND ca.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active app connection found for this company.';
  END IF;

  IF NOT v_has_credential THEN
    RAISE EXCEPTION 'No active credential exists for this app. Issue one first.';
  END IF;

  v_plaintext := public.admin_rotate_company_app_credential(p_company_id, p_app_id);

  UPDATE public.mt_company_apps
  SET credential_expires_at = p_expires_at,
      credential_revoked_at = null,
      credential_revoked_by = null
  WHERE company_id = p_company_id
    AND app_id = p_app_id;

  RETURN v_plaintext;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.self_service_rotate_credential(uuid, uuid, text, timestamptz)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_service_rotate_credential(uuid, uuid, text, timestamptz)
TO service_role;
```

Rotation behavior:

- Old key becomes invalid immediately.
- New plaintext key is shown once.
- Existing app connection remains active.

### 6.7 Revoke credential

```sql
CREATE OR REPLACE FUNCTION public.self_service_revoke_credential(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_app_id text
)
RETURNS TABLE(app_id text, has_credential boolean, credential_revoked_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.mt_company_apps ca
    WHERE ca.company_id = p_company_id
      AND ca.app_id = p_app_id
      AND ca.is_active = true
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'No active app connection found for this company.';
  END IF;

  UPDATE public.mt_company_apps ca
  SET credential_hash = null,
      credential_created_at = null,
      credential_expires_at = null,
      credential_revoked_at = now(),
      credential_revoked_by = p_actor_user_id
  WHERE ca.company_id = p_company_id
    AND ca.app_id = p_app_id
    AND ca.is_active = true;

  RETURN QUERY
  SELECT ca.app_id,
         (ca.credential_hash IS NOT NULL) AS has_credential,
         ca.credential_revoked_at
  FROM public.mt_company_apps ca
  WHERE ca.company_id = p_company_id
    AND ca.app_id = p_app_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.self_service_revoke_credential(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_service_revoke_credential(uuid, uuid, text)
TO service_role;
```

Revoke behavior:

- The current key stops working immediately.
- The app remains connected.
- The row remains visible.
- The row action changes from Rotate/Revoke to Issue credential.

### 6.8 Disconnect app

```sql
CREATE OR REPLACE FUNCTION public.self_service_disconnect_app(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_app_id text
)
RETURNS TABLE(app_id text, is_active boolean, disconnected_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public._ct_require_company_admin(p_actor_user_id, p_company_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.mt_company_apps ca
    WHERE ca.company_id = p_company_id
      AND ca.app_id = p_app_id
      AND ca.is_active = true
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'No active app connection found for this company.';
  END IF;

  UPDATE public.mt_company_apps ca
  SET is_active = false,
      credential_hash = null,
      credential_created_at = null,
      credential_expires_at = null,
      credential_revoked_at = now(),
      credential_revoked_by = p_actor_user_id,
      disconnected_at = now(),
      disconnected_by = p_actor_user_id
  WHERE ca.company_id = p_company_id
    AND ca.app_id = p_app_id
    AND ca.is_active = true;

  RETURN QUERY
  SELECT ca.app_id, ca.is_active, ca.disconnected_at
  FROM public.mt_company_apps ca
  WHERE ca.company_id = p_company_id
    AND ca.app_id = p_app_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.self_service_disconnect_app(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_service_disconnect_app(uuid, uuid, text)
TO service_role;
```

Disconnect behavior:

- Do not delete from `mt_apps`.
- Do not delete from `mt_company_apps`.
- Set `mt_company_apps.is_active = false`.
- Revoke any active credential at the same time.
- Existing budgets/alerts/history are not deleted.
- Ingestion using the old key must fail because the credential is revoked and the grant is inactive.

### 6.9 Grants verification SQL

After migration, this query must return zero rows for the service-role-only self-service functions:

```sql
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    '_ct_require_company_admin',
    'self_service_app_connections_list',
    'self_service_register_app',
    'self_service_update_app_capture_config',
    'self_service_issue_credential',
    'self_service_rotate_credential',
    'self_service_revoke_credential',
    'self_service_disconnect_app'
  )
  AND grantee IN ('PUBLIC', 'anon', 'authenticated');
```

The only expected executable grantee for externally-called self-service functions is `service_role`.

---

## 7. Proxy/API implementation

### 7.1 Route guard

All routes in this section must use an existing verified Supabase session guard plus company-admin guard.

Do not accept `company_id` from request body.

If the product supports company switching, the selected company context may be passed through the existing company selection mechanism, but it must be treated as untrusted until the server verifies that the authenticated user is an active admin of that company.

Server-derived values:

- `req.user.id` from verified Supabase JWT
- `req.companyId` after company-admin verification

### 7.2 Route list

Add these routes under the existing proxy/API surface.

Suggested route namespace:

```text
/api/control-tower/settings/apps
```

Routes:

```text
GET    /api/control-tower/settings/apps
POST   /api/control-tower/settings/apps
PATCH  /api/control-tower/settings/apps/:appId/capture
POST   /api/control-tower/settings/apps/:appId/credentials/issue
POST   /api/control-tower/settings/apps/:appId/credentials/rotate
POST   /api/control-tower/settings/apps/:appId/credentials/revoke
POST   /api/control-tower/settings/apps/:appId/disconnect
GET    /api/control-tower/settings/api-reference
```

### 7.3 GET app connections

Request:

```http
GET /api/control-tower/settings/apps
Authorization: Bearer <supabase-access-token>
```

Response:

```json
{
  "apps": [
    {
      "appId": "product-studio",
      "name": "Product Studio",
      "credentialStatus": "not_issued",
      "hasCredential": false,
      "credentialCreatedAt": null,
      "credentialLastUsedAt": null,
      "credentialExpiresAt": null,
      "credentialRevokedAt": null,
      "scopeUsageWrite": true,
      "scopeTracesWrite": true,
      "scopePayloadsWrite": true,
      "payloadCaptureEnabled": true,
      "supportsEnforcement": true,
      "controlMode": "enforceable",
      "isActive": true,
      "grantedAt": "2026-08-25T10:26:06.981491Z"
    }
  ]
}
```

Never include `credential_hash`.

### 7.4 POST connect/register app

Request:

```http
POST /api/control-tower/settings/apps
Content-Type: application/json
Authorization: Bearer <supabase-access-token>
```

Body:

```json
{
  "displayName": "Inventory Sync"
}
```

Response:

```json
{
  "app": {
    "appId": "inventory-sync-a1b2c3d4",
    "name": "Inventory Sync",
    "controlMode": "monitor_only"
  }
}
```

Validation:

- display name required
- trim whitespace
- max length: 80 characters in API validation, unless DB has a stricter limit
- reject names that slugify to empty

### 7.5 PATCH capture/scopes

Request:

```http
PATCH /api/control-tower/settings/apps/:appId/capture
Content-Type: application/json
Authorization: Bearer <supabase-access-token>
```

Body:

```json
{
  "scopeUsageWrite": true,
  "scopeTracesWrite": true,
  "scopePayloadsWrite": true,
  "payloadCaptureEnabled": true
}
```

Response:

```json
{
  "appId": "inventory-sync-a1b2c3d4",
  "scopeUsageWrite": true,
  "scopeTracesWrite": true,
  "scopePayloadsWrite": true,
  "payloadCaptureEnabled": true
}
```

Validation:

- app must be active for company
- payload capture cannot be enabled unless payload write scope is enabled
- all booleans must be actual booleans

### 7.6 POST issue credential

Request:

```http
POST /api/control-tower/settings/apps/:appId/credentials/issue
Content-Type: application/json
Authorization: Bearer <supabase-access-token>
```

Body:

```json
{
  "expiresAt": null
}
```

Response:

```json
{
  "appId": "inventory-sync-a1b2c3d4",
  "credential": "ct_...",
  "shownOnce": true,
  "message": "Copy this key now. It will not be shown again."
}
```

Rules:

- Do not log `credential`.
- Do not persist `credential` in frontend storage.
- UI may keep it in component memory until drawer is closed.
- On drawer close, plaintext must be discarded.

### 7.7 POST rotate credential

Request:

```http
POST /api/control-tower/settings/apps/:appId/credentials/rotate
Content-Type: application/json
Authorization: Bearer <supabase-access-token>
```

Body:

```json
{
  "expiresAt": null
}
```

Response: same shape as issue.

Behavior:

- Require confirmation in UI.
- Existing key invalid immediately.
- New plaintext key shown once.

### 7.8 POST revoke credential

Request:

```http
POST /api/control-tower/settings/apps/:appId/credentials/revoke
Authorization: Bearer <supabase-access-token>
```

Response:

```json
{
  "appId": "inventory-sync-a1b2c3d4",
  "hasCredential": false,
  "credentialRevokedAt": "2026-09-16T10:30:00Z"
}
```

Behavior:

- Require confirmation in UI.
- Existing key invalid immediately.
- App remains connected.
- User can issue a new credential later.

### 7.9 POST disconnect app

Request:

```http
POST /api/control-tower/settings/apps/:appId/disconnect
Authorization: Bearer <supabase-access-token>
```

Response:

```json
{
  "appId": "inventory-sync-a1b2c3d4",
  "isActive": false,
  "disconnectedAt": "2026-09-16T10:30:00Z"
}
```

Behavior:

- Require confirmation in UI.
- Revoke credential at the same time.
- Hide row from active App connections list after successful disconnect.
- Do not delete global `mt_apps`.
- Do not delete historical cost, traces, alerts, or budgets.

### 7.10 GET API reference config

Request:

```http
GET /api/control-tower/settings/api-reference
Authorization: Bearer <supabase-access-token>
```

Response:

```json
{
  "url": "https://<environment-api-host>/docs/"
}
```

Implementation:

- Read from existing codebase config if already present.
- Otherwise add a config key:
  - frontend: `VITE_CT_API_REFERENCE_URL`
  - proxy/server: `CT_API_REFERENCE_URL`
- Do not hardcode `https://pgt-proxy-dev.onrender.com/docs/` in React code.
- The dev URL can be the dev environment value.

---

## 8. Ingestion API enforcement

The Settings UI exposes scopes. Therefore the backend must make them real.

### 8.1 API key lookup must include lifecycle fields

API key authentication must resolve a key to a row containing:

- `company_id`
- `app_id`
- `is_active`
- `credential_hash`
- `credential_expires_at`
- `scope_usage_write`
- `scope_traces_write`
- `scope_payloads_write`
- `payload_capture_enabled`

Reject request if:

- no matching hash
- `is_active = false`
- `credential_hash is null`
- `credential_expires_at is not null and now() > credential_expires_at`

All four rejection conditions above must return an identical response body, status code, and error code — the ingestion endpoint must not let a caller distinguish a nonexistent key from a revoked, inactive, or expired one.

### 8.2 Scope-to-endpoint enforcement

Minimum enforcement rules:

| Endpoint family | Required flag |
|---|---|
| `/v1/usage-events` | `scope_usage_write = true` |
| `/v1/traces` | `scope_traces_write = true` |
| `/v1/tool-spans` | `scope_traces_write = true` |
| `/v1/trace-payloads` | `scope_payloads_write = true` and `payload_capture_enabled = true` |

If scope fails, return 403 with a stable error body:

```json
{
  "error": "scope_not_allowed",
  "message": "This credential is not allowed to write this telemetry type."
}
```

If payload capture is disabled, return:

```json
{
  "error": "payload_capture_disabled",
  "message": "Payload capture is disabled for this app credential."
}
```

Do not leak company IDs, app IDs, or hash details in errors.

### 8.3 Last-used timestamp

On successful authenticated ingestion request, update:

```sql
credential_last_used_at = now()
```

This powers the App connections table's Last used column.

This update should be best-effort and must not block the primary ingestion request if the timestamp update fails after authentication has succeeded. Log only sanitized metadata.

---

## 9. Frontend implementation

### 9.1 Target architecture

Primary implementation target is the current AI Control Tower React app.

Expected file areas:

- `ai-control-tower-react/src/App.tsx`
- `ai-control-tower-react/src/types.ts`
- `ai-control-tower-react/src/services/controlTowerApi.ts`
- `ai-control-tower-react/src/components/ui.tsx`
- new page/component files under `ai-control-tower-react/src/pages` or `src/components/settings`

Do not modify legacy Product Studio files except where the active Control Tower shell still physically lives there. If a `Product-Studio-v9.37.01/` directory is present as a read-only reference, do not write into it.

### 9.2 User menu change

Change user-menu label:

```text
Team Settings -> Settings
```

Click opens Settings page.

If routing is not available, implement with the same state-based page switch pattern used by existing Control Tower nav pages.

### 9.3 Settings page layout

Header:

```text
Settings
Configure connected apps, ingestion credentials, capture controls, and budget rules.
```

Tabs:

```text
App connections | Budget & alerts
```

No header App selector.
No Period selector.
No Export button.
No second left panel.

### 9.4 App connections toolbar

Left side:

```text
App connections
Manage telemetry ingestion for apps connected to this company.
```

Right side:

```text
Open API Reference ↗
Connect app
```

`Open API Reference` opens the configured docs URL in a new tab.

`Connect app` opens the guided drawer.

### 9.5 App connections table

Columns:

1. App
2. App ID
3. Credential
4. Capture
5. Scopes
6. Control mode
7. Last used
8. Actions

Column behavior:

#### App

Show display name from `mt_apps.name`.

#### App ID

Show `app_id` in subdued monospace text. It is useful for support/debugging but should not dominate the UX.

#### Credential

Map `credential_status`:

- `not_issued` -> Not issued
- `active` -> Active
- `expired` -> Expired

Never show plaintext key.

#### Capture

Show:

- Payload capture On
- Payload capture Off

#### Scopes

Show compact chips/labels:

- Usage
- Traces
- Payloads

Only show enabled scopes.

#### Control mode

Map:

- `enforceable` -> Enforceable
- `monitor_only` -> Monitor only

Read-only. No inline edit.

#### Last used

Use `credential_last_used_at`.

Display:

- relative time where available
- `-` if null

#### Actions

Only a three-dot menu.

### 9.6 Empty state

If no connected apps:

Title:

```text
Connect your first app
```

Copy:

```text
Give your integration a name, choose what telemetry it can send, and issue an ingestion key to start sending data into Control Tower.
```

CTA:

```text
Connect app
```

Secondary link:

```text
Open API Reference ↗
```

Do not show an empty table with no context.

---

## 10. Connect app drawer

The Connect app drawer owns the first-time flow.

### 10.1 Step 1 - App identity

Fields:

- App display name

Do not ask the admin to type `app_id`.

Helper copy:

```text
Use a recognizable name for the app or integration sending telemetry to Control Tower.
```

After submit:

- POST `/api/control-tower/settings/apps`
- Server generates app ID.
- UI proceeds to Step 2.

### 10.2 Step 2 - Capture & scopes

Fields:

- Usage events: enabled by default
- Traces/spans: enabled by default
- Payloads: off by default unless product owner chooses otherwise
- Payload capture: off by default and only enabled if Payloads is enabled

Validation:

- Payload capture cannot be on while Payloads is off.
- If Usage or Traces are made configurable, backend scope enforcement must be active before release.

After submit:

- PATCH `/api/control-tower/settings/apps/:appId/capture`
- UI proceeds to Step 3.

### 10.3 Step 3 - Issue credential

CTA:

```text
Issue credential
```

After success:

- Show plaintext key once.
- Show copy button.
- Show warning:

```text
Copy this key now. It will not be shown again.
```

Do not store plaintext key in local storage, session storage, IndexedDB, URL, or logs.

### 10.4 Step 4 - Quick Start Guide

After credential issuance, show the same existing Quick Start visual style.

The guide should be app-specific and scope-aware.

Do not list every endpoint from OpenAPI.

Include:

- Base URL
- Authorization header pattern
- minimal usage event example
- trace example if traces are enabled
- payload capture example only if payload scope and payload capture are enabled
- View full API reference link

---

## 11. Three-dot row menu actions

### 11.1 Menu item list

For an app with no credential:

```text
View details
Configure capture & scopes
Issue credential
Quick Start Guide
Disconnect app
```

For an app with an active credential:

```text
View details
Configure capture & scopes
Rotate credential
Revoke credential
Quick Start Guide
Disconnect app
```

For an expired credential:

```text
View details
Configure capture & scopes
Rotate credential
Revoke credential
Quick Start Guide
Disconnect app
```

Do not include Delete.

### 11.2 View details drawer

Show:

- App name
- App ID
- Connected since
- Credential status
- Credential created at
- Credential last used at
- Credential expires at, if any
- Payload capture On/Off
- Enabled scopes
- Control mode

Do not show:

- credential hash
- plaintext credential

### 11.3 Configure capture & scopes drawer

Show same controls as Connect app Step 2.

Save calls:

```text
PATCH /api/control-tower/settings/apps/:appId/capture
```

After save:

- close drawer or show saved state
- refresh app list

### 11.4 Issue credential drawer

Available only when `hasCredential = false`.

Flow:

- confirmation screen
- issue action
- one-time plaintext key reveal
- copy button
- Quick Start Guide CTA

### 11.5 Rotate credential modal/drawer

Available only when `hasCredential = true`.

Confirmation copy:

```text
Rotating this credential will immediately invalidate the current key. Any app still using the old key will stop sending telemetry until it is updated.
```

After success:

- show new plaintext key once
- copy button
- Quick Start Guide CTA

### 11.6 Revoke credential modal

Available only when `hasCredential = true`.

Confirmation copy:

```text
Revoking this credential will immediately stop this app from sending telemetry until a new credential is issued.
```

After success:

- row credential status becomes Not issued
- actions change to Issue credential

### 11.7 Quick Start Guide drawer

Use existing Quick Start style.

Title:

```text
Quick Start Guide - {App Name}
```

Do not duplicate the full OpenAPI docs.

Include:

- Base URL
- Authorization header
- selected minimal examples
- View full API reference CTA

### 11.8 Disconnect app modal

Confirmation copy:

```text
Disconnecting this app will remove it from active app connections and revoke any active credential. Historical usage, traces, budget records, and alerts will remain available where already stored.
```

After success:

- row disappears from active list
- any existing credential is invalid

---

## 12. Budget & alerts implementation

### 12.1 Reuse existing Governance code

Extract or reuse the existing Governance page content as a Settings tab.

Do not redesign the Budget Posture and Alerts cards.

Remove only:

- the top-level Governance page wrapper
- the extra banner/copy that was rejected
- analytics-page header filters when rendered inside Settings

### 12.2 Data sources

Continue using existing budget/alert RPCs:

- `mt_ai_budget_get_active(p_company_id, p_app_id)`
- `mt_ai_budget_upsert(...)`
- `mt_ai_alerts_list(p_company_id, p_app_id)`
- `mt_ai_alert_acknowledge(p_alert_id)`
- `mt_ai_alert_dismiss(p_alert_id)`

Do not add new alert queries for this release.
Do not add alert history unless existing implementation already supports it.

### 12.3 App selector inside Budget & alerts

Because budgets are app-scoped, Budget & alerts needs to know which app it is editing.

Rules:

- If exactly one active connected app exists, use it automatically.
- If multiple active apps exist, show a small local App selector inside the Budget & alerts tab content.
- Do not put App selector in the Settings page header.
- Do not show Period selector.

### 12.4 Monitor-only behavior

If selected app has `supports_enforcement = false`:

- `action_on_breach` must remain `notify`.
- Do not show Stop/Restrict options.
- If an existing reused component has an Action on breach dropdown, it must render as disabled Notify only for Monitor only apps.

If selected app has `supports_enforcement = true`:

- Reuse existing supported controls.
- Do not invent new enforcement controls.

---

## 13. Quick Start Guide content rules

### 13.1 Do not list every endpoint

The Quick Start Guide is not an API reference.

It should include only the minimum viable integration path for the selected app.

Full endpoint coverage belongs to the OpenAPI/API docs page opened by:

```text
Open API Reference ↗
```

### 13.2 Scope-aware examples

Examples must respect current app settings.

If only Usage is enabled:

- show usage event example only

If Traces are enabled:

- include trace/span example

If Payloads and Payload Capture are enabled:

- include payload capture example

If Payload Capture is disabled:

- do not show payload capture example as an active quick-start path
- optionally show a small note: enable payload capture to send raw prompt/response payloads

### 13.3 Credential display in examples

When a key has just been created and plaintext is still available in component memory, examples may include:

```text
Authorization: Bearer ct_...
```

Once the drawer is closed or later reopened, use placeholder:

```text
Authorization: Bearer YOUR_CONTROL_TOWER_KEY
```

Never fetch or reconstruct an existing key.

---

## 14. API Reference link

### 14.1 Source

The API Reference URL must be read from config.

Preferred sources, in order:

1. Existing codebase config if one already exists for OpenAPI docs.
2. `VITE_CT_API_REFERENCE_URL` for frontend builds.
3. `CT_API_REFERENCE_URL` returned through a server config endpoint.
4. Derived fallback: ingestion API base URL + `/docs/`.

### 14.2 Behavior

The CTA opens in a new browser tab/window.

Do not use the dev URL directly in source code:

```text
https://pgt-proxy-dev.onrender.com/docs/
```

That URL may be used only as the dev environment value.

### 14.3 Docs source of truth (2026-09-16 update)

The Ingestion API (`/v1/*`) is now also implemented natively in
`ai-control-tower-proxy` (ported from Product-Studio-v9.37.01/proxy, same
Supabase tables/RPCs, run in parallel — Product Studio's own `/v1` routes
are unmodified and keep running; retiring them is a future, separate,
explicit-approval-required step, not done as part of this change).

`ai-control-tower-proxy` serves its own `/docs` (Redoc + `openapi.json`),
built by `swagger-jsdoc` from `@openapi` JSDoc blocks above every route
handler in `routes/**/*.js` (both the Ingestion API and the Settings API) —
live-generated on every process start, not a static copied YAML file. See
`ai-control-tower-proxy/README.md`'s "API docs" section for the convention:
every new route must carry its own `@openapi` block.

---

## 15. Types and frontend service contracts

### 15.1 TypeScript types

Add or update types:

```ts
export type ControlMode = 'enforceable' | 'monitor_only';
export type CredentialStatus = 'not_issued' | 'active' | 'expired';

export interface ConnectedApp {
  appId: string;
  name: string;
  isActive: boolean;
  grantedAt: string;
  supportsEnforcement: boolean;
  controlMode: ControlMode;
  hasCredential: boolean;
  credentialStatus: CredentialStatus;
  credentialCreatedAt: string | null;
  credentialLastUsedAt: string | null;
  credentialExpiresAt: string | null;
  credentialRevokedAt: string | null;
  scopeUsageWrite: boolean;
  scopeTracesWrite: boolean;
  scopePayloadsWrite: boolean;
  payloadCaptureEnabled: boolean;
}
```

### 15.2 Service methods

Add to `controlTowerApi.ts` or equivalent:

```ts
listConnectedApps(): Promise<ConnectedApp[]>;
connectApp(input: { displayName: string }): Promise<ConnectedApp | { appId: string; name: string }>;
updateCaptureConfig(appId: string, input: CaptureConfigInput): Promise<CaptureConfig>;
issueCredential(appId: string, input?: { expiresAt?: string | null }): Promise<IssueCredentialResponse>;
rotateCredential(appId: string, input?: { expiresAt?: string | null }): Promise<IssueCredentialResponse>;
revokeCredential(appId: string): Promise<RevokeCredentialResponse>;
disconnectApp(appId: string): Promise<DisconnectAppResponse>;
getApiReferenceUrl(): Promise<string>;
```

`IssueCredentialResponse` must be handled carefully because it contains the plaintext key.

---

## 16. Error handling

### 16.1 User-facing error messages

Map backend errors to clear messages.

| Backend condition | User-facing message |
|---|---|
| duplicate active app name | An app with this name is already connected. |
| not company admin | You do not have permission to manage settings for this company. |
| no active app connection | This app is no longer connected. Refresh and try again. |
| credential already exists | A credential already exists. Rotate it instead. |
| no credential exists | No active credential exists. Issue one first. |
| nonexistent/revoked/inactive/expired ingestion API key | Invalid API key. |
| payload capture without payload scope | Payload capture requires payload write scope. |
| expired/invalid auth session | Your session has expired. Sign in again. |

### 16.2 Toasts

Use short toasts:

- App connected
- Capture settings updated
- Credential issued
- Credential rotated
- Credential revoked
- App disconnected

Do not include plaintext credentials in toasts.

---

## 17. Logging and observability

### 17.1 Server logs

Allowed:

- action name
- actor user id
- company id
- app id
- success/failure status
- sanitized error code

Not allowed:

- plaintext credential
- credential hash
- request Authorization header
- full request body if it may contain secrets

### 17.2 Client logs

Do not `console.log` issue/rotate responses.

Add an ESLint/code review check for accidental logging of `credential` if feasible.

---

## 18. Acceptance criteria

### 18.1 Navigation acceptance

- User menu shows Settings, not Team Settings.
- Clicking Settings opens Settings in main content area.
- Settings has no App/Period/Export controls in the header.
- Settings has exactly two tabs: App connections and Budget & alerts.
- No second left settings panel appears.

### 18.2 App connections acceptance

- Empty state appears for companies with zero apps.
- Connect app opens drawer.
- Admin enters display name only; no app ID input.
- App ID is generated server-side.
- Self-registered app shows Control mode = Monitor only.
- Product Studio shows Control mode = Enforceable where `supports_enforcement = true`.
- Three-dot menu shows state-appropriate actions.
- No Delete action appears.

### 18.3 Credential acceptance

- Issue credential returns plaintext once.
- Closing drawer discards plaintext.
- Refreshing page never shows plaintext key.
- Rotate invalidates old key immediately.
- Revoke invalidates current key immediately.
- Disconnect invalidates any current key immediately.
- `credential_hash` never appears in network responses.

### 18.4 Capture/scope acceptance

- Capture & scopes can be configured from Connect app flow.
- Capture & scopes can be configured later from row menu.
- New self-service registrations default to `scope_usage_write = true`, `scope_traces_write = true`, `scope_payloads_write = false`, and `payload_capture_enabled = false`.
- Reconnecting a previously-disconnected app resets all scope/capture flags to defaults regardless of their state at disconnect time.
- Payload capture cannot be enabled without payload write scope.
- Ingestion endpoints reject writes not allowed by scope flags.

### 18.5 Quick Start/API Reference acceptance

- Page-level CTA says Open API Reference.
- Row menu item says Quick Start Guide.
- Quick Start Guide uses existing Quick Start visual style.
- Quick Start Guide is app-specific.
- Quick Start Guide does not list all OpenAPI endpoints.
- Quick Start Guide links to full API reference.

### 18.6 Budget & alerts acceptance

- Budget & Alerts appears as Settings tab.
- Existing Governance-style Budget Posture and Alerts layout is reused.
- Rejected banner copy does not appear.
- No new alert UX is introduced.
- Monitor only apps do not show Stop/Restrict options.

---

## 19. Test plan

### 19.1 Database tests

Run in dev first.

1. Non-admin cannot call any self-service RPC successfully.
2. Company admin cannot act on a different company.
3. Same display name in two companies produces different app IDs.
4. Same display name in same active company fails with duplicate message.
5. Disconnected app can be reconnected by using the same display name.
6. Reconnecting a previously-disconnected app resets all scope/capture flags to defaults regardless of their state at disconnect time.
7. Self-registered app has `supports_enforcement = false`.
8. Self-registered app defaults `payload_capture_enabled = false`.
9. Issue credential stores only hash and returns plaintext once.
10. Rotate credential changes hash and returns new plaintext.
11. Revoke sets `credential_hash = null` and records revoke metadata.
12. Disconnect sets `is_active = false`, revokes credential, and records disconnect metadata.
13. Service-role-only RPC grant check returns zero rows for PUBLIC/anon/authenticated.

### 19.2 Proxy tests

1. Requests without JWT return 401.
2. Member/readonly user returns 403 for write operations.
3. Admin succeeds for own company.
4. Request body company ID is ignored/rejected.
5. Plaintext credential is not logged.
6. API Reference URL is environment-driven.

### 19.3 Ingestion tests

1. Valid active key can write allowed endpoint.
2. Revoked key returns 401.
3. Disconnected app key returns 401.
4. Expired key returns 401.
5. Usage endpoint rejects when `scope_usage_write = false`.
6. Trace/tool-span endpoints reject when `scope_traces_write = false`.
7. Payload endpoint rejects when `scope_payloads_write = false`.
8. Payload endpoint rejects when `payload_capture_enabled = false`.
9. Successful ingestion updates `credential_last_used_at`.

### 19.4 Frontend tests

1. Settings navigation renders correctly.
2. No top-right analytics controls on Settings.
3. App connections empty state renders.
4. Connect app drawer step flow works.
5. One-time key state clears on drawer close.
6. Three-dot menu actions render by credential state.
7. Confirmation modals prevent accidental rotate/revoke/disconnect.
8. Quick Start Guide uses existing style and has full API reference link.
9. Budget & Alerts tab reuses existing Governance cards.

---

## 20. Rollout plan

### 20.1 Development order

1. Add DB migration in dev.
2. Add proxy route guards and service methods.
3. Add app list/register/config endpoints.
4. Add issue/rotate/revoke/disconnect endpoints.
5. Add ingestion scope enforcement and expiry checks.
6. Add frontend Settings route/page shell.
7. Add App connections tab and empty state.
8. Add Connect app drawer.
9. Add row action menu and action drawers/modals.
10. Move existing Governance content into Budget & alerts tab.
11. Remove/hide top-level Governance nav item.
12. Wire API Reference config.
13. Run full test plan.
14. Update documentation.

### 20.2 Dev-first rule

All SQL and proxy changes must be applied to `pgt-dev` first.

Do not apply to production until:

- DB grant checks pass.
- Key issue/rotate/revoke tests pass.
- Ingestion compatibility tests pass.
- Existing Product Studio telemetry still works.
- Budget & Alerts existing behavior is unchanged except for page location.

### 20.3 Rollback

Rollback strategy:

- Frontend: feature flag or route hide Settings App connections tab.
- Proxy: disable self-service routes.
- DB: leave added nullable columns in place; do not drop during emergency rollback unless required.
- Existing operator admin functions remain untouched, so manual process can continue if self-service is disabled.

---

## 21. Build list for approval

No code should be changed until this build list is approved.

### Database

1. Add nullable lifecycle columns to `mt_company_apps`:
   - `credential_expires_at`
   - `credential_revoked_at`
   - `credential_revoked_by`
   - `disconnected_at`
   - `disconnected_by`
2. Add `_ct_require_company_admin` helper.
3. Add `self_service_app_connections_list`.
4. Add `self_service_register_app`.
5. Add `self_service_update_app_capture_config`.
6. Add `self_service_issue_credential`.
7. Add `self_service_rotate_credential`.
8. Add `self_service_revoke_credential`.
9. Add `self_service_disconnect_app`.
10. Revoke self-service functions from PUBLIC/anon/authenticated and grant only to service_role.
11. Run grant verification query.

### Proxy/API

12. Add settings app routes under `/api/control-tower/settings/apps`.
13. Add API Reference URL config route or frontend config.
14. Ensure route guard verifies company admin and sets actor user ID server-side.
15. Ensure no route logs plaintext credentials.
16. Add credential expiry check in API-key auth.
17. Add inactive/revoked grant rejection in API-key auth.
18. Add scope enforcement for usage, traces/tool-spans, and trace-payloads.
19. Add best-effort `credential_last_used_at` update.

### Frontend

20. Rename Team Settings to Settings in user menu.
21. Add Settings page.
22. Remove top-right App/Period/Export controls from Settings.
23. Add App connections and Budget & alerts tabs.
24. Implement App connections table.
25. Implement Connect app drawer.
26. Implement row three-dot menu.
27. Implement View details drawer.
28. Implement Configure capture & scopes drawer.
29. Implement Issue credential drawer.
30. Implement Rotate credential confirmation + one-time key reveal.
31. Implement Revoke credential confirmation.
32. Implement Disconnect app confirmation.
33. Implement Quick Start Guide drawer using existing Quick Start style.
34. Add Open API Reference CTA.
35. Move/reuse existing Governance content into Budget & alerts tab.
36. Remove or hide Governance from main nav.

### Docs/config

37. Add `VITE_CT_API_REFERENCE_URL` or reuse existing docs URL config.
38. Update `.env.example`.
39. Update README/handover notes.
40. Update changelog/project map/file manifest if the repo uses them.

---

## 22. Critic review prompts

Ask the critic to focus on these failure modes:

1. Does the service-role RPC design correctly avoid relying on `current_app_user()`?
2. Can a company admin act on another company's app by manipulating request parameters?
3. Does any frontend or backend response leak `credential_hash`?
4. Does any log path leak plaintext `ct_...` credentials?
5. Are scope toggles actually enforced by ingestion endpoints?
6. Does revoke invalidate a key immediately?
7. Does disconnect revoke credentials and avoid deleting historical telemetry?
8. Is `supports_enforcement` read-only and correctly treated as platform capability, not an admin setting?
9. Does Budget & Alerts reuse existing Governance behavior instead of introducing new behavior?
10. Does the Quick Start Guide avoid duplicating the full OpenAPI docs?

---

## 23. Final implementation guardrails

- Do not expose `supports_enforcement` as a user-editable setting.
- Do not add Delete app for company admins.
- Do not store plaintext API keys.
- Do not show existing keys again.
- Do not accept company ID from request body for privileged operations.
- Do not call service-role RPCs without passing verified actor user ID.
- Do not leave scope toggles unenforced.
- Do not redesign Budget & Alerts.
- Do not hardcode the dev API docs URL.
- Do not modify Product Studio signup/login unless separately approved.
