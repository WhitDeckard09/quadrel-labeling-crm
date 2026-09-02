/**
 * Employee profile — identity, rolled-up stats, and the complete weekly history.
 *
 * Supports a `?week=YYYY-MM-DD` deep link (used by the dashboard and the ⌘K
 * palette) which highlights and scrolls to that week's entry.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Building2,
  UserRound,
  Flag,
  LayoutList,
  Table2,
  ChevronDown,
} from 'lucide-react'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  EmployeeStatusBadge,
  EmptyState,
  Skeleton,
  SubmissionBadge,
} from '@/components/ui/primitives'
import { EmployeeHistoryChart } from '@/components/charts'
import { useDataStore } from '@/hooks/useDataStore'
import {
  avatarTint,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatShortDate,
  tenureFrom,
} from '@/lib/format'
import type { WorkLog } from '@/types'

export function EmployeeProfile() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const highlightWeek = params.get('week')
  const { employeeById, logsForEmployee, loading, employees } = useDataStore()
  const [view, setView] = useState<'timeline' | 'table'>('timeline')
  const highlightRef = useRef<HTMLDivElement>(null)

  const employee = employeeById(id)
  const logs = useMemo(() => logsForEmployee(id), [logsForEmployee, id])
  const manager = employee?.managerId ? employeeById(employee.managerId) : undefined

  const stats = useMemo(() => {
    const submitted = logs.filter((l) => l.status !== 'missing')
    const onTime = logs.filter((l) => l.status === 'on_time').length
    const totalHours = submitted.reduce((s, l) => s + l.hoursWorked, 0)
    const totalOutput = submitted.reduce((s, l) => s + l.output, 0)
    return {
      weeks: logs.length,
      submitted: submitted.length,
      onTime,
      late: logs.filter((l) => l.status === 'late').length,
      missing: logs.filter((l) => l.status === 'missing').length,
      avgHours: submitted.length ? totalHours / submitted.length : 0,
      totalHours,
      avgOutput: submitted.length ? totalOutput / submitted.length : 0,
      totalOutput,
      onTimeRate: logs.length ? (onTime / logs.length) * 100 : 0,
      unit: logs[0]?.outputUnit ?? 'units',
    }
  }, [logs])

  const chartData = useMemo(
    () =>
      [...logs]
        .filter((l) => l.status !== 'missing')
        .sort((a, b) => (a.weekEnding < b.weekEnding ? -1 : 1))
        .map((l) => ({ weekEnding: l.weekEnding, hours: l.hoursWorked, output: l.output })),
    [logs],
  )

  useEffect(() => {
    if (highlightWeek && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightWeek, logs.length])

  if (loading && !employee) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <Card>
          <EmptyState
            icon={<UserRound className="size-5" />}
            title="Employee not found"
            description={`No record matches "${id}". They may have been removed from the roster.`}
            action={
              <Link to="/employees">
                <Button variant="primary">Back to directory</Button>
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  const directReports = employees.filter((e) => e.managerId === employee.id)

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link
        to="/employees"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Employee directory
      </Link>

      {/* -------------------------------------------------------- header -- */}
      <Card className="mb-4">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={employee.fullName} tint={avatarTint(employee.id)} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink">{employee.fullName}</h1>
              <EmployeeStatusBadge status={employee.status} />
              <Chip className="tnum">{employee.employeeId}</Chip>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {employee.role} · {employee.department}
            </p>

            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow icon={<Mail className="size-3.5" />} label="Email">
                <a href={`mailto:${employee.email}`} className="text-brand-600 hover:underline dark:text-brand-400">
                  {employee.email}
                </a>
              </InfoRow>
              <InfoRow icon={<Phone className="size-3.5" />} label="Phone">
                <span className="tnum">{employee.phone}</span>
              </InfoRow>
              <InfoRow icon={<CalendarDays className="size-3.5" />} label="Hired">
                <span className="tnum">
                  {formatDate(employee.hireDate)}{' '}
                  <span className="text-ink-subtle">({tenureFrom(employee.hireDate)})</span>
                </span>
              </InfoRow>
              <InfoRow icon={<MapPin className="size-3.5" />} label="Shift">
                {employee.shift}
              </InfoRow>
              <InfoRow icon={<Building2 className="size-3.5" />} label="Facility">
                {employee.facility}
              </InfoRow>
              <InfoRow icon={<UserRound className="size-3.5" />} label="Reports to">
                {manager ? (
                  <Link to={`/employees/${manager.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                    {manager.fullName}
                  </Link>
                ) : (
                  <span className="text-ink-subtle">Facility leadership</span>
                )}
              </InfoRow>
            </dl>

            {directReports.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <span className="text-xs font-medium text-ink-muted">
                  {directReports.length} direct report{directReports.length > 1 ? 's' : ''}:
                </span>
                {directReports.slice(0, 6).map((r) => (
                  <Link
                    key={r.id}
                    to={`/employees/${r.id}`}
                    className="rounded-md bg-surface-3 px-2 py-0.5 text-xs text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/12 dark:hover:text-brand-300"
                  >
                    {r.fullName}
                  </Link>
                ))}
                {directReports.length > 6 && (
                  <span className="text-xs text-ink-subtle">+{directReports.length - 6} more</span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* --------------------------------------------------------- stats -- */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Weeks tracked" value={formatNumber(stats.weeks)} />
        <StatTile
          label="On-time rate"
          value={formatPercent(stats.onTimeRate)}
          tone={stats.onTimeRate >= 90 ? 'good' : stats.onTimeRate >= 70 ? 'warn' : 'bad'}
        />
        <StatTile label="Late" value={formatNumber(stats.late)} tone={stats.late > 0 ? 'warn' : undefined} />
        <StatTile label="Missing" value={formatNumber(stats.missing)} tone={stats.missing > 0 ? 'bad' : undefined} />
        <StatTile label="Avg hours / wk" value={stats.avgHours.toFixed(1)} />
        <StatTile
          label="Avg output / wk"
          value={formatNumber(Math.round(stats.avgOutput))}
          note={stats.unit}
        />
      </div>

      {/* --------------------------------------------------------- chart -- */}
      {chartData.length > 1 && (
        <Card className="mb-4">
          <CardHeader
            title="Hours and output by week"
            subtitle={`Output measured in ${stats.unit}`}
          />
          <div className="mt-3">
            <EmployeeHistoryChart data={chartData} />
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------- history -- */}
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
          <div>
            <h3 className="text-sm font-semibold text-ink">Weekly submission history</h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              {stats.weeks} week{stats.weeks === 1 ? '' : 's'} on record · newest first
            </p>
          </div>
          <div className="flex rounded-lg border border-line-strong p-0.5">
            <ViewToggle active={view === 'timeline'} onClick={() => setView('timeline')} icon={<LayoutList className="size-3.5" />} label="Timeline" />
            <ViewToggle active={view === 'table'} onClick={() => setView('table')} icon={<Table2 className="size-3.5" />} label="Table" />
          </div>
        </div>

        {logs.length === 0 ? (
          <EmptyState title="No submissions on record" description="This employee has no weekly work logs yet." />
        ) : view === 'timeline' ? (
          <ol className="divide-y divide-line">
            {logs.map((log) => (
              <TimelineEntry
                key={log.id}
                log={log}
                highlighted={log.weekEnding === highlightWeek}
                innerRef={log.weekEnding === highlightWeek ? highlightRef : undefined}
              />
            ))}
          </ol>
        ) : (
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-5 py-2.5 text-left">Week ending</th>
                  <th className="px-5 py-2.5 text-left">Status</th>
                  <th className="px-5 py-2.5 text-right">Hours</th>
                  <th className="px-5 py-2.5 text-right">Output</th>
                  <th className="px-5 py-2.5 text-left">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className={clsx(
                      'align-top transition-colors hover:bg-surface-2',
                      log.weekEnding === highlightWeek && 'bg-brand-50/60 dark:bg-brand-500/8',
                    )}
                  >
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-ink tnum">
                      {formatShortDate(log.weekEnding)}
                    </td>
                    <td className="px-5 py-3">
                      <SubmissionBadge status={log.status} />
                    </td>
                    <td className="px-5 py-3 text-right text-ink-muted tnum">
                      {log.status === 'missing' ? '—' : log.hoursWorked.toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-muted tnum">
                      {log.status === 'missing' ? '—' : formatNumber(log.output)}
                    </td>
                    <td className="max-w-md px-5 py-3 text-ink-muted">
                      {log.summary || <span className="text-ink-subtle">No submission</span>}
                      {log.notes && (
                        <p className="mt-1.5 flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                          <Flag className="mt-0.5 size-3 shrink-0" />
                          {log.notes}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

/* --------------------------------------------------------------- pieces -- */

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-ink-subtle">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{label}</dt>
        <dd className="truncate text-ink">{children}</dd>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  tone,
  note,
}: {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'bad'
  note?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <p className="truncate text-xs text-ink-muted">{label}</p>
      <p
        className={clsx(
          'mt-1 text-lg font-semibold tnum',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'warn' && 'text-amber-600 dark:text-amber-400',
          tone === 'bad' && 'text-rose-600 dark:text-rose-400',
          !tone && 'text-ink',
        )}
      >
        {value}
      </p>
      {note && <p className="truncate text-[11px] text-ink-subtle" title={note}>{note}</p>}
    </div>
  )
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'bg-surface-3 text-ink' : 'text-ink-muted hover:text-ink',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function TimelineEntry({
  log,
  highlighted,
  innerRef,
}: {
  log: WorkLog
  highlighted: boolean
  innerRef?: React.Ref<HTMLDivElement>
}) {
  const [open, setOpen] = useState(false)
  const [clipped, setClipped] = useState(false)
  const summaryRef = useRef<HTMLParagraphElement>(null)
  const isMissing = log.status === 'missing'

  // Only offer "Show more" when the text genuinely overflows its clamp — a
  // character-count guess puts the toggle under summaries that already fit.
  useEffect(() => {
    if (open) return
    const el = summaryRef.current
    if (!el) return
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [log.summary, open])

  return (
    <li>
      <div
        ref={innerRef}
        className={clsx(
          'scroll-mt-24 px-5 py-4 transition-colors',
          highlighted && 'bg-brand-50/70 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/8 dark:ring-brand-500/25',
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-sm font-semibold text-ink tnum">
            Week ending {formatDate(log.weekEnding)}
          </span>
          <SubmissionBadge status={log.status} />
          {!isMissing && (
            <span className="text-xs text-ink-subtle tnum">
              {log.hoursWorked.toFixed(1)} hrs · {formatNumber(log.output)} {log.outputUnit}
            </span>
          )}
          {log.submittedAt && (
            <span className="ml-auto text-xs text-ink-subtle tnum">
              Submitted {formatDateTime(log.submittedAt)}
            </span>
          )}
        </div>

        {isMissing ? (
          <p className="mt-2 text-sm text-ink-subtle">
            {log.notes ?? 'No submission received for this week.'}
          </p>
        ) : (
          <p
            ref={summaryRef}
            className={clsx('mt-2 text-sm leading-relaxed text-ink-muted', !open && 'line-clamp-2')}
          >
            {log.summary}
          </p>
        )}

        {!isMissing && (clipped || open) && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            {open ? 'Show less' : 'Show more'}
            <ChevronDown className={clsx('size-3 transition-transform', open && 'rotate-180')} />
          </button>
        )}

        {log.notes && !isMissing && (
          <div className="mt-2.5 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/8 dark:text-amber-200">
            <Flag className="mt-0.5 size-3.5 shrink-0" />
            <span>{log.notes}</span>
          </div>
        )}
      </div>
    </li>
  )
}
