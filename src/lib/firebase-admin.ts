import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'
import { getAuth, Auth } from 'firebase-admin/auth'
import { getStorage, Storage } from 'firebase-admin/storage'

// Singleton — Next.js hot-reload can call this multiple times
let app: App
let db: Firestore
let auth: Auth
let storage: Storage

function initAdmin() {
  if (getApps().length > 0) {
    app = getApps()[0]
  } else {
    console.log("PROJECT:", process.env.FIREBASE_PROJECT_ID);
    console.log("EMAIL:", process.env.FIREBASE_CLIENT_EMAIL);
    console.log("KEY EXISTS:", !!process.env.FIREBASE_PRIVATE_KEY);
    app = initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        // Replace \n escape in env value
        privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
      storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
    })
  }

  db      = getFirestore(app)
  auth    = getAuth(app)
  storage = getStorage(app)
}

initAdmin()

export { db, auth, storage }

// ── Helpers ────────────────────────────────────────────────

/** Convert Firestore Timestamp → ISO string safely */
export function tsToISO(value: FirebaseFirestore.Timestamp | string | undefined): string {
  if (!value) return new Date().toISOString()
  if (typeof value === 'string') return value
  return value.toDate().toISOString()
}

/** Check whether caller's email is in the ADMIN_EMAILS env list */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const allowed = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase())
  return allowed.includes(email.toLowerCase())
}
