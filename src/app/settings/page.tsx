'use client'
import { useEffect, useState } from 'react'
import { Save, UserPlus, Trash2, Bell, Shield, Zap, Settings } from 'lucide-react'
import { Btn, FormRow, useToast } from '@/components/ui'
import { initials } from '@/lib/utils'

const ADMINS = [
  { name: 'Admin Kamau',  email: 'admin@readyrentals.co.ke', role: 'Super admin' },
  { name: 'Ops Team',     email: 'ops@readyrentals.co.ke',   role: 'Moderator'   },
]

type BoostPackage = {
  id: string
  order: number
  price: number
}

export default function SettingsPage() {
  const { push, ToastContainer } = useToast()

  // Boost pricing state
  const [packages, setPackages] = useState<BoostPackage[]>([])
  const [loadingPricing, setLoadingPricing] = useState(true)
  const [savingPricing, setSavingPricing] = useState(false)


  useEffect(() => {
  const loadPricing = async () => {
    try {
      setLoadingPricing(true)

      const res = await fetch('/api/settings/boost-packages')
      if (!res.ok) throw new Error('Failed to load pricing')

      const data: BoostPackage[] = await res.json()
      data.sort((a, b) => a.order - b.order)

      setPackages(data)
    } finally {
      setLoadingPricing(false)
    }
  }

  loadPricing()
}, [])

  const savePricing = async () => {
  try {
    setSavingPricing(true)

    const res = await fetch('/api/settings/boost-packages', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        packages.map(({ id, price }) => ({
          id,
          price: Number(price),
        }))
      ),
    })

    if (!res.ok) throw new Error('Save failed')
  } finally {
    setSavingPricing(false)
  }
}

  // Verification rules
  const [autoApprove,  setAutoApprove]  = useState('no')
  const [listingExpiry, setListingExpiry] = useState('90')
  const [freeLimit,    setFreeLimit]    = useState('3')

  // Notification prefs
  const [notifPending,  setNotifPending]  = useState(true)
  const [notifReport,   setNotifReport]   = useState(true)
  const [notifDigest,   setNotifDigest]   = useState(false)
  const [notifWeekly,   setNotifWeekly]   = useState(true)

  // Invite modal
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('Moderator')

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Platform configuration, pricing, and admin account management.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Boost pricing ─────────────────────────────── */}
        <div className="rr-card">
  <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
      <Zap className="w-4 h-4 text-amber-600" />
    </div>

    <h3 className="text-sm font-semibold text-gray-900">
      Boost pricing (KSh)
    </h3>
  </div>

  <div className="p-5 space-y-4">

    {loadingPricing ? (

      <div className="py-10 text-center text-gray-500">
        Loading pricing...
      </div>

    ) : (

      <>

        <FormRow label="🥉 Bronze — 7 days">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">KSh</span>

            <input
              type="number"
              className="rr-input"
              value={bronze}
              onChange={(e) => setBronze(e.target.value)}
            />
          </div>
        </FormRow>

        <FormRow label="🥈 Silver — 14 days">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">KSh</span>

            <input
              type="number"
              className="rr-input"
              value={silver}
              onChange={(e) => setSilver(e.target.value)}
            />
          </div>
        </FormRow>

        <FormRow label="🥇 Gold — 30 days">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">KSh</span>

            <input
              type="number"
              className="rr-input"
              value={gold}
              onChange={(e) => setGold(e.target.value)}
            />
          </div>
        </FormRow>

        <Btn
          variant="primary"
          icon={<Save className="w-4 h-4" />}
          onClick={savePricing}
          disabled={savingPricing}
        >
          {savingPricing ? 'Saving...' : 'Save pricing'}
        </Btn>

      </>

    )}

  </div>
