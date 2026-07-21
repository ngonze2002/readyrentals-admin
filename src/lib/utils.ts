import { clsx, type ClassValue } from 'clsx'
import { format, formatDistanceToNow } from 'date-fns'

// ── Tailwind class merging ─────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// ── Currency formatting ────────────────────────────────────
export function fmtKsh(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE')}`
}

// ── Date formatting ────────────────────────────────────────
export function fmtDate(iso: string | undefined): string {
  if (!iso) return '—'
  try { return format(new Date(iso), 'd MMM yyyy') }
  catch { return '—' }
}

export function fmtDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  try { return format(new Date(iso), 'd MMM yyyy · h:mm a') }
  catch { return '—' }
}

export function fmtRelative(iso: string | undefined): string {
  if (!iso) return '—'
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }) }
  catch { return '—' }
}

// ── Initials ───────────────────────────────────────────────
export function initials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Status colour maps ─────────────────────────────────────
export const statusBadge: Record<string, string> = {
  pending:   'bg-amber-50  text-amber-700  border-amber-200',
  verified:  'bg-green-50  text-green-700  border-green-200',
  rejected:  'bg-red-50    text-red-700    border-red-200',
  active:    'bg-green-50  text-green-700  border-green-200',
  expired:   'bg-gray-100  text-gray-500   border-gray-200',
  open:      'bg-red-50    text-red-700    border-red-200',
  actioned:  'bg-blue-50   text-blue-700   border-blue-200',
  dismissed: 'bg-gray-100  text-gray-500   border-gray-200',
  landlord:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  tenant:    'bg-green-50  text-green-700  border-green-200',
  admin:     'bg-purple-50 text-purple-700 border-purple-200',
  suspended: 'bg-red-50    text-red-700    border-red-200',
  vacant:    'bg-green-50  text-green-700  border-green-200',
  occupied:  'bg-gray-100  text-gray-500   border-gray-200',
}

// ── Pagination ─────────────────────────────────────────────
export function paginate<T>(items: T[], page: number, perPage = 20) {
  const total      = items.length
  const totalPages = Math.ceil(total / perPage)
  const safeP      = Math.max(1, Math.min(page, totalPages))
  const start      = (safeP - 1) * perPage
  return {
    data: items.slice(start, start + perPage),
    meta: { page: safeP, perPage, total, totalPages },
  }
}

// ── Truncate ───────────────────────────────────────────────
export function truncate(str: string, max = 60): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}
