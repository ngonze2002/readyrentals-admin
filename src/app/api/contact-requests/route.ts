import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db, tsToISO } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

/* ─────────────────────────────────────────────────────────
   GET  /api/contact-requests?status=new|read|resolved
   ───────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'new'

  try {
    const snap = await db
      .collection('contact_requests')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .get()

    const data = snap.docs.map((d) => {
      const doc = d.data() as any
      return {
        id: d.id,
        ...doc,
        createdAt: tsToISO(doc.createdAt),
        resolvedAt: doc.resolvedAt ? tsToISO(doc.resolvedAt) : undefined,
      }
    })

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('GET /api/contact-requests error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/* ─────────────────────────────────────────────────────────
   PATCH  /api/contact-requests
   Body: {
     id: string
     action: 'markRead' | 'resolve' | 'reopen'
     adminNote?: string
   }
   ───────────────────────────────────────────────────────── */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminUid = (session.user as any)?.uid ?? (session.user as any)?.id ?? 'unknown'

  const body: { id: string; action: 'markRead' | 'resolve' | 'reopen'; adminNote?: string } =
    await req.json()
  const { id, action, adminNote } = body

  try {
    const ref = db.collection('contact_requests').doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const now = FieldValue.serverTimestamp()

    if (action === 'markRead') {
      await ref.update({ status: 'read', updatedAt: now })
    } else if (action === 'resolve') {
      await ref.update({
        status: 'resolved',
        adminNote: adminNote ?? null,
        resolvedBy: adminUid,
        resolvedAt: now,
        updatedAt: now,
      })
    } else if (action === 'reopen') {
      await ref.update({
        status: 'new',
        resolvedBy: FieldValue.delete(),
        resolvedAt: FieldValue.delete(),
        updatedAt: now,
      })
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, id, action })
  } catch (err: any) {
    console.error('PATCH /api/contact-requests error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}