import { NextRequest, NextResponse } from 'next/server'
import { stkPush, DarajaError }       from '@/lib/daraja'
import { db, COLLECTIONS, TX_STATUS }  from '@/lib/firebase'
import { corsJson, corsOptions }        from '@/lib/mpesa-cors'
import { FieldValue }                   from 'firebase-admin/firestore'
import { randomUUID }                   from 'crypto'

export async function OPTIONS() {
  return corsOptions()
}

export async function POST(req: NextRequest) {
  try {
    const body: {
      userId:      string
      propertyId:  string
      packageId:   string   // ← Firestore document ID
      type:        string   // ← TransactionType enum name (for validation)
      amount:      number
      phone:       string
      description: string
    } = await req.json()

    const { userId, propertyId, packageId, type, phone, description } = body

    // ── Validate ────────────────────────────────────────────
    if (!userId || !propertyId || !packageId || !type || !phone) {
      return corsJson(
        { error: 'Missing required fields: userId, propertyId, packageId, type, phone' },
        { status: 400 },
      )
    }

    // Read package pricing from Firestore by document ID
    const packageDoc = await db.collection('boost_packages').doc(packageId).get()

    if (!packageDoc.exists) {
      return corsJson(
        { error: `Boost package not found: ${packageId}` },
        { status: 404 },
      )
    }

    const packageData = packageDoc.data()!

    if (!packageData.enabled) {
      return corsJson(
        { error: 'This boost package is currently disabled.' },
        { status: 400 },
      )
    }

    // Optional: validate the client-sent type matches the stored type
    if (packageData.type !== type) {
      return corsJson(
        { error: 'Package type mismatch.' },
        { status: 400 },
      )
    }

    const expectedAmount = Number(packageData.price)

    const phoneRegex = /^254[71]\d{8}$/
    if (!phoneRegex.test(phone)) {
      return corsJson(
        { error: 'Invalid phone number. Use format 2547XXXXXXXX (e.g. 254712345678)' },
        { status: 400 },
      )
    }

    // ── Duplicate guard ─────────────────────────────────────
    const existingSnap = await db
      .collection(COLLECTIONS.transactions)
      .where('userId',     '==', userId)
      .where('propertyId', '==', propertyId)
      .where('type',       '==', type)
      .where('status',     '==', TX_STATUS.pending)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      const existing  = existingSnap.docs[0]
      const data      = existing.data()
      const createdAt = (data.createdAt as FirebaseFirestore.Timestamp).toDate()
      if (Date.now() - createdAt.getTime() < 3 * 60 * 1000) {
        console.log(`[STK] Returning existing pending tx ${existing.id}`)
        return corsJson({
          transactionId:     existing.id,
          merchantRequestId: data.merchantRequestId,
          checkoutRequestId: data.checkoutRequestId,
          message:           'STK push already sent — check your phone',
        })
      }
    }

    // ── Call Daraja ─────────────────────────────────────────
    const accountRef = `RR-${propertyId.slice(0, 6).toUpperCase()}`
    const stkResult  = await stkPush({
      phone,
      amount:      expectedAmount,
      accountRef,
      description: (description ?? `ReadyRentals ${type}`).slice(0, 13),
    })

    // ── Persist pending transaction in Firestore ────────────
    const transactionId = randomUUID()
    await db.collection(COLLECTIONS.transactions).doc(transactionId).set({
      userId,
      propertyId,
      type,                        // ← stores 'boostBronze', etc.
      status:             TX_STATUS.pending,
      amount:             expectedAmount,
      phoneNumber:        phone,
      merchantRequestId:  stkResult.merchantRequestId,
      checkoutRequestId:  stkResult.checkoutRequestId,
      mpesaReceiptNumber: null,
      resultDesc:         null,
      resultCode:         null,
      createdAt:          FieldValue.serverTimestamp(),
      completedAt:        null,
    })

    console.log(`[STK] OK txId=${transactionId} checkoutReqId=${stkResult.checkoutRequestId}`)

    return corsJson({
      transactionId,
      merchantRequestId: stkResult.merchantRequestId,
      checkoutRequestId: stkResult.checkoutRequestId,
      customerMessage:   stkResult.customerMessage,
    })

  } catch (err) {
    if (err instanceof DarajaError) {
      console.error(`[STK] Daraja ${err.code}: ${err.message}`)
      return corsJson(
        { error: _friendlyError(err.code, err.message) },
        { status: 502 },
      )
    }
    console.error('[STK] Unexpected error:', err)
    return corsJson(
      { error: 'Payment service temporarily unavailable. Please try again.' },
      { status: 500 },
    )
  }
}

function _friendlyError(code: string, raw: string): string {
  const map: Record<string, string> = {
    '404.001.03':    'Invalid M-Pesa phone number. Please check and try again.',
    '400.002.02':    'Bad request to M-Pesa. Please try again.',
    '500.001.1001':  'M-Pesa service is temporarily down. Try again in a moment.',
    '1037':          'M-Pesa STK push timed out. Make sure the phone number is correct.',
  }
  return map[code] ?? raw ?? 'Payment initiation failed.'
}