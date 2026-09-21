# AI Control Tower SQL migrations

## Dev-first execution

1. Open the Supabase SQL Editor for **pgt-dev**.
2. Review `20260916_ai_control_tower_settings.sql`.
3. Execute the migration as one script.
4. Run the verification queries at the end of that file.
5. Test the Settings proxy and ingestion lifecycle behavior against pgt-dev.
6. Do not run this migration against production until dev verification is complete and explicit approval is provided.

The application does not execute this file and must not assume the migration is applied. Until it is applied, the new Settings routes return an unavailable response from the missing RPCs; existing ingestion authentication retains its legacy fallback behavior.

**Resolved (2026-09-16):** the `column reference "app_id" is ambiguous` error on "Connect app" was NOT a qualification issue (that was a red herring). The real cause was `self_service_register_app`'s `INSERT ... ON CONFLICT (app_id)` / `ON CONFLICT (company_id, app_id)` — a plpgsql `RETURNS TABLE(app_id ...)` OUT-parameter collides with a bare column name inside an `ON CONFLICT` target list, and that list can't be table-qualified. Fixed by switching to `ON CONFLICT ON CONSTRAINT mt_apps_pkey` / `ON CONFLICT ON CONSTRAINT mt_company_apps_pkey`. This fix is applied in `20260916_ai_control_tower_settings.sql` and has been verified working end-to-end against pgt-dev. (The narrower companion patch file that previously existed for this fix has been deleted — it's fully superseded by the main migration file.)

**Latest file to run in production:** `20260916_ai_control_tower_settings.sql` — it is the single, complete, current migration (lifecycle columns + all eight self-service functions, including the `ON CONFLICT ON CONSTRAINT` fix) and is idempotent, so it's safe to run even though pgt-dev already has these objects from earlier partial runs. There is no other SQL file to run.

## Required dev verification

Confirm:

- all five nullable lifecycle columns exist on `public.mt_company_apps`;
- all eight self-service functions exist;
- self-service functions have no `PUBLIC`, `anon`, or `authenticated` execute grants;
- service-role grants are present;
- self-service registration defaults payload capture off;
- reconnect resets usage, trace, payload, and capture flags;
- issue, rotate, revoke, and disconnect behavior matches the approved spec.

Do not apply production changes from this workspace.
