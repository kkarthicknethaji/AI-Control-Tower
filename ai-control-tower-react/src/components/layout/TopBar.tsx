import { Download } from 'lucide-react';
import { Button } from '../ui';
import { navItems } from '../../app/navigation';
import type { CompanyApp } from '../../types';
import { AppSelector } from './AppSelector';
import { PeriodSelector } from './PeriodSelector';

export function TopBar({ active, apps, appId, appOpen, period, periodLabel, periodOpen, isExporting, showExport = true, onAppToggle, onAppClose, onAppSelect, onPeriodToggle, onPeriodClose, onPeriodSelect, onExport }: { active: string; apps: CompanyApp[]; appId: string | null; appOpen: boolean; period: string; periodLabel: string; periodOpen: boolean; isExporting: boolean; showExport?: boolean; onAppToggle: () => void; onAppClose: () => void; onAppSelect: (id: string) => void; onPeriodToggle: () => void; onPeriodClose: () => void; onPeriodSelect: (period: string) => void; onExport: () => void }) {
  const item = navItems.find((entry) => entry.key === active);
  const isSettings = active === 'settings';
  return <header className="topbar"><div className="top-left"><h2>{isSettings ? 'Settings' : item?.label ?? 'Command Center'}</h2><p>{isSettings ? 'Configure connected apps, ingestion credentials, capture controls, and budget rules.' : item?.sub ?? ''}</p></div>{!isSettings && <div className="top-actions"><AppSelector apps={apps} selectedId={appId} open={appOpen} onToggle={onAppToggle} onClose={onAppClose} onSelect={onAppSelect} /><PeriodSelector period={period} label={periodLabel} open={periodOpen} onToggle={onPeriodToggle} onClose={onPeriodClose} onSelect={onPeriodSelect} />{showExport && <Button className="export-btn" disabled={isExporting} onClick={onExport} aria-label="Export current page as PDF"><Download size={14} />{isExporting ? 'Exporting...' : 'Export'}</Button>}</div>}</header>;
}
