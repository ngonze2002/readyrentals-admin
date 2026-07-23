import { NextRequest, NextResponse } from 'next/server'
import { db, COLLECTIONS }           from '@/lib/firebase'

// GET /api/mpesa/transactions?userId=xxx&status=completed&limit=20
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId  = searchParams.get('userId')
  const status  = searchParams.get('status')
  const limit   = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

  let query = db.collection(COLLECTIONS.transactions)
    .orderBy('createdAt', 'desc')
    .limit(limit) as FirebaseFirestore.Query

  if (userId) query = query.where('userId', '==', userId)
  if (status) query = query.where('status', '==', status)

  const snap = await query.get()

  const data = snap.docs.map(d => {
    const tx = d.data()
    return {
      id:                d.id,
      userId:            tx.userId,
      propertyId:        tx.propertyId,
      type:              tx.type,
      status:            tx.status,
      amount:            tx.amount,
      phoneNumber:       tx.phoneNumber,
      mpesaReceiptNumber: tx.mpesaReceiptNumber ?? null,
      resultDesc:        tx.resultDesc ?? null,
      createdAt:         tx.createdAt?.toDate?.()?.toISOString() ?? null,
      completedAt:       tx.completedAt?.toDate?.()?.toISOString() ?? null,
    }
  })

  return NextResponse.json({ data, total: data.length })
}
