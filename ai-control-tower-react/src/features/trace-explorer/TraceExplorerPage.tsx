import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ChevronDown, FileSearch, Layers, Search } from 'lucide-react';
import { getCostEvents, getTraceDetails, getTracePayload } from '../../services/controlTowerApi';
import type { CostEventRow, TraceDetailRow, TracePayloadRow } from '../../services/controlTowerApi';
import type { RpcParams } from '../../types';
import { money } from '../../lib/utils';
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui';
import { DetailDrawer } from '../../components/layout/DetailDrawer';

const PAGE_SIZE = 50;
function numeric(row: Record<string, unknown> | undefined, ...keys: string[]) { for (const key of keys) { const value = row?.[key]; if (value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) return Number(value); } return undefined; }
function text(value: unknown) { return value === null || value === undefined || value === '' ? '—' : String(value); }
function formatPayload(value: unknown) { if (value == null) return 'No payload captured.'; if (typeof value === 'string') return value; try { return JSON.stringify(value, null, 2); } catch { return '[Payload could not be rendered]'; } }
// Status classification mirrors legacy cost-tower.js actBuildTraceSummaries: last span 'error' => abandoned,
// last span 'success' with an earlier failure => recovered, last span 'success' clean => completed, else other.
function traceStatusKind(spans: TraceDetailRow[]) { const last = spans[spans.length - 1]?.span_status; const hasEarlierFailure = spans.slice(0, -1).some((span) => span.span_status === 'error' || span.span_status === 'timeout'); if (last === 'error') return 'abandoned'; if (last === 'success') return hasEarlierFailure ? 'recovered' : 'completed'; return 'other'; }
function traceSummary(rows: TraceDetailRow[]) { const groups = new Map<string, TraceDetailRow[]>(); rows.forEach((row) => { if (!row.trace_id) return; const list = groups.get(row.trace_id) ?? []; list.push(row); groups.set(row.trace_id, list); }); return [...groups.entries()].map(([id, rawSpans]) => { const spans = rawSpans.sort((a, b) => Number(a.sequence_order ?? 0) - Number(b.sequence_order ?? 0)); return { id, spans, agent: spans[0]?.agent_name, cost: spans.reduce((sum, span) => sum + (numeric(span, 'calculated_cost') ?? 0), 0), duration: spans.reduce((sum, span) => sum + (numeric(span, 'span_duration_ms') ?? 0), 0), spanCount: spans.length, statusKind: traceStatusKind(spans), lastStatus: spans[spans.length - 1]?.span_status }; }); }
const STATUS_BADGE: Record<string, string> = { completed: 'bg-greenP text-green', abandoned: 'bg-redP text-red', recovered: 'bg-amberP text-amber', other: 'bg-soft text-muted' };
const STATUS_LABEL: Record<string, string> = { completed: 'Completed', abandoned: 'Abandoned', recovered: '1 error span', other: 'Unresolved' };

function PayloadContent({ query }: { query: { isLoading: boolean; error: unknown; data?: TracePayloadRow[] } }) { if (query.isLoading) return <EmptyState>Loading payload...</EmptyState>; if (query.error) return <EmptyState>Payload could not be loaded. The RPC denied or could not retrieve this payload.</EmptyState>; if (!query.data?.length) return <EmptyState>No payload was captured for this call.</EmptyState>; const payload = query.data[0]; if (payload.request_payload == null && payload.response_payload == null) return <EmptyState>A payload record exists, but it contains no prompt or response content.</EmptyState>; return <div className="space-y-4"><div><SectionTitle title="Request Payload" />{payload.request_payload == null ? <EmptyState>No request payload captured.</EmptyState> : <pre className="max-h-72 overflow-auto rounded-control bg-soft p-3 text-[10px] leading-5 text-text">{formatPayload(payload.request_payload)}</pre>}</div><div><SectionTitle title="Response Payload" />{payload.response_payload == null ? <EmptyState>No response payload captured.</EmptyState> : <pre className="max-h-72 overflow-auto rounded-control bg-soft p-3 text-[10px] leading-5 text-text">{formatPayload(payload.response_payload)}</pre>}</div></div>; }

