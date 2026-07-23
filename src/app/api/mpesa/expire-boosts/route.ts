import { NextRequest, NextResponse } from 'next/server'
import { db, COLLECTIONS }           from '@/lib/firebase'
import { FieldValue }                 from 'firebase-admin/firestore'

// GET /api/mpesa/expire-boosts
// Called by Vercel Cron daily at midnight Nairobi time (UTC+3 = 21:00 UTC).
// Finds all properties whose boostedUntil is in the past and resets them.

export async function GET(req: NextRequest) {
  // Verify cron secret — Vercel passes this automatically
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  // Find all boosted properties whose boost has expired
  const expiredProps = await db
    .collection(COLLECTIONS.properties)
    .where('isBoosted',    '==', true)
    .where('boostedUntil', '<=', now)
    .get()

  if (expiredProps.empty) {
    console.log('[Cron] No expired boosts found')
    return NextResponse.json({ expired: 0 })
  }

  const batch = db.batch()

  // Reset each expired property
  for (const doc of expiredProps.docs) {
    batch.update(doc.ref, {
      isBoosted:    false,
      boostedUntil: null,
      updatedAt:    FieldValue.serverTimestamp(),
    })
  }

  // Find matching active boost records and mark them expired
  const boostSnap = await db
    .collection(COLLECTIONS.boosts)
    .where('status',  '==', 'active')
    .where('endDate', '<=', now)
    .get()

  for (const doc of boostSnap.docs) {
    batch.update(doc.ref, { status: 'expired' })
  }

  await batch.commit()

  const count = expiredProps.docs.length
  console.log(`[Cron] Expired ${count} boost(s)`)

  return NextResponse.json({ expired: count })
}
