import type { NextAuthOptions, Session, User } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { auth as adminAuth, isAdminEmail } from './firebase-admin'

export const authOptions: NextAuthOptions = {
  debug: true,

  logger: {
    error(code, metadata) {
      console.error("NEXTAUTH ERROR:", code, metadata)
    },
    warn(code) {
      console.warn("NEXTAUTH WARN:", code)
    },
    debug(code, metadata) {
      console.log("NEXTAUTH DEBUG:", code, metadata)
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8-hour sessions

  providers: [
    // ── Google OAuth (primary) ───────────────────────────
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),

    // ── Email / password via Firebase (fallback) ─────────
    CredentialsProvider({
      name: 'Email',
      credentials: {
        idToken: { label: 'Firebase ID Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null
        try {
          const decoded = await adminAuth.verifyIdToken(credentials.idToken)
          if (!isAdminEmail(decoded.email)) return null
          return {
            id:    decoded.uid,
            email: decoded.email ?? '',
            name:  decoded.name  ?? '',
            image: decoded.picture,
          } as User
        } catch {
          return null
        }
      },
    }),
  ],

  callbacks: {
    // Block non-admin emails at sign-in
    async signIn({ user }) {
      return isAdminEmail(user.email)
    },

    async jwt({ token, user }) {
      if (user) token.uid = user.id
      return token
    },

    async session({ session, token }): Promise<Session> {
      if (session.user) {
        (session.user as Session['user'] & { uid: string }).uid =
          token.uid as string
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },
}
