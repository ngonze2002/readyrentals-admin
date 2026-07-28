import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db, tsToISO } from '@/lib/firebase-admin'
import type { Boost } from '@/types'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const snap = await db.collection('boosts').orderBy('startDate', 'desc').get()

  const data: Boost[] = snap.docs.map(d => {
    const raw = d.data() as Record<string, any>

    return {
      id: d.id,
      propertyTitle: raw.propertyTitle ?? 'Untitled',
      landlordName:  raw.landlordName  ?? 'Unknown',
      package:       raw.package       ?? 'Bronze',
      amount:        Number(raw.amount ?? 0),
      status:        raw.status        ?? 'expired',
      startDate:     tsToISO(raw.startDate) ?? '',
      endDate:       tsToISO(raw.endDate)   ?? '',
    } as Boost
  })

  return NextResponse.json({ data })
}