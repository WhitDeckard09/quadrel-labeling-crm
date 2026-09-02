/**
 * Dashboard — the weekly review starting point.
 *
 * Answers, in order: did everyone submit? who didn't? what did they flag?
 * how are hours and output trending? Everything is derived from the store's
 * cached dataset via the pure helpers in `src/lib/analytics.ts`.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
  Flag,
  ArrowRight,
  ClipboardCheck,
  Inbox,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardHeader, Chip, EmptyState, Skeleton, SubmissionBadge, Avatar, Button } from '@/components/ui/primitives'
import { MetricCard } from '@/components/ui/MetricCard'
import { SubmissionsTrendChart, OutputTrendChart, DepartmentHoursChart } from '@/components/charts'
import { SERIES } from '@/components/charts/chartTheme'
import { useDataStore } from '@/hooks/useDataStore'
import {
  weeklyTrend,
  summarizeDepartments,
  missingForWeek,
  flaggedEntries,
  recentActivity,
  submissionRisk,
  delta,
} from '@/lib/analytics'
import { avatarTint, formatCompact, formatDateTime, formatNumber, formatShortDate } from '@/lib/format'

/** Trailing windows offered by the chart range control. */
const RANGES = [
  { key: '13', label: '13W', weeks: 13 },
  { key: '26', label: '26W', weeks: 26 },
  { key: '52', label: '52W', weeks: 52 },
  { key: 'all', label: 'All', weeks: Number.POSITIVE_INFINITY },
] as const

