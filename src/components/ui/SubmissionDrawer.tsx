/**
 * Detail drawer for a single weekly submission.
 *
 * Also the one place a manager writes back: marking an entry reviewed and
 * attaching a note. Those edits go through the store (optimistic local update +
 * an API call), which is exactly the path a real `PATCH /api/work-logs/:id`
 * will take.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { X, Flag, CheckCircle2, Clock, ExternalLink, CalendarRange, Save } from 'lucide-react'
import { Avatar, Button, Chip, SubmissionBadge } from './primitives'
import { useDataStore } from '@/hooks/useDataStore'
import { avatarTint, formatDate, formatDateTime, formatNumber } from '@/lib/format'

export function SubmissionDrawer({
  logId,
  onClose,
  onFilterWeek,
}: {
  /** Id of the row to show. The drawer resolves the *live* record from the
   *  store so manager edits re-render here immediately — holding the row object
   *  itself would leave the drawer showing a stale snapshot. */
  logId: string | null
  onClose: () => void
  onFilterWeek?: (week: string) => void
}) {
  const { updateWorkLog, employeeById, workLogs } = useDataStore()
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const log = useMemo(() => workLogs.find((l) => l.id === logId) ?? null, [workLogs, logId])

  useEffect(() => {
    setNote(log?.managerNote ?? '')
    setSaved(false)
  }, [logId])

  useEffect(() => {
    if (!logId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [logId, onClose])

  if (!log) return null

  const employee = employeeById(log.employeeId)
  const isMissing = log.status === 'missing'
  const noteChanged = note.trim() !== (log.managerNote ?? '')

  async function saveNote() {
    if (!log) return
    await updateWorkLog(log.id, { managerNote: note.trim() || null })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Submission detail">
      <div className="absolute inset-0 animate-fade bg-slate-950/40" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 flex w-full max-w-lg animate-fade-up flex-col border-l border-line bg-surface shadow-2xl">
        {/* --------------------------------------------------- header -- */}
        <div className="flex items-start gap-3 border-b border-line p-5">
          <Avatar name={log.employeeName} tint={avatarTint(log.employeeId)} />
          <div className="min-w-0 flex-1">
            <Link
              to={`/employees/${log.employeeId}`}
              className="group inline-flex items-center gap-1.5 text-base font-semibold text-ink hover:text-brand-600 dark:hover:text-brand-400"
            >
              {log.employeeName}
              <ExternalLink className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
            <p className="mt-0.5 truncate text-sm text-ink-muted">
              {log.role} · {log.department}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip className="tnum">{log.employeeBadge}</Chip>
              {employee && <Chip>{employee.shift}</Chip>}
              {employee && <Chip>{employee.facility}</Chip>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ---------------------------------------------------- body -- */}
        <div className="scroll-slim flex-1 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink tnum">
              <CalendarRange className="size-4 text-ink-subtle" />
              Week ending {formatDate(log.weekEnding)}
            </span>
            <SubmissionBadge status={log.status} />
            {onFilterWeek && (
              <button
                type="button"
                onClick={() => onFilterWeek(log.weekEnding)}
                className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                Filter to this week
              </button>
            )}
          </div>

          {!isMissing && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Hours worked" value={`${log.hoursWorked.toFixed(1)} hrs`} />
              <Stat label={capitalize(log.outputUnit)} value={formatNumber(log.output)} />
            </div>
          )}

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Work summary
            </p>
            {isMissing ? (
              <div className="mt-2 rounded-lg border border-dashed border-line-strong bg-surface-2 p-4 text-sm text-ink-muted">
                {log.notes ?? 'No submission was received for this week.'}
              </div>
            ) : (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{log.summary}</p>
            )}
          </div>

          {log.notes && !isMissing && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Employee flag
              </p>
              <div className="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/8 dark:text-amber-200">
                <Flag className="mt-0.5 size-4 shrink-0" />
                <span>{log.notes}</span>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <Meta label="Submitted" value={log.submittedAt ? formatDateTime(log.submittedAt) : 'Never'} />
            <Meta label="Output unit" value={log.outputUnit} />
            <Meta label="Entry ID" value={log.id} mono />
          </div>

          {/* --------------------------------------- manager review -- */}
          <div className="mt-6 rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Manager review
            </p>

            <button
              type="button"
              onClick={() => void updateWorkLog(log.id, { reviewed: !log.reviewed })}
              className={clsx(
                'mt-3 inline-flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                log.reviewed
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-3',
              )}
            >
              {log.reviewed ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}
              {log.reviewed ? 'Reviewed' : 'Mark as reviewed'}
            </button>

            <label className="mt-3 block">
              <span className="text-xs font-medium text-ink-muted">Internal note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add a note for the record — not visible to the employee."
                className="mt-1.5 w-full resize-none rounded-lg border border-line-strong bg-surface p-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>

            <div className="mt-2 flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => void saveNote()} disabled={!noteChanged}>
                <Save className="size-3.5" />
                Save note
              </Button>
              {saved && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Saved</span>
              )}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-ink-subtle">
              {/* TODO: replace with API call — PATCH /api/work-logs/:id */}
              Phase 1: review state is held in local app state and resets on reload.
            </p>
          </div>
        </div>

        {/* -------------------------------------------------- footer -- */}
        <div className="border-t border-line p-4">
          <Link to={`/employees/${log.employeeId}?week=${log.weekEnding}`} onClick={onClose}>
            <Button variant="secondary" className="w-full">
              View full history for {log.employeeName.split(' ')[0]}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <p className="truncate text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-ink tnum">{value}</p>
    </div>
  )
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-xs text-ink-subtle">{label}</span>
      <span className={clsx('truncate text-right text-ink-muted', mono ? 'font-mono text-xs' : 'text-sm')}>
        {value}
      </span>
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
