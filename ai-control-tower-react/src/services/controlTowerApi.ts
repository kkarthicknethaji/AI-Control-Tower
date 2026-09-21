import type { CaptureConfigInput, CompanyApp, ConnectedApp, RpcParams } from '../types';
import { getSupabase } from '../lib/supabase';
import { getEnv } from '../lib/env';
import { money } from '../lib/utils';

export interface CostSummaryRow {
  total_cost?: number | string | null;
  total_cost_usd?: number | string | null;
  call_count?: number | string | null;
  total_calls?: number | string | null;
  total_tokens?: number | string | null;
  total_input_tokens?: number | string | null;
  total_output_tokens?: number | string | null;
  total_input_cost?: number | string | null;
  total_output_cost?: number | string | null;
  priced_calls?: number | string | null;
  unpriced_call_count?: number | string | null;
  unpriced_calls?: number | string | null;
  null_token_calls?: number | string | null;
  model_variance_calls?: number | string | null;
  failed_calls?: number | string | null;
  failed_cost?: number | string | null;
  cache_savings?: number | string | null;
  [key: string]: unknown;
}

export interface GroupedCostRow {
  group_key1?: string | null;
  group_key2?: string | null;
  label?: string | null;
  key?: string | null;
  feature?: string | null;
  model?: string | null;
  cost?: number | string | null;
  total_cost_usd?: number | string | null;
  cost_usd?: number | string | null;
  group_input_cost?: number | string | null;
  group_output_cost?: number | string | null;
  [key: string]: unknown;
}

export interface AgentCostRow extends GroupedCostRow {
  agent?: string | null;
  agent_name?: string | null;
  caller?: string | null;
  call_count?: number | string | null;
}

export interface OutcomeRow {
  id?: string | null;
  outcome_id?: string | null;
  outcome_type_id?: string | null;
  name?: string | null;
  outcome_name?: string | null;
  status?: string | null;
  is_abandoned?: boolean | null;
  [key: string]: unknown;
}

export interface OutcomeTypeRow {
  outcome_type_id?: string | null;
  id?: string | null;
  name?: string | null;
  canvas?: string | null;
  [key: string]: unknown;
}

export interface TopCallRow {
  partition_key?: string | null;
  caller?: string | null;
  calculated_cost?: number | string | null;
  cost?: number | string | null;
  [key: string]: unknown;
}

export interface CostEventRow {
  usage_event_id?: string | null;
  event_id?: string | null;
  trace_id?: string | null;
  request_started_at?: string | null;
  caller?: string | null;
  provider?: string | null;
  resolved_model?: string | null;
  model?: string | null;
  input_tokens?: number | string | null;
  output_tokens?: number | string | null;
  calculated_cost?: number | string | null;
  cost?: number | string | null;
  status?: string | null;
  failure_phase?: string | null;
  total_row_count?: number | string | null;
  [key: string]: unknown;
}

export interface TraceDetailRow {
  trace_id?: string | null;
  client_trace_id?: string | null;
  usage_event_id?: string | null;
  agent_name?: string | null;
  trace_started_at?: string | null;
  trace_completed_at?: string | null;
  outcome_id?: string | null;
  sequence_order?: number | string | null;
  span_type?: string | null;
  tool_name?: string | null;
  span_status?: string | null;
  span_started_at?: string | null;
  span_duration_ms?: number | string | null;
  calculated_cost?: number | string | null;
  request_bytes?: number | string | null;
  response_bytes?: number | string | null;
  [key: string]: unknown;
}

export interface TracePayloadRow {
  payload_id?: string | null;
  request_payload?: unknown;
  response_payload?: unknown;
  [key: string]: unknown;
}

export interface BudgetRow {
  budget_id?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  warn_threshold_pct?: number | string | null;
  escalate_threshold_pct?: number | string | null;
  enforcement_mode?: string | null;
  action_on_breach?: string | null;
  [key: string]: unknown;
}

