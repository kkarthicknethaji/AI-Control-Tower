import { Activity, BarChart3, Home, Target, type LucideIcon } from 'lucide-react';
import type { NavKey } from '../types';

export interface NavigationItem { key: NavKey; label: string; sub: string; icon: LucideIcon; }

export const navItems: NavigationItem[] = [
  { key: 'command', label: 'Command Center', sub: 'Outcome, spend, risk', icon: Home },
  { key: 'outcomes', label: 'Outcome Economics', sub: 'Cost per outcome', icon: Target },
  { key: 'cost', label: 'Cost Analytics', sub: 'Drivers and quality', icon: BarChart3 },
  { key: 'traces', label: 'Trace Explorer', sub: 'Requests, spans, payloads', icon: Activity },
];

export const CUSTOM_RANGE_OPTION = 'Custom Range...';
export const periods = ['This Month', 'Last Month', 'Last 3 Months', 'Overall', CUSTOM_RANGE_OPTION];

export interface CustomRange { start: string; end: string; }

export function periodRange(period: string, custom?: CustomRange | null) {
  const now = new Date();
  let start: Date;
  let end: Date;
  if (period === CUSTOM_RANGE_OPTION && custom) {
    start = new Date(`${custom.start}T00:00:00`);
    end = new Date(`${custom.end}T23:59:59.999`);
  } else if (period === 'Last Month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'Last 3 Months') {
    start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (period === 'Overall') {
    start = new Date(2024, 0, 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

export function periodLabel(period: string, custom?: CustomRange | null) {
  if (period === CUSTOM_RANGE_OPTION && custom) {
    const format = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${format(custom.start)} – ${format(custom.end)}`;
  }
  return period;
}
