import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Settings, UserRound } from 'lucide-react';
import { useRef } from 'react';
import { APP_DISPLAY_VERSION, APP_NAME } from '../../lib/appMeta';
import { getSupabase } from '../../lib/supabase';
import { useClickOutside } from '../../lib/useClickOutside';
import type { CompanyMembership, NavKey } from '../../types';
import { navItems } from '../../app/navigation';

function initials(name?: string | null) { return (name || 'User').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U'; }
function titleCase(value: string) { return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1)); }

export function Sidebar({ active, collapsed, setActive, setCollapsed, userOpen, setUserOpen, displayName, email, membership }: { active: NavKey; collapsed: boolean; setActive: (key: NavKey) => void; setCollapsed: (value: boolean) => void; userOpen: boolean; setUserOpen: (value: boolean) => void; displayName: string; email?: string; membership: CompanyMembership }) {
  const visibleNav = navItems;
  const accountRef = useRef<HTMLDivElement>(null);
  useClickOutside(accountRef, userOpen, () => setUserOpen(false));
  return <aside className="sidebar"><div className="brand"><img src="/Product_Studio_Icon.ico" alt="Product Studio" className="product-icon" /><div className="brand-copy"><h1>{APP_NAME}</h1><p>{APP_DISPLAY_VERSION}</p></div><button className="collapse-btn" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button></div><div className="nav-sec">Navigate</div><nav className="nav" aria-label="AI Control Tower views">{visibleNav.map(({ key, label, sub, icon: Icon }) => <button key={key} className={active === key ? 'nav-btn active' : 'nav-btn'} onClick={() => setActive(key)} title={collapsed ? label : undefined}><span className="nav-ic"><Icon size={16} /></span><span className="nav-copy"><span className="nav-title">{label}</span><span className="nav-sub">{sub}</span></span></button>)}</nav><div className="account-wrap" ref={accountRef}><button className="account-trigger" aria-expanded={userOpen} onClick={() => setUserOpen(!userOpen)}><span className="account-avatar">{initials(displayName)}</span><span className="account-copy"><span className="account-name">{displayName}</span><span className="account-role">{titleCase(membership.role)} Access</span></span><ChevronDown className="account-chevron" size={14} /></button>{userOpen && <div className="account-popover"><div className="account-menu-head"><span className="account-avatar">{initials(displayName)}</span><div><b>{displayName}</b><span>{email}</span></div></div><button className="account-menu-item"><UserRound size={15} />My Profile</button><button className="account-menu-item" onClick={() => { setUserOpen(false); setActive('settings'); }}><Settings size={15} />Settings</button><div className="account-divider" /><button className="account-menu-item signout" onClick={() => getSupabase().auth.signOut()}><LogOut size={15} />Sign Out</button></div>}</div></aside>;
}