export interface AlertRow {
  alert_id?: string | null;
  threshold_type?: string | null;
  threshold_pct?: number | string | null;
  status?: string | null;
  created_at?: string | null;
  acknowledged_at?: string | null;
  [key: string]: unknown;
}

export interface OpportunityRow {
  type?: number | string | null;
  title?: string | null;
  feature?: string | null;
  savings?: number | string | null;
  estimated_savings?: number | string | null;
  evidence?: string | null;
  confidence?: string | null;
  recommendation?: string | null;
  segmentCount?: number | string | null;
  currentTier?: string | null;
  candidateTier?: string | null;
  [key: string]: unknown;
}

// Same thresholds/segment size the legacy Cost Tower client uses to map mt_ai_cost_opportunities' raw rows (opp_type 1/2) into a readable title, evidence, confidence, and recommendation.
const OPPORTUNITY_SMALL_SEGMENT_PCT = 0.4;
const CONFIDENCE_HIGH_MIN = 1000;
const CONFIDENCE_MEDIUM_MIN = 200;
const TIER_LABEL: Record<string, string> = { economical: 'Economical', balanced: 'Balanced', frontier: 'Frontier' };

function tierLabel(tier: unknown) {
  if (tier === null || tier === undefined || tier === '') return 'Untiered';
  return TIER_LABEL[String(tier).toLowerCase()] ?? String(tier);
}

function confidenceTier(count: number): 'High' | 'Medium' | 'Low' {
  if (count > CONFIDENCE_HIGH_MIN) return 'High';
  if (count >= CONFIDENCE_MEDIUM_MIN) return 'Medium';
  return 'Low';
}

function mapOpportunityRow(row: Record<string, unknown>): OpportunityRow {
  const oppType = Number(row.opp_type ?? row.type);
  const segmentCount = Number(row.segment_count ?? row.segmentCount ?? 0);
  const feature = String(row.feature ?? '');
  if (oppType === 1) {
    const currentTier = tierLabel(row.current_tier);
    const candidateTier = tierLabel(row.candidate_tier);
    const smallPct = Math.round(OPPORTUNITY_SMALL_SEGMENT_PCT * 100);
    return {
      ...row, type: 1, feature, savings: Number(row.savings),
      title: `${feature} Intake Routing`,
      evidence: `The smallest ${smallPct}% of ${feature} calls by request size still route through ${currentTier} tier, alongside its larger calls. That segment covers ${segmentCount} qualifying calls this period.`,
      confidence: confidenceTier(segmentCount),
      segmentCount,
      currentTier: String(row.current_tier ?? ''),
      candidateTier: String(row.candidate_tier ?? ''),
      recommendation: `Route the smallest ${smallPct}% of ${feature} calls by request size to the ${candidateTier} tier instead of ${currentTier}. This re-tiers ${segmentCount} calls without touching the larger requests that need ${currentTier}.`,
    };
  }
  if (oppType === 2) {
    const currentAvg = Number(row.current_avg_cost);
    const baselineAvg = Number(row.baseline_avg_cost);
    const currentVersion = String(row.current_version ?? 'the current version');
    const baselineVersion = String(row.baseline_version ?? 'the prior version');
    return {
      ...row, type: 2, feature, savings: Number(row.savings),
      title: `Prompt Version ${currentVersion} Review`,
      evidence: `${currentVersion} shows a higher avg cost/call (${money(currentAvg)}) than the immediately preceding version ${baselineVersion} (${money(baselineAvg)}) for ${feature}.`,
      confidence: confidenceTier(segmentCount),
      segmentCount,
      recommendation: `Diff prompt version ${currentVersion} against ${baselineVersion} for ${feature} and roll back or fix whichever change is driving the ${money(currentAvg - baselineAvg)} per-call increase.`,
    };
  }
  return row as OpportunityRow;
}

