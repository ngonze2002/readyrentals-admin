import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore }                  from 'firebase-admin/firestore'
import { getMessaging }                  from 'firebase-admin/messaging'

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  })
}

export const db        = getFirestore()
export const messaging = getMessaging()

// ── Firestore collection names ─────────────────────────────
export const COLLECTIONS = {
  transactions: 'mpesa_transactions',
  properties:   'properties',
  users:        'users',
  boosts:       'boosts',
} as const

// ── Transaction status values ──────────────────────────────
export const TX_STATUS = {
  pending:    'pending',
  processing: 'processing',
  completed:  'completed',
  failed:     'failed',
  timedOut:   'timedOut',
} as const

export type TxStatus = typeof TX_STATUS[keyof typeof TX_STATUS]
