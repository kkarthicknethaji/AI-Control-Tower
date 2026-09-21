import { useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '../ui';
import { periods } from '../../app/navigation';
import { useClickOutside } from '../../lib/useClickOutside';

export function PeriodSelector({ period, label, open, onToggle, onClose, onSelect }: { period: string; label: string; open: boolean; onToggle: () => void; onClose: () => void; onSelect: (period: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, open, onClose);
  return <div className="dropdown-wrap" ref={wrapRef}><Button className="selector" onClick={onToggle}><span className="btn-kicker">Period</span><span>{label}</span><ChevronDown size={13} /></Button>{open && <div className="dropdown-menu">{periods.map((option) => <button key={option} onClick={() => onSelect(option)} className={option === period ? 'selected' : ''}>{option}</button>)}</div>}</div>;
}
