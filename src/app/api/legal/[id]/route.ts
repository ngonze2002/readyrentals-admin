import { db } from '@/lib/firebase-admin'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/legal/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doc = await db.collection('legal_documents').doc(params.id).get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ id: doc.id, ...doc.data() })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
  }
}

// PATCH /api/legal/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    await db.collection('legal_documents').doc(params.id).update({
      ...body,
      lastUpdated: new Date(),
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

// DELETE /api/legal/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.collection('legal_documents').doc(params.id).delete()
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}