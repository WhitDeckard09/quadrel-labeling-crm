/**
 * Pure filter/sort logic, defined once.
 *
 * Both sides use these:
 *  - `src/api/client.ts` runs them to emulate server-side filtering.
 *  - `src/hooks/useDataStore.tsx` runs them against the cached working set so
 *    typing in a search box is instant instead of round-tripping.
 *
 * When the real API lands, the store switches from calling these to calling the
 * client — the query objects it passes are already the right shape.
 */
import type { Employee, EmployeeQuery, WorkLog, WorkLogQuery } from '@/types'

function matches(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle)
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true })
}

export function applyEmployeeQuery(rows: Employee[], query: EmployeeQuery = {}): Employee[] {
  const {
    search = '',
    department = 'all',
    role = 'all',
    status = 'all',
    shift = 'all',
    sortBy = 'fullName',
    sortDir = 'asc',
  } = query
  const needle = search.trim().toLowerCase()

  const filtered = rows.filter((e) => {
    if (department !== 'all' && e.department !== department) return false
    if (role !== 'all' && e.role !== role) return false
    if (status !== 'all' && e.status !== status) return false
    if (shift !== 'all' && e.shift !== shift) return false
    if (needle) {
      return (
        matches(e.fullName, needle) ||
        matches(e.employeeId, needle) ||
        matches(e.email, needle) ||
        matches(e.role, needle) ||
        matches(e.department, needle)
      )
    }
    return true
  })

  return filtered.sort((a, b) => {
    const r = compare(a[sortBy], b[sortBy])
    return sortDir === 'asc' ? r : -r
  })
}

/** Sort weight for submission status so "worst first" is a real ordering. */
const STATUS_RANK = { missing: 0, late: 1, on_time: 2 } as const

export function applyWorkLogQuery(rows: WorkLog[], query: WorkLogQuery = {}): WorkLog[] {
  const {
    search = '',
    weekEnding = 'all',
    department = 'all',
    submissionStatus = 'all',
    employeeId,
    flaggedOnly = false,
    sortBy = 'weekEnding',
    sortDir = 'desc',
  } = query
  const needle = search.trim().toLowerCase()

  const filtered = rows.filter((l) => {
    if (employeeId && l.employeeId !== employeeId) return false
    if (weekEnding !== 'all' && l.weekEnding !== weekEnding) return false
    if (department !== 'all' && l.department !== department) return false
    if (submissionStatus !== 'all' && l.status !== submissionStatus) return false
    if (flaggedOnly && !l.notes) return false
    if (needle) {
      return (
        matches(l.employeeName, needle) ||
        matches(l.summary, needle) ||
        matches(l.employeeBadge, needle) ||
        matches(l.role, needle) ||
        matches(l.department, needle) ||
        (l.notes ? matches(l.notes, needle) : false)
      )
    }
    return true
  })

  return filtered.sort((a, b) => {
    const r =
      sortBy === 'status'
        ? STATUS_RANK[a.status] - STATUS_RANK[b.status]
        : compare(a[sortBy], b[sortBy])
    // Stable secondary sort keeps equal rows from jumping around between renders.
    const tie = r === 0 ? a.employeeName.localeCompare(b.employeeName) : 0
    return (sortDir === 'asc' ? r : -r) || tie
  })
}
