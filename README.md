# ReadyRentals Admin Portal

> **Next.js 14 + Firebase Admin SDK + NextAuth**  
> Secure, server-rendered admin dashboard for the ReadyRentals Kenyan rental marketplace.

---

## Tech Stack

| Layer           | Technology                                |
|-----------------|-------------------------------------------|
| Framework       | Next.js 14 (App Router, Server Components)|
| Auth            | NextAuth.js v4 (Google OAuth + Firebase)  |
| Database        | Firebase Admin SDK → Cloud Firestore      |
| UI              | Tailwind CSS + Lucide icons               |
| Charts          | Recharts                                  |
| Hosting         | Vercel (recommended)                      |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout + SessionProvider
│   ├── page.tsx                # Redirects → /dashboard
│   ├── login/page.tsx          # Login (Google + email)
│   ├── dashboard/
│   │   ├── layout.tsx          # Sidebar + Topbar shell (server-side auth guard)
│   │   └── page.tsx            # Overview stats + quick-action tables
│   ├── verify/page.tsx         # Listing verification queue
│   ├── reports/page.tsx        # Tenant report queue
│   ├── users/page.tsx          # User management
│   ├── listings/page.tsx       # Full listing inventory
│   ├── boosts/page.tsx         # Premium boost tracker
│   ├── analytics/page.tsx      # Charts + metrics
│   ├── settings/page.tsx       # Platform config
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth handler
│       ├── listings/route.ts   # GET / PATCH / DELETE
│       ├── users/route.ts      # GET / PATCH / DELETE
│       ├── reports/route.ts    # GET / PATCH
│       ├── boosts/route.ts     # GET
│       └── analytics/route.ts  # GET
├── components/
│   ├── layout/Sidebar.tsx
│   ├── layout/Topbar.tsx
│   └── ui/index.tsx            # Badge, Btn, Modal, StatCard, Table, Pagination, Tabs, Toast
├── lib/
│   ├── firebase-admin.ts       # Admin SDK singleton
│   ├── firebase-client.ts      # Client SDK (login only)
│   ├── auth-options.ts         # NextAuth config + email whitelist
│   └── utils.ts                # fmtKsh, fmtDate, initials, cn, statusBadge
├── middleware.ts               # Route protection for all non-login pages
└── types/index.ts              # TypeScript interfaces
```

---

## Local Setup

### 1. Install dependencies
```bash
cd readyrentals-admin
npm install
```

### 2. Create `.env.local`
Copy `.env.local.example` → `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

**Firebase Admin SDK values** come from:
- Firebase Console → Project Settings → Service accounts → Generate new private key
- Download the JSON → copy `project_id`, `client_email`, `private_key`

**Firebase Client SDK values** come from:
- Firebase Console → Project Settings → Your apps → Web app → SDK setup

**NextAuth secret** — generate one:
```bash
openssl rand -base64 32
```

**ADMIN_EMAILS** — comma-separated list of Google account emails that should have admin access:
```
ADMIN_EMAILS=you@gmail.com,colleague@gmail.com
```

### 3. Google OAuth (for the Google sign-in button)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Authorised redirect URIs: `http://localhost:3000/api/auth/callback/google`
4. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env.local`

### 4. Run dev server
```bash
npm run dev
# Open http://localhost:3000
```

Sign in with a Google account whose email is in `ADMIN_EMAILS`. Unauthorized accounts are rejected at sign-in.

---

## Deployment to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

In the Vercel dashboard → your project → Settings → Environment Variables, add all the same variables from `.env.local`.

For the production Google OAuth redirect, add:
```
https://your-domain.vercel.app/api/auth/callback/google
```
to your Google OAuth client's authorised redirect URIs.

**Recommended domain:** `admin.readyrentals.co.ke`

---

## Security model

| Layer       | How it works                                                               |
|-------------|----------------------------------------------------------------------------|
| Middleware  | `next-auth/middleware` blocks every route except `/login` and `/api/auth` |
| Sign-in     | `signIn` callback rejects any email not in `ADMIN_EMAILS` env var          |
| API routes  | Every route calls `getServerSession(authOptions)` — returns 401 if missing |
| Firestore   | Firebase Admin SDK runs server-side with full admin privileges              |
| Client SDK  | Only used for email/password sign-in to get a Firebase ID token            |

---

## Firestore collections used

| Collection    | Used for                                          |
|---------------|---------------------------------------------------|
| `properties`  | Listings — verify, reject, delete                 |
| `users`       | Accounts — verify, suspend, delete                |
| `reports`     | Fraud reports — action, dismiss                   |
| `boosts`      | Premium campaigns — read-only in admin            |
| `chats`       | Not accessed by admin portal                      |

---

## Connecting to the Flutter app

Both apps share the same Firebase project. The admin portal uses the **Admin SDK** (bypasses security rules), while the Flutter app uses the **client SDK** (restricted by `firestore.rules`).

Verification flow:
1. Landlord submits listing in Flutter app → `isVerified: false`
2. Admin reviews in this portal → clicks "Verify & publish"
3. API route sets `isVerified: true` → Flutter app sees the badge in real-time via Firestore streams

---

## Environment variables reference

| Variable                              | Required | Description                           |
|---------------------------------------|----------|---------------------------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY`        | ✓        | Firebase client API key               |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`    | ✓        | Firebase auth domain                  |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`     | ✓        | Firebase project ID                   |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✓        | Firebase storage bucket               |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✓   | Firebase messaging sender ID          |
| `NEXT_PUBLIC_FIREBASE_APP_ID`         | ✓        | Firebase app ID                       |
| `FIREBASE_PROJECT_ID`                 | ✓        | Same project ID (server-side)         |
| `FIREBASE_CLIENT_EMAIL`               | ✓        | Service account email                 |
| `FIREBASE_PRIVATE_KEY`                | ✓        | Service account private key           |
| `NEXTAUTH_SECRET`                     | ✓        | Random 32-char secret for JWT signing |
| `NEXTAUTH_URL`                        | ✓        | Base URL (`http://localhost:3000`)    |
| `ADMIN_EMAILS`                        | ✓        | Comma-separated allowed admin emails  |
| `GOOGLE_CLIENT_ID`                    | Optional | For Google OAuth button               |
| `GOOGLE_CLIENT_SECRET`                | Optional | For Google OAuth button               |
