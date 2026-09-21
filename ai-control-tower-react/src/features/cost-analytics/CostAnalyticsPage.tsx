import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import {
  getAllCostEvents,
  getCostEvents,
  getCostSummary,
  getGroupedCost,
} from "../../services/controlTowerApi";
import type {
  CostSummaryRow,
  GroupedCostRow,
} from "../../services/controlTowerApi";
import type { RpcParams } from "../../types";
import { compactNumber, money } from "../../lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SectionTitle,
} from "../../components/ui";
import { MetricCard } from "../../components/common/MetricCard";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type Grouping = { key: string; label: string; detail: string };
const groupings: Grouping[] = [
  { key: "model", label: "Cost by Model", detail: "Resolved model economics" },
  {
    key: "feature",
    label: "Cost by Feature",
    detail: "Caller and feature drivers",
  },
  {
    key: "user_role",
    label: "Cost by User / Role",
    detail: "User-role grouping where returned",
  },
  {
    key: "failure_phase",
    label: "Failure / Status Cost",
    detail: "Failure phase where returned",
  },
];
function numeric(row: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      Number.isFinite(Number(value))
    )
      return Number(value);
  }
  return undefined;
}
function rowCost(row: GroupedCostRow) {
  return numeric(row, "cost", "total_cost_usd", "cost_usd");
}
function rowLabel(row: GroupedCostRow) {
  return String(row.group_key1 ?? row.label ?? row.key ?? "Unlabelled");
}
function display(value: unknown) {
  return value === null || value === undefined || value === ""
    ? "—"
    : String(value);
}
function csvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function OpportunityMatrix({ params }: { params: RpcParams }) {
  const query = useQuery({
    queryKey: ["cost-analytics", "opportunity-matrix", params.companyId, params.appId, params.periodStart, params.periodEnd],
    queryFn: () => getGroupedCost(params, "feature"),
  });
  const points = (query.data ?? []).map((row) => {
    const calls = numeric(row, "call_count", "calls", "total_calls") ?? 0;
    const cost = rowCost(row) ?? 0;
    return { name: rowLabel(row), calls, cost, avgCost: calls > 0 ? cost / calls : 0 };
  }).filter((point) => point.calls > 0);
  const overallAvg = points.length ? points.reduce((sum, point) => sum + point.avgCost, 0) / points.length : 0;
  const maxCalls = Math.max(1, ...points.map((point) => point.calls));
  const maxAvgCost = Math.max(1, ...points.map((point) => point.avgCost));
  const costs = points.map((point) => point.cost);
  const minCost = Math.min(0, ...costs);
  const maxCost = Math.max(1, ...costs);

  return <Card className="panel opportunity-matrix-card">
    <SectionTitle title="Opportunity Matrix" detail="Call volume, average cost per call, and total spend by feature" />
    {query.isLoading ? <EmptyState>Loading opportunity data...</EmptyState> : query.error ? <EmptyState>Opportunity data could not be loaded.</EmptyState> : !points.length ? <EmptyState>No feature cost data is available for this period.</EmptyState> : <>
      <p className="matrix-help">The X-axis is call volume, the Y-axis is average cost per call, and bubble size represents total spend. Red bubbles are above 1.5x the cross-feature average.</p>
      <div className="opportunity-matrix" role="img" aria-label="Opportunity matrix showing call volume against average cost per call">
        <div className="matrix-quadrant-label matrix-quadrant-top-left">High cost / low volume</div>
        <div className="matrix-quadrant-label matrix-quadrant-top-right">High cost / high volume</div>
        <div className="matrix-quadrant-label matrix-quadrant-bottom-left">Low cost / low volume</div>
        <div className="matrix-quadrant-label matrix-quadrant-bottom-right">Low cost / high volume</div>
        <div className="matrix-axis matrix-axis-x">Call volume →</div>
        <div className="matrix-axis matrix-axis-y">Avg cost / call →</div>
        {points.map((point) => {
          const left = 8 + (point.calls / maxCalls) * 84;
          const bottom = 8 + (point.avgCost / maxAvgCost) * 84;
          const size = 18 + (maxCost > minCost ? ((point.cost - minCost) / (maxCost - minCost)) * 28 : 14);
          const flagged = point.avgCost > overallAvg * 1.5;
          return <div className={`matrix-point ${flagged ? "flagged" : ""}`} key={point.name} style={{ left: `${left}%`, bottom: `${bottom}%`, width: size, height: size }} tabIndex={0} title={`${point.name}: ${compactNumber(point.calls)} calls, ${money(point.cost)} total, ${money(point.avgCost)} average cost/call`}>
            <span className="matrix-tooltip"><b>{point.name}</b>{compactNumber(point.calls)} calls · {money(point.cost)} total<br />{money(point.avgCost)} avg cost/call</span>
            <span className="matrix-point-label">{point.name}</span>
          </div>;
        })}
      </div>
      <div className="matrix-legend"><span><i className="matrix-legend-dot flagged" />Flagged (&gt;1.5x average)</span><span><i className="matrix-legend-dot" />Normal</span><span>Bubble size = total spend</span></div>
    </>}
  </Card>;
}
function downloadRequestCsv(
  rows: Awaited<ReturnType<typeof getAllCostEvents>>,
) {
  const headers = [
    "Started",
    "Caller",
    "Provider",
    "Model",
    "Input Tokens",
    "Output Tokens",
    "Cost",
    "Status",
    "Failure Phase",
    "Trace ID",
    "Usage Event ID",
  ];
  const lines = rows.map((row) =>
    [
      row.request_started_at
        ? new Date(row.request_started_at).toISOString()
        : "",
      row.caller,
      row.provider,
      row.resolved_model ?? row.model,
      row.input_tokens,
      row.output_tokens,
      row.calculated_cost ?? row.cost,
      row.status,
      row.failure_phase,
      row.trace_id,
      row.usage_event_id,
    ]
      .map(csvValue)
      .join(","),
  );
  const blob = new Blob(
    [`${headers.map(csvValue).join(",")}\n${lines.join("\n")}`],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `request-explorer-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function GroupedPanel({
  params,
  grouping,
}: {
  params: RpcParams;
  grouping: Grouping;
}) {
  const query = useQuery({
    queryKey: [
      "cost-analytics",
      "grouped",
      params.companyId,
      params.appId,
      params.periodStart,
      params.periodEnd,
      grouping.key,
    ],
    queryFn: () => getGroupedCost(params, grouping.key),
  });
  return (
    <Card className="panel">
      <SectionTitle title={grouping.label} detail={grouping.detail} />
      {query.isLoading ? (
        <EmptyState>Loading live data...</EmptyState>
      ) : query.error ? (
        <EmptyState>Could not load {grouping.label.toLowerCase()}.</EmptyState>
      ) : !query.data?.length ? (
        <EmptyState>
          No {grouping.label.toLowerCase()} data is available.
        </EmptyState>
      ) : (
        <div className="list">
          {query.data.slice(0, 8).map((row, index) => (
            <div
              className="list-row"
              key={`${row.group_key1 ?? row.key ?? "row"}-${index}`}
            >
              <span>{rowLabel(row)}</span>
              <strong>{money(rowCost(row))}</strong>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RequestExplorer({
  params,
  canInspectTrace,
  onTraceSelect,
}: {
  params: RpcParams;
  canInspectTrace: boolean;
  onTraceSelect: (traceId: string) => void;
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const query = useQuery({
    queryKey: [
      "cost-analytics",
      "events",
      params.companyId,
      params.appId,
      params.periodStart,
      params.periodEnd,
    ],
    queryFn: () => getAllCostEvents(params),
  });
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows =
    query.data?.filter((row) => {
      const status = String(row.status ?? "").toLowerCase();
      const requestedModel = String(row.requested_model ?? "").toLowerCase();
      const responseModel = String(row.response_model ?? "").toLowerCase();
      const searchable = [
        row.caller,
        row.provider,
        row.resolved_model,
        row.model,
        row.status,
        row.failure_phase,
        row.trace_id,
        row.usage_event_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const isUnpriced = numeric(row, "calculated_cost", "cost") === undefined;
      const isVariance = Boolean(
        requestedModel && responseModel && requestedModel !== responseModel,
      );
      const matchesFilter =
        filter === "all" ||
        (filter === "failed" && (status === "error" || status === "timeout")) ||
        (filter === "missing-trace" && !row.trace_id) ||
        (filter === "trace" && Boolean(row.trace_id)) ||
        (filter === "unpriced" && isUnpriced) ||
        (filter === "variance" && isVariance);
      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        matchesFilter
      );
    }) ?? [];
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize);
  const clearFilters = () => {
    setSearch("");
    setFilter("all");
    setPage(0);
  };
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const rows = await getAllCostEvents(params);
      downloadRequestCsv(rows);
    } catch (error) {
      console.error("[AI Control Tower] Request export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };
  return (
    <Card className="panel">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle
          title="Request Explorer"
          detail="Flat usage-event view with client-side filtering over loaded rows"
        />
        <Button
          className="px-2 py-1 text-[10px]"
          onClick={handleExport}
          disabled={isExporting}
          title="Download all request rows as an Excel-compatible CSV"
          aria-label="Download all request rows as CSV"
        >
          <Download size={14} />
          {isExporting ? "Preparing..." : "Download CSV"}
        </Button>
      </div>
      {query.isLoading ? (
        <EmptyState>Loading request events...</EmptyState>
      ) : query.error ? (
        <EmptyState>Request events could not be loaded.</EmptyState>
      ) : !query.data?.length ? (
        <EmptyState>
          <Search size={18} className="mx-auto mb-2 text-blue" />
          No request events are available for this app and period.
        </EmptyState>
      ) : (
        <>
          <div className="filterbar">
            <div className="search-wrap">
              <Search size={15} />
              <input
                className="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                placeholder="Search request rows by caller, model, status, or trace"
                aria-label="Search request rows"
              />
            </div>
            <div className="select-wrap">
              <span className="select-label">Filter</span>
              <select
                className="select"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setPage(0);
                }}
                aria-label="Filter request rows"
              >
                <option value="all">All loaded rows</option>
                <option value="failed">Failed requests</option>
                <option value="missing-trace">Missing trace</option>
                <option value="variance">Model variance</option>
                <option value="trace">Trace available</option>
                <option value="unpriced">Unpriced cost</option>
              </select>
              <ChevronDown className="select-chevron" size={14} aria-hidden="true" />
            </div>
            <Button
              className="btn-small"
              onClick={clearFilters}
              disabled={!search && filter === "all"}
            >
              Clear
            </Button>
          </div>
          <div className="mb-3 text-[10px] font-bold text-muted">
            Showing {visibleRows.length} of {filteredRows.length} matching rows
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[11px]">
              <thead>
                <tr className="border-b border-line text-[9px] uppercase tracking-[.06em] text-faint">
                  <th className="px-2 py-2">Started</th>
                  <th className="px-2 py-2">Caller</th>
                  <th className="px-2 py-2">Model</th>
                  <th className="px-2 py-2">Tokens</th>
                  <th className="px-2 py-2">Cost</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Trace</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const tokens =
                    numeric(row, "input_tokens") !== undefined ||
                    numeric(row, "output_tokens") !== undefined
                      ? (numeric(row, "input_tokens") ?? 0) +
                        (numeric(row, "output_tokens") ?? 0)
                      : undefined;
                  return (
                    <tr
                      className="border-b border-line/60 text-text"
                      key={String(
                        row.usage_event_id ??
                          row.event_id ??
                          `${row.request_started_at}-${index}`,
                      )}
                    >
                      <td className="px-2 py-3">
                        {display(
                          row.request_started_at
                            ? new Date(row.request_started_at).toLocaleString()
                            : null,
                        )}
                      </td>
                      <td className="px-2 py-3">{display(row.caller)}</td>
                      <td className="px-2 py-3">
                        {display(row.resolved_model ?? row.model)}
                      </td>
                      <td className="px-2 py-3 tabular-nums">
                        {compactNumber(tokens)}
                      </td>
                      <td className="px-2 py-3 tabular-nums">
                        {money(numeric(row, "calculated_cost", "cost"))}
                      </td>
                      <td className="px-2 py-3">{display(row.status)}</td>
                      <td className="px-2 py-3">
                        {row.trace_id && canInspectTrace ? (
                          <Button
                            className="px-2 py-1 text-[10px]"
                            onClick={() => onTraceSelect(String(row.trace_id))}
                          >
                            View Trace
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted">
                            {row.trace_id
                              ? "Trace Unavailable"
                              : "Trace Unavailable"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visibleRows.length === 0 && (
            <EmptyState>No loaded request rows match these filters.</EmptyState>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold text-muted">
            <span>
              {filteredRows.length} matching events · {query.data.length} total events
            </span>
            <span className="flex items-center gap-2">
              <label htmlFor="request-page-size">Rows per page</label>
              <select
                id="request-page-size"
                className="select"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(0);
                }}
                aria-label="Rows per page"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <Button
                aria-label="Previous request page"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft size={14} />
              </Button>
              <span>
                Page {page + 1} of {totalPages}
              </span>
              <Button
                aria-label="Next request page"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="h-7 w-7 p-0"
              >
                <ChevronRight size={14} />
              </Button>
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

export function CostAnalyticsPage({
  params,
  canInspectTrace,
  onTraceSelect,
  onOpen: _onOpen,
}: {
  params: RpcParams;
  canInspectTrace: boolean;
  onTraceSelect: (traceId: string) => void;
  onOpen: (title: string) => void;
}) {
  const summary = useQuery({
    queryKey: [
      "cost-analytics",
      "summary",
      params.companyId,
      params.appId,
      params.periodStart,
      params.periodEnd,
    ],
    queryFn: () => getCostSummary(params),
  });
  const row: CostSummaryRow = summary.data?.[0] ?? {};
  const totalCalls = numeric(row, "total_calls", "call_count");
  const pricedCalls = numeric(row, "priced_calls");
  const unpricedCalls = numeric(row, "unpriced_calls", "unpriced_call_count");
  const pricingTrust =
    pricedCalls !== undefined && totalCalls !== undefined && totalCalls > 0
      ? `${((pricedCalls / totalCalls) * 100).toFixed(1)}%`
      : "—";
  const failureCount = numeric(row, "failed_calls");
  const failureCost = numeric(row, "failed_cost");
  const nullTokenCalls = numeric(row, "null_token_calls");
  const varianceCalls = numeric(row, "model_variance_calls");
  const cacheSavings = numeric(row, "cache_savings");
  return (
    <>
      <div className="page-intro">
        <div>
          <Badge className="bg-blueP text-blue">Operational Analytics</Badge>
          <p>
            Explain movement through model, feature, user, failure, and data
            quality signals.
          </p>
        </div>
      </div>
      <div className="metric-grid five">
        <MetricCard
          label="Total Spend"
          value={money(numeric(row, "total_cost"))}
          detail={summary.isLoading ? "Loading summary..." : "Current period"}
          tone="blue"
        />
        <MetricCard
          label="Total Calls"
          value={compactNumber(totalCalls)}
          detail="Usage events"
          tone="blue"
        />
        <MetricCard
          label="Pricing Trust"
          value={pricingTrust}
          detail="Priced calls / total calls"
          tone="green"
        />
        <MetricCard
          label="Failed Cost"
          value={money(failureCost)}
          detail={
            failureCount === undefined
              ? "Failure count unavailable"
              : `${compactNumber(failureCount)} failed calls`
          }
          tone="red"
        />
        <MetricCard
          label="Cache Savings"
          value={money(cacheSavings)}
          detail="Cache read benefit"
          tone="green"
        />
      </div>
      <div className="metric-grid three">
        <MetricCard
          label="Unpriced Calls"
          value={compactNumber(unpricedCalls)}
          detail="Summary field"
          tone="amber"
        />
        <MetricCard
          label="Null-Token Calls"
          value={compactNumber(nullTokenCalls)}
          detail="Available when returned"
          tone="amber"
        />
        <MetricCard
          label="Model Variance Calls"
          value={compactNumber(varianceCalls)}
          detail="Available when returned"
          tone="purple"
        />
      </div>
      <div className="mb-3">
        <SectionTitle
          title="Explainability of cost movement"
          detail="Existing groupings presented as technical drivers across model, feature, user, failure, and data quality signals."
        />
      </div>
      <div className="two-column">
        {groupings.slice(0, 2).map((grouping) => (
          <GroupedPanel
            key={grouping.key}
            params={params}
            grouping={grouping}
          />
        ))}
      </div>
      <div className="two-column">
        {groupings.slice(2).map((grouping) => (
          <GroupedPanel
            key={grouping.key}
            params={params}
            grouping={grouping}
          />
        ))}
      </div>
      <OpportunityMatrix params={params} />
      <RequestExplorer
        params={params}
        canInspectTrace={canInspectTrace}
        onTraceSelect={onTraceSelect}
      />
    </>
  );
}
