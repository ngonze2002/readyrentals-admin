'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { TrendingUp, Users, Building2, Zap, Loader2 } from 'lucide-react'
import { StatCard } from '@/components/ui'
import { fmtKsh } from '@/lib/utils'

interface AnalyticsData {
  months: string[]
  listingsByMonth: number[]
  usersByMonth: number[]
  totalRevenue: number
  typeCounts: Record<string, number>
  totalListings: number
  totalUsers: number
  avgViews: number
  topEstates: {
    estate: string
    county: string
    count: number
    avgRent: number
    vacancy: number
  }[]
  // Dynamic deltas
  listingsDelta: number
  usersDelta: number
  revenueDelta: number
  avgViewsDelta: number
}

const TYPE_LABELS: Record<string, string> = {
  oneBedroom:       '1 Bedroom',
  bedsitter:        'Bedsitter',
  twoBedroom:       '2 Bedroom',
  studio:           'Studio',
  singleRoom:       'Single Room',
  threeBedroom:     '3 Bedroom',
  threePlusBedroom: '3+ Bedroom',
  shop:             'Shop',
  office:           'Office',
}

// Format delta for display: "+18%" or "-5%"
function fmtDelta(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}% vs last month`
}

export default function AnalyticsPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    )
  }

  const chartData = data
    ? data.months.map((m, i) => ({
        month:    m,
        listings: data.listingsByMonth[i],
        users:    data.usersByMonth[i],
      }))
    : []

  const typeData = data
    ? Object.entries(data.typeCounts)
        .map(([k, v]) => ({ name: TYPE_LABELS[k] ?? k, count: v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    : []

  const maxType = Math.max(...typeData.map(t => t.count), 1)

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Platform-wide metrics and growth trends.
        </p>
      </div>

      {/* Summary stats — all deltas are now dynamic */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total listings (year)"
          value={data?.totalListings ?? 0}
          delta={fmtDelta(data?.listingsDelta ?? 0)}
          deltaUp={(data?.listingsDelta ?? 0) >= 0}
          icon={<Building2 className="w-4 h-4 text-brand" />}
          iconBg="bg-brand-light"
        />
        <StatCard
          label="Total users (year)"
          value={data?.totalUsers ?? 0}
          delta={fmtDelta(data?.usersDelta ?? 0)}
          deltaUp={(data?.usersDelta ?? 0) >= 0}
          icon={<Users className="w-4 h-4 text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Boost revenue"
          value={fmtKsh(data?.totalRevenue ?? 0)}
          delta={fmtDelta(data?.revenueDelta ?? 0)}
          deltaUp={(data?.revenueDelta ?? 0) >= 0}
          icon={<Zap className="w-4 h-4 text-amber-600" />}
          iconBg="bg-amber-50"
        />
        <StatCard
          label="Avg. views / listing"
          value={data?.avgViews ?? 0}
          delta={fmtDelta(data?.avgViewsDelta ?? 0)}
          deltaUp={(data?.avgViewsDelta ?? 0) >= 0}
          icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Listings bar chart */}
        <div className="rr-card xl:col-span-2">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">New listings by month</h3>
            <p className="text-xs text-gray-400 mt-0.5">Last 12 months</p>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    background: '#111',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 12,
                  }}
                  cursor={{ fill: '#f4f4f2' }}
                />
                <Bar dataKey="listings" name="Listings" fill="#1B7A4D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Property type breakdown */}
        <div className="rr-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Listings by type</h3>
          </div>
          <div className="p-5 space-y-3">
            {typeData.map(t => (
              <div key={t.name}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-600">{t.name}</span>
                  <span className="text-xs font-semibold text-gray-800">{t.count}</span>
                </div>
                <div className="h-1.5 bg-surface-0 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-700"
                    style={{ width: `${(t.count / maxType) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Users growth line chart */}
      <div className="rr-card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">User growth</h3>
          <p className="text-xs text-gray-400 mt-0.5">New registrations per month</p>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: '#111',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="users"
                name="New users"
                stroke="#185FA5"
                strokeWidth={2.5}
                dot={{ fill: '#185FA5', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top estates table */}
      <div className="rr-card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Top estates by listing count</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full rr-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Estate</th>
                <th>County</th>
                <th>Listings</th>
                <th>Avg. rent</th>
                <th>Vacancy rate</th>
              </tr>
            </thead>
            <tbody>
              {data?.topEstates.length ? (
                data.topEstates.map((e, i) => (
                  <tr key={e.estate}>
                    <td className="text-gray-400 font-medium">{i + 1}</td>
                    <td className="font-semibold text-gray-900">{e.estate}</td>
                    <td className="text-gray-500">{e.county}</td>
                    <td className="text-center text-gray-700 font-medium">{e.count}</td>
                    <td className="font-medium text-gray-900">{fmtKsh(e.avgRent)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface-0 rounded-full overflow-hidden max-w-[80px]">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${e.vacancy}%` }}
                          />
                        </div>
                        <span className="text-xs text-green-700 font-medium">{e.vacancy}% vacant</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-8 text-gray-400"
                  >
                    No property data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}