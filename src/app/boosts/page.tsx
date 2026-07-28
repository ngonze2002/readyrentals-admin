'use client'
import { useEffect, useState } from 'react'
import { Zap, Loader2 } from 'lucide-react'
import { Badge, Empty, Table, StatCard, useToast } from '@/components/ui'
import { fmtDate, fmtKsh } from '@/lib/utils'
import type { Boost } from '@/types'

export default function BoostsPage() {
  const [items,   setItems]   = useState<Boost[]>([])
  const [loading, setLoading] = useState(true)
  const { ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/boosts')
      .then(r => r.json())
      .then(j => setItems(j.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const active  = items.filter(b => b.status === 'active')
  const expired = items.filter(b => b.status === 'expired')
  const revenue = active.reduce((s, b) => s + (b.amount ?? 0), 0)
  const total   = items.reduce((s, b) => s + (b.amount ?? 0), 0)

  const pkgColor: Record<string, string> = {
    Bronze: 'bg-amber-50  text-amber-700  border-amber-200',
    Silver: 'bg-gray-100  text-gray-600   border-gray-200',
    Gold:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Boosts</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Premium listing promotion campaigns purchased by landlords.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Active boosts"
          value={active.length}
          icon={<Zap className="w-4 h-4 text-amber-600" />}
          iconBg="bg-amber-50"
        />
        <StatCard
          label="Expired this month"
          value={expired.length}
          icon={<Zap className="w-4 h-4 text-gray-400" />}
          iconBg="bg-gray-100"
        />
        <StatCard
          label="Revenue (active)"
          value={fmtKsh(revenue)}
          delta="Currently running"
          deltaUp
          icon={<Zap className="w-4 h-4 text-brand" />}
          iconBg="bg-brand-light"
        />
        <StatCard
          label="Total all-time"
          value={fmtKsh(total)}
          icon={<Zap className="w-4 h-4 text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
      </div>

      {/* Table */}
      <div className="rr-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">All campaigns</h3>
          <Badge status={active.length > 0 ? 'active' : 'expired'}>
            {active.length} active
          </Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
          </div>
        ) : items.length === 0 ? (
          <Empty icon={<Zap className="w-7 h-7" />} title="No boosts yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Listing</th>
                <th>Landlord</th>
                <th>Package</th>
                <th>Amount</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(b => (
                <tr key={b.id}>
                  <td className="font-medium text-gray-900 max-w-[180px]">
                    <span className="truncate block">{b.propertyTitle}</span>
                  </td>
                  <td className="text-gray-500">{b.landlordName}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
                                      text-xs font-semibold border ${pkgColor[b.package] ?? ''}`}>
                      <Zap className="w-3 h-3" />
                      {b.package}
                    </span>
                  </td>
                  <td className="font-semibold text-gray-900">
                    {fmtKsh(b.amount ?? 0)}
                  </td>
                  <td className="text-gray-500 whitespace-nowrap">
                    {b.startDate ? fmtDate(b.startDate) : '—'}
                  </td>
                  <td className="text-gray-500 whitespace-nowrap">
                    {b.endDate ? fmtDate(b.endDate) : '—'}
                  </td>
                  <td>
                    <Badge status={b.status === 'active' ? 'active' : 'expired'}>
                      {b.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <ToastContainer />
    </div>
  )
}