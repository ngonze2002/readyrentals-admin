'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, Save, Globe, Lock, FileText } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'

interface LegalDocForm {
  type: string
  title: string
  content: string
  version: string
  isPublished: boolean
}

const DOC_TYPES = [
  { value: 'privacy_policy', label: 'Privacy Policy' },
  { value: 'terms_of_service', label: 'Terms of Service' },
  { value: 'refund_policy', label: 'Refund Policy' },
  { value: 'community_guidelines', label: 'Community Guidelines' },
  { value: 'cookie_policy', label: 'Cookie Policy' },
]

export default function LegalDocEditorPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const isNew = params.id === 'new'
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [form, setForm] = useState<LegalDocForm>({
    type: 'privacy_policy',
    title: '',
    content: '',
    version: '1.0',
    isPublished: false,
  })

  useEffect(() => {
    if (isNew) return
    fetch(`/api/legal/${params.id}`)
      .then(r => r.json())
      .then(data => {
        setForm({
          type: data.type || 'privacy_policy',
          title: data.title || '',
          content: data.content || '',
          version: data.version || '1.0',
          isPublished: data.isPublished || false,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id, isNew])

  const handleSave = useCallback(async () => {
    setSaving(true)
    const url = isNew ? '/api/legal' : `/api/legal/${params.id}`
    const method = isNew ? 'POST' : 'PATCH'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          lastUpdated: new Date().toISOString(),
        }),
      })
      if (res.ok) {
        router.push('/legal')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }, [form, isNew, params.id, router])

  if (loading) {
    return (
      <div className="max-w-7xl flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/legal" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isNew ? 'New Legal Document' : 'Edit Document'}
            </h2>
            <p className="text-sm text-gray-500">
              {form.type ? DOC_TYPES.find(t => t.value === form.type)?.label : 'Select document type'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              previewMode 
                ? 'bg-brand text-white' 
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Eye className="w-4 h-4" />
            {previewMode ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim() || !form.content.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Column */}
        <div className={`lg:col-span-2 space-y-4 ${previewMode ? 'hidden lg:block' : ''}`}>
          <div className="rr-card p-5 space-y-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Document Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                {DOC_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Privacy Policy"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>

            {/* Version */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Version</label>
              <input
                type="text"
                value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                placeholder="1.0"
                className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Content (Markdown)</label>
                <span className="text-xs text-gray-400">Supports Markdown formatting</span>
              </div>
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="# Heading&#10;&#10;Your content here...&#10;&#10;- Bullet point&#10;- Another point"
                rows={24}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-y"
              />
            </div>
          </div>
        </div>

        {/* Settings Column */}
        <div className={`space-y-4 ${previewMode ? 'hidden lg:block' : ''}`}>
          <div className="rr-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Settings</h3>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-11 h-6 rounded-full transition-colors ${form.isPublished ? 'bg-brand' : 'bg-gray-200'}`}>
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))}
                  className="sr-only"
                />
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isPublished ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {form.isPublished ? 'Published' : 'Draft'}
                </p>
                <p className="text-xs text-gray-500">
                  {form.isPublished 
                    ? 'Visible to all app users' 
                    : 'Only visible to admins'}
                </p>
              </div>
            </label>
          </div>

          <div className="rr-card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Markdown Tips</h3>
            <div className="space-y-2 text-xs text-gray-600 font-mono">
              <p><span className="text-brand font-semibold"># Heading 1</span></p>
              <p><span className="text-brand font-semibold">## Heading 2</span></p>
              <p><span className="text-brand font-semibold">**bold**</span></p>
              <p><span className="text-brand font-semibold">*italic*</span></p>
              <p><span className="text-brand font-semibold">- bullet</span></p>
              <p><span className="text-brand font-semibold">1. numbered</span></p>
              <p><span className="text-brand font-semibold">[link](url)</span></p>
            </div>
          </div>
        </div>

                {/* Preview Column (full width on mobile when previewing) */}
        <div className={`lg:col-span-3 ${!previewMode ? 'hidden lg:block' : ''}`}>
          <div className="rr-card p-8">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                <FileText className="w-5 h-5 text-brand" />
                <span className="text-sm font-medium text-gray-500">Preview</span>
              </div>
              <div
                className="prose prose-sm max-w-none
                  prose-headings:font-semibold prose-headings:tracking-tight
                  prose-h1:text-2xl prose-h1:mb-1 prose-h1:text-gray-900
                  prose-h2:text-base prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2
                  prose-h2:border-b prose-h2:border-gray-100 prose-h2:text-brand-dark
                  prose-p:text-gray-700 prose-p:leading-relaxed
                  prose-li:text-gray-700 prose-li:my-1
                  prose-ul:my-3 prose-ul:space-y-1
                  prose-strong:text-gray-900 prose-strong:font-semibold
                  prose-em:text-gray-500 prose-em:not-italic prose-em:text-xs prose-em:uppercase prose-em:tracking-wide
                  prose-blockquote:border-l-4 prose-blockquote:border-brand
                  prose-blockquote:bg-brand-light/40 prose-blockquote:py-2 prose-blockquote:px-4
                  prose-blockquote:not-italic prose-blockquote:text-gray-600 prose-blockquote:rounded-r-md
                  prose-hr:border-gray-100 prose-hr:my-8
                  prose-a:text-brand prose-a:no-underline hover:prose-a:underline"
              >
                {form.content ? (
                  <ReactMarkdown>{form.content}</ReactMarkdown>
                ) : (
                  <p className="text-gray-400 italic">Start typing to see preview...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}