export function Dashboard() {
  const { employees, workLogs, weeks, currentWeek, loading } = useDataStore()
  const navigate = useNavigate()
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('13')

  const windowWeeks = RANGES.find((r) => r.key === range)!.weeks

  // Full-history trend drives the week-over-week metrics; the charts render a
  // trailing slice of it, because 64 bars on one axis is unreadable.
  const trend = useMemo(() => weeklyTrend(workLogs, weeks), [workLogs, weeks])
  const visibleTrend = useMemo(
    () => (windowWeeks === Number.POSITIVE_INFINITY ? trend : trend.slice(-windowWeeks)),
    [trend, windowWeeks],
  )
  const visibleWeekSet = useMemo(
    () => new Set(visibleTrend.map((w) => w.weekEnding)),
    [visibleTrend],
  )
  const departments = useMemo(
    () => summarizeDepartments(employees, workLogs.filter((l) => visibleWeekSet.has(l.weekEnding))),
    [employees, workLogs, visibleWeekSet],
  )

  const thisWeek = trend[trend.length - 1]
  const lastWeek = trend[trend.length - 2]

  const missing = useMemo(() => missingForWeek(workLogs, currentWeek), [workLogs, currentWeek])
  const flagged = useMemo(() => flaggedEntries(workLogs, 6), [workLogs])
  const activity = useMemo(() => recentActivity(workLogs, 7), [workLogs])
  const atRisk = useMemo(
    () => submissionRisk(employees, workLogs, weeks, 6).slice(0, 5),
    [employees, workLogs, weeks],
  )

  const activeCount = employees.filter((e) => e.status === 'Active').length
  const submittedThisWeek = (thisWeek?.onTime ?? 0) + (thisWeek?.late ?? 0)

  const avgOutput = thisWeek && submittedThisWeek ? thisWeek.totalOutput / submittedThisWeek : 0
  const prevAvgOutput =
    lastWeek && lastWeek.onTime + lastWeek.late
      ? lastWeek.totalOutput / (lastWeek.onTime + lastWeek.late)
      : 0

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Weekly overview"
        description={
          currentWeek
            ? `Reporting week ending ${formatShortDate(currentWeek)} · ${activeCount} active employees`
            : 'Loading reporting period…'
        }
        actions={
          <>
            <div className="flex rounded-lg border border-line-strong p-0.5" role="group" aria-label="Chart range">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  aria-pressed={range === r.key}
                  className={
                    range === r.key
                      ? 'rounded-md bg-surface-3 px-2.5 py-1 text-xs font-medium text-ink'
                      : 'rounded-md px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink'
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={() => navigate(`/submissions?week=${currentWeek}`)}>
              <ClipboardCheck className="size-4" />
              Review this week
            </Button>
          </>
        }
      />

      {/* ------------------------------------------------ summary metrics -- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Total employees"
          value={formatNumber(employees.length)}
          hint={`${activeCount} active · ${employees.length - activeCount} leave or inactive`}
          icon={<Users className="size-4" />}
          loading={loading}
        />
        <MetricCard
          label="Submitted this week"
          value={`${submittedThisWeek}/${thisWeek?.expected ?? 0}`}
          hint={`${thisWeek?.onTime ?? 0} on time · ${thisWeek?.late ?? 0} late`}
          icon={<CheckCircle2 className="size-4" />}
          tone="positive"
          delta={lastWeek ? delta(submittedThisWeek, lastWeek.onTime + lastWeek.late) : null}
          loading={loading}
          onClick={() => navigate(`/submissions?week=${currentWeek}`)}
        />
        <MetricCard
          label="Missing this week"
          value={formatNumber(thisWeek?.missing ?? 0)}
          hint={missing.length ? 'Needs follow-up' : 'Everyone accounted for'}
          icon={<AlertCircle className="size-4" />}
          tone={(thisWeek?.missing ?? 0) > 0 ? 'critical' : 'positive'}
          delta={lastWeek ? delta(thisWeek?.missing ?? 0, lastWeek.missing) : null}
          invertDelta
          loading={loading}
          onClick={() => navigate(`/submissions?week=${currentWeek}&status=missing`)}
        />
        <MetricCard
          label="Avg hours / person"
          value={thisWeek ? thisWeek.avgHours.toFixed(1) : '—'}
          hint="Across submitted weeks"
          icon={<Clock className="size-4" />}
          delta={lastWeek ? delta(thisWeek?.avgHours ?? 0, lastWeek.avgHours) : null}
          sparkline={trend.slice(-16).map((w) => w.avgHours)}
          loading={loading}
        />
        <MetricCard
          label="Avg output / person"
          value={formatCompact(Math.round(avgOutput))}
          hint="Mixed units — see note below"
          icon={<Package className="size-4" />}
          delta={delta(avgOutput, prevAvgOutput)}
          sparkline={trend.slice(-16).map((w) => (w.onTime + w.late ? w.totalOutput / (w.onTime + w.late) : 0))}
          sparklineColor={SERIES.onTime}
          loading={loading}
        />
      </div>

      {/* ------------------------------------------------------- charts -- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Submissions over time"
            subtitle={`Last ${visibleTrend.length} weeks · every expected submission, by status`}
          />
          <div className="mt-4">
            {loading ? <Skeleton className="h-[260px] w-full" /> : <SubmissionsTrendChart data={visibleTrend} />}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Hours by department"
            subtitle={`Total logged over the last ${visibleTrend.length} weeks`}
          />
          <div className="mt-4">
            {loading ? <Skeleton className="h-[260px] w-full" /> : <DepartmentHoursChart data={departments} />}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Output trend"
            subtitle="Total units logged per week — labels, pallets, inspections and tickets combined"
          />
          <div className="mt-4">
            {loading ? <Skeleton className="h-[260px] w-full" /> : <OutputTrendChart data={visibleTrend} />}
          </div>
          <p className="mt-3 border-t border-line pt-3 text-xs text-ink-subtle">
            Output units differ by role, so this line reads as relative volume rather than a single
            physical quantity. Per-role figures are on each employee profile.
          </p>
        </Card>

        {/* ------------------------------------- missing this week list -- */}
        <Card padded={false} className="self-start">
          <div className="flex items-start justify-between gap-3 p-5 pb-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                Missing this week
                {missing.length > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-100 px-1.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                    {missing.length}
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                Week ending {formatShortDate(currentWeek)}
              </p>
            </div>
            {missing.length > 0 && (
              <Link
                to={`/submissions?week=${currentWeek}&status=missing`}
                className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                View all
              </Link>
            )}
          </div>

          {loading ? (
            <div className="space-y-3 p-5 pt-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : missing.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-5" />}
              title="Every submission is in"
              description="No follow-up needed for this reporting week."
            />
          ) : (
            <ul className="scroll-slim max-h-[340px] divide-y divide-line overflow-y-auto">
              {missing.map((log) => {
                const employee = employees.find((e) => e.id === log.employeeId)
                return (
                  <li key={log.id}>
                    <Link
                      to={`/employees/${log.employeeId}`}
                      className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <Avatar name={log.employeeName} tint={avatarTint(log.employeeId)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{log.employeeName}</p>
                        <p className="truncate text-xs text-ink-muted">
                          {log.role} · {log.department}
                        </p>
                      </div>
                      {employee?.status === 'On Leave' ? (
                        <Chip className="bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                          On leave
                        </Chip>
                      ) : (
                        <ArrowRight className="size-4 shrink-0 text-ink-subtle" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ---------------------------------------- flags, risk, activity -- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card padded={false} className="xl:col-span-2">
          <div className="flex items-start justify-between gap-3 p-5 pb-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Flag className="size-4 text-amber-500" />
                Recently flagged entries
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                Weeks where an employee left a note for their manager
              </p>
            </div>
            <Link
              to="/submissions?flagged=true"
              className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3 p-5 pt-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : flagged.length === 0 ? (
            <EmptyState icon={<Inbox className="size-5" />} title="No flagged entries" />
          ) : (
            <ul className="divide-y divide-line">
              {flagged.map((log) => (
                <li key={log.id}>
                  <Link
                    to={`/employees/${log.employeeId}?week=${log.weekEnding}`}
                    className="block px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-ink">{log.employeeName}</span>
                      <Chip>{log.department}</Chip>
                      <span className="text-xs text-ink-subtle tnum">
                        week ending {formatShortDate(log.weekEnding)}
                      </span>
                    </div>
                    <p className="mt-1 border-l-2 border-amber-400 pl-2.5 text-sm text-ink-muted">
                      {log.notes}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card padded={false}>
            <div className="p-5 pb-3">
              <h3 className="text-sm font-semibold text-ink">Follow-up list</h3>
              <p className="mt-0.5 text-xs text-ink-muted">Weakest submission records, last 6 weeks</p>
            </div>
            {loading ? (
              <div className="space-y-3 p-5 pt-0">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : atRisk.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="size-5" />} title="Nothing outstanding" />
            ) : (
              <ul className="divide-y divide-line">
                {atRisk.map(({ employee, missing: m, late }) => (
                  <li key={employee.id}>
                    <Link
                      to={`/employees/${employee.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <Avatar name={employee.fullName} tint={avatarTint(employee.id)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{employee.fullName}</p>
                        <p className="truncate text-xs text-ink-muted">{employee.department}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {m > 0 && (
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 tnum dark:bg-rose-500/12 dark:text-rose-300">
                            {m} missing
                          </span>
                        )}
                        {late > 0 && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 tnum dark:bg-amber-500/12 dark:text-amber-300">
                            {late} late
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padded={false}>
            <div className="p-5 pb-3">
              <h3 className="text-sm font-semibold text-ink">Recent activity</h3>
              <p className="mt-0.5 text-xs text-ink-muted">Latest submissions received</p>
            </div>
            {loading ? (
              <div className="space-y-3 p-5 pt-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {activity.map((log) => (
                  <li key={log.id} className="flex items-center gap-3 px-5 py-2.5">
                    <SubmissionBadge status={log.status} />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/employees/${log.employeeId}`}
                        className="block truncate text-sm font-medium text-ink hover:text-brand-600"
                      >
                        {log.employeeName}
                      </Link>
                    </div>
                    <span className="shrink-0 text-xs text-ink-subtle tnum">
                      {formatDateTime(log.submittedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
