import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db, tsToISO } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { Report } from '@/types'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = new URL(req.url).searchParams.get('status') ?? 'open'
  const snap   = await db.collection('reports')
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .get()

  const data: Report[] = snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as Omit<Report, 'id'>),
    createdAt: tsToISO(d.data().createdAt),
  }))

  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: {
    id: string
    action: 'action' | 'dismiss'
    adminNote?: string
    removeProperty?: boolean
  } = await req.json()

  const ref = db.collection('reports').doc(body.id)
  await ref.update({
    status:      body.action === 'dismiss' ? 'dismissed' : 'actioned',
    adminNote:   body.adminNote ?? null,
    resolvedAt:  FieldValue.serverTimestamp(),
  })

  // Optionally remove the property
  if (body.removeProperty) {
    const report = (await ref.get()).data()
    if (report?.propertyId) {
      await db.collection('properties').doc(report.propertyId).delete()
    }
  }

  return NextResponse.json({ ok: true })
}
