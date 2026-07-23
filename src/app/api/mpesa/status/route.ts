import { NextRequest, NextResponse } from 'next/server'
import { stkQuery }                    from '@/lib/daraja'
import { db, COLLECTIONS, TX_STATUS }  from '@/lib/firebase'
import { FieldValue }                  from 'firebase-admin/firestore'

// GET /api/mpesa/status?checkoutRequestId=xxx
// Used as a fallback when the Firestore stream is unavailable.
// Also called by the admin portal to inspect payment status.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const checkoutRequestId = searchParams.get('checkoutRequestId')
  const transactionId     = searchParams.get('transactionId')

  if (!checkoutRequestId && !transactionId) {
    return NextResponse.json(
      { error: 'Provide checkoutRequestId or transactionId' },
      { status: 400 },
    )
  }

  // ── Look up from Firestore first ───────────────────────
  let txSnap: FirebaseFirestore.QuerySnapshot | FirebaseFirestore.DocumentSnapshot | null = null

  if (transactionId) {
    txSnap = await db.collection(COLLECTIONS.transactions).doc(transactionId).get()
  } else if (checkoutRequestId) {
    const snap = await db
      .collection(COLLECTIONS.transactions)
      .where('checkoutRequestId', '==', checkoutRequestId)
      .limit(1)
      .get()
    txSnap = snap.empty ? null : snap
  }

  const txData = txSnap && 'docs' in txSnap
    ? (txSnap.empty ? null : txSnap.docs[0].data())
    : (txSnap as FirebaseFirestore.DocumentSnapshot)?.data?.()

  // If already completed or failed, return immediately — no need to query Daraja
  if (txData?.status === TX_STATUS.completed || txData?.status === TX_STATUS.failed) {
    return NextResponse.json({
      status:             txData.status,
      mpesaReceiptNumber: txData.mpesaReceiptNumber ?? null,
      resultDesc:         txData.resultDesc ?? null,
      resultCode:         txData.resultCode ?? null,
    })
  }

  // ── Still pending — query Daraja STK Push API ──────────
  if (!checkoutRequestId && !txData?.checkoutRequestId) {
    return NextResponse.json({
      status: txData?.status ?? TX_STATUS.pending,
      resultDesc: 'No checkoutRequestId to query',
    })
  }

  const queryId = checkoutRequestId ?? txData?.checkoutRequestId

  try {
    const result = await stkQuery(queryId)

    if (result.resultCode === 0) {
      // Paid — update Firestore in case callback was missed
      const docRef = txSnap && 'docs' in txSnap
        ? txSnap.docs?.[0]?.ref
        : (txSnap as FirebaseFirestore.DocumentSnapshot)?.ref

      if (docRef && txData?.status !== TX_STATUS.completed) {
        await docRef.update({
          status:      TX_STATUS.completed,
          resultCode:  0,
          resultDesc:  result.resultDesc,
          completedAt: FieldValue.serverTimestamp(),
        })
        console.log(`[Status] Firestore updated via polling for ${queryId}`)
      }

      return NextResponse.json({
        status:     TX_STATUS.completed,
        resultCode: 0,
        resultDesc: result.resultDesc,
      })
    }

    if (result.resultCode === 1032) {
      // User cancelled
      const docRef = txSnap && 'docs' in txSnap
        ? txSnap.docs?.[0]?.ref
        : (txSnap as FirebaseFirestore.DocumentSnapshot)?.ref

      if (docRef) {
        await docRef.update({
          status:      TX_STATUS.failed,
          resultCode:  1032,
          resultDesc:  'Request cancelled by user',
          completedAt: FieldValue.serverTimestamp(),
        })
      }

      return NextResponse.json({
        status:     TX_STATUS.failed,
        resultCode: 1032,
        resultDesc: 'Request cancelled by user',
      })
    }

    // Still processing (e.g. resultCode 1037 = request in progress)
    return NextResponse.json({
      status:     TX_STATUS.processing,
      resultCode: result.resultCode,
      resultDesc: result.resultDesc,
    })

  } catch {
    // Daraja query failed — return current Firestore status
    return NextResponse.json({
      status:     txData?.status ?? TX_STATUS.pending,
      resultDesc: 'Could not query payment status',
    })
  }
}
