import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db, tsToISO } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { Property } from '@/types'

// ── GET /api/listings?status=pending&page=1 ────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const page   = parseInt(searchParams.get('page') ?? '1', 10)
  const per    = 20

  let query = db.collection('properties').orderBy('createdAt', 'desc') as
    FirebaseFirestore.Query

  if (status === 'pending')  query = query.where('isVerified', '==', false).where('status', '!=', 'rejected')
  if (status === 'verified') query = query.where('isVerified', '==', true)
  if (status === 'rejected') query = query.where('status', '==', 'rejected')

  const snap  = await query.get()
  const total = snap.docs.length
  const slice = snap.docs.slice((page - 1) * per, page * per)

  const data: Property[] = slice.map(d => ({
    id: d.id,
    ...(d.data() as Omit<Property, 'id'>),
    createdAt: tsToISO(d.data().createdAt),
    updatedAt: tsToISO(d.data().updatedAt),
  }))

  return NextResponse.json({
    data,
    meta: { page, perPage: per, total, totalPages: Math.ceil(total / per) },
  })
}

// ── PATCH /api/listings — verify or reject a single listing ─
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: {
    id: string
    action: 'verify' | 'reject'
    reason?: string
    adminNote?: string
  } = await req.json()

  if (!body.id || !body.action) {
    return NextResponse.json({ error: 'Missing id or action' }, { status: 400 })
  }

  const ref = db.collection('properties').doc(body.id)
  const doc = await ref.get()
  if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.action === 'verify') {
    await ref.update({
      isVerified:  true,
      status:      'vacant',
      updatedAt:   FieldValue.serverTimestamp(),
      adminNote:   body.adminNote ?? null,
    })
    // TODO: send FCM push to landlord here
  } else {
    await ref.update({
      isVerified:       false,
      status:           'rejected',
      rejectionReason:  body.reason ?? 'Does not meet listing standards',
      adminNote:        body.adminNote ?? null,
      updatedAt:        FieldValue.serverTimestamp(),
    })
    // TODO: send FCM push to landlord here
  }

  return NextResponse.json({ ok: true })
}

// ── DELETE /api/listings?id=xxx ────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await db.collection('properties').doc(id).delete()
  return NextResponse.json({ ok: true })
}
