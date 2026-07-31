'use client'

import { useEffect, useState } from 'react'
import {
  Flag,
  Loader2,
  AlertTriangle,
  ExternalLink,
  UserX,
  ShieldAlert,
  Eye,
  MessageSquare,
  Ban,
  Trash2,
  RotateCcw,
  Undo2,
} from 'lucide-react'
import { Badge, Btn, Modal, Tabs, Empty, Table, useToast, FormRow } from '@/components/ui'
import { fmtDate, truncate } from '@/lib/utils'
import type { Report } from '@/types'

type Tab = 'open' | 'actioned' | 'dismissed'
type AdminAction = 'contact' | 'flag' | 'remove' | 'ban' | 'dismiss'
type ReversalAction = 'unflag' | 'restore' | 'unsuspend'

interface EnrichedReport extends Report {
  id: string
  landlordId: string
  landlordReportCount: number
  propertyReportCount: number
  landlordSuspended: boolean
  landlordName: string
  thumbnail?: string | null
  estate?: string | null
  county?: string | null
  rent?: number | null
  isBoosted?: boolean
  propertyStatus?: string | null
  propertyPublished?: boolean | null
}

/** Which reversal options make sense right now, given current live state. */
function availableReversals(r: EnrichedReport): { action: ReversalAction; label: string; icon: React.ReactNode }[] {
  const options: { action: ReversalAction; label: string; icon: React.ReactNode }[] = []

  if (r.propertyStatus === 'under_review') {
    options.push({ action: 'unflag', label: 'Unflag listing', icon: <ShieldAlert className="w-4 h-4" /> })
  }
  if (r.propertyStatus === 'removed') {
    options.push({ action: 'restore', label: 'Restore listing', icon: <RotateCcw className="w-4 h-4" /> })
  }
  if (r.landlordSuspended) {
    options.push({ action: 'unsuspend', label: 'Unsuspend landlord', icon: <Undo2 className="w-4 h-4" /> })
  }

  return options
}