export async function listCompanyApps(companyId: string): Promise<CompanyApp[]> {
  const { data, error } = await getSupabase().rpc('mt_company_apps_list', { p_company_id: companyId });
  if (error) throw error;
  return (data ?? []).map((app: { app_id?: string; name?: string; app_name?: string; supports_enforcement?: boolean }) => ({
    app_id: String(app.app_id ?? ''),
    app_name: app.app_name ?? app.name ?? 'Unnamed app',
    supports_enforcement: Boolean(app.supports_enforcement),
  }));
}

export async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await getSupabase().rpc(name, params);
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function getCostSummary(params: RpcParams): Promise<CostSummaryRow[]> {
  return rpc<CostSummaryRow>('mt_ai_cost_summary', {
    p_company_id: params.companyId, p_app_id: params.appId,
    p_period_start: params.periodStart, p_period_end: params.periodEnd,
  });
}

export async function getGroupedCost(params: RpcParams, groupBy: string): Promise<GroupedCostRow[]> {
  return rpc<GroupedCostRow>('mt_ai_cost_grouped', {
    p_company_id: params.companyId, p_app_id: params.appId,
    p_period_start: params.periodStart, p_period_end: params.periodEnd, p_group_by: groupBy,
  });
}

export async function getCostByAgent(params: RpcParams): Promise<AgentCostRow[]> {
  return rpc<AgentCostRow>('mt_ai_cost_by_agent', {
    p_company_id: params.companyId, p_app_id: params.appId,
    p_period_start: params.periodStart, p_period_end: params.periodEnd,
  });
}

export async function getBudget(params: RpcParams): Promise<BudgetRow | null> {
  const { data, error } = await getSupabase().rpc('mt_ai_budget_get_active', { p_company_id: params.companyId, p_app_id: params.appId });
  if (error) throw error;
  return (data ?? null) as BudgetRow | null;
}

export async function getAlerts(params: RpcParams): Promise<AlertRow[]> {
  return rpc<AlertRow>('mt_ai_alerts_list', { p_company_id: params.companyId, p_app_id: params.appId });
}

export async function getOpportunities(params: RpcParams): Promise<OpportunityRow[]> {
  const rows = await rpc<Record<string, unknown>>('mt_ai_cost_opportunities', {
    p_company_id: params.companyId, p_app_id: params.appId,
    p_period_start: params.periodStart, p_period_end: params.periodEnd,
  });
  return rows.map(mapOpportunityRow).sort((a, b) => (Number(b.savings) || 0) - (Number(a.savings) || 0));
}

export async function upsertBudget(params: RpcParams, input: { amount: number; warnThresholdPct: number; escalateThresholdPct: number; actionOnBreach: string }): Promise<BudgetRow | null> {
  const { data, error } = await getSupabase().rpc('mt_ai_budget_upsert', {
    p_company_id: params.companyId, p_app_id: params.appId, p_amount: input.amount, p_currency: 'USD',
    p_warn_threshold_pct: input.warnThresholdPct, p_escalate_threshold_pct: input.escalateThresholdPct,
    p_enforcement_mode: 'monitor', p_action_on_breach: input.actionOnBreach,
  });
  if (error) throw error;
  return (data ?? null) as BudgetRow | null;
}

export async function acknowledgeAlert(alertId: string): Promise<AlertRow | null> {
  const { data, error } = await getSupabase().rpc('mt_ai_alert_acknowledge', { p_alert_id: alertId });
  if (error) throw error;
  return (data ?? null) as AlertRow | null;
}

export async function dismissAlert(alertId: string): Promise<AlertRow | null> {
  const { data, error } = await getSupabase().rpc('mt_ai_alert_dismiss', { p_alert_id: alertId });
  if (error) throw error;
  return (data ?? null) as AlertRow | null;
}

