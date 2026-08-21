import { db } from '@/lib/firebase-admin'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/legal — list all documents
export async function GET() {
  try {
    const snap = await db.collection('legal_documents').orderBy('createdAt', 'desc').get()
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return NextResponse.json(docs)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

// POST /api/legal — create new document
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const ref = db.collection('legal_documents').doc()
    
    await ref.set({
      ...body,
      createdAt: new Date(),
      lastUpdated: new Date(),
    })
    
    return NextResponse.json({ id: ref.id, ...body })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}