const TRACE_PAGE_SIZE = 20;
function matchesQuery(haystacks: Array<string | undefined | null>, query: string) { const q = query.trim().toLowerCase(); if (!q) return true; return haystacks.some((value) => value != null && String(value).toLowerCase().includes(q)); }

export function TraceExplorerPage({ params, canInspectTrace, initialTraceId, onOpen: _onOpen }: { params: RpcParams; canInspectTrace: boolean; initialTraceId?: string | null; onOpen: (title: string, content?: ReactNode) => void }) {
  const [page, setPage] = useState(0); const [searchTerm, setSearchTerm] = useState(''); const [selectedTraceId, setSelectedTraceId] = useState<string | null>(initialTraceId ?? null); const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null); const [selectedSpan, setSelectedSpan] = useState<TraceDetailRow | null>(null); const [detailTab, setDetailTab] = useState<'summary' | 'cost' | 'payload' | 'metadata'>('summary'); const [payloadUsageEventId, setPayloadUsageEventId] = useState<string | null>(null);
  const context = [params.companyId, params.appId, params.periodStart, params.periodEnd];
  const events = useQuery({ queryKey: ['trace-explorer', 'events', ...context, PAGE_SIZE, page], enabled: !canInspectTrace, queryFn: () => getCostEvents(params, PAGE_SIZE, page * PAGE_SIZE) });
  const details = useQuery({ queryKey: ['trace-explorer', 'details', ...context], enabled: canInspectTrace, queryFn: () => getTraceDetails(params) });
  const payload = useQuery({ queryKey: ['trace-explorer', 'payload', params.companyId, params.appId, payloadUsageEventId], enabled: canInspectTrace && Boolean(payloadUsageEventId), queryFn: () => getTracePayload(params, payloadUsageEventId!) });
  const summaries = useMemo(() => traceSummary(details.data ?? []), [details.data]);
  const filteredSummaries = useMemo(() => summaries.filter((summary) => matchesQuery([summary.id, summary.agent, summary.statusKind, summary.lastStatus], searchTerm)), [summaries, searchTerm]);
  const traceEvents = events.data?.rows.filter((row) => row.trace_id) ?? [];
  const filteredEvents = useMemo(() => traceEvents.filter((row) => matchesQuery([row.trace_id, row.caller, row.status], searchTerm)), [traceEvents, searchTerm]);
  const selectedSummary = summaries.find((summary) => summary.id === selectedTraceId);
  // Admins/members get a full-period trace-grouped list (one row per trace); readonly falls back to the paginated raw cost-event RPC.
  const totalPages = canInspectTrace ? Math.max(1, Math.ceil(filteredSummaries.length / TRACE_PAGE_SIZE)) : (events.data ? Math.max(1, Math.ceil(events.data.totalCount / PAGE_SIZE)) : 1);
  const safePage = Math.min(page, totalPages - 1);
  const pageSummaries = canInspectTrace ? filteredSummaries.slice(safePage * TRACE_PAGE_SIZE, safePage * TRACE_PAGE_SIZE + TRACE_PAGE_SIZE) : [];
  const isLoadingList = canInspectTrace ? details.isLoading : events.isLoading;
  const listError = canInspectTrace ? details.error : events.error;
  const hasRows = canInspectTrace ? pageSummaries.length > 0 : filteredEvents.length > 0;
  const listDetail = canInspectTrace ? `${filteredSummaries.length} trace${filteredSummaries.length === 1 ? '' : 's'} this period` : `${events.data?.totalCount ?? 0} events this period`;
  function selectTrace(id: string) { setSelectedTraceId((current) => (current === id ? null : id)); setSelectedSpan(null); setDetailTab('summary'); }
  function selectEvent(row: CostEventRow, key: string) { setSelectedRowKey((current) => (current === key ? null : key)); const id = String(row.trace_id ?? ''); setSelectedTraceId((current) => (selectedRowKey === key ? null : (id || null))); setSelectedSpan(null); setDetailTab('summary'); }
  function selectSpan(span: TraceDetailRow) { setSelectedSpan(span); setDetailTab('summary'); }
  function handleSearchChange(value: string) { setSearchTerm(value); setPage(0); }
  function goToPage(next: number) { setPage(Math.max(0, Math.min(next, totalPages - 1))); }
  function eventBadgeClass(status?: string | null) { const s = (status ?? '').toLowerCase(); if (s === 'success' || s === 'completed' || s === 'ok') return 'bg-greenP text-green'; if (s === 'error' || s === 'failed' || s === 'timeout') return 'bg-redP text-red'; if (!s) return 'bg-soft text-muted'; return 'bg-amberP text-amber'; }
  return <>
    <div className="page-intro"><div><Badge className="bg-purpleP text-purple">Observability</Badge><p>Inspect requests, traces, spans, and payload availability without fabricating missing trace data.</p></div></div>
    <div className="filterbar"><span className="search-wrap"><Search size={14} /><input className="search" value={searchTerm} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Search traces by agent or status" /></span></div>
    <Card className="trace-layout">
      <div className="trace-list">
        <SectionTitle title="Request / Trace List" detail={listDetail} />
        {isLoadingList ? <EmptyState>Loading requests...</EmptyState> : listError ? <EmptyState>Request list could not be loaded.</EmptyState> : !hasRows ? <EmptyState><Activity size={20} className="mx-auto mb-2 text-purple" />{searchTerm ? 'No traces match this search.' : 'No requests/traces for this app and period.'}</EmptyState> : <div className="trace-scroll">
          {canInspectTrace ? pageSummaries.map((summary) => <button className={summary.id === selectedTraceId ? 'trace-card w-full active' : 'trace-card w-full'} key={summary.id} onClick={() => selectTrace(summary.id)}>
            <div className="trace-card-top">
              <div><strong className="trace-card-name">{text(summary.agent)}</strong><div className="trace-card-meta">{summary.spanCount} call{summary.spanCount === 1 ? '' : 's'} · {(summary.duration / 1000).toFixed(1)}s</div></div>
              <span className="trace-card-cost">{money(summary.cost)}</span>
            </div>
            <Badge className={`mt-2 ${STATUS_BADGE[summary.statusKind] ?? STATUS_BADGE.other}`}>{STATUS_LABEL[summary.statusKind] ?? summary.statusKind}</Badge>
          </button>) : filteredEvents.map((row, index) => { const key = String(row.usage_event_id ?? row.event_id ?? `${row.trace_id}-${index}`); return <button className={key === selectedRowKey ? 'trace-card w-full active' : 'trace-card w-full'} key={key} onClick={() => selectEvent(row, key)}>
            <div className="trace-card-top">
              <div><strong className="trace-card-name">{text(row.caller)}</strong><div className="trace-card-meta">{text(row.resolved_model ?? row.model)}</div></div>
              <span className="trace-card-cost">{money(numeric(row, 'calculated_cost', 'cost'))}</span>
            </div>
            <Badge className={`mt-2 ${eventBadgeClass(row.status)}`}>{text(row.status)}</Badge>
          </button>; })}
        </div>}
        {totalPages > 1 && <div className="trace-pager flex items-center justify-between text-[10px] font-bold text-muted"><span>{safePage + 1} / {totalPages}</span><span className="flex items-center gap-2"><Button aria-label="Previous trace page" disabled={safePage === 0} onClick={() => goToPage(safePage - 1)} className="h-7 w-7 p-0"><ChevronDown className="rotate-90" size={14} /></Button><Button aria-label="Next trace page" disabled={safePage + 1 >= totalPages} onClick={() => goToPage(safePage + 1)} className="h-7 w-7 p-0"><ChevronDown className="-rotate-90" size={14} /></Button></span></div>}
      </div>
      <div className="trace-tree">
        <SectionTitle title="Run Hierarchy" detail="Select a span to inspect its details" />
        {!canInspectTrace ? <EmptyState>Trace details are restricted for readonly users.</EmptyState> : details.isLoading ? <EmptyState>Loading trace spans...</EmptyState> : details.error ? <EmptyState>Trace details could not be loaded.</EmptyState> : !selectedTraceId ? <EmptyState><Search size={18} className="mx-auto mb-2 text-purple" />Select a request with a trace ID.</EmptyState> : !selectedSummary ? <EmptyState>Trace detail is unavailable or the trace ID is masked.</EmptyState> : <div className="trace-scroll">{selectedSummary.spans.map((span, index) => <button className={selectedSpan === span ? 'span-card w-full active' : 'span-card w-full'} key={String(span.usage_event_id ?? `${selectedSummary.id}-${index}`)} onClick={() => selectSpan(span)}>
          <strong className="span-card-title">{text(span.span_type ?? span.tool_name)}</strong>
          <div className="span-card-sub">Sequence {text(span.sequence_order)} · {text(span.span_status)} · {money(numeric(span, 'calculated_cost'))}</div>
        </button>)}</div>}
      </div>
      <div className="trace-detail">
        <SectionTitle title="Span Details" detail="Metadata only unless payload access is allowed" />
        {!selectedSpan ? <EmptyState><Layers size={18} className="mx-auto mb-2 text-purple" />Choose a span to inspect details.</EmptyState> : <>
          <div className="detail-tabs"><button className={detailTab === 'summary' ? 'active' : ''} onClick={() => setDetailTab('summary')}>Summary</button><button className={detailTab === 'cost' ? 'active' : ''} onClick={() => setDetailTab('cost')}>Cost</button><button className={detailTab === 'payload' ? 'active' : ''} onClick={() => setDetailTab('payload')}>Payload</button><button className={detailTab === 'metadata' ? 'active' : ''} onClick={() => setDetailTab('metadata')}>Metadata</button></div>
          {detailTab === 'summary' && <div className="list"><div className="list-row"><span>Status</span><strong>{text(selectedSpan.span_status)}</strong></div><div className="list-row"><span>Started</span><strong>{selectedSpan.span_started_at ? new Date(selectedSpan.span_started_at).toLocaleString() : '—'}</strong></div><div className="list-row"><span>Duration</span><strong>{selectedSpan.span_duration_ms == null ? 'Not captured' : `${selectedSpan.span_duration_ms} ms`}</strong></div><div className="list-row"><span>Sequence</span><strong>{text(selectedSpan.sequence_order)}</strong></div><div className="list-row"><span>Cost</span><strong>{money(numeric(selectedSpan, 'calculated_cost'))}</strong></div></div>}
          {detailTab === 'cost' && <div className="list"><div className="list-row"><span>Calculated Cost</span><strong>{money(numeric(selectedSpan, 'calculated_cost'))}</strong></div><div className="list-row"><span>Request Bytes</span><strong>{text(selectedSpan.request_bytes)}</strong></div><div className="list-row"><span>Response Bytes</span><strong>{text(selectedSpan.response_bytes)}</strong></div></div>}
          {detailTab === 'payload' && (canInspectTrace && selectedSpan.usage_event_id ? <Button className="mt-1" onClick={() => setPayloadUsageEventId(String(selectedSpan.usage_event_id))}><FileSearch size={14} />View Payload</Button> : <EmptyState>Payload unavailable for this span.</EmptyState>)}
          {detailTab === 'metadata' && <div className="list"><div className="list-row"><span>Trace ID</span><strong className="text-[10px]">{text(selectedSummary?.id)}</strong></div><div className="list-row"><span>Agent</span><strong>{text(selectedSummary?.agent)}</strong></div><div className="list-row"><span>Span Type</span><strong>{text(selectedSpan.span_type)}</strong></div><div className="list-row"><span>Tool Name</span><strong>{selectedSpan.span_type === 'llm_call' ? 'N/A (LLM call)' : text(selectedSpan.tool_name)}</strong></div><div className="list-row"><span>Usage Event</span><strong>{selectedSpan.usage_event_id ? 'Available' : 'Masked'}</strong></div></div>}
        </>}
      </div>
    </Card>
    {payloadUsageEventId && <DetailDrawer title="Prompt and Response Payload" content={<PayloadContent query={payload} />} onClose={() => setPayloadUsageEventId(null)} />}
  </>;
}
