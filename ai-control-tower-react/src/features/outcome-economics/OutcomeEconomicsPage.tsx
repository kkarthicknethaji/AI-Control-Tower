import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search, Target } from 'lucide-react';
import { getCostSummary, getGroupedCost, getOutcomeTypes, getOutcomes, getTopCalls } from '../../services/controlTowerApi';
import type { OutcomeRow, OutcomeTypeRow, TopCallRow } from '../../services/controlTowerApi';
import type { RpcParams } from '../../types';
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

function costFor(row: Record<string, unknown>) { return numeric(row, 'cost', 'total_cost_usd', 'cost_usd', 'calculated_cost'); }
function sumCosts(rows: Array<Record<string, unknown>>) { if (!rows.length) return 0; const costs = rows.map(costFor); return costs.every((value) => value !== undefined) ? costs.reduce((total, value) => total + (value ?? 0), 0) : undefined; }
function typeId(type: OutcomeTypeRow) { return String(type.outcome_type_id ?? type.id ?? ''); }
function typeName(type: OutcomeTypeRow) { return String(type.name ?? 'Outcome type'); }
function countFor(row: Record<string, unknown>) { return numeric(row, 'call_count', 'calls', 'total_calls', 'count'); }
function sumCounts(rows: Array<Record<string, unknown>>) { return rows.reduce((total, row) => total + (countFor(row) ?? 0), 0); }
function trendPct(current: number | undefined, previous: number | undefined) { if (current === undefined || previous === undefined || previous === 0) return undefined; return ((current - previous) / previous) * 100; }
function formatTrend(pct: number | undefined) { if (pct === undefined || Number.isNaN(pct)) return 'No prior-period comparison'; const rounded = Math.round(pct); if (rounded === 0) return 'Flat vs prior period'; return `${rounded > 0 ? '+' : ''}${rounded}% vs prior period`; }
function unitLabel(type: OutcomeTypeRow, count: number) { const label = String(type.unit_label ?? typeName(type)); return count === 1 ? label : `${label}s`; }
function windowLabel(type: OutcomeTypeRow) { const hours = numeric(type as Record<string, unknown>, 'abandonment_window_hrs', 'abandonment_window_hours'); return hours === undefined ? '—' : `${hours}h`; }
function callTimestamp(call: Record<string, unknown>) { const value = call.request_started_at ?? call.created_at; return value ? new Date(String(value)).toLocaleString() : 'Unknown time'; }
function callModel(call: Record<string, unknown>) { return String(call.resolved_model ?? call.response_model ?? call.requested_model ?? call.model ?? 'Unknown model'); }
function callStatus(call: Record<string, unknown>) { return String(call.status ?? 'unknown'); }

function DetailContent({ type, outcomes, sampleCalls, totalCost, completedCost, abandonedCost }: { type: OutcomeTypeRow; outcomes: OutcomeRow[]; sampleCalls: TopCallRow[]; totalCost: number | undefined; completedCost: number | undefined; abandonedCost: number | undefined }) {
  const completed = outcomes.filter((outcome) => outcome.status === 'completed').length;
  const abandoned = outcomes.filter((outcome) => outcome.is_abandoned).length;
  const inProgress = outcomes.some((outcome) => outcome.status === 'in_progress') ? outcomes.filter((outcome) => outcome.status === 'in_progress').length : undefined;
  return <div className="space-y-4"><div className="list"><div className="list-row"><span>Outcome Spend</span><strong>{money(totalCost)}</strong></div><div className="list-row"><span>Completed Cost</span><strong>{money(completedCost)}</strong></div><div className="list-row"><span>Abandoned Cost</span><strong>{money(abandonedCost)}</strong></div><div className="list-row"><span>Completed / Abandoned / In Progress</span><strong>{completed} / {abandoned} / {inProgress ?? '—'}</strong></div></div><div><SectionTitle title={sampleCalls.length ? `Top ${sampleCalls.length} Highest-Cost Calls` : 'Highest-Cost Calls'} detail="Ranked by cost for this outcome type this period — a bounded top-N, not the full contributing set. See Trace Explorer for every call." />{sampleCalls.length ? <div className="list">{sampleCalls.map((call, index) => { const row = call as Record<string, unknown>; return <div className="list-row" key={`${String(call.caller ?? 'call')}-${index}`}><span><b>{callModel(row)}</b><span className="block text-[9.5px] font-semibold text-faint">{callTimestamp(row)} &middot; {callStatus(row)}</span></span><strong>{money(numeric(row, 'calculated_cost', 'cost'))}</strong></div>; })}</div> : <EmptyState>No cost-ranked calls were returned for this outcome type.</EmptyState>}</div><p className="text-[10px] font-semibold text-muted">{type.canvas ? `Context: ${type.canvas}` : 'App-defined outcome type'}</p></div>;
}

