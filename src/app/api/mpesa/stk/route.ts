import { NextRequest, NextResponse } from 'next/server'
import { stkPush, DarajaError }      from '@/lib/daraja'
import { db, COLLECTIONS, TX_STATUS } from '@/lib/firebase'
import { FieldValue }                  from 'firebase-admin/firestore'
import { randomUUID }                  from 'crypto'

// Valid transaction types and their amounts (KSh)
const PACKAGE_AMOUNTS: Record<string, number> = {
  boostBronze: 500,
  boostSilver: 800,
  boostGold:   1200,
}

export async function POST(req: NextRequest) {
  try {
    const body: {
      userId:      string
      propertyId:  string
      type:        string
      amount:      number
      phone:       string
      description: string
    } = await req.json()

    // ── Validate inputs ──────────────────────────────────
    const { userId, propertyId, type, phone, description } = body

    if (!userId || !propertyId || !type || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, propertyId, type, phone' },
        { status: 400 },
      )
    }

    // Verify amount matches package — don't trust client-sent amount
    const expectedAmount = PACKAGE_AMOUNTS[type]
    if (!expectedAmount) {
      return NextResponse.json(
        { error: `Invalid transaction type: ${type}` },
        { status: 400 },
      )
    }

    // Validate phone format: must be 2547XXXXXXXX or 2541XXXXXXXX
    const phoneRegex = /^254[71]\d{8}$/
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number. Use format 2547XXXXXXXX' },
        { status: 400 },
      )
    }

    // ── Check for duplicate pending transaction ──────────
    // Prevent double-charging if user taps button twice
    const existingSnap = await db
      .collection(COLLECTIONS.transactions)
      .where('userId',     '==', userId)
      .where('propertyId', '==', propertyId)
      .where('type',       '==', type)
      .where('status',     '==', TX_STATUS.pending)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0]
      const data     = existing.data()
      // If within 3 minutes, return the existing transaction
      const createdAt = (data.createdAt as FirebaseFirestore.Timestamp).toDate()
      if (Date.now() - createdAt.getTime() < 3 * 60 * 1000) {
        return NextResponse.json({
          transactionId:     existing.id,
          merchantRequestId: data.merchantRequestId,
          checkoutRequestId: data.checkoutRequestId,
          message:           'Existing pending payment found — please check your phone',
        })
      }
    }

    // ── Call Daraja STK Push ─────────────────────────────
    const accountRef = `RR-${propertyId.slice(0, 6).toUpperCase()}`
    const stkResult  = await stkPush({
      phone,
      amount:      expectedAmount,
      accountRef,
      description: description ?? `ReadyRentals ${type}`,
    })

    // ── Save pending transaction to Firestore ────────────
    const transactionId = randomUUID()
    await db.collection(COLLECTIONS.transactions).doc(transactionId).set({
      userId,
      propertyId,
      type,
      status:            TX_STATUS.pending,
      amount:            expectedAmount,
      phoneNumber:       phone,
      merchantRequestId: stkResult.merchantRequestId,
      checkoutRequestId: stkResult.checkoutRequestId,
      mpesaReceiptNumber: null,
      resultDesc:        null,
      resultCode:        null,
      createdAt:         FieldValue.serverTimestamp(),
      completedAt:       null,
    })

    console.log(`[STK Push] OK — txId=${transactionId} checkoutReqId=${stkResult.checkoutRequestId}`)

    return NextResponse.json({
      transactionId:     transactionId,
      merchantRequestId: stkResult.merchantRequestId,
      checkoutRequestId: stkResult.checkoutRequestId,
      customerMessage:   stkResult.customerMessage,
    })

  } catch (err) {
    if (err instanceof DarajaError) {
      console.error(`[STK Push] Daraja error ${err.code}: ${err.message}`)
      return NextResponse.json(
        { error: _friendlyDarajaError(err.code, err.message) },
        { status: 502 },
      )
    }

    console.error('[STK Push] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Payment service temporarily unavailable. Please try again.' },
      { status: 500 },
    )
  }
}

// ── Human-friendly Daraja error messages ──────────────────
function _friendlyDarajaError(code: string, raw: string): string {
  const map: Record<string, string> = {
    '404.001.03': 'Invalid phone number. Please check and try again.',
    '400.002.02': 'Bad request to payment service.',
    '500.001.1001': 'M-Pesa service is temporarily down. Please try again shortly.',
  }
  return map[code] ?? raw ?? 'Payment initiation failed.'
}
