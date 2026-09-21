import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { RpcParams } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function previousRange(params: Pick<RpcParams, 'periodStart' | 'periodEnd'>) {
  const start = new Date(params.periodStart).getTime();
  const end = new Date(params.periodEnd).getTime();
  const duration = Math.max(end - start, 0);
  return { periodStart: new Date(start - duration).toISOString(), periodEnd: new Date(start).toISOString() };
}

export function money(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

export function compactNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