function OutcomeCard({ type, totalCost, completedCount, abandonedCount, calls, units, trend, onOpen }: { type: OutcomeTypeRow; totalCost: number | undefined; completedCount: number; abandonedCount: number; calls: number; units: number; trend: number | undefined; onOpen: () => void }) {
  return <button className="outcome-card-rich" onClick={onOpen}>
    <Badge className="w-fit bg-purpleP text-purple">Outcome</Badge>
    <strong className="outcome-card-title">{typeName(type)}</strong>
    <span className="outcome-card-sub">{type.canvas ? String(type.canvas) : 'App-defined outcome type'}</span>
    <span className="outcome-card-cost">{money(totalCost)}</span>
    <span className="outcome-card-meta">{compactNumber(calls)} calls &middot; {units} {unitLabel(type, units)} &middot; {formatTrend(trend)}</span>
    <div className="mini-grid">
      <div className="mini"><span>Completed</span><b>{completedCount || '—'}</b></div>
      <div className="mini"><span>Abandoned</span><b>{abandonedCount || '—'}</b></div>
      <div className="mini"><span>Window</span><b>{windowLabel(type)}</b></div>
    </div>
  </button>;
}

const SORT_OPTIONS = [{ key: 'abandoned', label: 'Abandoned Cost' }, { key: 'name', label: 'Name' }, { key: 'cost', label: 'Total Cost' }] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['key'];

