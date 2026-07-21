'use client'
import { useCallback, useEffect, useState } from 'react'
import { Flag, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'
import { Badge, Btn, Modal, Tabs, Empty, Table, useToast, FormRow } from '@/components/ui'
import { fmtDate, truncate } from '@/lib/utils'
import type { Report } from '@/types'

type Tab = 'open' | 'actioned' | 'dismissed'

export default function ReportsPage() {
  const [tab,        setTab]        = useState<Tab>('open')
  const [items,      setItems]      = useState<Report[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<Report | null>(null)
  const [modal,      setModal]      = useState<'review' | null>(null)
  const [action,     setAction]     = useState('remove')
  const [note,       setNote]       = useState('')
  const [removeP,    setRemoveP]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { push, ToastContainer } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/reports?status=${tab}`)
      const json = await res.json()
      setItems(json.data ?? [])
    } finally { setLoading(false) }
  }, [tab])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:             selected.id,
          action:         action === 'dismiss' ? 'dismiss' : 'action',
          adminNote:      note || undefined,
          removeProperty: removeP,
        }),
      })
      push(
        action === 'dismiss'
          ? 'Report dismissed'
          : removeP
            ? 'Report actioned — listing removed'
            : 'Report actioned',
        action === 'dismiss' ? 'success' : 'error',
      )
      setModal(null)
      setSelected(null)
      setNote('')
      setRemoveP(false)
      load()
    } catch {
      push('Something went wrong.', 'error')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Tenant-submitted reports of fake listings, fraud, or policy violations.
        </p>
      </div>

      <div className="rr-card">
        <Tabs
          options={[
            { label: 'Open',      value: 'open'      as Tab, count: tab === 'open' ? items.length : undefined },
            { label: 'Actioned',  value: 'actioned'  as Tab },
            { label: 'Dismissed', value: 'dismissed' as Tab },
          ]}
          value={tab}
          onChange={v => { setTab(v) }}
        />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
          </div>
        ) : items.length === 0 ? (
          <Empty
            icon={<Flag className="w-7 h-7" />}
            title={`No ${tab} reports`}
            message={tab === 'open' ? 'No reports to review right now.' : undefined}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Property</th>
                <th>Reported by</th>
                <th>Reason</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id}>
                  <td>
                    <p className="font-medium text-gray-900 max-w-[160px] truncate">
                      {r.propertyTitle}
                    </p>
                  </td>
                  <td className="text-gray-500">{r.reporterName}</td>
                  <td>
                    <p className="text-gray-600 max-w-[220px] truncate" title={r.reason}>
                      {truncate(r.reason, 55)}
                    </p>
                  </td>
                  <td className="text-gray-500 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                  <td><Badge status={r.status}>{r.status}</Badge></td>
                  <td>
                    {r.status === 'open' && (
                      <div className="flex gap-2">
                        <Btn
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelected(r); setAction('action'); setModal('review') }}
                        >
                          Review
                        </Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSelected(r); setAction('dismiss'); setModal('review') }}
                        >
                          Dismiss
                        </Btn>
                      </div>
                    )}
                    {r.status !== 'open' && r.adminNote && (
                      <span className="text-xs text-gray-400 italic">{truncate(r.adminNote, 40)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {/* Review modal */}
      <Modal
        open={modal === 'review'}
        onClose={() => setModal(null)}
        title={action === 'dismiss' ? 'Dismiss report' : 'Review & action report'}
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn
              variant={action === 'dismiss' ? 'outline' : 'danger'}
              loading={submitting}
              onClick={handleSubmit}
            >
              {action === 'dismiss' ? 'Dismiss report' : 'Apply action'}
            </Btn>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* Report detail */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-sm font-semibold text-red-800">{selected.propertyTitle}</p>
              </div>
              <p className="text-sm text-red-700">{selected.reason}</p>
              {selected.details && (
                <p className="text-xs text-red-600 mt-1 italic">"{selected.details}"</p>
              )}
              <p className="text-xs text-red-400 mt-2">
                Reported by {selected.reporterName} · {fmtDate(selected.createdAt)}
              </p>
            </div>

            {action !== 'dismiss' && (
              <>
                <FormRow label="Action to take">
                  <select
                    className="rr-select"
                    value={action}
                    onChange={e => setAction(e.target.value)}
                  >
                    <option value="contact">Contact landlord for clarification</option>
                    <option value="flag">Flag listing as under review</option>
                    <option value="remove">Remove listing from platform</option>
                    <option value="ban">Remove listing + suspend landlord</option>
                  </select>
                </FormRow>

                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <input
                    type="checkbox"
                    id="remove-prop"
                    checked={removeP}
                    onChange={e => setRemoveP(e.target.checked)}
                    className="w-4 h-4 accent-red-600 cursor-pointer"
                  />
                  <label htmlFor="remove-prop" className="text-sm text-amber-800 cursor-pointer">
                    Also permanently remove the listing from the platform
                  </label>
                </div>
              </>
            )}

            <FormRow label={action === 'dismiss' ? 'Reason for dismissal (optional)' : 'Admin note (internal)'}>
              <textarea
                className="rr-textarea"
                rows={3}
                placeholder={
                  action === 'dismiss'
                    ? 'e.g. Verified with landlord — listing is legitimate'
                    : 'e.g. Emailed landlord, awaiting photos…'
                }
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
