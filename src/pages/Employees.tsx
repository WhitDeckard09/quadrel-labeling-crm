/**
 * Employee directory — searchable, filterable, sortable roster.
 * Filter state lives in the URL so a filtered view can be bookmarked or shared.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SearchX, Users, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmployeeStatusBadge,
  EmptyState,
  SearchInput,
  Select,
  SortHeader,
  SubmissionBadge,
  TableSkeleton,
} from '@/components/ui/primitives'
import { useDataStore } from '@/hooks/useDataStore'
import { useUrlState } from '@/hooks/useUrlState'
import { applyEmployeeQuery } from '@/lib/query'
import { avatarTint, formatDate, formatPercent, formatShortDate, tenureFrom } from '@/lib/format'
import { DEPARTMENTS, SHIFTS } from '@/data/roles'
import type { Employee, EmployeeQuery, WorkLog } from '@/types'

const DEFAULTS = {
  q: '',
  department: 'all',
  role: 'all',
  status: 'all',
  shift: 'all',
  sort: 'fullName',
  dir: 'asc',
}

/** Trailing-6-week on-time rate + this person's most recent submission. */
function complianceFor(logs: WorkLog[], weeks: string[]) {
  const window = new Set([...weeks].sort().slice(-6))
  const rows = logs.filter((l) => window.has(l.weekEnding))
  const onTime = rows.filter((l) => l.status === 'on_time').length
  return {
    rate: rows.length ? (onTime / rows.length) * 100 : null,
    latest: logs[0] ?? null,
  }
}

export function Employees() {
  const { employees, weeks, roles, loading, logsForEmployee } = useDataStore()
  const { state, setState, reset, activeCount } = useUrlState(DEFAULTS)

  const rows = useMemo(() => {
    const query: EmployeeQuery = {
      search: state.q,
      department: state.department as EmployeeQuery['department'],
      role: state.role,
      status: state.status as EmployeeQuery['status'],
      shift: state.shift as EmployeeQuery['shift'],
      sortBy: state.sort as keyof Employee,
      sortDir: state.dir as 'asc' | 'desc',
    }
    return applyEmployeeQuery(employees, query)
  }, [employees, state])

  function toggleSort(column: keyof Employee) {
    if (state.sort === column) setState({ dir: state.dir === 'asc' ? 'desc' : 'asc' })
    else setState({ sort: column, dir: 'asc' })
  }

  const sortProps = (column: keyof Employee) => ({
    active: state.sort === column,
    direction: state.dir as 'asc' | 'desc',
    onClick: () => toggleSort(column),
  })

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Employee directory"
        description={`${employees.length} people across ${DEPARTMENTS.length} departments`}
      />

      <Card padded={false}>
        {/* -------------------------------------------------- filter bar -- */}
        <div className="border-b border-line p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={state.q}
              onChange={(q) => setState({ q })}
              placeholder="Search by name, badge, email or role…"
              className="lg:max-w-xs lg:flex-1"
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:ml-auto lg:flex lg:flex-none">
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
                label="Role"
                value={state.role}
                onChange={(e) => setState({ role: e.target.value })}
                className="lg:w-52"
              >
                <option value="all">All roles</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>

              <Select
                label="Status"
                value={state.status}
                onChange={(e) => setState({ status: e.target.value })}
                className="lg:w-36"
              >
                <option value="all">Any status</option>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </Select>

              <Select
                label="Shift"
                value={state.shift}
                onChange={(e) => setState({ shift: e.target.value })}
                className="lg:w-36"
              >
                <option value="all">Any shift</option>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <p className="text-xs text-ink-muted tnum">
              {loading ? 'Loading…' : `${rows.length} of ${employees.length} employees`}
            </p>
            {activeCount > 0 && (
              <Button size="sm" variant="ghost" onClick={reset}>
                <X className="size-3.5" />
                Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------ table -- */}
        {loading ? (
          <TableSkeleton rows={10} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-5" />}
            title="No employees match these filters"
            description="Try widening the department or clearing the search."
            action={
              <Button variant="secondary" onClick={reset}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[1010px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="whitespace-nowrap px-3 py-2.5 text-left">
                    <SortHeader label="Employee" {...sortProps('fullName')} />
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-left">
                    <SortHeader label="Role" {...sortProps('role')} />
                  </th>
                  <th className="hidden whitespace-nowrap px-3 py-2.5 text-left lg:table-cell">
                    <SortHeader label="Department" {...sortProps('department')} />
                  </th>
                  <th className="hidden whitespace-nowrap px-3 py-2.5 text-left 2xl:table-cell">
                    <SortHeader label="Shift / Facility" {...sortProps('shift')} />
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-left">
                    <SortHeader label="Status" {...sortProps('status')} />
                  </th>
                  <th className="hidden whitespace-nowrap px-3 py-2.5 text-right lg:table-cell">
                    <SortHeader label="Tenure" align="right" {...sortProps('hireDate')} />
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right">
                    <span
                      className="text-xs font-semibold uppercase tracking-wide text-ink-subtle"
                      title="Share of the last six weeks submitted on time"
                    >
                      On time
                    </span>
                  </th>
                  <th className="hidden whitespace-nowrap px-3 py-2.5 text-right sm:table-cell">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                      Latest
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((employee) => {
                  const { rate, latest } = complianceFor(logsForEmployee(employee.id), weeks)
                  return (
                    <tr key={employee.id} className="group transition-colors hover:bg-surface-2">
                      <td className="max-w-[15rem] px-3 py-2.5">
                        <Link to={`/employees/${employee.id}`} className="flex items-center gap-3">
                          <Avatar name={employee.fullName} tint={avatarTint(employee.id)} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink group-hover:text-brand-600 dark:group-hover:text-brand-400">
                              {employee.fullName}
                            </p>
                            <p className="truncate text-xs text-ink-subtle tnum">
                              {employee.employeeId} · {employee.email}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{employee.role}</td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 lg:table-cell">
                        <Chip>{employee.department}</Chip>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 2xl:table-cell">
                        <p className="text-ink-muted">{employee.shift}</p>
                        <p className="text-xs text-ink-subtle">{employee.facility}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <EmployeeStatusBadge status={employee.status} />
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-right text-ink-muted tnum lg:table-cell">
                        <p>{tenureFrom(employee.hireDate)}</p>
                        <p className="text-xs text-ink-subtle">{formatDate(employee.hireDate)}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {rate === null ? (
                          <span className="text-ink-subtle">—</span>
                        ) : (
                          <span
                            className={
                              rate >= 90
                                ? 'font-medium text-emerald-600 tnum dark:text-emerald-400'
                                : rate >= 70
                                  ? 'font-medium text-amber-600 tnum dark:text-amber-400'
                                  : 'font-medium text-rose-600 tnum dark:text-rose-400'
                            }
                          >
                            {formatPercent(rate)}
                          </span>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-right sm:table-cell">
                        {latest ? (
                          <>
                            <SubmissionBadge status={latest.status} />
                            <p className="mt-0.5 text-xs text-ink-subtle tnum">
                              {formatShortDate(latest.weekEnding)}
                            </p>
                          </>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && rows.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-subtle">
          <Users className="size-3.5" />
          Select an employee to open their full weekly submission history.
        </p>
      )}
    </div>
  )
}
