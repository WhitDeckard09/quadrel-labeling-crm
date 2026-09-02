/**
 * Weekly submissions — every employee-week in one filterable, sortable table.
 *
 * Filters are combinable and URL-synced (department + status + week + free text),
 * so "Production, late, week ending May 30" is a shareable link. Selecting a row
 * opens a detail drawer with the full summary and any flagged note.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { SearchX, X, Flag, Download, ChevronRight, ChevronLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  SearchInput,
  Select,
  SortHeader,
  SubmissionBadge,
  TableSkeleton,
} from '@/components/ui/primitives'
import { SubmissionDrawer } from '@/components/ui/SubmissionDrawer'
import { useDataStore } from '@/hooks/useDataStore'
import { useUrlState } from '@/hooks/useUrlState'
import { applyWorkLogQuery } from '@/lib/query'
import { statusCounts } from '@/lib/analytics'
import { avatarTint, formatCompact, formatNumber, formatShortDate } from '@/lib/format'
import { DEPARTMENTS } from '@/data/roles'
import type { WorkLogQuery } from '@/types'

const DEFAULTS = {
  q: '',
  week: 'all',
  department: 'all',
  status: 'all',
  flagged: false,
  sort: 'weekEnding',
  dir: 'desc',
}

export function Submissions() {
  const { workLogs, weeks, loading } = useDataStore()
  const { state, setState, reset, activeCount } = useUrlState(DEFAULTS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [, setParams] = useSearchParams()

  const rows = useMemo(() => {
    const query: WorkLogQuery = {
      search: state.q,
      weekEnding: state.week,
      department: state.department as WorkLogQuery['department'],
      submissionStatus: state.status as WorkLogQuery['submissionStatus'],
      flaggedOnly: state.flagged,
      sortBy: state.sort as WorkLogQuery['sortBy'],
      sortDir: state.dir as 'asc' | 'desc',
    }
    return applyWorkLogQuery(workLogs, query)
  }, [workLogs, state])

  // Any filter/sort change invalidates the current page offset.
  useEffect(() => setPage(0), [state])

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const counts = useMemo(() => statusCounts(rows), [rows])
  const submittedRows = rows.filter((r) => r.status !== 'missing')
  const totalHours = submittedRows.reduce((s, r) => s + r.hoursWorked, 0)
  const totalOutput = submittedRows.reduce((s, r) => s + r.output, 0)

  function toggleSort(column: NonNullable<WorkLogQuery['sortBy']>) {
    if (state.sort === column) setState({ dir: state.dir === 'asc' ? 'desc' : 'asc' })
    else setState({ sort: column, dir: column === 'employeeName' ? 'asc' : 'desc' })
  }

  const sortProps = (column: NonNullable<WorkLogQuery['sortBy']>) => ({
    active: state.sort === column,
    direction: state.dir as 'asc' | 'desc',
    onClick: () => toggleSort(column),
  })

  /** Client-side CSV export. Phase 2 this becomes `GET /api/work-logs.csv`. */
  function exportCsv() {
    const header = [
      'Employee',
      'Badge',
      'Department',
      'Role',
      'Week ending',
      'Status',
      'Hours',
      'Output',
      'Unit',
      'Summary',
      'Notes',
    ]
    const escape = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.employeeName,
          r.employeeBadge,
          r.department,
          r.role,
          r.weekEnding,
          r.status,
          r.status === 'missing' ? '' : r.hoursWorked,
          r.status === 'missing' ? '' : r.output,
          r.outputUnit,
          r.summary,
          r.notes,
        ]
          .map(escape)
          .join(','),
      ),
    ].join('\n')

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `quadrel-submissions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Weekly submissions"
        description="Every employee-week across the reporting period"
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={loading || rows.length === 0}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      <Card padded={false}>
        {/* --------------------------------------------------- filters -- */}
        <div className="border-b border-line p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={state.q}
              onChange={(q) => setState({ q })}
              placeholder="Search names, roles, or anything in a work summary…"
              className="lg:max-w-sm lg:flex-1"
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:ml-auto lg:flex lg:flex-none">
              <Select
                label="Week"
                value={state.week}
                onChange={(e) => setState({ week: e.target.value })}
                className="lg:w-48"
              >
                <option value="all">All weeks</option>
                {weeks.map((w, i) => (
                  <option key={w} value={w}>
                    Week ending {formatShortDate(w)}
                    {i === 0 ? ' (current)' : ''}
                  </option>
                ))}
              </Select>

              <Select
                label="Department"
                value={state.department}
                onChange={(e) => setState({ department: e.target.value })}
                className="lg:w-44"
              >
                <option value="all">All departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>

              <Select
                label="Submission status"
                value={state.status}
                onChange={(e) => setState({ status: e.target.value })}
                className="lg:w-40"
              >
                <option value="all">Any status</option>
                <option value="on_time">On time</option>
                <option value="late">Late</option>
                <option value="missing">Missing</option>
              </Select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-xs text-ink-muted tnum">
              {loading ? 'Loading…' : `${formatNumber(rows.length)} of ${formatNumber(workLogs.length)} entries`}
            </p>

            {!loading && rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <StatusPill
                  label="on time"
                  count={counts.on_time}
                  className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                />
                <StatusPill
                  label="late"
                  count={counts.late}
                  className="bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                />
                <StatusPill
                  label="missing"
                  count={counts.missing}
                  className="bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                />
                <span className="ml-1 text-ink-subtle tnum">
                  {formatNumber(totalHours, 0)} hrs logged · {formatCompact(totalOutput)} units
                  <span className="ml-1 not-italic text-ink-subtle/70">(mixed types)</span>
                </span>
              </div>
            )}

            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-muted">
              <input
                type="checkbox"
                checked={state.flagged}
                onChange={(e) => setState({ flagged: e.target.checked })}
                className="size-3.5 rounded border-line-strong text-brand-600 focus:ring-brand-500/30"
              />
              <Flag className="size-3.5 text-amber-500" />
              Flagged only
            </label>

            {activeCount > 0 && (
              <Button size="sm" variant="ghost" onClick={reset}>
                <X className="size-3.5" />
                Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------- table -- */}
        {loading ? (
          <TableSkeleton rows={12} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-5" />}
            title="No submissions match these filters"
            description="Try a different week, or clear the search."
            action={
              <Button variant="secondary" onClick={reset}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="px-4 py-2.5 text-left">
                    <SortHeader label="Employee" {...sortProps('employeeName')} />
                  </th>
                  <th className="hidden px-4 py-2.5 text-left lg:table-cell">
                    <SortHeader label="Department" {...sortProps('department')} />
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <SortHeader label="Week ending" {...sortProps('weekEnding')} />
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <SortHeader label="Status" {...sortProps('status')} />
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    <SortHeader label="Hours" align="right" {...sortProps('hoursWorked')} />
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    <SortHeader label="Output" align="right" {...sortProps('output')} />
                  </th>
                  <th className="hidden px-4 py-2.5 text-left xl:table-cell">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                      Work summary
                    </span>
                  </th>
                  <th className="w-10 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageRows.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedId(log.id)}
                    className={clsx(
                      'cursor-pointer transition-colors hover:bg-surface-2',
                      log.status === 'missing' && 'bg-rose-50/40 dark:bg-rose-500/5',
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={log.employeeName} tint={avatarTint(log.employeeId)} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{log.employeeName}</p>
                          <p className="truncate text-xs text-ink-subtle">{log.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-2.5 lg:table-cell">
                      <Chip>{log.department}</Chip>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted tnum">
                      {formatShortDate(log.weekEnding)}
                    </td>
                    <td className="px-4 py-2.5">
                      <SubmissionBadge status={log.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-muted tnum">
                      {log.status === 'missing' ? '—' : log.hoursWorked.toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {log.status === 'missing' ? (
                        <span className="text-ink-muted">—</span>
                      ) : (
                        <>
                          <p
                            className="text-ink-muted tnum"
                            title={`${formatNumber(log.output)} ${log.outputUnit}`}
                          >
                            {formatCompact(log.output)}
                          </p>
                          <p className="truncate text-xs text-ink-subtle">{log.outputUnit}</p>
                        </>
                      )}
                    </td>
                    <td className="hidden max-w-[26rem] px-4 py-2.5 xl:table-cell">
                      {log.status === 'missing' ? (
                        <span className="text-ink-subtle">No submission received</span>
                      ) : (
                        <p className="truncate text-ink-muted">{log.summary}</p>
                      )}
                      {log.notes && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-amber-700 dark:text-amber-400">
                          <Flag className="size-3 shrink-0" />
                          {log.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <ChevronRight className="size-4 text-ink-subtle" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* TODO: replace with server-side pagination — GET /api/work-logs?page=N&pageSize=M */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-2.5">
              <p className="text-xs text-ink-muted tnum">
                Showing {formatNumber(safePage * pageSize + 1)}–
                {formatNumber(Math.min((safePage + 1) * pageSize, rows.length))} of{' '}
                {formatNumber(rows.length)}
              </p>

              <div className="flex items-center gap-2">
                <Select
                  label="Rows per page"
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(0)
                  }}
                  className="w-28"
                >
                  <option value="25">25 / page</option>
                  <option value="50">50 / page</option>
                  <option value="100">100 / page</option>
                </Select>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <span className="px-1 text-xs text-ink-muted tnum">
                    {safePage + 1} / {pageCount}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={safePage >= pageCount - 1}
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <SubmissionDrawer
        logId={selectedId}
        onClose={() => setSelectedId(null)}
        onFilterWeek={(week) => {
          setParams((prev) => {
            const next = new URLSearchParams(prev)
            next.set('week', week)
            return next
          })
          setSelectedId(null)
        }}
      />
    </div>
  )
}

function StatusPill({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <span className={clsx('rounded-md px-1.5 py-0.5 font-medium tnum', className)}>
      {formatNumber(count)} {label}
    </span>
  )
}
