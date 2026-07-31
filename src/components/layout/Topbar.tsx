'use client'
import Link from 'next/link'
import { Bell, Search } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { initials } from '@/lib/utils'

interface TopbarProps {
  title: string
  contactCount?: number
}

export function Topbar({ title, contactCount = 0 }: TopbarProps) {
  const { data: session } = useSession()
  return (
    <header className="h-13 flex items-center gap-4 px-6 bg-white border-b border-gray-100 shrink-0">
      <h1 className="text-base font-semibold text-gray-900 flex-1">{title}</h1>

      {/* Search */}
      <div className="flex items-center gap-2 bg-surface-0 border border-gray-200 rounded-lg px-3 py-1.5 w-56">
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Search…"
          className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
        />
      </div>

      <Link
        href="/support"
        className="relative text-gray-400 hover:text-gray-600 transition-colors"
        title={contactCount > 0 ? `${contactCount} new contact request${contactCount !== 1 ? 's' : ''}` : 'Contact requests'}
      >
        <Bell className="w-5 h-5" />
        {contactCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center
                            bg-red-500 text-white text-[10px] font-semibold rounded-full leading-none">
            {contactCount > 9 ? '9+' : contactCount}
          </span>
        )}
      </Link>

      <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center
                      text-xs font-semibold text-brand cursor-pointer">
        {session?.user?.name ? initials(session.user.name) : 'AD'}
      </div>
    </header>
  )
}
