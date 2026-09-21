import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CircleDollarSign, Eye, GitBranch, Lightbulb } from 'lucide-react';
import { getAlerts, getBudget, getCostByAgent, getCostSummary, getGroupedCost, getOpportunities, getOpportunitySupportingCalls } from '../../services/controlTowerApi';
import type { CostSummaryRow, OpportunityRow } from '../../services/controlTowerApi';
import type { NavKey, RpcParams } from '../../types';
import { compactNumber, money, previousRange } from '../../lib/utils';
import { Badge, Card, EmptyState, SectionTitle } from '../../components/ui';
import { MetricCard } from '../../components/common/MetricCard';

function numeric(row: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function summaryValue(row: CostSummaryRow, ...keys: string[]) { return numeric(row as Record<string, unknown>, ...keys); }
function rowLabel(row: Record<string, unknown>) { return String(row.label ?? row.group_key1 ?? row.feature ?? row.name ?? row.key ?? 'Unlabelled'); }
function rowCost(row: Record<string, unknown>) { return numeric(row, 'total_cost_usd', 'cost_usd', 'cost', 'calculated_cost'); }
function rowInputCost(row: Record<string, unknown>) { return numeric(row, 'group_input_cost'); }
function rowOutputCost(row: Record<string, unknown>) { return numeric(row, 'group_output_cost'); }
function sumCosts(rows: Array<Record<string, unknown>>) { if (!rows.length) return 0; const costs = rows.map(rowCost); return costs.every((value) => value !== undefined) ? costs.reduce((total, value) => total + (value ?? 0), 0) : undefined; }
function sumField(rows: Array<Record<string, unknown>>, fn: (row: Record<string, unknown>) => number | undefined) { if (!rows.length) return 0; const values = rows.map(fn); return values.every((value) => value !== undefined) ? values.reduce((total, value) => total + (value ?? 0), 0) : undefined; }

function QueryState({ isLoading, error, empty, children }: { isLoading: boolean; error: unknown; empty: boolean; children: React.ReactNode }) {
  if (isLoading) return <EmptyState>Loading live data...</EmptyState>;
  if (error) return <EmptyState>Live data could not be loaded for this period.</EmptyState>;
  if (empty) return <EmptyState>No live data is available for this app and period.</EmptyState>;
  return <>{children}</>;
}

function tierLabel(tier: unknown) {
  if (tier === null || tier === undefined || tier === '') return 'Untiered';
  const labels: Record<string, string> = { economical: 'Economical', balanced: 'Balanced', frontier: 'Frontier' };
  return labels[String(tier).toLowerCase()] ?? String(tier);
}

function OpportunityDetail({ params, opportunity }: { params: RpcParams; opportunity: OpportunityRow }) {
  const feature = String(opportunity.feature ?? '');
  const savings = numeric(opportunity as Record<string, unknown>, 'savings', 'estimated_savings');
  const evidence = opportunity.evidence ? String(opportunity.evidence) : undefined;
  const recommendation = opportunity.recommendation ? String(opportunity.recommendation) : undefined;
  const confidence = opportunity.confidence ? String(opportunity.confidence) : undefined;
  const segmentCount = numeric(opportunity as Record<string, unknown>, 'segmentCount', 'segment_count');
  const opportunityType = numeric(opportunity as Record<string, unknown>, 'type');
  const typeLabel = opportunityType === 1 ? 'Tier Routing' : opportunityType === 2 ? 'Prompt Regression' : opportunityType === 3 ? 'Attribution Gap' : undefined;
  const confidenceDetail = confidence === 'High' ? '>1,000 qualifying calls this period' : confidence === 'Medium' ? '200–1,000 qualifying calls this period' : confidence === 'Low' ? '<200 qualifying calls this period' : undefined;
  const query = useQuery({
    queryKey: ['command-center', 'opportunity-calls', params.companyId, params.appId, params.periodStart, params.periodEnd, feature],
    enabled: Boolean(feature),
    queryFn: () => getOpportunitySupportingCalls(params, feature, 5),
  });
  return <div className="space-y-4">
    <div className="list">
      <div className="list-row"><span>Feature</span><strong>{feature || 'Unavailable'}</strong></div>
      {typeLabel && <div className="list-row"><span>Signal Type</span><strong>{typeLabel}</strong></div>}
      <div className="list-row"><span>Estimated Savings</span><strong>{money(savings)}{opportunityType !== 3 ? ' / mo' : ''}</strong></div>
      {confidence && <div className="list-row"><span>Confidence</span><strong>{confidence}{confidenceDetail ? ` (${confidenceDetail})` : ''}</strong></div>}
      {segmentCount !== undefined && <div className="list-row"><span>Qualifying Calls</span><strong>{compactNumber(segmentCount)}</strong></div>}
    </div>
    {evidence && <div className="cc-callout"><b>Why This Was Flagged</b><p>{evidence}</p></div>}
    {recommendation && <div className="cc-callout cc-callout-action"><b>Recommended Action</b><p>{recommendation}</p></div>}
    <div>
      <SectionTitle title="Supporting Calls" detail="Request size, duration, and current tier for the qualifying segment — use this to re-tune routing or prompt rules" />
      {!feature ? <EmptyState>No feature reference is available for this opportunity.</EmptyState> : query.isLoading ? <EmptyState>Loading supporting calls...</EmptyState> : query.error ? <EmptyState>Supporting calls could not be loaded.</EmptyState> : !query.data?.length ? <EmptyState>No supporting calls were returned.</EmptyState> : <table className="cc-table"><thead><tr><th>Time</th><th>Request Size</th><th>Duration</th><th>Tier</th><th>Cost</th></tr></thead><tbody>
        {query.data.map((call, index) => {
          const startedAt = call.request_started_at ? new Date(String(call.request_started_at)).toLocaleTimeString() : '—';
          const requestBytes = numeric(call, 'request_bytes');
          const durationMs = numeric(call, 'duration_ms');
          return <tr key={String(call.usage_event_id ?? call.request_started_at ?? index)}>
            <td>{startedAt}</td>
            <td>{requestBytes === undefined ? '—' : `${Math.round(requestBytes / 1024)} KB`}</td>
            <td>{durationMs === undefined ? '—' : `${(durationMs / 1000).toFixed(1)}s`}</td>
            <td>{tierLabel(call.tier)}</td>
            <td>{money(numeric(call, 'calculated_cost', 'cost'))}</td>
          </tr>;
        })}
      </tbody></table>}
    </div>
  </div>;
}

interface ActionItem { key: string; title: string; detail: string; onClick: () => void; }

export function CommandCenterPage({ params, onOpen, canViewGovernance, onNavigate }: { params: RpcParams; onOpen: (title: string, content?: ReactNode) => void; canViewGovernance: boolean; onNavigate: (key: NavKey) => void }) {
  const queryContext = [params.companyId, params.appId, params.periodStart, params.periodEnd];
  const previousParams: RpcParams = { ...params, ...previousRange(params) };
  const previousSummary = useQuery({ queryKey: ['command-center', 'summary-prev', previousParams.companyId, previousParams.appId, previousParams.periodStart, previousParams.periodEnd], queryFn: () => getCostSummary(previousParams) });
  const summary = useQuery({ queryKey: ['command-center', 'summary', ...queryContext], queryFn: () => getCostSummary(params) });
  const grouped = useQuery({ queryKey: ['command-center', 'grouped', ...queryContext, 'feature'], queryFn: () => getGroupedCost(params, 'feature') });
  const outcomeGrouped = useQuery({ queryKey: ['command-center', 'grouped', ...queryContext, 'outcome_type'], queryFn: () => getGroupedCost(params, 'outcome_type') });
  const agents = useQuery({ queryKey: ['command-center', 'agents', ...queryContext], queryFn: () => getCostByAgent(params) });
  const budget = useQuery({ queryKey: ['command-center', 'budget', params.companyId, params.appId], queryFn: () => getBudget(params) });
  const alerts = useQuery({ queryKey: ['command-center', 'alerts', params.companyId, params.appId], enabled: canViewGovernance, queryFn: () => getAlerts(params) });
  const opportunities = useQuery({ queryKey: ['command-center', 'opportunities', ...queryContext], queryFn: () => getOpportunities(params) });

  const row = summary.data?.[0] ?? {};
  const totalSpend = summaryValue(row, 'total_cost', 'total_cost_usd');
  const callCount = summaryValue(row, 'total_calls', 'call_count');
  const totalTokens = summaryValue(row, 'total_input_tokens') !== undefined || summaryValue(row, 'total_output_tokens') !== undefined
    ? (summaryValue(row, 'total_input_tokens') ?? 0) + (summaryValue(row, 'total_output_tokens') ?? 0)
    : summaryValue(row, 'total_tokens');
  const inputTokens = summaryValue(row, 'total_input_tokens');
  const outputTokens = summaryValue(row, 'total_output_tokens');
  const inputCost = summaryValue(row, 'total_input_cost');
  const outputCost = summaryValue(row, 'total_output_cost');
  const averageCost = totalSpend !== undefined && callCount !== undefined && callCount > 0 ? totalSpend / callCount : undefined;
  const pricedCalls = summaryValue(row, 'priced_calls');
  const pricingMatch = pricedCalls !== undefined && callCount !== undefined && callCount > 0 ? (pricedCalls / callCount) * 100 : undefined;
  const unpricedCalls = summaryValue(row, 'unpriced_calls', 'unpriced_call_count');
  const outcomeSpend = outcomeGrouped.isLoading || outcomeGrouped.error ? undefined : sumCosts(outcomeGrouped.data ?? []);
  const unattributedSpend = totalSpend !== undefined && outcomeSpend !== undefined ? totalSpend - outcomeSpend : undefined;
  const outcomeInputCost = outcomeGrouped.isLoading || outcomeGrouped.error ? undefined : sumField(outcomeGrouped.data ?? [], rowInputCost);
  const outcomeOutputCost = outcomeGrouped.isLoading || outcomeGrouped.error ? undefined : sumField(outcomeGrouped.data ?? [], rowOutputCost);
  const unattributedInputCost = inputCost !== undefined && outcomeInputCost !== undefined ? inputCost - outcomeInputCost : undefined;
  const unattributedOutputCost = outputCost !== undefined && outcomeOutputCost !== undefined ? outputCost - outcomeOutputCost : undefined;
  const averageInputCost = inputCost !== undefined && callCount !== undefined && callCount > 0 ? inputCost / callCount : undefined;
  const averageOutputCost = outputCost !== undefined && callCount !== undefined && callCount > 0 ? outputCost / callCount : undefined;
  const budgetAmount = numeric(budget.data as Record<string, unknown> | undefined, 'amount');
  const budgetUsedPct = budgetAmount && totalSpend !== undefined && budgetAmount > 0 ? (totalSpend / budgetAmount) * 100 : undefined;
  const activeAlertCount = canViewGovernance ? alerts.data?.length ?? 0 : undefined;

  const driverRows = (grouped.data ?? []).slice(0, 5);
  const maxDriverCost = Math.max(1, ...driverRows.map((item) => rowCost(item) ?? 0));
  const agentRows = (agents.data ?? []).slice(0, 5);
  const opportunityRows = (opportunities.data ?? []).slice(0, 3);
  const topOpportunity = opportunityRows[0];
  const topOpportunitySavings = topOpportunity ? numeric(topOpportunity as Record<string, unknown>, 'savings', 'estimated_savings') : undefined;
  const outcomeAttributionPct = totalSpend !== undefined && totalSpend > 0 && outcomeSpend !== undefined ? (outcomeSpend / totalSpend) * 100 : undefined;
  const prevTotalSpend = summaryValue(previousSummary.data?.[0] ?? {}, 'total_cost', 'total_cost_usd');
  const spendDeltaPct = totalSpend !== undefined && prevTotalSpend !== undefined && prevTotalSpend > 0 ? ((totalSpend - prevTotalSpend) / prevTotalSpend) * 100 : undefined;
  const heroLoading = summary.isLoading || outcomeGrouped.isLoading || opportunities.isLoading;

  function heroHeadline() {
    if (heroLoading) return 'Loading executive summary for this app and period...';
    const spendClause = budgetUsedPct !== undefined
      ? budgetUsedPct >= 100 ? 'over budget' : budgetUsedPct >= 90 ? 'nearing budget' : 'within budget'
      : spendDeltaPct !== undefined
        ? spendDeltaPct > 5 ? `up ${spendDeltaPct.toFixed(0)}% from the prior period` : spendDeltaPct < -5 ? `down ${Math.abs(spendDeltaPct).toFixed(0)}% from the prior period` : 'steady versus the prior period'
        : 'tracking for this period';
    let riskClause = 'no major leaks are showing in the current signals';
    if (topOpportunity) riskClause = `a ${money(topOpportunitySavings)} opportunity in ${String(topOpportunity.title ?? topOpportunity.feature ?? 'a top driver')} is the next control point`;
    else if (unpricedCalls !== undefined && unpricedCalls > 0) riskClause = `${compactNumber(unpricedCalls)} unpriced calls are the next control point`;
    else if (outcomeAttributionPct !== undefined && outcomeAttributionPct < 60) riskClause = 'unattributed spend is the next control point';
    return `AI spend is ${spendClause}, but ${riskClause}.`;
  }

  function heroSummary() {
    if (heroLoading) return 'Live spend, outcome attribution, and opportunity signals for this app and period are loading.';
    const parts: string[] = [`Total AI spend is ${money(totalSpend)} across ${compactNumber(callCount)} calls this period.`];
    if (outcomeAttributionPct !== undefined) parts.push(`${outcomeAttributionPct.toFixed(0)}% of that spend (${money(outcomeSpend)}) is attributed to outcomes, the app's ROI signal.`);
    if (topOpportunity) parts.push(`The largest leak is ${String(topOpportunity.title ?? topOpportunity.feature ?? 'an optimization signal')}, worth ${money(topOpportunitySavings)} in potential savings.`);
    else if (unpricedCalls !== undefined && unpricedCalls > 0) parts.push(`${compactNumber(unpricedCalls)} calls remain unpriced, which limits full cost visibility.`);
    return parts.join(' ');
  }

  const actions: ActionItem[] = [];
  opportunityRows.slice(0, 1).forEach((opportunity, index) => {
    const savings = numeric(opportunity as Record<string, unknown>, 'savings', 'estimated_savings');
    actions.push({
      key: `opportunity-${index}`,
      title: String(opportunity.title ?? opportunity.feature ?? 'Optimization opportunity'),
      detail: savings !== undefined ? `Estimated savings of ${money(savings)} from an existing optimization signal.` : 'Existing optimization signal from live cost data.',
      onClick: () => onNavigate('governance'),
    });
  });
  if (unpricedCalls !== undefined && unpricedCalls > 0) {
    actions.push({
      key: 'unpriced',
      title: `Fix ${compactNumber(unpricedCalls)} unpriced calls`,
      detail: `Pricing match is ${pricingMatch === undefined ? 'incomplete' : `${pricingMatch.toFixed(1)}%`}; unpriced rows reduce trust in cost reporting.`,
      onClick: () => onNavigate('cost'),
    });
  }
  if (canViewGovernance && budgetUsedPct !== undefined) {
    actions.push({
      key: 'budget',
      title: `Review ${budgetUsedPct.toFixed(0)}% budget usage`,
      detail: `Current period spend is tracking against the active budget of ${money(budgetAmount)}.`,
      onClick: () => onNavigate('governance'),
    });
  }
  if (canViewGovernance && activeAlertCount) {
    actions.push({
      key: 'alerts',
      title: `Review ${activeAlertCount} active governance alert${activeAlertCount === 1 ? '' : 's'}`,
      detail: 'Open alerts from the governance alert feed for this app and period.',
      onClick: () => onNavigate('governance'),
    });
  }

  return <>
    <div className="cc-hero">
      <Card className="cc-story">
        <Badge className="bg-purpleP text-purple">Live Executive Summary</Badge>
        <h2 className="cc-headline">{heroHeadline()}</h2>
        <p>{heroSummary()}</p>
        <div className="lens-row">
          <div className="lens"><div className="lens-dot"><Eye size={14} /></div><div><b>Observability</b><span>Spend, calls, tokens, average cost, and pricing trust.</span></div></div>
          <div className="lens"><div className="lens-dot"><GitBranch size={14} /></div><div><b>Traceability</b><span>Request to trace to span to payload to outcome path.</span></div></div>
          <div className="lens"><div className="lens-dot"><Lightbulb size={14} /></div><div><b>Explainability</b><span>Feature, agent, and outcome-type cost drivers.</span></div></div>
        </div>
      </Card>
      <Card className="cc-actions">
        <div className="panel-head">
          <div><span className="eyebrow">Next Actions</span><h3>What Needs Attention</h3><p>Clickable pathways into existing investigation surfaces.</p></div>
          <Badge className="bg-amberP text-amber">{actions.length} Items</Badge>
        </div>
        <div className="action-list">
          {actions.length === 0 && <EmptyState>No signals need attention for this app and period.</EmptyState>}
          {actions.map((action, index) => <button key={action.key} className="action-row" onClick={action.onClick}>
            <span className="action-ic">{index + 1}</span>
            <span><b>{action.title}</b><p>{action.detail}</p></span>
          </button>)}
        </div>
      </Card>
    </div>

    <div className="metric-grid five">
      <MetricCard
        label="Total AI Spend"
        value={money(totalSpend)}
        detail={summary.isLoading ? 'Loading summary...' : `${compactNumber(callCount)} calls this period`}
        tone="blue"
        breakdown={inputCost !== undefined || outputCost !== undefined ? { inLabel: 'In', inValue: money(inputCost), outLabel: 'Out', outValue: money(outputCost) } : undefined}
      />
      <MetricCard label="Budget Used" value={budgetUsedPct === undefined ? '—' : `${budgetUsedPct.toFixed(0)}%`} detail={budgetAmount === undefined ? 'No active budget configured' : `Of ${money(budgetAmount)} budget`} tone={budgetUsedPct !== undefined && budgetUsedPct >= 90 ? 'red' : budgetUsedPct !== undefined && budgetUsedPct >= 75 ? 'amber' : 'green'} />
      <MetricCard
        label="Outcome-Attributed Spend"
        value={money(outcomeSpend)}
        detail="Outcome-type grouping"
        tone="purple"
        breakdown={outcomeInputCost !== undefined || outcomeOutputCost !== undefined ? { inLabel: 'In', inValue: money(outcomeInputCost), outLabel: 'Out', outValue: money(outcomeOutputCost) } : undefined}
      />
      <MetricCard
        label="Outcome-Unattributed Spend"
        value={money(unattributedSpend)}
        detail="Total less attributed"
        tone="amber"
        breakdown={unattributedInputCost !== undefined || unattributedOutputCost !== undefined ? { inLabel: 'In', inValue: money(unattributedInputCost), outLabel: 'Out', outValue: money(unattributedOutputCost) } : undefined}
      />
      <MetricCard label="Pricing Match" value={pricingMatch === undefined ? '—' : `${pricingMatch.toFixed(1)}%`} detail={`${compactNumber(unpricedCalls)} unpriced calls`} tone="green" />
    </div>

    <div className="metric-grid four">
      <MetricCard
        label="Tokens"
        value={compactNumber(totalTokens)}
        detail="Input and output"
        tone="blue"
        breakdown={inputTokens !== undefined || outputTokens !== undefined ? { inLabel: 'In', inValue: compactNumber(inputTokens), outLabel: 'Out', outValue: compactNumber(outputTokens) } : undefined}
      />
      <MetricCard
        label="Average Cost / Call"
        value={money(averageCost)}
        detail="Total spend / total calls"
        tone="purple"
        breakdown={averageInputCost !== undefined || averageOutputCost !== undefined ? { inLabel: 'In', inValue: money(averageInputCost), outLabel: 'Out', outValue: money(averageOutputCost) } : undefined}
      />
      <MetricCard label="AI Calls" value={compactNumber(callCount)} detail="Across producer apps" tone="blue" />
      <MetricCard label="Active Alerts" value={canViewGovernance ? compactNumber(activeAlertCount) : '—'} detail={canViewGovernance ? 'Governance alerts' : 'Restricted for readonly users'} tone="red" />
    </div>

    <SectionTitle title="Executive Observability" detail="Existing widgets re-arranged into a decision narrative" />
    <div className="grid-three">
      <Card className="panel">
        <div className="panel-head"><div><span className="eyebrow">Top Drivers</span><h3>Where Spend Is Coming From</h3></div></div>
        <QueryState isLoading={grouped.isLoading} error={grouped.error} empty={!driverRows.length}>
          <div className="bar-list">{driverRows.map((item, index) => {
            const cost = rowCost(item) ?? 0;
            return <div className="bar-row" key={String(item.group_key1 ?? item.key ?? index)}>
              <span className="bar-name">{rowLabel(item)}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(6, (cost / maxDriverCost) * 100)}%` }} /></span>
              <span className="bar-money">{money(cost)}</span>
            </div>;
          })}</div>
        </QueryState>
      </Card>
      <Card className="panel">
        <div className="panel-head"><div><span className="eyebrow">Cost By Agent</span><h3>Trace-Level Workload</h3></div></div>
        <QueryState isLoading={agents.isLoading} error={agents.error} empty={!agentRows.length}>
          <table className="cc-table"><thead><tr><th>Agent</th><th>Calls</th><th>Cost</th></tr></thead><tbody>
            {agentRows.map((item, index) => <tr key={String(item.agent ?? item.agent_name ?? item.caller ?? index)}>
              <td>{String(item.agent ?? item.agent_name ?? item.caller ?? 'Unknown Agent')}</td>
              <td>{compactNumber(numeric(item, 'call_count'))}</td>
              <td>{money(rowCost(item))}</td>
            </tr>)}
          </tbody></table>
        </QueryState>
      </Card>
      <Card className="panel">
        <div className="panel-head"><div><span className="eyebrow">Optimization</span><h3>Savings Opportunities</h3></div></div>
        {!canViewGovernance ? <EmptyState>Optimization signals are restricted for readonly users.</EmptyState> : <QueryState isLoading={opportunities.isLoading} error={opportunities.error} empty={!opportunityRows.length}>
          <div className="action-list">{opportunityRows.map((opportunity, index) => {
            const savings = numeric(opportunity as Record<string, unknown>, 'savings', 'estimated_savings');
            return <button className="action-row" key={String(opportunity.feature ?? opportunity.title ?? index)} onClick={() => onOpen(String(opportunity.title ?? 'Optimization Opportunity'), <OpportunityDetail params={params} opportunity={opportunity} />)}>
              <span className="action-ic"><CircleDollarSign size={14} /></span>
              <span><b>{String(opportunity.title ?? opportunity.feature ?? 'Optimization opportunity')}</b><p>{savings !== undefined ? `${money(savings)} savings` : 'Live optimization signal'}</p></span>
              <ArrowUpRight size={14} className="action-arrow" />
            </button>;
          })}</div>
        </QueryState>}
      </Card>
    </div>
  </>;
}
