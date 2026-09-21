import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge, Button } from '../ui';
import type { CompanyApp } from '../../types';
import { useClickOutside } from '../../lib/useClickOutside';

export function AppSelector({ apps, selectedId, open, onToggle, onClose, onSelect, kicker = 'App' }: { apps: CompanyApp[]; selectedId: string | null; open: boolean; onToggle: () => void; onClose: () => void; onSelect: (id: string) => void; kicker?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, open, onClose);
  const [query, setQuery] = useState('');
  useEffect(() => { if (!open) setQuery(''); }, [open]);
  const selectedApp = apps.find((app) => app.app_id === selectedId);
  const sorted = [...apps].sort((a, b) => a.app_name.localeCompare(b.app_name));
  const filtered = query.trim() ? sorted.filter((app) => app.app_name.toLowerCase().includes(query.trim().toLowerCase())) : sorted;
  const ordered = [...filtered.filter((app) => app.app_id === selectedId), ...filtered.filter((app) => app.app_id !== selectedId)];
  return <div className="dropdown-wrap" ref={wrapRef}><Button className="selector" onClick={onToggle} disabled={!selectedApp}><span className="btn-kicker">{kicker}</span><span>{selectedApp?.app_name ?? 'Loading Apps...'}</span><ChevronDown size={13} /></Button>{open && selectedApp && <div className="dropdown-menu">{apps.length > 6 && <div className="dropdown-search"><input autoFocus type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps..." /></div>}{ordered.length === 0 ? <div className="dropdown-empty">No apps found</div> : ordered.map((app) => <button key={app.app_id} onClick={() => onSelect(app.app_id)} className={app.app_id === selectedId ? 'selected' : ''}>{app.app_name}{app.app_id === selectedId && <Badge className="ml-auto">Active</Badge>}</button>)}</div>}</div>;
}