export default function ReportsPage() {
  const [tab,        setTab]        = useState<Tab>('open')
  const [items,      setItems]      = useState<EnrichedReport[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selected,   setSelected]   = useState<EnrichedReport | null>(null)
  const [modal,      setModal]      = useState<'review' | 'detail' | 'manage' | null>(null)
  const [action,     setAction]     = useState<AdminAction>('remove')
  const [reversal,   setReversal]   = useState<ReversalAction | null>(null)
  const [note,       setNote]       = useState('')
  const [removeP,    setRemoveP]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { push, ToastContainer } = useToast()

  /* ── fetch data ── */
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    fetch(`/api/reports?status=${tab}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        return json
      })
      .then((json) => setItems(json.data ?? []))
      .catch((e) => {
        if (e.name !== 'AbortError') {
          push(e.message || 'Failed to load reports', 'error')
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [tab, refreshKey])

  const reload = () => setRefreshKey((k) => k + 1)

  const handleSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:             selected.id,
          action:         action,
          adminNote:      note || undefined,
          removeProperty: removeP,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      const msgMap: Record<string, string> = {
        contact: 'Landlord contacted — note saved',
        flag:    'Listing flagged as under review',
        remove:  removeP
          ? 'Listing removed from platform'
          : 'Report actioned',
        ban:     'Landlord suspended + listings removed',
      }

      push(msgMap[action] ?? 'Action applied', action === 'ban' ? 'error' : 'success')
      setModal(null)
      setSelected(null)
      setNote('')
      setRemoveP(false)
      reload()
    } catch (e: any) {
      push(e.message || 'Something went wrong', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReversal = async () => {
    if (!selected || !reversal) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:        selected.id,
          action:    reversal,
          adminNote: note || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      const msgMap: Record<ReversalAction, string> = {
        unflag:    'Listing unflagged and set back to active',
        restore:   'Listing restored to the platform',
        unsuspend: 'Landlord unsuspended and eligible listings restored',
      }

      push(msgMap[reversal], 'success')
      setModal(null)
      setSelected(null)
      setNote('')
      setReversal(null)
      reload()
    } catch (e: any) {
      push(e.message || 'Something went wrong', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = (r: EnrichedReport) => {
    setSelected(r)
    setModal('detail')
  }

  const openReview = (r: EnrichedReport, defaultAction: AdminAction = 'remove') => {
    setSelected(r)
    setAction(defaultAction)
    setRemoveP(defaultAction === 'remove' || defaultAction === 'ban')
    setModal('review')
  }

  const openManage = (r: EnrichedReport) => {
    const options = availableReversals(r)
    setSelected(r)
    setReversal(options[0]?.action ?? null)
    setNote('')
    setModal('manage')
  }

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Tenant-submitted reports of fake listings, fraud, or policy violations.
          </p>
        </div>
        <div className="text-xs text-gray-400">
          {items.length} {tab} report{items.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Tabs */}
      <div className="rr-card">
        <Tabs
          options={[
            { label: 'Open',      value: 'open'      as Tab, count: tab === 'open' ? items.length : undefined },
            { label: 'Actioned',  value: 'actioned'  as Tab },
            { label: 'Dismissed', value: 'dismissed' as Tab },
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
            icon={<Flag className="w-7 h-7" />}
            title={`No ${tab} reports`}
            message={tab === 'open' ? 'No reports to review right now.' : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <th className="w-14">Thumb</th>
                  <th>Property</th>
                  <th>Landlord</th>
                  <th>Reason</th>
                  <th>Priority</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => {
                  const reversals = tab === 'actioned' ? availableReversals(r) : []
                  return (
                  <tr key={r.id} className="group">
                    {/* Thumbnail */}
                    <td>
                      {r.thumbnail ? (
                        <img
                          src={r.thumbnail}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Eye className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </td>

                    {/* Property */}
                    <td>
                      <div className="max-w-[180px]">
                        <p className="font-medium text-gray-900 truncate" title={r.propertyTitle}>
                          {r.propertyTitle}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {r.estate}{r.county ? `, ${r.county}` : ''}
                        </p>
                        {r.propertyReportCount > 1 && (
                          <Badge status="warning" className="mt-1">
                            {r.propertyReportCount} reports on this listing
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Landlord */}
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm text-gray-700">{r.landlordName}</span>
                        {r.landlordSuspended && (
                          <Badge status="error">Suspended</Badge>
                        )}
                        {r.landlordReportCount > 1 && !r.landlordSuspended && (
                          <Badge status="warning">
                            Repeat offender ({r.landlordReportCount})
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Reason */}
                    <td>
                      <p className="text-gray-600 max-w-[200px] truncate" title={r.reason}>
                        {truncate(r.reason, 50)}
                      </p>
                    </td>

                    {/* Priority */}
                    <td>
                      {r.isBoosted ? (
                        <Badge status="error">
                          <ShieldAlert className="w-3 h-3 mr-1" />
                          High
                        </Badge>
                      ) : (
                        <Badge status="neutral">Normal</Badge>
                      )}
                    </td>

                    {/* Date */}
                    <td className="text-gray-500 whitespace-nowrap text-sm">
                      {fmtDate(r.createdAt)}
                    </td>

                    {/* Status */}
                    <td>
                      <div className="flex flex-col gap-1">
                        <Badge status={r.status === 'open' ? 'warning' : r.status === 'dismissed' ? 'neutral' : 'success'}>
                          {r.status}
                        </Badge>
                        {r.reversedAction && (
                          <Badge status="neutral">Reversed</Badge>
                        )}
                        {tab === 'actioned' && !r.reversedAction && r.propertyStatus === 'under_review' && (
                          <Badge status="warning">Under review</Badge>
                        )}
                        {tab === 'actioned' && !r.reversedAction && r.propertyStatus === 'removed' && (
                          <Badge status="error">Removed</Badge>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <Btn
                          size="sm"
                          variant="ghost"
                          title="View details"
                          onClick={() => openDetail(r)}
                        >
                          <Eye className="w-4 h-4" />
                        </Btn>

                        {r.status === 'open' && (
                          <>
                            <Btn
                              size="sm"
                              variant="outline"
                              onClick={() => openReview(r, 'remove')}
                            >
                              Review
                            </Btn>
                            <Btn
                              size="sm"
                              variant="ghost"
                              className="text-gray-400 hover:text-gray-600"
                              onClick={() => {
                                setSelected(r)
                                setAction('remove')
                                setModal('review')
                              }}
                            >
                              Dismiss
                            </Btn>
                          </>
                        )}

                        {r.status === 'actioned' && reversals.length > 0 && (
                          <Btn
                            size="sm"
                            variant="outline"
                            onClick={() => openManage(r)}
                          >
                            Manage
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Detail Modal (read-only) ── */}
      <Modal
        open={modal === 'detail' && !!selected}
        onClose={() => setModal(null)}
        title="Report details"
        footer={
          <Btn variant="outline" onClick={() => setModal(null)}>Close</Btn>
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* Property card */}
            <div className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              {selected.thumbnail ? (
                <img src={selected.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{selected.propertyTitle}</p>
                <p className="text-sm text-gray-500">{selected.estate}, {selected.county}</p>
                <p className="text-sm text-gray-500">KSh {selected.rent?.toLocaleString() ?? '—'}/mo</p>
                <div className="flex gap-2 mt-1.5">
                  <a
                    href={`/admin/properties/${selected.propertyId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs text-brand hover:underline"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Open property
                  </a>
                  <a
                    href={`/admin/users/${selected.landlordId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs text-brand hover:underline"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Open landlord
                  </a>
                </div>
              </div>
            </div>

            {/* Reporter & reason */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400 mb-0.5">Reported by</p>
                <p className="font-medium text-gray-800">{selected.reporterName}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Date</p>
                <p className="font-medium text-gray-800">{fmtDate(selected.createdAt)}</p>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm text-red-800">{selected.reason}</p>
            </div>

            {selected.details && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Details</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  "{selected.details}"
                </p>
              </div>
            )}

            {selected.adminNote && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Admin note</p>
                <p className="text-sm text-gray-600 italic">{selected.adminNote}</p>
              </div>
            )}

            {selected.reversedAction && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Reversed — {selected.reversedAction}
                </p>
                {selected.reversalNote && (
                  <p className="text-sm text-gray-600 italic">{selected.reversalNote}</p>
                )}
              </div>
            )}

            {/* Landlord history */}
            <div className="border-t pt-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Landlord history</p>
              <div className="flex gap-3">
                <div className="flex-1 bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">{selected.landlordReportCount}</p>
                  <p className="text-xs text-gray-500">Total reports</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">{selected.propertyReportCount}</p>
                  <p className="text-xs text-gray-500">On this property</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">
                    {selected.landlordSuspended ? (
                      <span className="text-red-600">Yes</span>
                    ) : (
                      <span className="text-green-600">No</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">Suspended</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Review / Action Modal ── */}
      <Modal
        open={modal === 'review' && !!selected}
        onClose={() => setModal(null)}
        title={action === 'dismiss' ? 'Dismiss report' : 'Review & action report'}
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn
              variant={action === 'dismiss' ? 'outline' : action === 'ban' ? 'danger' : 'primary'}
              loading={submitting}
              onClick={handleSubmit}
            >
              {action === 'dismiss' && 'Dismiss report'}
              {action === 'contact' && 'Log contact'}
              {action === 'flag' && 'Flag listing'}
              {action === 'remove' && (removeP ? 'Remove listing' : 'Apply action')}
              {action === 'ban' && 'Suspend landlord'}
            </Btn>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* Report summary */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-sm font-semibold text-red-800">{selected.propertyTitle}</p>
              </div>
              <p className="text-sm text-red-700">{selected.reason}</p>
              {selected.details && (
                <p className="text-xs text-red-600 mt-1 italic">"{selected.details}"</p>
              )}
              <div className="flex gap-3 mt-2">
                <a
                  href={`/admin/properties/${selected.propertyId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-xs text-red-700 hover:underline"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View property
                </a>
                <a
                  href={`/admin/users/${selected.landlordId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-xs text-red-700 hover:underline"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View landlord
                </a>
              </div>
              <p className="text-xs text-red-400 mt-2">
                Reported by {selected.reporterName} · {fmtDate(selected.createdAt)}
              </p>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-sm font-bold text-gray-900">{selected.landlordReportCount}</p>
                <p className="text-[10px] text-gray-500 uppercase">Landlord reports</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-sm font-bold text-gray-900">{selected.propertyReportCount}</p>
                <p className="text-[10px] text-gray-500 uppercase">Property reports</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-sm font-bold text-gray-900">
                  {selected.isBoosted ? (
                    <span className="text-amber-600">Boosted</span>
                  ) : (
                    <span className="text-gray-600">Organic</span>
                  )}
                </p>
                <p className="text-[10px] text-gray-500 uppercase">Visibility</p>
              </div>
            </div>

            {/* Action selector (skip for dismiss) */}
            {action !== 'dismiss' && (
              <>
                <FormRow label="Action to take">
                  <select
                    className="rr-select"
                    value={action}
                    onChange={e => {
                      const val = e.target.value as AdminAction
                      setAction(val)
                      setRemoveP(val === 'remove' || val === 'ban')
                    }}
                  >
                    <option value="contact">
                      <MessageSquare className="w-3 h-3 inline mr-1" />
                      Contact landlord for clarification
                    </option>
                    <option value="flag">
                      <ShieldAlert className="w-3 h-3 inline mr-1" />
                      Flag listing as under review
                    </option>
                    <option value="remove">
                      <Trash2 className="w-3 h-3 inline mr-1" />
                      Remove listing from platform
                    </option>
                    <option value="ban">
                      <Ban className="w-3 h-3 inline mr-1" />
                      Remove listing + suspend landlord
                    </option>
                  </select>
                </FormRow>

                {/* Remove property checkbox */}
                {(action === 'remove' || action === 'ban') && (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <input
                      type="checkbox"
                      id="remove-prop"
                      checked={removeP}
                      onChange={e => setRemoveP(e.target.checked)}
                      className="w-4 h-4 mt-0.5 accent-red-600 cursor-pointer"
                    />
                    <label htmlFor="remove-prop" className="text-sm text-amber-800 cursor-pointer leading-relaxed">
                      Also permanently unpublish the listing from the platform
                      {action === 'ban' && ' and all other listings by this landlord'}
                    </label>
                  </div>
                )}

                {/* Ban warning */}
                {action === 'ban' && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                    <UserX className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 leading-relaxed">
                      This will suspend the landlord account, unpublish ALL their listings,
                      and increment their violation count. The landlord will not be able to
                      list new properties until manually reinstated.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Admin note */}
            <FormRow
              label={
                action === 'dismiss'
                  ? 'Reason for dismissal (optional)'
                  : 'Admin note (internal, optional)'
              }
            >
              <textarea
                className="rr-textarea"
                rows={3}
                placeholder={
                  action === 'dismiss'
                    ? 'e.g. Verified with landlord — listing is legitimate'
                    : action === 'contact'
                    ? 'e.g. Emailed landlord on 30 July, awaiting photos…'
                    : 'e.g. Confirmed fake photos via reverse image search'
                }
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </FormRow>
          </div>
        )}
      </Modal>

      {/* ── Manage / Reversal Modal (Actioned tab) ── */}
      <Modal
        open={modal === 'manage' && !!selected}
        onClose={() => setModal(null)}
        title="Manage actioned report"
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn
              variant="primary"
              loading={submitting}
              disabled={!reversal}
              onClick={handleReversal}
            >
              {reversal === 'unflag' && 'Unflag listing'}
              {reversal === 'restore' && 'Restore listing'}
              {reversal === 'unsuspend' && 'Unsuspend landlord'}
              {!reversal && 'Apply'}
            </Btn>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900">{selected.propertyTitle}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Originally actioned as <span className="font-medium">{selected.resolution ?? 'unknown'}</span>
                {selected.reviewedAt ? ` on ${fmtDate(selected.reviewedAt)}` : ''}
              </p>
              {selected.adminNote && (
                <p className="text-xs text-gray-500 mt-1 italic">"{selected.adminNote}"</p>
              )}
            </div>

            <FormRow label="Reversal to apply">
              <select
                className="rr-select"
                value={reversal ?? ''}
                onChange={e => setReversal(e.target.value as ReversalAction)}
              >
                {availableReversals(selected).map(opt => (
                  <option key={opt.action} value={opt.action}>{opt.label}</option>
                ))}
              </select>
            </FormRow>

            {reversal === 'unsuspend' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <UserX className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  This reinstates the landlord account and republishes any listings that were
                  removed specifically because of this suspension. Listings removed for other
                  reasons will stay removed.
                </p>
              </div>
            )}

            <FormRow label="Note (optional, internal)">
              <textarea
                className="rr-textarea"
                rows={3}
                placeholder="e.g. Landlord provided proof of ownership — reinstating listing"
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
