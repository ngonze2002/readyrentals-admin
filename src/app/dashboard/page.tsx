import { db, tsToISO } from '@/lib/firebase-admin'
import { fmtDate, fmtKsh, initials } from '@/lib/utils'
import { Building2, Users, Clock, Flag, Zap, BadgeCheck } from 'lucide-react'
import { StatCard, Badge, Table } from '@/components/ui'
import Link from 'next/link'
import type { Property, AppUser, Report } from '@/types'

async function getDashboardData() {
  const [propSnap, userSnap, reportSnap, boostSnap, txSnap] = await Promise.all([
    db.collection('properties').orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('users').orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('reports').where('status', '==', 'open').limit(5).get(),
    db.collection('boosts').where('status', '==', 'active').get(),
    db.collection('mpesa_transactions')
      .where('status', '==', 'completed')
      .where('type', 'in', ['boostBronze', 'boostSilver', 'boostGold'])
      .get(),
  ])

  const props    = propSnap.docs.map(d => ({ id: d.id, ...d.data() } as Property))
  const users    = userSnap.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser))
  const reports  = reportSnap.docs.map(d => ({ id: d.id, ...d.data() } as Report))

  const pending  = props.filter(p => !p.isVerified && p.status !== 'rejected')
  const landlords = users.filter(u => u.role === 'landlord')

  // Sum revenue from completed M-Pesa boost transactions
  const boostRevenue = txSnap.docs.reduce(
    (sum, d) => sum + ((d.data().amount as number) ?? 0), 0,
  )

  const activeBoosts = boostSnap.size

  // New this week
  const weekAgo  = Date.now() - 7 * 24 * 60 * 60 * 1000
  const newProps = props.filter(p => new Date(tsToISO(p.createdAt as any)).getTime() > weekAgo)
  const newUsers = users.filter(u => new Date(tsToISO(u.createdAt as any)).getTime() > weekAgo)

  return {
    stats: {
      totalListings:       props.length,
      pendingVerification: pending.length,
      totalUsers:          users.length,
      activeLandlords:     landlords.length,
      openReports:         reports.length,
      boostRevenue,
      activeBoosts,
      newListingsThisWeek: newProps.length,
      newUsersThisWeek:    newUsers.length,
    },
    pendingListings: pending.slice(0, 5) as Property[],
    recentUsers:     users.slice(0, 6) as AppUser[],
    openReports:     reports as Report[],
  }
}

export default async function DashboardPage() {
  const { stats, pendingListings, recentUsers, openReports } = await getDashboardData()

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Welcome back — here's what's happening on ReadyRentals today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total listings"
          value={stats.totalListings}
          delta={`+${stats.newListingsThisWeek} this week`}
          deltaUp
          icon={<Building2 className="w-4 h-4 text-brand" />}
          iconBg="bg-brand-light"
        />
        <StatCard
          label="Pending verification"
          value={stats.pendingVerification}
          delta="Awaiting review"
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          iconBg="bg-amber-50"
        />
        <StatCard
          label="Registered users"
          value={stats.totalUsers}
          delta={`+${stats.newUsersThisWeek} this week`}
          deltaUp
          icon={<Users className="w-4 h-4 text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Active landlords"
          value={stats.activeLandlords}
          icon={<Building2 className="w-4 h-4 text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
        <StatCard
          label="Open reports"
          value={stats.openReports}
          icon={<Flag className="w-4 h-4 text-red-600" />}
          iconBg="bg-red-50"
        />
        <StatCard
          label="Boost revenue"
          value={fmtKsh(stats.boostRevenue)}
          delta={`${stats.activeBoosts} active campaigns`}
          deltaUp
          icon={<Zap className="w-4 h-4 text-amber-600" />}
          iconBg="bg-amber-50"
        />
      </div>

      {/* Two-col row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pending queue */}
        <div className="rr-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Verification queue</h3>
            <Badge status="pending">{stats.pendingVerification} pending</Badge>
          </div>
          {pendingListings.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              <BadgeCheck className="w-8 h-8 mx-auto mb-2 text-green-300" />
              All listings verified!
            </div>
          ) : (
            <>
              {pendingListings.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0"
                >
                  <div className="w-9 h-9 rounded-lg bg-brand-light flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                    <p className="text-xs text-gray-400">{p.landlordName} · {fmtDate(tsToISO(p.createdAt as any))}</p>
                  </div>
                  <Link
                    href={`/verify?id=${p.id}`}
                    className="text-xs font-medium text-brand hover:underline shrink-0"
                  >
                    Review →
                  </Link>
                </div>
              ))}
              <div className="px-5 py-3 border-t border-gray-50">
                <Link href="/verify" className="text-xs font-medium text-brand hover:underline">
                  View all {stats.pendingVerification} pending →
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Open reports */}
        <div className="rr-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Open reports</h3>
            <Badge status="open">{openReports.length} open</Badge>
          </div>
          {openReports.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              <Flag className="w-8 h-8 mx-auto mb-2 text-gray-200" />
              No open reports
            </div>
          ) : (
            <>
              {openReports.map(r => (
                <div key={r.id} className="flex items-start gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Flag className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.propertyTitle}</p>
                    <p className="text-xs text-gray-400 truncate">{r.reason}</p>
                    <p className="text-xs text-gray-300 mt-0.5">{r.reporterName} · {fmtDate(r.createdAt)}</p>
                  </div>
                  <Badge status="open">Open</Badge>
                </div>
              ))}
              <div className="px-5 py-3 border-t border-gray-50">
                <Link href="/reports" className="text-xs font-medium text-brand hover:underline">
                  Review all reports →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent users */}
      <div className="rr-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Recent users</h3>
          <Link href="/users" className="text-xs font-medium text-brand hover:underline">
            View all →
          </Link>
        </div>
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Joined</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map(u => (
              <tr key={u.uid}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center
                                    text-xs font-semibold text-brand shrink-0">
                      {initials(u.fullName)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{u.fullName}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td><Badge status={u.role}>{u.role}</Badge></td>
                <td className="text-gray-500">{u.phone}</td>
                <td className="text-gray-500">{fmtDate(u.createdAt)}</td>
                <td>
                  <Badge status={u.isVerified ? 'verified' : 'pending'}>
                    {u.isVerified ? 'Verified' : 'Pending'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  )
}