import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge, Button } from '../ui';

export function CustomDateDialog({ initialStart, initialEnd, onApply, onClose }: { initialStart?: string; initialEnd?: string; onApply: (start: string, end: string) => void; onClose: () => void }) {
  const [start, setStart] = useState(initialStart ?? '');
  const [end, setEnd] = useState(initialEnd ?? '');
  const valid = Boolean(start) && Boolean(end) && start <= end;
  return <div className="drawer-backdrop" onClick={onClose}><div className="modal" onClick={(event) => event.stopPropagation()}>
    <div className="drawer-head"><div><Badge>Period</Badge><h2>Custom Date Range</h2></div><button className="icon-close" aria-label="Close custom date range" onClick={onClose}><X size={17} /></button></div>
    <div className="modal-body">
      <label className="modal-field">Start Date<input type="date" value={start} max={end || undefined} onChange={(event) => setStart(event.target.value)} /></label>
      <label className="modal-field">End Date<input type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} /></label>
      <div className="modal-actions"><Button onClick={onClose}>Cancel</Button><Button className="bg-purple text-white" disabled={!valid} onClick={() => onApply(start, end)}>Apply Range</Button></div>
    </div>
  </div></div>;
}
