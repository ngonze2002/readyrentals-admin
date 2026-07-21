import type { Metadata } from 'next'
// @ts-ignore: side-effect import for global CSS
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'ReadyRentals Admin',
  description: "Admin portal for ReadyRentals — Kenya's rental marketplace",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
