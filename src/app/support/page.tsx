'use client'

import { useEffect, useState } from 'react'
import {
  Mail,
  Loader2,
  MessageSquare,
  ExternalLink,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react'
import { Badge, Btn, Modal, Tabs, Empty, Table, useToast, FormRow } from '@/components/ui'
import { fmtDateTime, truncate } from '@/lib/utils'
import type { ContactRequest, ContactRequestStatus } from '@/types'

type Tab = 'new' | 'resolved'

const SUPPORT_EMAIL = 'readyrentals@gmail.com'

function buildMailto(r: ContactRequest) {
  const subject = encodeURIComponent(`Re: ${r.category} — ReadyRentals support`)
  const replyTo = encodeURIComponent(SUPPORT_EMAIL)
  return `mailto:${r.email}?subject=${subject}&Reply-To=${replyTo}`
}

export default function SupportPage() {
  const [tab,        setTab]        = useState<Tab>('new')
  const [items,      setItems]      = useState<ContactRequest[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selected,   setSelected]   = useState<ContactRequest | null>(null)
  const [modal,      setModal]      = useState<'detail' | 'resolve' | null>(null)
  const [note,       setNote]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { push, ToastContainer } = useToast()

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    // The "new" tab shows both never-opened ('new') and opened-but-unresolved
    // ('read') requests — only 'resolved' is excluded.
    const statuses: ContactRequestStatus[] = tab === 'new' ? ['new', 'read'] : ['resolved']

    Promise.all(
      statuses.map((status) =>
        fetch(`/api/contact-requests?status=${status}`, { signal: controller.signal })
          .then(async (res) => {
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            return json.data as ContactRequest[]
          })
      )
    )
      .then((results) => {
        const merged = results.flat().sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setItems(merged)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          push(e.message || 'Failed to load requests', 'error')
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [tab, refreshKey])

  const reload = () => setRefreshKey((k) => k + 1)

  const openDetail = async (r: ContactRequest) => {
    setSelected(r)
    setModal('detail')

    if (r.status === 'new') {
      try {
        await fetch('/api/contact-requests', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: r.id, action: 'markRead' }),
        })
        setItems((prev) => prev.map((i) => (i.id === r.id ? { ...i, status: 'read' } : i)))
      } catch {
        // non-fatal — the request just stays marked "new"
      }
    }
  }

  const openResolve = (r: ContactRequest) => {
    setSelected(r)
    setNote('')
    setModal('resolve')
  }

  const handleResolve = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/contact-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, action: 'resolve', adminNote: note || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      push('Marked as resolved', 'success')
      setModal(null)
      setSelected(null)
      setNote('')
      reload()
    } catch (e: any) {
      push(e.message || 'Something went wrong', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReopen = async (r: ContactRequest) => {
    try {
      const res = await fetch('/api/contact-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, action: 'reopen' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      push('Request reopened', 'success')
      setModal(null)
      reload()
    } catch (e: any) {
      push(e.message || 'Something went wrong', 'error')
    }
  }

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Contact requests</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Messages submitted through the "Contact us" form in the app.
          </p>
        </div>
        <div className="text-xs text-gray-400">
          {items.length} {tab === 'new' ? 'open' : 'resolved'} request{items.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Tabs */}
      <div className="rr-card">
        <Tabs
          options={[
            { label: 'New',      value: 'new'      as Tab, count: tab === 'new' ? items.length : undefined },
            { label: 'Resolved', value: 'resolved' as Tab },
          ]}
          value={tab}
          onChange={v => setTab(v)}
        />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
          </div>
        ) : items.length === 0 ? (
          <Empty
            icon={<Mail className="w-7 h-7" />}
            title={`No ${tab === 'new' ? 'open' : 'resolved'} requests`}
            message={tab === 'new' ? 'Nothing waiting on you right now.' : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <th>From</th>
                  <th>Topic</th>
                  <th>Message</th>
                  <th>Received</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} className="group">
                    <td>
                      <div className="max-w-[160px]">
                        <p className="font-medium text-gray-900 truncate">{r.name}</p>
                        <p className="text-xs text-gray-400 truncate">{r.email}</p>
                      </div>
                    </td>
                    <td>
                      <Badge status="neutral">{r.category}</Badge>
                    </td>
                    <td>
                      <p className="text-gray-600 max-w-[260px] truncate" title={r.message}>
                        {truncate(r.message, 70)}
                      </p>
                    </td>
                    <td className="text-gray-500 whitespace-nowrap text-sm">
                      {fmtDateTime(r.createdAt)}
                    </td>
                    <td>
                      <Badge status={r.status === 'new' ? 'warning' : r.status === 'read' ? 'pending' : 'success'}>
                        {r.status === 'new' ? 'New' : r.status === 'read' ? 'Read' : 'Resolved'}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <Btn size="sm" variant="ghost" title="View" onClick={() => openDetail(r)}>
                          <MessageSquare className="w-4 h-4" />
                        </Btn>
                        <a
                          href={buildMailto(r)}
                          className="inline-flex"
                          title="Reply by email"
                        >
                          <Btn size="sm" variant="ghost">
                            <ExternalLink className="w-4 h-4" />
                          </Btn>
                        </a>
                        {r.status !== 'resolved' ? (
                          <Btn size="sm" variant="outline" onClick={() => openResolve(r)}>
                            Resolve
                          </Btn>
                        ) : (
                          <Btn size="sm" variant="ghost" onClick={() => handleReopen(r)}>
                            <RotateCcw className="w-4 h-4" />
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <Modal
        open={modal === 'detail' && !!selected}
        onClose={() => setModal(null)}
        title="Message details"
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Close</Btn>
            {selected && selected.status !== 'resolved' && (
              <Btn variant="primary" onClick={() => { setNote(''); setModal('resolve') }}>
                Mark resolved
              </Btn>
            )}
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400 mb-0.5">From</p>
                <p className="font-medium text-gray-800">{selected.name}</p>
                <p className="text-xs text-gray-500">{selected.email}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Received</p>
                <p className="font-medium text-gray-800">{fmtDateTime(selected.createdAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Topic</p>
              <Badge status="neutral">{selected.category}</Badge>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Message</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.message}</p>
            </div>

            {selected.adminNote && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Admin note</p>
                <p className="text-sm text-gray-600 italic">{selected.adminNote}</p>
              </div>
            )}

            <a
              href={buildMailto(selected)}
              className="inline-flex items-center text-sm text-brand hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Reply by email
            </a>
          </div>
        )}
      </Modal>

      {/* ── Resolve Modal ── */}
      <Modal
        open={modal === 'resolve' && !!selected}
        onClose={() => setModal(null)}
        title="Mark as resolved"
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="primary" loading={submitting} onClick={handleResolve}>
              <CheckCircle2 className="w-4 h-4" />
              Mark resolved
            </Btn>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{selected.category}</p>
            </div>
            <FormRow label="Resolution note (optional, internal)">
              <textarea
                className="rr-textarea"
                rows={3}
                placeholder="e.g. Replied by email, issue resolved"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </FormRow>
          </div>
        )}
      </Modal>

      <ToastContainer />
    </div>
  )
}
