import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CircleDollarSign, X } from 'lucide-react';
import { acknowledgeAlert, dismissAlert, getAlerts, getBudget, getCostSummary, upsertBudget } from '../../services/controlTowerApi';
import type { AlertRow, BudgetRow } from '../../services/controlTowerApi';
import type { RpcParams } from '../../types';
import { compactNumber, money } from '../../lib/utils';
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui';
import { MetricCard } from '../../components/common/MetricCard';

function numeric(row: Record<string, unknown> | undefined, ...keys: string[]) { for (const key of keys) { const value = row?.[key]; if (value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) return Number(value); } return undefined; }
function field(row: Record<string, unknown> | null | undefined, ...keys: string[]) { for (const key of keys) if (row?.[key] !== null && row?.[key] !== undefined && row?.[key] !== '') return String(row[key]); return '—'; }

function BudgetDialog({ params, budget, onClose }: { params: RpcParams; budget: BudgetRow | null; onClose: () => void }) { const client = useQueryClient(); const [amount, setAmount] = useState(budget?.amount == null ? '' : String(budget.amount)); const [warn, setWarn] = useState(budget?.warn_threshold_pct == null ? '' : String(budget.warn_threshold_pct)); const [escalate, setEscalate] = useState(budget?.escalate_threshold_pct == null ? '' : String(budget.escalate_threshold_pct)); const mutation = useMutation({ mutationFn: () => upsertBudget(params, { amount: Number(amount), warnThresholdPct: Number(warn), escalateThresholdPct: Number(escalate), actionOnBreach: budget?.action_on_breach ?? 'notify' }), onSuccess: () => { client.invalidateQueries({ queryKey: ['governance', 'budget'] }); onClose(); } }); return <div className="drawer-backdrop" onClick={onClose}><div className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><Badge>Governance Control</Badge><h2>Budget Controls</h2></div><button className="icon-close" aria-label="Close budget controls" onClick={onClose}><X size={17} /></button></div><div className="space-y-4"><label className="block text-[11px] font-extrabold text-text">Monthly Budget<input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 w-full rounded-control border border-line bg-soft px-3 py-2 text-[12px]" /></label><label className="block text-[11px] font-extrabold text-text">Warn Threshold %<input type="number" value={warn} onChange={(event) => setWarn(event.target.value)} className="mt-2 w-full rounded-control border border-line bg-soft px-3 py-2 text-[12px]" /></label><label className="block text-[11px] font-extrabold text-text">Escalate Threshold %<input type="number" value={escalate} onChange={(event) => setEscalate(event.target.value)} className="mt-2 w-full rounded-control border border-line bg-soft px-3 py-2 text-[12px]" /></label><p className="text-[10px] font-semibold text-muted">Save calls the existing budget upsert RPC. Do not save during smoke validation.</p>{mutation.error && <EmptyState>Budget update failed. The RPC returned an error.</EmptyState>}<Button disabled={mutation.isPending} onClick={() => mutation.mutate()} className="bg-purple text-white">{mutation.isPending ? 'Saving...' : 'Save Configuration'}</Button></div></div></div>; }

function WhatIfDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [users, setUsers] = useState(5);
  const [products, setProducts] = useState(2);
  const [intensity, setIntensity] = useState(100);
  if (!open) return null;
  const projected = Math.max(12, Math.round(users * 18 + products * 24 + (intensity - 100) * 1.6));
  return <div className="drawer-backdrop" onClick={onClose}>
    <div className="drawer" onClick={(event) => event.stopPropagation()}>
      <div className="drawer-head"><div><Badge>New</Badge><h2>What-if scenario</h2></div><button className="icon-close" aria-label="Close what-if scenario" onClick={onClose}><X size={17} /></button></div>
      <div className="space-y-4">
        <label className="block text-[11px] font-extrabold text-text">Additional users <span className="text-muted">{users}</span><input type="range" min="0" max="25" value={users} onChange={(event) => setUsers(Number(event.target.value))} className="mt-2 w-full" /></label>
        <label className="block text-[11px] font-extrabold text-text">Additional products <span className="text-muted">{products}</span><input type="range" min="0" max="10" value={products} onChange={(event) => setProducts(Number(event.target.value))} className="mt-2 w-full" /></label>
        <label className="block text-[11px] font-extrabold text-text">Usage intensity <span className="text-muted">{intensity}%</span><input type="range" min="50" max="200" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} className="mt-2 w-full" /></label>
        <div className="cc-callout cc-callout-action"><b>Projected add-on cost:</b><p>+${projected} / month</p></div>
      </div>
    </div>
  </div>;
}

