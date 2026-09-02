import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Sparkline } from '@/components/charts'
import { Skeleton } from './primitives'

type Tone = 'neutral' | 'positive' | 'warning' | 'critical'

const TONE_ACCENT: Record<Tone, string> = {
  neutral: 'text-ink',
  positive: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-rose-600 dark:text-rose-400',
}

const TONE_ICON_BG: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-muted',
  positive: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/12 dark:text-amber-400',
  critical: 'bg-rose-50 text-rose-600 dark:bg-rose-500/12 dark:text-rose-400',
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  delta,
  deltaLabel,
  /** Higher is worse for this metric (missing submissions, defect rate…). */
  invertDelta = false,
  sparkline,
  sparklineColor,
  loading,
  onClick,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  tone?: Tone
  delta?: number | null
  deltaLabel?: string
  invertDelta?: boolean
  sparkline?: number[]
  sparklineColor?: string
  loading?: boolean
  onClick?: () => void
}) {
  const Wrapper = onClick ? 'button' : 'div'
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta)
  const rising = hasDelta && delta! > 0.5
  const falling = hasDelta && delta! < -0.5
  const good = invertDelta ? falling : rising
  const bad = invertDelta ? rising : falling

  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={clsx(
        'relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors',
        onClick && 'hover:border-line-strong hover:bg-surface-2',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {icon && (
          <span className={clsx('flex size-7 shrink-0 items-center justify-center rounded-lg', TONE_ICON_BG[tone])}>
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <span className={clsx('text-2xl font-semibold tracking-tight tnum', TONE_ACCENT[tone])}>{value}</span>
        )}
        {hasDelta && !loading && (
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 text-xs font-medium tnum',
              good && 'text-emerald-600 dark:text-emerald-400',
              bad && 'text-rose-600 dark:text-rose-400',
              !good && !bad && 'text-ink-subtle',
            )}
          >
            {rising ? (
              <ArrowUpRight className="size-3.5" />
            ) : falling ? (
              <ArrowDownRight className="size-3.5" />
            ) : (
              <Minus className="size-3.5" />
            )}
            {Math.abs(delta!).toFixed(1)}%
          </span>
        )}
      </div>

      {(hint || deltaLabel) && (
        <p className="mt-1 text-xs text-ink-subtle">{hint ?? deltaLabel}</p>
      )}

      {sparkline && sparkline.length > 1 && (
        <div className="-mx-4 -mb-4 mt-3">
          <Sparkline data={sparkline} color={sparklineColor} />
        </div>
      )}
    </Wrapper>
  )
}
