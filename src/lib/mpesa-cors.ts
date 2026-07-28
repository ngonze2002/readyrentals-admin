import { NextResponse } from 'next/server'

// M-Pesa API routes are called from the Flutter mobile app and from
// Safaricom's servers (callbacks). Neither sends a NextAuth session
// cookie, so we must:
//   1. Exclude them from NextAuth middleware (done in middleware.ts)
//   2. Add CORS headers so Flutter's http client accepts the response

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/** Wrap a NextResponse with CORS headers */
export function withCors(res: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

/** Respond to OPTIONS preflight requests */
export function corsOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/** Quick helper: JSON response with CORS */
export function corsJson(
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  const res = NextResponse.json(body, init)
  return withCors(res)
}