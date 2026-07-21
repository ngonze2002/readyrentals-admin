'use client'
import { useEffect, useState, useCallback } from 'react'
import { BadgeCheck, Building2, Phone, MapPin, Image, Eye, Loader2, FileText } from 'lucide-react'
import {
  Badge, Btn, Modal, Tabs, Empty, Pagination, useToast, FormRow,
} from '@/components/ui'
import { fmtDate, fmtKsh, truncate } from '@/lib/utils'
import type { Property, PaginationMeta } from '@/types'

type Tab = 'pending' | 'verified' | 'rejected'

export default function VerifyPage() {
  const [tab,        setTab]        = useState<Tab>('pending')
  const [items,      setItems]      = useState<Property[]>([])
  const [meta,       setMeta]       = useState<PaginationMeta | null>(null)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<Property | null>(null)
  const [modal,      setModal]      = useState<'verify' | 'reject' | 'note' | null>(null)
  const [reason,     setReason]     = useState('')
  const [note,       setNote]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { push, ToastContainer } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/listings?status=${tab}&page=${page}`)
      const json = await res.json()
      setItems(json.data ?? [])
      setMeta(json.meta ?? null)
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => { load() }, [load])

  const handleAction = async (action: 'verify' | 'reject') => {
    if (!selected) return
    setSubmitting(true)
    try {
      await fetch('/api/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id, action,
          reason: action === 'reject' ? reason : undefined,
          adminNote: note || undefined,
        }),
      })
      push(action === 'verify'
        ? `✓ "${selected.title}" verified and published`
        : `"${selected.title}" rejected — landlord notified`,
        action === 'verify' ? 'success' : 'error',
      )
      setModal(null)
      setSelected(null)
      setReason('')
      setNote('')
      load()
    } catch {
      push('Something went wrong. Try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Verify listings</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Review and approve or reject landlord property submissions.
        </p>
      </div>

      <div className="rr-card">
        <Tabs
          options={[
            { label: 'Pending',  value: 'pending' as Tab,  count: tab === 'pending'  ? meta?.total : undefined },
            { label: 'Verified', value: 'verified' as Tab },
            { label: 'Rejected', value: 'rejected' as Tab },
          ]}
          value={tab}
          onChange={v => { setTab(v); setPage(1) }}
        />

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-brand" />
            </div>
          ) : items.length === 0 ? (
            <Empty
              icon={<BadgeCheck className="w-7 h-7" />}
              title={`No ${tab} listings`}
              message={tab === 'pending' ? 'All caught up! No listings waiting for review.' : undefined}
            />
          ) : (
            items.map(p => (
              <ListingCard
                key={p.id}
                property={p}
                onVerify={() => { setSelected(p); setModal('verify') }}
                onReject={() => { setSelected(p); setModal('reject') }}
                onNote={()   => { setSelected(p); setModal('note')   }}
              />
            ))
          )}
        </div>

        {meta && <Pagination meta={meta} onPage={setPage} />}
      </div>

      {/* Verify modal */}
      <Modal
        open={modal === 'verify'}
        onClose={() => setModal(null)}
        title="Confirm verification"
        size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="success" loading={submitting} onClick={() => handleAction('verify')}>
              <BadgeCheck className="w-4 h-4" />
              Verify & publish
            </Btn>
          </>
        }
      >
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <BadgeCheck className="w-7 h-7 text-green-700" />
          </div>
          <p className="font-semibold text-gray-900 mb-2">Verify "{selected?.title}"?</p>
          <p className="text-sm text-gray-500">
            This will mark it as verified, show a badge to tenants, and notify the landlord.
          </p>
          <div className="mt-4 text-left">
            <FormRow label="Optional note to team (internal)">
              <textarea
                className="rr-textarea"
                rows={2}
                placeholder="e.g. Inspected photos — looks legitimate"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </FormRow>
          </div>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal
        open={modal === 'reject'}
        onClose={() => setModal(null)}
        title="Reject listing"
        size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="danger" loading={submitting} disabled={!reason}
              onClick={() => handleAction('reject')}>
              Reject & notify landlord
            </Btn>
          </>
        }
      >
        <FormRow label="Reason for rejection">
          <select
            className="rr-select"
            value={reason}
            onChange={e => setReason(e.target.value)}
          >
            <option value="">Select a reason…</option>
            <option>Insufficient photos — please upload at least 3 clear photos</option>
            <option>Location cannot be verified — please pin exact address on map</option>
            <option>Duplicate listing — this property is already listed</option>
            <option>Suspicious or misleading content — description does not match photos</option>
            <option>Invalid landlord contact — phone number is unreachable</option>
            <option>Missing pricing — rent or deposit not specified</option>
          </select>
        </FormRow>
        <FormRow label="Additional note to landlord (optional)">
          <textarea
            className="rr-textarea"
            rows={3}
            placeholder="Explain what needs to be fixed before resubmitting…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </FormRow>
      </Modal>

      {/* Add note modal */}
      <Modal
        open={modal === 'note'}
        onClose={() => setModal(null)}
        title="Add internal note"
        size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="primary" loading={submitting}
              onClick={async () => {
                // Save note without changing status
                setSubmitting(true)
                await fetch('/api/listings', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: selected?.id, action: 'note', adminNote: note }),
                })
                setSubmitting(false)
                setModal(null)
                push('Note saved')
              }}>
              Save note
            </Btn>
          </>
        }
      >
        <FormRow label="Internal note (not visible to landlord)">
          <textarea
            className="rr-textarea"
            rows={4}
            placeholder="e.g. Need to call landlord to confirm address…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </FormRow>
      </Modal>

      <ToastContainer />
    </div>
  )
}

// ── Listing review card ────────────────────────────────────
function ListingCard({
  property: p, onVerify, onReject, onNote,
}: {
  property: Property
  onVerify: () => void
  onReject: () => void
  onNote: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white">
        <div className="w-11 h-11 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{p.title}</p>
            <Badge status={p.isVerified ? 'verified' : p.status === 'rejected' ? 'rejected' : 'pending'}>
              {p.isVerified ? 'Verified' : p.status === 'rejected' ? 'Rejected' : 'Pending'}
            </Badge>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {p.landlordName} · Submitted {fmtDate(p.createdAt)} · ID: {p.id.slice(0, 8)}
          </p>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-brand font-medium hover:underline shrink-0"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Detail grid */}
      {expanded && (
        <div className="px-4 pb-4 bg-white">
          <p className="text-sm text-gray-600 leading-relaxed mb-3 italic">"{p.description}"</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
            {[
              { icon: <span className="text-green-700 font-semibold text-sm">{fmtKsh(p.rent)}/mo</span>, label: 'Rent' },
              { icon: <span className="text-sm text-gray-700">{p.propertyType}</span>,   label: 'Type' },
              { icon: <span className="text-sm text-gray-700">{p.estate}, {p.county}</span>, label: 'Location' },
              { icon: <span className="text-sm text-gray-700">{p.landlordPhone}</span>, label: 'Phone' },
              { icon: <span className="text-sm text-gray-700">{p.imageUrls?.length ?? 0} photo(s)</span>, label: 'Photos' },
              { icon: <span className="text-sm text-gray-700">{p.viewCount}</span>,     label: 'Views' },
            ].map((item, i) => (
              <div key={i} className="bg-surface-0 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
                {item.icon}
              </div>
            ))}
          </div>
          {p.amenities?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {p.amenities.map(a => (
                <span key={a} className="text-xs bg-brand-light text-brand px-2 py-0.5 rounded-full">{a}</span>
              ))}
            </div>
          )}
          {p.adminNote && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3 text-xs text-amber-700">
              <strong>Admin note:</strong> {p.adminNote}
            </div>
          )}
          {p.rejectionReason && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3 text-xs text-red-700">
              <strong>Rejection reason:</strong> {p.rejectionReason}
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-0 border-t border-gray-100">
        <Btn size="sm" variant="ghost" icon={<FileText className="w-3.5 h-3.5" />} onClick={onNote}>
          Note
        </Btn>
        <div className="ml-auto flex gap-2">
          {!p.isVerified && p.status !== 'rejected' && (
            <Btn size="sm" variant="danger" onClick={onReject}>Reject</Btn>
          )}
          {p.status === 'rejected' && (
            <Btn size="sm" variant="success" onClick={onVerify}>Re-verify</Btn>
          )}
          {!p.isVerified && p.status !== 'rejected' && (
            <Btn size="sm" variant="success" icon={<BadgeCheck className="w-3.5 h-3.5" />} onClick={onVerify}>
              Verify & publish
            </Btn>
          )}
          {p.isVerified && (
            <Btn size="sm" variant="danger" onClick={onReject}>Revoke verification</Btn>
          )}
        </div>
      </div>
    </div>
  )
}
