'use client'
import { cn, statusBadge } from '@/lib/utils'
import { X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PaginationMeta } from '@/types'

// ── Badge ──────────────────────────────────────────────────
export function Badge({
  status, className, children,
}: { status?: string; className?: string; children: React.ReactNode }) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border'
  const color = status ? (statusBadge[status] ?? 'bg-gray-100 text-gray-500 border-gray-200') : ''
  return <span className={cn(base, color, className)}>{children}</span>
}

// ── Button ─────────────────────────────────────────────────
type BtnVariant = 'primary' | 'danger' | 'success' | 'outline' | 'ghost'
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: 'sm' | 'md'
  loading?: boolean
  icon?: React.ReactNode
}
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark border-brand',
  danger:  'bg-red-600 text-white hover:bg-red-700 border-red-600',
  success: 'bg-green-700 text-white hover:bg-green-800 border-green-700',
  outline: 'bg-white text-gray-700 hover:bg-surface-0 border-gray-200',
  ghost:   'bg-transparent text-gray-600 hover:bg-surface-0 border-transparent',
}
export function Btn({
  variant = 'outline', size = 'md', loading, icon, children, className, disabled, ...props
}: BtnProps) {
  const sz = size === 'sm'
    ? 'px-3 py-1.5 text-xs rounded-md gap-1.5'
    : 'px-4 py-2 text-sm rounded-lg gap-2'
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium border transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        btnVariants[variant], sz, className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ── Modal ──────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}
export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={ref}
        className={cn('bg-white rounded-2xl shadow-xl w-full flex flex-col max-h-[85vh]', sizes[size])}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  deltaUp?: boolean
  icon: React.ReactNode
  iconBg?: string
}
export function StatCard({ label, value, delta, deltaUp, icon, iconBg = 'bg-brand-light' }: StatCardProps) {
  return (
    <div className="rr-card p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', iconBg)}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-semibold text-gray-900 leading-none">{value}</p>
      {delta && (
        <p className={cn('text-xs mt-2 font-medium', deltaUp ? 'text-green-600' : 'text-red-600')}>
          {deltaUp ? '↑' : '↓'} {delta}
        </p>
      )}
    </div>
  )
}

// ── Table wrapper ──────────────────────────────────────────
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full rr-table">{children}</table>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────
export function Empty({ icon, title, message }: { icon: React.ReactNode; title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-0 flex items-center justify-center mb-4 text-gray-400">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {message && <p className="text-xs text-gray-400 mt-1 max-w-xs">{message}</p>}
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────
export function Pagination({
  meta, onPage,
}: { meta: PaginationMeta; onPage: (p: number) => void }) {
  if (meta.totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        Showing {(meta.page - 1) * meta.perPage + 1}–
        {Math.min(meta.page * meta.perPage, meta.total)} of {meta.total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(meta.page - 1)}
          disabled={meta.page <= 1}
          className="p-1 rounded hover:bg-surface-0 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
          const p = i + 1
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={cn(
                'w-7 h-7 rounded text-xs font-medium transition-colors',
                p === meta.page
                  ? 'bg-brand text-white'
                  : 'text-gray-600 hover:bg-surface-0',
              )}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={() => onPage(meta.page + 1)}
          disabled={meta.page >= meta.totalPages}
          className="p-1 rounded hover:bg-surface-0 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Toast (context-free, local) ────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' }[]>([])
  const push = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }
  const ToastContainer = () => (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[100]">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white min-w-[260px]',
            t.type === 'success' ? 'bg-gray-900' : 'bg-red-600',
          )}
        >
          <span>{t.type === 'success' ? '✓' : '✕'}</span>
          {t.msg}
        </div>
      ))}
    </div>
  )
  return { push, ToastContainer }
}

// ── Section tabs ───────────────────────────────────────────
export function Tabs<T extends string>({
  options, value, onChange,
}: { options: { label: string; value: T; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex border-b border-gray-100 bg-white px-4">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
            value === o.value
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
              value === o.value ? 'bg-brand-light text-brand' : 'bg-gray-100 text-gray-500',
            )}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Form row ───────────────────────────────────────────────
export function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