</div>

        {/* ── Verification rules ─────────────────────────── */}
        <div className="rr-card">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-brand-light flex items-center justify-center">
              <Shield className="w-4 h-4 text-brand" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Verification rules</h3>
          </div>
          <div className="p-5 space-y-4">
            <FormRow label="Auto-approve listings from verified landlords">
              <select
                className="rr-select"
                value={autoApprove}
                onChange={e => setAutoApprove(e.target.value)}
              >
                <option value="no">No — all listings require manual review</option>
                <option value="yes">Yes — skip queue for verified landlords</option>
              </select>
            </FormRow>
            <FormRow label="Listing expires after (days)">
              <input
                type="number"
                className="rr-input"
                value={listingExpiry}
                onChange={e => setListingExpiry(e.target.value)}
              />
            </FormRow>
            <FormRow label="Max free listings per landlord">
              <input
                type="number"
                className="rr-input"
                value={freeLimit}
                onChange={e => setFreeLimit(e.target.value)}
              />
            </FormRow>
            <Btn variant="primary" icon={<Save className="w-4 h-4" />}
              onClick={() => push('Verification settings saved')}>
              Save settings
            </Btn>
          </div>
        </div>

        {/* ── Admin accounts ─────────────────────────────── */}
        <div className="rr-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Settings className="w-4 h-4 text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Admin accounts</h3>
            </div>
            <Btn
              size="sm"
              variant="primary"
              icon={<UserPlus className="w-3.5 h-3.5" />}
              onClick={() => setShowInvite(true)}
            >
              Invite
            </Btn>
          </div>
          <div>
            {ADMINS.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 last:border-0"
              >
                <div className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center
                                text-sm font-semibold text-brand shrink-0">
                  {initials(a.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-400">{a.email}</p>
                </div>
                <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200
                                  px-2 py-0.5 rounded-full shrink-0">
                  {a.role}
                </span>
                {i > 0 && (
                  <button
                    className="text-gray-300 hover:text-red-500 transition-colors ml-1"
                    onClick={() => push(`${a.name} removed`, 'error')}
                    title="Remove admin"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Inline invite form */}
          {showInvite && (
            <div className="px-5 py-4 bg-surface-0 border-t border-gray-100 space-y-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Invite new admin
              </p>
              <FormRow label="Email address">
                <input
                  type="email"
                  className="rr-input"
                  placeholder="admin@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                />
              </FormRow>
              <FormRow label="Role">
                <select
                  className="rr-select"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                >
                  <option>Moderator</option>
                  <option>Super admin</option>
                </select>
              </FormRow>
              <div className="flex gap-2">
                <Btn variant="outline" onClick={() => setShowInvite(false)}>Cancel</Btn>
                <Btn variant="primary" onClick={() => {
                  push(`Invite sent to ${inviteEmail}`)
                  setShowInvite(false)
                  setInviteEmail('')
                }}>
                  Send invite
                </Btn>
              </div>
            </div>
          )}
        </div>

        {/* ── Notifications ──────────────────────────────── */}
        <div className="rr-card">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Bell className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Email notifications</h3>
          </div>
          <div className="p-5 space-y-4">
            {[
              { label: 'New listing submitted for review', state: notifPending,  setter: setNotifPending },
              { label: 'New report filed by tenant',       state: notifReport,   setter: setNotifReport  },
              { label: 'Daily activity digest',            state: notifDigest,   setter: setNotifDigest  },
              { label: 'Weekly analytics summary',         state: notifWeekly,   setter: setNotifWeekly  },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{item.label}</span>
                <button
                  role="switch"
                  aria-checked={item.state}
                  onClick={() => item.setter(!item.state)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors focus:outline-none
                              focus-visible:ring-2 focus-visible:ring-brand
                              ${item.state ? 'bg-brand' : 'bg-gray-200'}`}
                  style={{ height: 22 }}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow
                                transition-transform ${item.state ? 'translate-x-[18px]' : ''}`}
                    style={{ width: 17, height: 17 }}
                  />
                </button>
              </div>
            ))}
            <div className="pt-2">
              <Btn variant="primary" icon={<Save className="w-4 h-4" />}
                onClick={() => push('Notification preferences saved')}>
                Save preferences
              </Btn>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer />
    </div>
  )
}