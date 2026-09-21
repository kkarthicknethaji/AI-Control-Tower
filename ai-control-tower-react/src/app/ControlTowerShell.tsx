import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import type { CompanyApp, CompanyMembership, NavKey, RpcParams } from '../types';
import { CUSTOM_RANGE_OPTION, periodLabel, periodRange, type CustomRange } from './navigation';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import { DetailDrawer } from '../components/layout/DetailDrawer';
import { CustomDateDialog } from '../components/layout/CustomDateDialog';
import { CommandCenterPage } from '../features/command-center/CommandCenterPage';
import { OutcomeEconomicsPage } from '../features/outcome-economics/OutcomeEconomicsPage';
import { CostAnalyticsPage } from '../features/cost-analytics/CostAnalyticsPage';
import { TraceExplorerPage } from '../features/trace-explorer/TraceExplorerPage';
import { GovernancePage } from '../features/governance/GovernancePage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { exportNodeToPdf } from '../lib/exportPdf';

export interface ShellContext { session: { user: { email?: string; user_metadata?: { display_name?: string } } }; membership: CompanyMembership; apps: CompanyApp[]; }

export function ControlTowerShell({ context }: { context: ShellContext }) {
  const [active, setActive] = useState<NavKey>('command'); const [settingsTab, setSettingsTab] = useState<'connections' | 'budget'>('connections'); const [collapsed, setCollapsed] = useState(false); const [period, setPeriod] = useState('This Month'); const [customRange, setCustomRange] = useState<CustomRange | null>(null); const [customDialogOpen, setCustomDialogOpen] = useState(false); const [appId, setAppId] = useState<string | null>(() => { const stored = localStorage.getItem('ai_control_tower_active_app_id'); if (stored && context.apps.some((app) => app.app_id === stored)) return stored; return context.apps[0]?.app_id ?? null; }); const [userOpen, setUserOpen] = useState(false); const [periodOpen, setPeriodOpen] = useState(false); const [appOpen, setAppOpen] = useState(false); const [drawer, setDrawer] = useState<{ title: string; content?: ReactNode } | null>(null); const [traceContext, setTraceContext] = useState<string | null>(null); const [isExporting, setIsExporting] = useState(false); const contentRef = useRef<HTMLDivElement>(null);
  const selectedApp = context.apps.find((app) => app.app_id === appId) ?? context.apps[0]; const range = periodRange(period, customRange); const params: RpcParams | null = selectedApp ? { companyId: context.membership.company_id, appId: selectedApp.app_id, ...range } : null; const canGovern = context.membership.role === 'admin' || context.membership.role === 'member'; const displayName = context.session.user.user_metadata?.display_name || context.session.user.email?.split('@')[0] || 'User';
  function selectApp(next: string) { setAppId(next); setAppOpen(false); localStorage.setItem('ai_control_tower_active_app_id', next); }
  function navigate(next: NavKey) { if (next === 'governance') { setSettingsTab('budget'); setActive('settings'); return; } setActive(next); }
  function selectPeriod(next: string) {
    if (next === CUSTOM_RANGE_OPTION) { setCustomDialogOpen(true); setPeriodOpen(false); return; }
    setPeriod(next); setCustomRange(null); setPeriodOpen(false);
  }
  function applyCustomRange(start: string, end: string) { setPeriod(CUSTOM_RANGE_OPTION); setCustomRange({ start, end }); setCustomDialogOpen(false); }
  const openDrawer = (title: string, content?: ReactNode) => setDrawer({ title, content });
  const openTrace = (traceId: string) => { setTraceContext(traceId); setActive('traces'); };
  async function handleExport() {
    if (!contentRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const navLabel = active.charAt(0).toUpperCase() + active.slice(1);
      await exportNodeToPdf(contentRef.current, `AI_Control_Tower_${navLabel}.pdf`);
    } catch (error) {
      console.error('[AI Control Tower] PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }
  return <div className={collapsed ? 'app-shell collapsed' : 'app-shell'}><Sidebar active={active} collapsed={collapsed} setActive={navigate} setCollapsed={setCollapsed} userOpen={userOpen} setUserOpen={setUserOpen} displayName={displayName} email={context.session.user.email} membership={context.membership} /><main className="main"><TopBar active={active} apps={context.apps} appId={appId} appOpen={appOpen} period={period} periodLabel={periodLabel(period, customRange)} periodOpen={periodOpen} isExporting={isExporting} showExport={active !== 'governance'} onAppToggle={() => setAppOpen(!appOpen)} onAppClose={() => setAppOpen(false)} onAppSelect={selectApp} onPeriodToggle={() => setPeriodOpen(!periodOpen)} onPeriodClose={() => setPeriodOpen(false)} onPeriodSelect={selectPeriod} onExport={handleExport} /><div className="content-scroll"><div className="content" ref={contentRef}>{active === 'command' && params && <CommandCenterPage params={params} canViewGovernance={canGovern} onOpen={openDrawer} onNavigate={navigate} />}{active === 'outcomes' && params && <OutcomeEconomicsPage params={params} onOpen={openDrawer} />}{active === 'cost' && params && <CostAnalyticsPage params={params} canInspectTrace={canGovern} onTraceSelect={openTrace} onOpen={(title) => openDrawer(title)} />}{active === 'traces' && params && <TraceExplorerPage params={params} canInspectTrace={canGovern} initialTraceId={traceContext} onOpen={openDrawer} />}{active === 'governance' && canGovern && params && <GovernancePage params={params} onOpen={(title) => openDrawer(title)} />}{active === 'settings' && canGovern && <SettingsPage companyId={context.membership.company_id} apps={context.apps} period={range} initialTab={settingsTab} />}</div></div>{drawer && <DetailDrawer title={drawer.title} content={drawer.content} onClose={() => setDrawer(null)} />}{customDialogOpen && <CustomDateDialog initialStart={customRange?.start} initialEnd={customRange?.end} onApply={applyCustomRange} onClose={() => setCustomDialogOpen(false)} />}</main></div>;
}
