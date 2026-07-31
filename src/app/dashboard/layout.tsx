import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth-options'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { db } from '@/lib/firebase-admin'

async function getCounts() {
  try {
    const [pendingSnap, reportsSnap, contactSnap] = await Promise.all([
      db.collection('properties').where('isVerified', '==', false)
        .where('status', '!=', 'rejected').count().get(),
      db.collection('reports').where('status', '==', 'open').count().get(),
      db.collection('contact_requests').where('status', '==', 'new').count().get(),
    ])
    return {
      pending: pendingSnap.data().count,
      reports: reportsSnap.data().count,
      contact: contactSnap.data().count,
    }
  } catch {
    return { pending: 0, reports: 0, contact: 0 }
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const counts = await getCounts()

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <Sidebar pendingCount={counts.pending} reportsCount={counts.reports} contactCount={counts.contact} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar title="ReadyRentals Admin" contactCount={counts.contact} />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  )
}
