/** Aggregation helpers shared by the assistant's handlers. */
import type { WorkLog } from '@/types'

export interface Agg {
  expected: number
  submitted: number
  onTime: number
  late: number
  missing: number
  hours: number
  avgHours: number
  output: number
  avgOutput: number
  onTimeRate: number
  flags: number
}

export function aggregate(logs: WorkLog[]): Agg {
  const submittedRows = logs.filter((l) => l.status !== 'missing')
  const hours = submittedRows.reduce((s, l) => s + l.hoursWorked, 0)
  const output = submittedRows.reduce((s, l) => s + l.output, 0)
  const onTime = logs.filter((l) => l.status === 'on_time').length
  return {
    expected: logs.length,
    submitted: submittedRows.length,
    onTime,
    late: logs.filter((l) => l.status === 'late').length,
    missing: logs.filter((l) => l.status === 'missing').length,
    hours,
    avgHours: submittedRows.length ? hours / submittedRows.length : 0,
    output,
    avgOutput: submittedRows.length ? output / submittedRows.length : 0,
    onTimeRate: logs.length ? (onTime / logs.length) * 100 : 0,
    flags: logs.filter((l) => l.notes).length,
  }
}

/**
 * Median weekly output per role, across all history.
 *
 * Output units differ by role — a Line Operator prints 120,000 labels while an
 * AP Clerk processes 200 invoices — so raw output can never be compared across
 * roles. Everything the assistant ranks uses output *relative to this baseline*,
 * which is comparable and honest.
 */
export function roleOutputBaselines(logs: WorkLog[]): Map<string, number> {
  const byRole = new Map<string, number[]>()
  for (const l of logs) {
    if (l.status === 'missing') continue
    const bucket = byRole.get(l.role)
    if (bucket) bucket.push(l.output)
    else byRole.set(l.role, [l.output])
  }
  const out = new Map<string, number>()
  for (const [role, values] of byRole) {
    values.sort((a, b) => a - b)
    const mid = Math.floor(values.length / 2)
    out.set(role, values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2)
  }
  return out
}

/** Average output as a multiple of the role's median. 1.0 = typical. */
export function outputIndex(logs: WorkLog[], baselines: Map<string, number>): number | null {
  const rows = logs.filter((l) => l.status !== 'missing')
  if (!rows.length) return null
  let total = 0
  let counted = 0
  for (const l of rows) {
    const base = baselines.get(l.role)
    if (!base) continue
    total += l.output / base
    counted++
  }
  return counted ? total / counted : null
}

/** Percentage change, or null when there is no baseline to compare against. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

/** "up 12%" / "down 4%" / "flat" — used in the assistant's prose. */
export function describeChange(delta: number | null, flatBand = 2): string {
  if (delta === null) return 'not comparable'
  if (Math.abs(delta) < flatBand) return 'about flat'
  return `${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)}%`
}