export function OutcomeEconomicsPage({ params, onOpen }: { params: RpcParams; onOpen: (title: string, content?: ReactNode) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const queryContext = [params.companyId, params.appId, params.periodStart, params.periodEnd];
  const previousParams: RpcParams = useMemo(() => ({ ...params, ...previousRange(params) }), [params]);
  const summary = useQuery({ queryKey: ['outcome-economics', 'summary', ...queryContext], queryFn: () => getCostSummary(params) });
  const types = useQuery({ queryKey: ['outcome-economics', 'types', params.appId], queryFn: () => getOutcomeTypes(params.appId) });
  const outcomes = useQuery({ queryKey: ['outcome-economics', 'outcomes', ...queryContext], queryFn: () => getOutcomes(params) });
  const grouped = useQuery({ queryKey: ['outcome-economics', 'grouped', ...queryContext, 'outcome_type'], queryFn: () => getGroupedCost(params, 'outcome_type') });
  const previousGrouped = useQuery({ queryKey: ['outcome-economics', 'grouped-prev', params.companyId, params.appId, previousParams.periodStart, previousParams.periodEnd, 'outcome_type'], queryFn: () => getGroupedCost(previousParams, 'outcome_type') });
  const sampleCalls = useQuery({ queryKey: ['outcome-economics', 'top-calls', ...queryContext, 'cost', 8, 'outcome_type'], queryFn: () => getTopCalls(params, 'cost', 8, 'outcome_type') });

  const summaryRow = summary.data?.[0];
  const totalSpend = numeric(summaryRow as Record<string, unknown> | undefined, 'total_cost', 'total_cost_usd');
  const groupedRows = grouped.data ?? [];
  const previousGroupedRows = previousGrouped.data ?? [];
  const attributedSpend = sumCosts(groupedRows);
  const unattributedSpend = totalSpend !== undefined && attributedSpend !== undefined ? totalSpend - attributedSpend : undefined;
  const completedCostTotal = sumCosts(groupedRows.filter((row) => row.group_key2 === 'completed'));
  const abandonedCostTotal = sumCosts(groupedRows.filter((row) => row.group_key2 === 'abandoned'));
  const completedCount = (outcomes.data ?? []).filter((outcome) => outcome.status === 'completed').length;
  const abandonedCount = (outcomes.data ?? []).filter((outcome) => outcome.is_abandoned).length;
  const completionRate = completedCount + abandonedCount > 0 ? (completedCount / (completedCount + abandonedCount)) * 100 : undefined;
  const loading = summary.isLoading || types.isLoading || outcomes.isLoading || grouped.isLoading || sampleCalls.isLoading;
  const error = summary.error || types.error || outcomes.error || grouped.error || sampleCalls.error;
  const hasData = Boolean(types.data?.length);
  const query = searchTerm.trim().toLowerCase();

  const cardData = useMemo(() => (types.data ?? []).map((type) => {
    const id = typeId(type);
    const typeOutcomes = (outcomes.data ?? []).filter((outcome) => outcome.outcome_type_id === id);
    const typeRows = groupedRows.filter((row) => row.group_key1 === id);
    const previousTypeRows = previousGroupedRows.filter((row) => row.group_key1 === id);
    const totalCost = sumCosts(typeRows);
    const previousCost = sumCosts(previousTypeRows);
    const completedCost = sumCosts(typeRows.filter((row) => row.group_key2 === 'completed'));
    const abandonedCost = sumCosts(typeRows.filter((row) => row.group_key2 === 'abandoned'));
    const typeCompletedCount = typeOutcomes.filter((outcome) => outcome.status === 'completed').length;
    const typeAbandonedCount = typeOutcomes.filter((outcome) => outcome.is_abandoned).length;
    const calls = (sampleCalls.data ?? []).filter((call) => call.partition_key === id);
    return { id, type, totalCost, completedCost, abandonedCost, typeCompletedCount, typeAbandonedCount, calls, units: typeOutcomes.length, trend: trendPct(totalCost, previousCost) };
  }), [types.data, outcomes.data, groupedRows, previousGroupedRows, sampleCalls.data]);

  const sortedTypeOptions = useMemo(() => [...(types.data ?? [])].sort((a, b) => typeName(a).localeCompare(typeName(b))), [types.data]);

  const filteredCards = cardData
    .filter((card) => selectedTypeId === 'all' || card.id === selectedTypeId)
    .filter((card) => !query || `${typeName(card.type)} ${card.type.canvas ?? ''}`.toLowerCase().includes(query))
    .slice()
    .sort((a, b) => {
      if (sortKey === 'name') return typeName(a.type).localeCompare(typeName(b.type));
      if (sortKey === 'abandoned') return (b.abandonedCost ?? 0) - (a.abandonedCost ?? 0);
      return (b.totalCost ?? 0) - (a.totalCost ?? 0);
    });
  const clearFilters = () => { setSearchTerm(''); setSelectedTypeId('all'); setSortKey('cost'); };

  return <><div className="page-intro"><div><Badge className="bg-greenP text-green">Primary USP</Badge><p>Connect AI spend to app-defined product and business outcomes, then inspect the calls behind them.</p></div></div><div className="metric-grid five"><MetricCard label="Outcome-Attributed Spend" value={money(attributedSpend)} detail="Usage events with outcome_id" tone="purple" /><MetricCard label="Completed Cost" value={money(completedCostTotal)} detail="Completed outcome records" tone="green" /><MetricCard label="Abandoned Cost" value={money(abandonedCostTotal)} detail="In-progress beyond window" tone="red" /><MetricCard label="Completion Rate" value={completionRate === undefined ? '—' : `${Math.round(completionRate)}%`} detail="Completed vs abandoned outcomes" tone="green" /><MetricCard label="Unattributed Spend" value={money(unattributedSpend)} detail={totalSpend === undefined ? 'Requires total spend from summary' : 'Total less attributed spend'} tone="amber" /></div><Card className="panel"><SectionTitle title="Outcome Portfolio" detail={`${types.data?.length ?? 0} app-defined outcome types available. Click a card to inspect cost, status, top calls, and metadata.`} /><div className="filterbar"><span className="search-wrap"><Search size={14} /><input className="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search outcome cards by name or canvas" /></span><span className="select-wrap"><select className="select wide" aria-label="Filter outcome cards" value={selectedTypeId} onChange={(event) => setSelectedTypeId(event.target.value)}><option value="all">All outcome cards</option>{sortedTypeOptions.map((type) => <option key={typeId(type)} value={typeId(type)}>{typeName(type)}</option>)}</select><ChevronDown size={13} className="select-chevron" /></span><span className="select-wrap"><span className="select-label">Sort</span><select className="select" aria-label="Sort outcome cards" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>{SORT_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select><ChevronDown size={13} className="select-chevron" /></span><button className="btn-small" onClick={clearFilters}>Clear</button></div><p className="filter-note">Outcome filter is intentionally a dropdown because producer apps can register many app-specific outcome types.</p>{loading ? <EmptyState>Loading live outcome data...</EmptyState> : error ? <EmptyState>Outcome data could not be loaded for this app and period.</EmptyState> : !hasData ? <EmptyState>No app-defined outcome types are available for this app.</EmptyState> : !filteredCards.length ? <EmptyState>No outcome cards match the selected filters.</EmptyState> : <div className="outcome-grid">{filteredCards.map((card) => <OutcomeCard key={card.id} type={card.type} totalCost={card.totalCost} completedCount={card.typeCompletedCount} abandonedCount={card.typeAbandonedCount} calls={sumCounts(groupedRows.filter((row) => row.group_key1 === card.id))} units={card.units} trend={card.trend} onOpen={() => onOpen(typeName(card.type), <DetailContent type={card.type} outcomes={(outcomes.data ?? []).filter((outcome) => outcome.outcome_type_id === card.id)} sampleCalls={card.calls} totalCost={card.totalCost} completedCost={card.completedCost} abandonedCost={card.abandonedCost} />)} />)}</div>}</Card></>;
}
