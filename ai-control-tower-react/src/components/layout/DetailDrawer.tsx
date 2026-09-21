import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Badge, EmptyState } from '../ui';

export function DetailDrawer({ title, content, onClose }: { title: string; content?: ReactNode; onClose: () => void }) { return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><Badge>Live detail</Badge><h2>{title}</h2></div><button className="icon-close" aria-label="Close detail drawer" onClick={onClose}><X size={17} /></button></div>{content ?? <EmptyState>Detail content will be populated from the corresponding Supabase service.</EmptyState>}</aside></div>; }
