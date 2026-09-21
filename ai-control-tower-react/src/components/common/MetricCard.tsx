import { Card } from '../ui';

export function MetricCard({ label, value, detail, tone = 'purple', breakdown }: { label: string; value: string; detail: string; tone?: string; breakdown?: { inLabel: string; inValue: string; outLabel: string; outValue: string } }) {
  return <Card className="metric-card"><div className="metric-label">{label}</div><strong className={`metric-value ${tone}`}>{value}</strong><span className="metric-detail">{detail}</span>{breakdown && <span className="metric-breakdown"><span>{breakdown.inLabel} <b>{breakdown.inValue}</b></span><span>{breakdown.outLabel} <b>{breakdown.outValue}</b></span></span>}</Card>;
}
