/**
 * Small, unopinionated UI primitives shared across pages.
 * Everything here is presentational — no data access, no routing.
 */
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import clsx from 'clsx'
import { Search, X, ChevronDown, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import type { SubmissionStatus, EmployeeStatus } from '@/types'

/* ------------------------------------------------------------------ card -- */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
        padded && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------- button -- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-[0_1px_2px_rgba(16,24,40,0.08)]',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-surface-3 active:bg-surface-3',
  ghost: 'text-ink-muted hover:bg-surface-3 hover:text-ink',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ variant = 'secondary', size = 'md', className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
})

/* ----------------------------------------------------------------- input -- */

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  ...props
}: {
  value: string
  onChange: (value: string) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <div className={clsx('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx(
          'h-9 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-8 text-sm text-ink',
          'placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none',
          'focus:ring-2 focus:ring-brand-500/20 [&::-webkit-search-cancel-button]:appearance-none',
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-subtle hover:bg-surface-3 hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function Select({
  label,
  className,
  children,
  ...props
}: { label?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={clsx('relative', className)}>
      {label && <span className="sr-only">{label}</span>}
      <select
        aria-label={label}
        className={clsx(
          'h-9 w-full appearance-none rounded-lg border border-line-strong bg-surface pl-3 pr-8 text-sm text-ink',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
        aria-hidden
      />
    </div>
  )
}

/* ----------------------------------------------------------------- badge -- */

const SUBMISSION_STYLES: Record<SubmissionStatus, { label: string; className: string; dot: string }> = {
  on_time: {
    label: 'On time',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25',
    dot: 'bg-emerald-500',
  },
  late: {
    label: 'Late',
    className: 'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25',
    dot: 'bg-amber-500',
  },
  missing: {
    label: 'Missing',
    className: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/25',
    dot: 'bg-rose-500',
  },
}

export function SubmissionBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  const s = SUBMISSION_STYLES[status]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        s.className,
        className,
      )}
    >
      <span className={clsx('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </span>
  )
}

export const SUBMISSION_LABEL: Record<SubmissionStatus, string> = {
  on_time: 'On time',
  late: 'Late',
  missing: 'Missing',
}

const EMPLOYEE_STATUS_STYLES: Record<EmployeeStatus, string> = {
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25',
  'On Leave': 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/25',
  Inactive: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-400/20',
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        EMPLOYEE_STATUS_STYLES[status],
      )}
    >
      {status}
    </span>
  )
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md bg-surface-3 px-1.5 py-0.5 text-xs font-medium text-ink-muted whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------------------------------------------------------- avatar -- */

export function Avatar({ name, tint, size = 'md' }: { name: string; tint: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'sm' && 'size-7 text-[11px]',
        size === 'md' && 'size-9 text-xs',
        size === 'lg' && 'size-14 text-lg',
        tint,
      )}
    >
      {initials}
    </span>
  )
}

/* ------------------------------------------------------------ table bits -- */

export function SortHeader({
  label,
  active,
  direction,
  onClick,
  align = 'left',
  className,
}: {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right'
  className?: string
}) {
  const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={onClick}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={clsx(
        'group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors',
        align === 'right' && 'flex-row-reverse',
        active ? 'text-ink' : 'text-ink-subtle hover:text-ink-muted',
        className,
      )}
    >
      {label}
      <Icon
        className={clsx('size-3 transition-opacity', active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60')}
      />
    </button>
  )
}

/* --------------------------------------------------------------- states -- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-3 text-ink-subtle">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-surface-3', className)} />
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={clsx('h-3.5', c === 0 ? 'w-40' : 'w-20', c === cols - 1 && 'ml-auto')} />
          ))}
        </div>
      ))}
    </div>
  )
}