export async function getOpportunitySupportingCalls(params: RpcParams, feature: string, limit = 5): Promise<Record<string, unknown>[]> {
  return rpc<Record<string, unknown>>('mt_ai_cost_opportunity_supporting_calls', {
    p_company_id: params.companyId, p_app_id: params.appId,
    p_period_start: params.periodStart, p_period_end: params.periodEnd, p_feature: feature, p_limit: limit,
  });
}

export async function getTopCalls(params: RpcParams, orderBy: string, limit: number, partitionBy?: string): Promise<TopCallRow[]> {
  return rpc<TopCallRow>('mt_ai_cost_top_calls', {
    p_company_id: params.companyId, p_app_id: params.appId,
    p_period_start: params.periodStart, p_period_end: params.periodEnd,
    p_order_by: orderBy, p_limit: limit, p_partition_by: partitionBy ?? null,
  });
}

export async function getCostEvents(params: RpcParams, limit = 50, offset = 0): Promise<{ rows: CostEventRow[]; totalCount: number }> {
  const { data, error } = await getSupabase().rpc('mt_ai_cost_events_list', {
    p_company_id: params.companyId, p_app_id: params.appId,
    p_period_start: params.periodStart, p_period_end: params.periodEnd,
    p_limit: limit, p_offset: offset,
  });
  if (error) throw error;
  const rows = (data ?? []) as CostEventRow[];
  return { rows, totalCount: rows[0]?.total_row_count == null ? rows.length : Number(rows[0].total_row_count) };
}

export async function getAllCostEvents(params: RpcParams): Promise<CostEventRow[]> {
  const pageSize = 100;
  const rows: CostEventRow[] = [];
  let offset = 0;
  let totalCount = 0;
  do {
    const page = await getCostEvents(params, pageSize, offset);
    rows.push(...page.rows);
    totalCount = page.totalCount;
    offset += page.rows.length;
    if (page.rows.length === 0) break;
  } while (rows.length < totalCount);
  return rows;
}

export async function getTraceDetails(params: RpcParams): Promise<TraceDetailRow[]> {
  return rpc<TraceDetailRow>('mt_ai_trace_detail_list', {
    p_company_id: params.companyId, p_app_id: params.appId,
    p_period_start: params.periodStart, p_period_end: params.periodEnd,
  });
}

export async function getTracePayload(params: RpcParams, usageEventId: string): Promise<TracePayloadRow[]> {
  return rpc<TracePayloadRow>('mt_ai_trace_payload_get', {
    p_company_id: params.companyId, p_app_id: params.appId, p_usage_event_id: usageEventId,
  });
}

export async function getOutcomeTypes(appId: string): Promise<OutcomeTypeRow[]> {
  return rpc<OutcomeTypeRow>('mt_outcome_types_list', { p_app_id: appId });
}

export async function getOutcomes(params: RpcParams): Promise<OutcomeRow[]> {
  return rpc<OutcomeRow>('mt_outcomes_list', {
    p_company_id: params.companyId, p_app_id: params.appId,
    p_period_start: params.periodStart, p_period_end: params.periodEnd,
  });
}

