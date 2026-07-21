import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db, tsToISO } from '@/lib/firebase-admin'
import type { Boost } from '@/types'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const snap = await db.collection('boosts').orderBy('startDate', 'desc').get()

  const data: Boost[] = snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as Omit<Boost, 'id'>),
    startDate: tsToISO(d.data().startDate),
    endDate:   tsToISO(d.data().endDate),
  }))

  return NextResponse.json({ data })
}
