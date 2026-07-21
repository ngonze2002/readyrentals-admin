'use client'
import { useCallback, useEffect, useState } from 'react'
import { Users, UserCheck, Ban, Trash2, Loader2 } from 'lucide-react'
import { Badge, Btn, Modal, Tabs, Empty, Table, Pagination, useToast, FormRow } from '@/components/ui'
import { fmtDate, fmtKsh, initials } from '@/lib/utils'
import type { AppUser, PaginationMeta } from '@/types'

type Tab = 'all' | 'landlord' | 'tenant'

export default function UsersPage() {
  const [tab,        setTab]        = useState<Tab>('all')
  const [items,      setItems]      = useState<AppUser[]>([])
  const [meta,       setMeta]       = useState<PaginationMeta | null>(null)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<AppUser | null>(null)
  const [modal,      setModal]      = useState<'view' | 'suspend' | 'delete' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { push, ToastContainer } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/users?role=${tab}&page=${page}`)
      const json = await res.json()
      setItems(json.data ?? [])
      setMeta(json.meta ?? null)
    } finally { setLoading(false) }
  }, [tab, page])

  useEffect(() => { load() }, [load])

  const patchUser = async (uid: string, action: 'verify' | 'suspend' | 'restore') => {
    setSubmitting(true)
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, action }),
    })
    setSubmitting(false)
    setModal(null)
    push(
      action === 'verify'  ? 'User verified'  :
      action === 'suspend' ? 'User suspended' : 'User restored',
      action === 'suspend' ? 'error' : 'success',
    )
    load()
  }

  const deleteUser = async (uid: string) => {
    setSubmitting(true)
    await fetch(`/api/users?uid=${uid}`, { method: 'DELETE' })
    setSubmitting(false)
    setModal(null)
    push('User deleted', 'error')
    load()
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage tenants and landlords on the platform.</p>
        </div>
      </div>

      <div className="rr-card">
        <Tabs
          options={[
            { label: 'All users',  value: 'all'      as Tab, count: tab === 'all'      ? meta?.total : undefined },
            { label: 'Landlords', value: 'landlord'  as Tab },
            { label: 'Tenants',   value: 'tenant'    as Tab },
          ]}
          value={tab}
          onChange={v => { setTab(v); setPage(1) }}
        />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
          </div>
        ) : items.length === 0 ? (
          <Empty icon={<Users className="w-7 h-7" />} title="No users found" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Listings</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(u => (
                <tr key={u.uid}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center
                                      text-xs font-semibold text-brand shrink-0">
                        {initials(u.fullName)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.fullName}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td><Badge status={u.role}>{u.role}</Badge></td>
                  <td className="text-gray-500">{u.phone}</td>
                  <td className="text-center text-gray-500">{u.listingCount ?? '—'}</td>
                  <td className="text-gray-500">{fmtDate(u.createdAt)}</td>
                  <td>
                    <Badge status={u.isVerified ? 'verified' : u.status === 'suspended' ? 'suspended' : 'pending'}>
                      {u.isVerified ? 'Verified' : u.status === 'suspended' ? 'Suspended' : 'Pending'}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Btn size="sm" variant="ghost" onClick={() => { setSelected(u); setModal('view') }}>
                        View
                      </Btn>
                      {!u.isVerified && u.status !== 'suspended' && (
                        <Btn size="sm" variant="success"
                          onClick={() => patchUser(u.uid, 'verify')}>
                          Verify
                        </Btn>
                      )}
                      {u.status !== 'suspended' ? (
                        <Btn size="sm" variant="danger"
                          onClick={() => { setSelected(u); setModal('suspend') }}>
                          Suspend
                        </Btn>
                      ) : (
                        <Btn size="sm" variant="outline"
                          onClick={() => patchUser(u.uid, 'restore')}>
                          Restore
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {meta && <Pagination meta={meta} onPage={setPage} />}
      </div>

      {/* View modal */}
      <Modal open={modal === 'view'} onClose={() => setModal(null)} title="User profile"
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Close</Btn>
            {selected && !selected.isVerified && selected.status !== 'suspended' && (
              <Btn variant="success" loading={submitting}
                onClick={() => patchUser(selected.uid, 'verify')}>
                <UserCheck className="w-4 h-4" /> Verify account
              </Btn>
            )}
            {selected && selected.status !== 'suspended' && (
              <Btn variant="danger" onClick={() => setModal('suspend')}>
                <Ban className="w-4 h-4" /> Suspend
              </Btn>
            )}
          </>
        }
      >
        {selected && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center
                              text-xl font-semibold text-brand shrink-0">
                {initials(selected.fullName)}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{selected.fullName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge status={selected.role}>{selected.role}</Badge>
                  <Badge status={selected.isVerified ? 'verified' : 'pending'}>
                    {selected.isVerified ? 'Verified' : 'Pending'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                ['Email',    selected.email],
                ['Phone',    selected.phone],
                ['Joined',   fmtDate(selected.createdAt)],
                ['Listings', String(selected.listingCount ?? 0)],
                ['National ID', selected.nationalId ?? '—'],
              ].map(([label, val]) => (
                <div key={label} className="bg-surface-0 rounded-lg px-3 py-2.5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-sm font-medium text-gray-800">{val}</p>
                </div>
              ))}
            </div>
            <Btn variant="danger" size="sm"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setModal('delete')}
            >
              Delete account permanently
            </Btn>
          </div>
        )}
      </Modal>

      {/* Suspend confirm */}
      <Modal open={modal === 'suspend'} onClose={() => setModal(null)} title="Suspend user" size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="danger" loading={submitting}
              onClick={() => selected && patchUser(selected.uid, 'suspend')}>
              Suspend account
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Suspending <strong>{selected?.fullName}</strong> will disable their account and prevent them
          from logging in. You can restore them at any time.
        </p>
      </Modal>

      {/* Delete confirm */}
      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Delete user" size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="danger" loading={submitting}
              onClick={() => selected && deleteUser(selected.uid)}>
              Delete permanently
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          This will permanently delete <strong>{selected?.fullName}</strong>'s account and all
          associated data. <strong className="text-red-600">This cannot be undone.</strong>
        </p>
      </Modal>

      <ToastContainer />
    </div>
  )
}
