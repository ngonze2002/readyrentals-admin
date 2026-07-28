import { NextRequest, NextResponse } from 'next/server'
import { stkQuery }                    from '@/lib/daraja'
import { db, COLLECTIONS, TX_STATUS }  from '@/lib/firebase'
import { corsJson, corsOptions }        from '@/lib/mpesa-cors'
import { FieldValue }                   from 'firebase-admin/firestore'

export async function OPTIONS() {
  return corsOptions()
}

// GET /api/mpesa/status?checkoutRequestId=xxx
// GET /api/mpesa/status?transactionId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const checkoutRequestId = searchParams.get('checkoutRequestId')
  const transactionId     = searchParams.get('transactionId')

  if (!checkoutRequestId && !transactionId) {
    return corsJson(
      { error: 'Provide checkoutRequestId or transactionId' },
      { status: 400 },
    )
  }

  // ── Look up Firestore record ────────────────────────────
  let txDocRef: FirebaseFirestore.DocumentReference | null = null
  let txData: FirebaseFirestore.DocumentData | undefined

  if (transactionId) {
    const doc = await db.collection(COLLECTIONS.transactions).doc(transactionId).get()
    if (doc.exists) { txDocRef = doc.ref; txData = doc.data() }
  } else if (checkoutRequestId) {
    const snap = await db
      .collection(COLLECTIONS.transactions)
      .where('checkoutRequestId', '==', checkoutRequestId)
      .limit(1)
      .get()
    if (!snap.empty) { txDocRef = snap.docs[0].ref; txData = snap.docs[0].data() }
  }

  // If already terminal, return immediately — no Daraja call needed
  if (txData?.status === TX_STATUS.completed || txData?.status === TX_STATUS.failed) {
    return corsJson({
      status:             txData.status,
      mpesaReceiptNumber: txData.mpesaReceiptNumber ?? null,
      resultDesc:         txData.resultDesc ?? null,
      resultCode:         txData.resultCode ?? null,
    })
  }

  // ── Query Daraja for live status ────────────────────────
  const queryId = checkoutRequestId ?? txData?.checkoutRequestId
  if (!queryId) {
    return corsJson({ status: txData?.status ?? TX_STATUS.pending })
  }

  try {
    const result = await stkQuery(queryId)

    if (result.resultCode === 0) {
      // Success — heal Firestore if callback was missed
      if (txDocRef && txData?.status !== TX_STATUS.completed) {
        await txDocRef.update({
          status:      TX_STATUS.completed,
          resultCode:  0,
          resultDesc:  result.resultDesc,
          completedAt: FieldValue.serverTimestamp(),
        })
      }
      return corsJson({ status: TX_STATUS.completed, resultCode: 0, resultDesc: result.resultDesc })
    }

    if (result.resultCode === 1032) {
      // User cancelled
      if (txDocRef) {
        await txDocRef.update({
          status:      TX_STATUS.failed,
          resultCode:  1032,
          resultDesc:  'Request cancelled by user',
          completedAt: FieldValue.serverTimestamp(),
        })
      }
      return corsJson({ status: TX_STATUS.failed, resultCode: 1032, resultDesc: 'Cancelled by user' })
    }

    return corsJson({ status: TX_STATUS.processing, resultCode: result.resultCode, resultDesc: result.resultDesc })

  } catch {
    return corsJson({ status: txData?.status ?? TX_STATUS.pending })
  }
}