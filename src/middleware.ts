import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  },
)

// Protect admin UI and admin API routes.
// PUBLIC (no auth needed):
//   /api/mpesa/*  — called by Flutter app, no session cookie
//   /api/auth/*   — NextAuth internals
//   /login        — sign-in page
export const config = {
  matcher: [
    '/((?!login|api/auth|api/mpesa|_next/static|_next/image|favicon.ico).*)',
  ],
}