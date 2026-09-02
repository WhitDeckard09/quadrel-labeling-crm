/** Renderers for the assistant's structured answer blocks. */
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Flag, Info, ChevronRight } from 'lucide-react'
import type { AnswerBlock, Tone } from '@/lib/assistant/types'
import { Avatar, SubmissionBadge } from '@/components/ui/primitives'
import { avatarTint, formatNumber, formatShortDate } from '@/lib/format'

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink',
  positive: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-rose-600 dark:text-rose-400',
}

export function AnswerBlockView({ block, onNavigate }: { block: AnswerBlock; onNavigate?: () => void }) {
  switch (block.kind) {
    case 'text':
      return <p className="text-sm leading-relaxed text-ink">{block.text}</p>

    case 'note':
      return (
        <div className="flex gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" />
          <p className="text-xs leading-relaxed text-ink-muted">{block.text}</p>
        </div>
      )

    case 'stats':
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {block.items.map((item) => (
            <div key={item.label} className="rounded-lg border border-line bg-surface px-3 py-2">
              <p className="truncate text-[11px] text-ink-muted">{item.label}</p>
              <p className={clsx('mt-0.5 text-base font-semibold tnum', TONE_TEXT[item.tone ?? 'neutral'])}>
                {item.value}
              </p>
              {item.sub && <p className="truncate text-[11px] text-ink-subtle">{item.sub}</p>}
            </div>
          ))}
        </div>
      )

    case 'table':
      return (
        <div className="scroll-slim overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                {block.columns.map((c) => (
                  <th
                    key={c.key}
                    className={clsx(
                      'whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle',
                      c.align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {block.columns.map((c) => (
                    <td
                      key={c.key}
                      className={clsx(
                        'whitespace-nowrap px-3 py-2 tnum',
                        c.align === 'right' ? 'text-right' : 'text-left',
                        c.key === 'metric' ? 'font-medium text-ink' : 'text-ink-muted',
                      )}
                    >
                      {row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'people':
      return (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {block.items.map((p) => (
            <li key={p.employeeId}>
              <Link
                to={`/employees/${p.employeeId}`}
                onClick={onNavigate}
                className="flex items-center gap-2.5 bg-surface px-3 py-2 transition-colors hover:bg-surface-2"
              >
                <Avatar name={p.name} tint={avatarTint(p.employeeId)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                  <p className="truncate text-xs text-ink-subtle">{p.sub}</p>
                </div>
                {p.value && (
                  <div className="shrink-0 text-right">
                    <p className={clsx('text-sm font-semibold tnum', TONE_TEXT[p.tone ?? 'neutral'])}>{p.value}</p>
                    {p.valueSub && <p className="text-[11px] text-ink-subtle tnum">{p.valueSub}</p>}
                  </div>
                )}
                <ChevronRight className="size-3.5 shrink-0 text-ink-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      )

    case 'logs':
      return (
        <ul className="space-y-2">
          {block.items.map((log) => (
            <li key={log.id}>
              <Link
                to={`/employees/${log.employeeId}?week=${log.weekEnding}`}
                onClick={onNavigate}
                className="block rounded-lg border border-line bg-surface p-3 transition-colors hover:bg-surface-2"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-ink">{log.employeeName}</span>
                  <span className="text-xs text-ink-subtle tnum">
                    week ending {formatShortDate(log.weekEnding)}
                  </span>
                  <SubmissionBadge status={log.status} />
                  {log.status !== 'missing' && (
                    <span className="text-xs text-ink-subtle tnum">
                      {log.hoursWorked.toFixed(1)} hrs · {formatNumber(log.output)} {log.outputUnit}
                    </span>
                  )}
                </div>
                {log.summary && (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{log.summary}</p>
                )}
                {log.notes && (
                  <p className="mt-1.5 flex gap-1.5 rounded border-l-2 border-amber-400 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-500/8 dark:text-amber-200">
                    <Flag className="mt-0.5 size-3 shrink-0" />
                    {log.notes}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )

    case 'chips':
      return (
        <div className="flex flex-wrap gap-1.5">
          {block.items.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              onClick={onNavigate}
              className="rounded-md bg-surface-3 px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/12 dark:hover:text-brand-300"
            >
              {c.label}
            </Link>
          ))}
        </div>
      )
  }
}
