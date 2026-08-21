import { db, tsToISO } from '@/lib/firebase-admin'
import { fmtDate } from '@/lib/utils'
import { FileText } from 'lucide-react'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

interface LegalDoc {
  id: string
  type: string
  title: string
  content: string
  version: string
  isPublished: boolean
  lastUpdated: any
}

async function getPublishedDoc(id: string): Promise<LegalDoc | null> {
  const doc = await db.collection('legal_documents').doc(id).get()
  if (!doc.exists) return null

  const data = doc.data() as Omit<LegalDoc, 'id'>
  // Public route: never expose unpublished/draft documents
  if (!data.isPublished) return null

  return { id: doc.id, ...data }
}

export default async function PublicLegalDocPreviewPage({
  params,
}: {
  params: { id: string }
}) {
  const doc = await getPublishedDoc(params.id)

  if (!doc) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Document card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Brand header strip */}
          <div className="bg-gradient-to-r from-brand to-brand-dark px-8 py-6">
            <div className="flex items-center gap-2 text-white/90 mb-1">
              <FileText className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Ready Rentals</span>
            </div>
            <h1 className="text-2xl font-semibold text-white">{doc.title}</h1>
          </div>

          {/* Metadata bar */}
          <div className="flex items-center justify-between px-8 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
            <span>Version {doc.version}</span>
            <span>Last updated {fmtDate(tsToISO(doc.lastUpdated))}</span>
          </div>

          {/* Document body */}
          <div className="px-8 py-10 sm:px-12">
            <div
              className="prose prose-sm max-w-none
                prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-gray-900
                prose-h1:hidden
                prose-h2:text-base prose-h2:mt-9 prose-h2:mb-3 prose-h2:pb-2
                prose-h2:border-b prose-h2:border-gray-100
                prose-p:text-gray-700 prose-p:leading-relaxed
                prose-li:text-gray-700 prose-li:my-1 prose-li:leading-relaxed
                prose-ul:my-3 prose-ul:space-y-1
                prose-strong:text-gray-900 prose-strong:font-semibold
                prose-em:text-gray-500 prose-em:not-italic prose-em:text-xs prose-em:uppercase prose-em:tracking-wide
                prose-blockquote:border-l-4 prose-blockquote:border-brand
                prose-blockquote:bg-brand-light/40 prose-blockquote:py-3 prose-blockquote:px-5
                prose-blockquote:not-italic prose-blockquote:text-gray-600 prose-blockquote:rounded-r-lg
                prose-hr:border-gray-100 prose-hr:my-8
                prose-a:text-brand prose-a:no-underline hover:prose-a:underline"
            >
              <ReactMarkdown>{doc.content}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} Ready Rentals. All rights reserved.
        </p>
      </div>
    </div>
  )
}
