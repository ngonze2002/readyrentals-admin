import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db, auth, tsToISO } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { AppUser } from '@/types'

// ── GET /api/users?role=landlord&page=1 ────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const per  = 20

  let query = db.collection('users').orderBy('createdAt', 'desc') as
    FirebaseFirestore.Query

  if (role && role !== 'all') query = query.where('role', '==', role)

  const snap  = await query.get()
  const total = snap.docs.length
  const slice = snap.docs.slice((page - 1) * per, page * per)

  // Fetch listing counts for landlords in parallel
  const data: AppUser[] = await Promise.all(
    slice.map(async d => {
      const u = { uid: d.id, ...d.data() } as AppUser
      u.createdAt = tsToISO(d.data().createdAt)
      if (u.role === 'landlord') {
        const lSnap = await db.collection('properties')
          .where('landlordId', '==', u.uid).count().get()
        u.listingCount = lSnap.data().count
      }
      return u
    }),
  )

  return NextResponse.json({
    data,
    meta: { page, perPage: per, total, totalPages: Math.ceil(total / per) },
  })
}

// ── PATCH /api/users — verify or suspend ──────────────────
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: {
    uid: string
    action: 'verify' | 'suspend' | 'restore'
  } = await req.json()

  if (!body.uid || !body.action) {
    return NextResponse.json({ error: 'Missing uid or action' }, { status: 400 })
  }

  const ref = db.collection('users').doc(body.uid)

  if (body.action === 'verify') {
    await ref.update({ isVerified: true, status: 'active', updatedAt: FieldValue.serverTimestamp() })
  } else if (body.action === 'suspend') {
    await ref.update({ status: 'suspended', updatedAt: FieldValue.serverTimestamp() })
    // Also disable in Firebase Auth
    await auth.updateUser(body.uid, { disabled: true })
  } else if (body.action === 'restore') {
    await ref.update({ status: 'active', updatedAt: FieldValue.serverTimestamp() })
    await auth.updateUser(body.uid, { disabled: false })
  }

  return NextResponse.json({ ok: true })
}

// ── DELETE /api/users?uid=xxx ─────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = new URL(req.url).searchParams.get('uid')
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 })

  // Delete from Firestore + Firebase Auth
  await Promise.all([
    db.collection('users').doc(uid).delete(),
    auth.deleteUser(uid).catch(() => {}),
  ])

  return NextResponse.json({ ok: true })
}