export function GovernancePage({ params, onOpen: _onOpen, hideIntro = false }: { params: RpcParams; onOpen: (title: string, content?: ReactNode) => void; hideIntro?: boolean }) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const client = useQueryClient();
  const budget = useQuery({ queryKey: ['governance', 'budget', params.companyId, params.appId], queryFn: () => getBudget(params) });
  const alerts = useQuery({ queryKey: ['governance', 'alerts', params.companyId, params.appId], queryFn: () => getAlerts(params) });
  const summary = useQuery({ queryKey: ['governance', 'summary', params.companyId, params.appId, params.periodStart, params.periodEnd], queryFn: () => getCostSummary(params) });
  const ack = useMutation({ mutationFn: (id: string) => acknowledgeAlert(id), onSuccess: () => client.invalidateQueries({ queryKey: ['governance', 'alerts'] }) });
  const dismiss = useMutation({ mutationFn: (id: string) => dismissAlert(id), onSuccess: () => client.invalidateQueries({ queryKey: ['governance', 'alerts'] }) });
  const row = summary.data?.[0] ?? {};
  const totalSpend = numeric(row, 'total_cost');
  const budgetAmount = numeric((budget.data ?? undefined) as Record<string, unknown> | undefined, 'amount');
  const budgetUsed = budgetAmount && totalSpend !== undefined && budgetAmount > 0 ? Math.min((totalSpend / budgetAmount) * 100, 100) : 0;
  const alertRows = alerts.data ?? [];

  return <>
    {!hideIntro && <div className="page-intro">
      <div>
        <Badge className="bg-amberP text-amber">Admin and Member Access</Badge>
        <p>Budget posture analysis, alert responses, and enforcement decisions for this app.</p>
      </div>
    </div>}

    <div className="hero">
      <Card className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Budget posture</div>
            <div className="panel-title">Monthly AI budget</div>
            <div className="panel-desc">Controls, thresholds, and action-on-breach remain here. Cost breakdown stays in Cost Analytics.</div>
          </div>
          <span className={`pill ${budgetUsed >= 90 ? 'amber' : 'green'}`}>{budgetAmount && totalSpend !== undefined ? `${Math.round(budgetUsed)}% used` : 'No budget'}</span>
        </div>

        <div className="panel-pad">
          <div className="budgetbar"><span style={{ width: `${budgetAmount && totalSpend !== undefined ? Math.min(Math.round(budgetUsed), 100) : 0}%` }} /></div>

          <div className="grid-4" style={{ marginTop: '14px' }}>
            <div className="mini"><span>Spend MTD</span><b>{money(totalSpend)}</b></div>
            <div className="mini"><span>Budget</span><b>{budgetAmount ? money(budgetAmount) : '—'}</b></div>
            <div className="mini"><span>Warning</span><b>{budget.data ? `${field(budget.data, 'warn_threshold_pct') ?? '—'}%` : '—'}</b></div>
            <div className="mini"><span>Escalate</span><b>{budget.data ? `${field(budget.data, 'escalate_threshold_pct') ?? '—'}%` : '—'}</b></div>
          </div>

          <div className="gov-actions-row" style={{ marginTop: '14px' }}>
            <button type="button" className="btn-primary" onClick={() => setBudgetOpen(true)}>Update controls</button>
            <button type="button" className="btn-secondary" onClick={() => setWhatIfOpen(true)}>Run what-if<span className="tag-new">New</span></button>
          </div>
        </div>
      </Card>

      <Card className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Alerts</div>
            <div className="panel-title">Open governance alerts</div>
          </div>
        </div>

        <div className="panel-pad action-list">
          {alerts.isLoading ? <EmptyState>Loading alerts...</EmptyState> : alerts.error ? <EmptyState>Alerts could not be loaded.</EmptyState> : !alertRows.length ? <EmptyState><AlertTriangle size={18} className="mx-auto mb-2 text-amber" />No active alerts for this app.</EmptyState> : alertRows.slice(0, 3).map((alert: AlertRow, index) => <div className="action-row" key={String(alert.alert_id ?? index)}>
            <div className="action-ic"><AlertTriangle size={12} /></div>
            <div>
              <b>{field(alert, 'threshold_type')} threshold</b>
              <p>{field(alert, 'threshold_pct')}% · {field(alert, 'status')}</p>
            </div>
            <div className="action-arrow" style={{ display: 'flex', gap: '6px' }}>
              <button type="button" className="btn-small" onClick={() => ack.mutate(String(alert.alert_id))}>Ack</button>
              <button type="button" className="btn-small" onClick={() => dismiss.mutate(String(alert.alert_id))}>Dismiss</button>
            </div>
          </div>)}
        </div>
      </Card>
    </div>

    {budgetOpen && <BudgetDialog params={params} budget={budget.data ?? null} onClose={() => setBudgetOpen(false)} />}
    {whatIfOpen && <WhatIfDialog open={whatIfOpen} onClose={() => setWhatIfOpen(false)} />}
  </>;
}

