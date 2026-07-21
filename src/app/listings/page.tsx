'use client'
import { useCallback, useEffect, useState } from 'react'
import { Building2, Trash2, BadgeCheck, Loader2 } from 'lucide-react'
import { Badge, Btn, Modal, Tabs, Empty, Table, Pagination, useToast } from '@/components/ui'
import { fmtDate, fmtKsh, truncate } from '@/lib/utils'
import type { Property, PaginationMeta } from '@/types'

type Tab = 'all' | 'pending' | 'verified' | 'rejected'

export default function ListingsPage() {
  const [tab,        setTab]        = useState<Tab>('all')
  const [items,      setItems]      = useState<Property[]>([])
  const [meta,       setMeta]       = useState<PaginationMeta | null>(null)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<Property | null>(null)
  const [modal,      setModal]      = useState<'delete' | 'verify' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { push, ToastContainer } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/listings?status=${tab}&page=${page}`)
      const json = await res.json()
      setItems(json.data ?? [])
      setMeta(json.meta ?? null)
    } finally { setLoading(false) }
  }, [tab, page])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!selected) return
    setSubmitting(true)
    await fetch(`/api/listings?id=${selected.id}`, { method: 'DELETE' })
    setSubmitting(false)
    setModal(null)
    push('Listing removed from platform', 'error')
    load()
  }

  const handleVerify = async () => {
    if (!selected) return
    setSubmitting(true)
    await fetch('/api/listings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, action: 'verify' }),
    })
    setSubmitting(false)
    setModal(null)
    push('Listing verified and published')
    load()
  }

  return (
    <div className="max-w-7xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">All listings</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Full inventory of every property on the platform.
        </p>
      </div>

      <div className="rr-card">
        <Tabs
          options={[
            { label: 'All',      value: 'all'      as Tab, count: tab === 'all'      ? meta?.total : undefined },
            { label: 'Pending',  value: 'pending'  as Tab },
            { label: 'Verified', value: 'verified' as Tab },
            { label: 'Rejected', value: 'rejected' as Tab },
          ]}
          value={tab}
          onChange={v => { setTab(v); setPage(1) }}
        />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
          </div>
        ) : items.length === 0 ? (
          <Empty icon={<Building2 className="w-7 h-7" />} title="No listings found" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Listing</th>
                <th>Landlord</th>
                <th>Type</th>
                <th>Rent</th>
                <th>Location</th>
                <th>Views</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <div className="w-8 h-8 rounded-lg bg-brand-light flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-brand" />
                      </div>
                      <span className="font-medium text-gray-900 truncate max-w-[140px]">
                        {p.title}
                      </span>
                    </div>
                  </td>
                  <td className="text-gray-500 whitespace-nowrap">{p.landlordName}</td>
                  <td className="text-gray-500 whitespace-nowrap">{p.propertyType}</td>
                  <td className="font-medium text-gray-900 whitespace-nowrap">{fmtKsh(p.rent)}</td>
                  <td className="text-gray-500">{p.estate}, {p.county}</td>
                  <td className="text-center text-gray-500">{p.viewCount}</td>
                  <td className="text-gray-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                  <td>
                    <Badge status={p.isVerified ? 'verified' : p.status === 'rejected' ? 'rejected' : 'pending'}>
                      {p.isVerified ? 'Verified' : p.status === 'rejected' ? 'Rejected' : 'Pending'}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {!p.isVerified && p.status !== 'rejected' && (
                        <Btn
                          size="sm"
                          variant="success"
                          onClick={() => { setSelected(p); setModal('verify') }}
                        >
                          Verify
                        </Btn>
                      )}
                      <Btn
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                        onClick={() => { setSelected(p); setModal('delete') }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {meta && <Pagination meta={meta} onPage={setPage} />}
      </div>

      {/* Verify modal */}
      <Modal
        open={modal === 'verify'}
        onClose={() => setModal(null)}
        title="Verify listing"
        size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="success" loading={submitting} onClick={handleVerify}
              icon={<BadgeCheck className="w-4 h-4" />}>
              Verify & publish
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Verify <strong>"{selected?.title}"</strong>? This will add a verified badge and make it
          visible to tenants.
        </p>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={modal === 'delete'}
        onClose={() => setModal(null)}
        title="Remove listing"
        size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="danger" loading={submitting} onClick={handleDelete}
              icon={<Trash2 className="w-4 h-4" />}>
              Remove permanently
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Remove <strong>"{selected?.title}"</strong> from the platform? This cannot be undone and
          the landlord will be notified.
        </p>
      </Modal>

      <ToastContainer />
    </div>
  )
}
