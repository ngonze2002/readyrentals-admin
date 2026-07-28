import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/firebase-admin'
import type { Boost } from '@/types'

const PACKAGE_NAMES: Record<string, string> = {
  boostBronze: 'Bronze',
  boostSilver: 'Silver',
  boostGold:   'Gold',
}

function toIso(value: any): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  return ''
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const snap = await db.collection('boosts').orderBy('startDate', 'desc').get()

  // Collect unique IDs so we can fetch them in parallel
  const propertyIds = new Set<string>()
  const transactionIds = new Set<string>()

  snap.docs.forEach(d => {
    const data = d.data()
    if (data.propertyId) propertyIds.add(data.propertyId)
    if (data.transactionId) transactionIds.add(data.transactionId)
  })

  // Fetch all referenced docs in parallel
  const [propertyDocs, txDocs] = await Promise.all([
    Promise.all(
      Array.from(propertyIds).map(id => db.collection('properties').doc(id).get())
    ),
    Promise.all(
      Array.from(transactionIds).map(id => db.collection('mpesa_transactions').doc(id).get())
    ),
  ])

  const properties = new Map(
    propertyDocs.filter(d => d.exists).map(d => [d.id, d.data()])
  )
  const transactions = new Map(
    txDocs.filter(d => d.exists).map(d => [d.id, d.data()])
  )

  const data: Boost[] = snap.docs.map(d => {
    const raw = d.data()
    const property = properties.get(raw.propertyId)
    const tx = transactions.get(raw.transactionId)

    return {
      id: d.id,
      propertyId: raw.propertyId ?? '',
      propertyTitle: property?.title ?? 'Untitled',
      landlordName:
        property?.landlordName ??
        property?.ownerName ??
        property?.userName ??
        'Unknown',
      landlordId:
        property?.landlordId ?? property?.ownerId ?? property?.userId ?? '',
      package: (PACKAGE_NAMES[raw.type] ?? 'Bronze') as 'Bronze' | 'Silver' | 'Gold',
      amount: Number(tx?.amount ?? 0),
      status: raw.status ?? 'expired',
      startDate: toIso(raw.startDate),
      endDate: toIso(raw.endDate),
    }
  })

  return NextResponse.json({ data })
}