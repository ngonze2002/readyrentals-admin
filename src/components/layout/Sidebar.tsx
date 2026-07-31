'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard, BadgeCheck, Flag, Users, Building2,
  Zap, BarChart3, Settings, LogOut, Home, Mail,
} from 'lucide-react'
import { cn, initials } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  badge?: string
}

const NAV: { section: string; items: NavItem[] }[] = [
  { section: 'Overview', items: [
    { href: '/dashboard',  label: 'Dashboard',        icon: LayoutDashboard },
  ]},
  { section: 'Moderation', items: [
    { href: '/verify',     label: 'Verify listings',  icon: BadgeCheck, badge: 'pending' },
    { href: '/reports',    label: 'Reports',          icon: Flag,       badge: 'reports' },
    { href: '/support',    label: 'Contact requests', icon: Mail,       badge: 'contact' },
  ]},
  { section: 'Data', items: [
    { href: '/users',      label: 'Users',            icon: Users },
    { href: '/listings',   label: 'All listings',     icon: Building2 },
    { href: '/boosts',     label: 'Boosts',           icon: Zap },
  ]},
  { section: 'Insights', items: [
    { href: '/analytics',  label: 'Analytics',        icon: BarChart3 },
  ]},
  { section: 'System', items: [
    { href: '/settings',   label: 'Settings',         icon: Settings },
  ]},
]

interface SidebarProps {
  pendingCount?: number
  reportsCount?: number
  contactCount?: number
}

export function Sidebar({ pendingCount = 0, reportsCount = 0, contactCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const badgeVal = (key: string) => {
    if (key === 'pending') return pendingCount
    if (key === 'reports') return reportsCount
    if (key === 'contact') return contactCount
    return 0
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-brand-dark h-screen overflow-y-auto scrollbar-thin">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Home className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">ReadyRentals</p>
          <p className="text-[10px] text-white/50 mt-0.5">Admin portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 pb-4">
        {NAV.map(group => (
          <div key={group.section} className="mt-4">
            <p className="px-3 mb-1 text-[10px] font-medium text-white/40 uppercase tracking-widest">
              {group.section}
            </p>
            {group.items.map(item => {
              const Icon    = item.icon
              const active  = pathname === item.href || pathname.startsWith(item.href + '/')
              const bv      = item.badge ? badgeVal(item.badge) : 0

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'nav-link',
                    active && 'active',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {bv > 0 && (
                    <span className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                      item.badge === 'reports'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700',
                    )}>
                      {bv}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center
                          text-[11px] font-semibold text-white shrink-0">
            {session?.user?.name ? initials(session.user.name) : 'AD'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {session?.user?.name ?? 'Admin'}
            </p>
            <p className="text-[10px] text-white/50 truncate">
              {session?.user?.email ?? ''}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-white/40 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