async function settingsRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');
  const env = getEnv();
  const response = await fetch(`${env.apiBaseUrl ?? ''}/api/control-tower/settings${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': session.access_token, ...(options.headers ?? {}) },
  });
  const body = await response.json() as T & { error?: { message?: string; type?: string } };
  if (!response.ok) throw new Error(body.error?.message ? `${body.error.message} (HTTP ${response.status})` : `Settings request failed (HTTP ${response.status}).`);
  return body;
}

function mapConnectedApp(row: Record<string, unknown>): ConnectedApp {
  return {
    appId: String(row.app_id ?? ''), name: String(row.name ?? 'Unnamed app'), isActive: Boolean(row.is_active),
    grantedAt: String(row.granted_at ?? ''), supportsEnforcement: Boolean(row.supports_enforcement),
    controlMode: row.control_mode === 'enforceable' ? 'enforceable' : 'monitor_only',
    hasCredential: Boolean(row.has_credential),
    credentialStatus: row.credential_status === 'active' || row.credential_status === 'expired' ? row.credential_status : 'not_issued',
    credentialCreatedAt: row.credential_created_at ? String(row.credential_created_at) : null,
    credentialLastUsedAt: row.credential_last_used_at ? String(row.credential_last_used_at) : null,
    credentialExpiresAt: row.credential_expires_at ? String(row.credential_expires_at) : null,
    credentialRevokedAt: row.credential_revoked_at ? String(row.credential_revoked_at) : null,
    scopeUsageWrite: Boolean(row.scope_usage_write), scopeTracesWrite: Boolean(row.scope_traces_write),
    scopePayloadsWrite: Boolean(row.scope_payloads_write), payloadCaptureEnabled: Boolean(row.payload_capture_enabled),
  };
}

export async function listConnectedApps(companyId: string): Promise<ConnectedApp[]> {
  const response = await settingsRequest<{ apps: Record<string, unknown>[] }>('/apps', { headers: { 'X-Company-Id': companyId } });
  return (response.apps ?? []).map(mapConnectedApp);
}

export async function connectApp(companyId: string, displayName: string): Promise<{ appId: string; name: string }> {
  const response = await settingsRequest<{ app: { appId: string; name: string } }>('/apps', {
    method: 'POST', headers: { 'X-Company-Id': companyId }, body: JSON.stringify({ displayName }),
  });
  return response.app;
}

export async function updateCaptureConfig(companyId: string, appId: string, input: CaptureConfigInput): Promise<CaptureConfigInput> {
  const response = await settingsRequest<{ scopeUsageWrite: boolean; scopeTracesWrite: boolean; scopePayloadsWrite: boolean; payloadCaptureEnabled: boolean }>(`/apps/${encodeURIComponent(appId)}/capture`, {
    method: 'PATCH', headers: { 'X-Company-Id': companyId }, body: JSON.stringify(input),
  });
  return response;
}

export interface IssueCredentialResponse { appId: string; credential: string; shownOnce: true; message: string; }
export interface RevokeCredentialResponse { appId: string; hasCredential: boolean; credentialRevokedAt: string; }
export interface DisconnectAppResponse { appId: string; isActive: false; disconnectedAt: string; }

export async function issueCredential(companyId: string, appId: string, expiresAt: string | null = null): Promise<IssueCredentialResponse> {
  return settingsRequest<IssueCredentialResponse>(`/apps/${encodeURIComponent(appId)}/credentials/issue`, { method: 'POST', headers: { 'X-Company-Id': companyId }, body: JSON.stringify({ expiresAt }) });
}
export async function rotateCredential(companyId: string, appId: string, expiresAt: string | null = null): Promise<IssueCredentialResponse> {
  return settingsRequest<IssueCredentialResponse>(`/apps/${encodeURIComponent(appId)}/credentials/rotate`, { method: 'POST', headers: { 'X-Company-Id': companyId }, body: JSON.stringify({ expiresAt }) });
}
export async function revokeCredential(companyId: string, appId: string): Promise<RevokeCredentialResponse> {
  return settingsRequest<RevokeCredentialResponse>(`/apps/${encodeURIComponent(appId)}/credentials/revoke`, { method: 'POST', headers: { 'X-Company-Id': companyId } });
}
export async function disconnectApp(companyId: string, appId: string): Promise<DisconnectAppResponse> {
  return settingsRequest<DisconnectAppResponse>(`/apps/${encodeURIComponent(appId)}/disconnect`, { method: 'POST', headers: { 'X-Company-Id': companyId } });
}
export async function getApiReferenceUrl(companyId: string): Promise<string> {
  const configured = getEnv().apiReferenceUrl;
  if (configured) return configured;
  const response = await settingsRequest<{ url: string }>('/api-reference', { headers: { 'X-Company-Id': companyId } });
  return response.url;
}
