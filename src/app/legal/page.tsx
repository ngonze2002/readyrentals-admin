import { db, tsToISO } from '@/lib/firebase-admin'
import { fmtDate } from '@/lib/utils'
import { FileText, Plus, Eye, Pencil, Globe, Lock } from 'lucide-react'
import { Badge } from '@/components/ui'
import Link from 'next/link'

interface LegalDoc {
  id: string
  type: string
  title: string
  version: string
  isPublished: boolean
  lastUpdated: any
  createdAt: any
}

async function getLegalDocs() {
  const snap = await db.collection('legal_documents').orderBy('createdAt', 'desc').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LegalDoc))
}

export default async function LegalDocsPage() {
  const docs = await getLegalDocs()

  const typeLabels: Record<string, string> = {
    privacy_policy: 'Privacy Policy',
    terms_of_service: 'Terms of Service',
    refund_policy: 'Refund Policy',
    community_guidelines: 'Community Guidelines',
    cookie_policy: 'Cookie Policy',
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Legal Documents</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage privacy policy, terms, and other legal pages visible in the app.
          </p>
        </div>
        <Link
          href="/legal/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Document
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {docs.map((doc) => (
          <div key={doc.id} className="rr-card p-5 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center">
                <FileText className="w-5 h-5 text-brand" />
              </div>
              <Badge status={doc.isPublished ? 'verified' : 'pending'}>
                {doc.isPublished ? 'Published' : 'Draft'}
              </Badge>
            </div>
            
            <h3 className="font-semibold text-gray-900 mb-1">{doc.title}</h3>
            <p className="text-xs text-gray-500 mb-1">
              {typeLabels[doc.type] || doc.type}
            </p>
            <p className="text-xs text-gray-400 mb-4">
              v{doc.version} · Updated {fmtDate(tsToISO(doc.lastUpdated))}
            </p>

            <div className="mt-auto pt-4 border-t border-gray-100 flex items-center gap-2">
              <Link
                href={`/legal/${doc.id}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-brand hover:bg-brand-light rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </Link>
              {doc.isPublished && (
                <Link
                  href={`/legal/${doc.id}/preview`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </Link>
              )}
            </div>
          </div>
        ))}

        {docs.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-500 font-medium">No legal documents yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first document to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}