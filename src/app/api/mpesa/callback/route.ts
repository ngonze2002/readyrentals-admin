import { NextRequest, NextResponse } from 'next/server'
import { db, COLLECTIONS, TX_STATUS, messaging } from '@/lib/firebase'
import { FieldValue } from 'firebase-admin/firestore'

// Safaricom sends a POST to this URL after the user enters their PIN.
// This endpoint MUST be publicly reachable (no auth header — Safaricom
// doesn't support custom headers on callbacks).
// We verify legitimacy via the CheckoutRequestID matching a known transaction.

interface DarajaCallback {
  Body: {
    stkCallback: {
      MerchantRequestID:  string
      CheckoutRequestID:  string
      ResultCode:         number   // 0 = success
      ResultDesc:         string
      CallbackMetadata?: {
        Item: Array<{
          Name:   string
          Value?: string | number
        }>
      }
    }
  }
}

export async function POST(req: NextRequest) {
  let body: DarajaCallback

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const cb = body?.Body?.stkCallback
  if (!cb) {
    console.warn('[Callback] Missing stkCallback in body')
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  const {
    MerchantRequestID:  merchantRequestId,
    CheckoutRequestID:  checkoutRequestId,
    ResultCode:         resultCode,
    ResultDesc:         resultDesc,
    CallbackMetadata:   metadata,
  } = cb

  console.log(`[Callback] CheckoutRequestID=${checkoutRequestId} ResultCode=${resultCode} Desc="${resultDesc}"`)

  // ── Find the matching transaction ──────────────────────
  const txSnap = await db
    .collection(COLLECTIONS.transactions)
    .where('checkoutRequestId', '==', checkoutRequestId)
    .limit(1)
    .get()

  if (txSnap.empty) {
    // Could be a replay or test ping — log and acknowledge
    console.warn(`[Callback] No transaction found for checkoutRequestId=${checkoutRequestId}`)
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  const txDoc = txSnap.docs[0]
  const txRef = txDoc.ref
  const txData = txDoc.data()

  // Guard against duplicate callbacks
  if (txData.status === TX_STATUS.completed || txData.status === TX_STATUS.failed) {
    console.log(`[Callback] Already processed — skipping (status=${txData.status})`)
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  const isSuccess = resultCode === 0

  // ── Extract metadata (only present on success) ─────────
  let mpesaReceiptNumber: string | null = null
  let transactionDate:    string | null = null
  let phoneNumber:        string | null = null
  let paidAmount:         number | null = null

  if (isSuccess && metadata?.Item) {
    for (const item of metadata.Item) {
      switch (item.Name) {
        case 'MpesaReceiptNumber': mpesaReceiptNumber = String(item.Value ?? ''); break
        case 'TransactionDate':    transactionDate    = String(item.Value ?? ''); break
        case 'PhoneNumber':        phoneNumber        = String(item.Value ?? ''); break
        case 'Amount':             paidAmount         = Number(item.Value ?? 0);  break
      }
    }
  }

  // ── Update Firestore transaction ───────────────────────
  const newStatus = isSuccess ? TX_STATUS.completed : TX_STATUS.failed

  const updatePayload: Record<string, unknown> = {
    status:             newStatus,
    resultCode,
    resultDesc,
    merchantRequestId,
    mpesaReceiptNumber: mpesaReceiptNumber ?? null,
    transactionDate:    transactionDate    ?? null,
    paidAmount:         paidAmount         ?? null,
    completedAt:        FieldValue.serverTimestamp(),
  }

  await txRef.update(updatePayload)
  console.log(`[Callback] Transaction ${txDoc.id} updated → ${newStatus}`)

  // ── On success: activate the boost ────────────────────
  if (isSuccess) {
    await _activateBoost(txData.propertyId, txData.type, txDoc.id)

    // Send FCM push notification to the landlord
    await _notifyLandlord(txData.userId, {
      title: '🎉 Boost activated!',
      body:  `Your listing is now boosted. Receipt: ${mpesaReceiptNumber}`,
    })
  } else {
    // Notify user of failure
    await _notifyLandlord(txData.userId, {
      title: 'Payment not completed',
      body:  resultDesc ?? 'Your M-Pesa payment was not completed.',
    })
  }

  // Safaricom expects this exact response shape
  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}

// ── Activate boost on the property ────────────────────────
async function _activateBoost(
  propertyId: string,
  type:       string,
  txId:       string,
) {
  const daysMap: Record<string, number> = {
    boostBronze: 7,
    boostSilver: 14,
    boostGold:   30,
  }
  const days = daysMap[type] ?? 7
  const until = new Date()
  until.setDate(until.getDate() + days)

  const batch = db.batch()

  // Update property
  const propRef = db.collection(COLLECTIONS.properties).doc(propertyId)
  batch.update(propRef, {
    isBoosted:    true,
    boostedUntil: until.toISOString(),
    updatedAt:    FieldValue.serverTimestamp(),
  })

  // Create boost record
  const boostRef = db.collection(COLLECTIONS.boosts).doc()
  batch.set(boostRef, {
    propertyId,
    transactionId: txId,
    type,
    startDate:  new Date().toISOString(),
    endDate:    until.toISOString(),
    status:     'active',
    createdAt:  FieldValue.serverTimestamp(),
  })

  await batch.commit()
  console.log(`[Callback] Boost activated on property ${propertyId} until ${until.toISOString()}`)
}

// ── Send FCM push to user ──────────────────────────────────
async function _notifyLandlord(
  userId:  string,
  payload: { title: string; body: string },
) {
  try {
    const userDoc = await db.collection(COLLECTIONS.users).doc(userId).get()
    const fcmToken = userDoc.data()?.fcmToken as string | undefined
    if (!fcmToken) return

    await messaging.send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body:  payload.body,
      },
      android: {
        priority: 'high',
        notification: { channelId: 'payments' },
      },
      apns: {
        payload: { aps: { sound: 'default' } },
      },
    })
    console.log(`[FCM] Push sent to user ${userId}`)
  } catch (e) {
    // FCM errors should never break the callback response
    console.warn('[FCM] Failed to send push:', e)
  }
}
