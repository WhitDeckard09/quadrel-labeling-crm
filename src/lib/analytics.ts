/**
 * Derived metrics computed from the in-memory dataset.
 *
 * These are pure functions over `WorkLog[]` / `Employee[]`. In production most
 * of them would move behind aggregate endpoints (`GET /api/metrics/weekly`), but
 * keeping them pure means the swap is mechanical and they stay unit-testable.
 */
import type { Employee, WorkLog, WeekSummary, DepartmentSummary, Department, SubmissionStatus } from '@/types'
import { DEPARTMENTS } from '@/data/roles'

export function summarizeWeek(logs: WorkLog[], weekEnding: string): WeekSummary {
  const rows = logs.filter((l) => l.weekEnding === weekEnding)
  return buildWeekSummary(weekEnding, rows)
}

function buildWeekSummary(weekEnding: string, rows: WorkLog[]): WeekSummary {
  const onTime = rows.filter((r) => r.status === 'on_time').length
  const late = rows.filter((r) => r.status === 'late').length
  const missing = rows.filter((r) => r.status === 'missing').length
  const submitted = rows.filter((r) => r.status !== 'missing')
  const totalHours = submitted.reduce((s, r) => s + r.hoursWorked, 0)
  const totalOutput = submitted.reduce((s, r) => s + r.output, 0)
  const expected = rows.length
  return {
    weekEnding,
    onTime,
    late,
    missing,
    expected,
    totalHours,
    totalOutput,
    avgHours: submitted.length ? totalHours / submitted.length : 0,
    complianceRate: expected ? ((onTime + late) / expected) * 100 : 0,
  }
}

/** One row per week, oldest first — the shape the charts consume. */
export function weeklyTrend(logs: WorkLog[], weeks: string[]): WeekSummary[] {
  const byWeek = new Map<string, WorkLog[]>()
  for (const l of logs) {
    const bucket = byWeek.get(l.weekEnding)
    if (bucket) bucket.push(l)
    else byWeek.set(l.weekEnding, [l])
  }
  return [...weeks]
    .sort()
    .map((w) => buildWeekSummary(w, byWeek.get(w) ?? []))
}

export function summarizeDepartments(employees: Employee[], logs: WorkLog[]): DepartmentSummary[] {
  return DEPARTMENTS.map((department) => {
    const rows = logs.filter((l) => l.department === department)
    const submitted = rows.filter((r) => r.status !== 'missing')
    const onTime = rows.filter((r) => r.status === 'on_time').length
    const late = rows.filter((r) => r.status === 'late').length
    const missing = rows.filter((r) => r.status === 'missing').length
    const totalHours = submitted.reduce((s, r) => s + r.hoursWorked, 0)
    return {
      department: department as Department,
      headcount: employees.filter((e) => e.department === department).length,
      totalHours,
      avgHours: submitted.length ? totalHours / submitted.length : 0,
      totalOutput: submitted.reduce((s, r) => s + r.output, 0),
      onTime,
      late,
      missing,
      complianceRate: rows.length ? ((onTime + late) / rows.length) * 100 : 0,
    }
  })
}

/** Employees who missed the given week — the primary manager to-do list. */
export function missingForWeek(logs: WorkLog[], weekEnding: string): WorkLog[] {
  return logs
    .filter((l) => l.weekEnding === weekEnding && l.status === 'missing')
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
}

/** Every entry carrying a note, newest first. */
export function flaggedEntries(logs: WorkLog[], limit?: number): WorkLog[] {
  const rows = logs
    .filter((l) => l.notes && l.status !== 'missing')
    .sort((a, b) => (a.weekEnding < b.weekEnding ? 1 : -1))
  return limit ? rows.slice(0, limit) : rows
}

/** Most recent submissions by timestamp — powers the activity feed. */
export function recentActivity(logs: WorkLog[], limit = 8): WorkLog[] {
  return logs
    .filter((l) => l.submittedAt)
    .sort((a, b) => (a.submittedAt! < b.submittedAt! ? 1 : -1))
    .slice(0, limit)
}

/**
 * Employees with a weak submission record over the trailing window. Surfaces the
 * people a manager should actually chase rather than a raw count.
 */
export function submissionRisk(
  employees: Employee[],
  logs: WorkLog[],
  weeks: string[],
  windowSize = 6,
): { employee: Employee; missing: number; late: number; onTime: number; rate: number }[] {
  const window = new Set([...weeks].sort().slice(-windowSize))
  const byEmployee = new Map<string, WorkLog[]>()
  for (const l of logs) {
    if (!window.has(l.weekEnding)) continue
    const bucket = byEmployee.get(l.employeeId)
    if (bucket) bucket.push(l)
    else byEmployee.set(l.employeeId, [l])
  }

  return employees
    .filter((e) => e.status !== 'Inactive')
    .map((employee) => {
      const rows = byEmployee.get(employee.id) ?? []
      const missing = rows.filter((r) => r.status === 'missing').length
      const late = rows.filter((r) => r.status === 'late').length
      const onTime = rows.filter((r) => r.status === 'on_time').length
      return { employee, missing, late, onTime, rate: rows.length ? (onTime / rows.length) * 100 : 100 }
    })
    .filter((r) => r.missing + r.late > 0)
    .sort((a, b) => b.missing * 2 + b.late - (a.missing * 2 + a.late))
}

export function statusCounts(logs: WorkLog[]): Record<SubmissionStatus, number> {
  return {
    on_time: logs.filter((l) => l.status === 'on_time').length,
    late: logs.filter((l) => l.status === 'late').length,
    missing: logs.filter((l) => l.status === 'missing').length,
  }
}

/** Percentage delta between two values; null when there is no prior value. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}
