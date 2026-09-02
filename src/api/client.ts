/**
 * ============================================================================
 * API CLIENT  —  the single seam between the UI and the data source
 * ============================================================================
 *
 * Every function is async and resolves an `ApiResponse<T>` envelope, so the UI
 * already handles latency, loading states and errors. Swapping in the real
 * backend means replacing each function body with a `fetch` — the exported
 * signatures do not change:
 *
 *   // TODO: replace with API call — GET /api/employees
 *   export async function getEmployees(query: EmployeeQuery = {}) {
 *     const res = await fetch(`/api/employees?${new URLSearchParams(query as never)}`)
 *     if (!res.ok) throw new ApiError(res.status, await res.text())
 *     return (await res.json()) as ApiResponse<Employee[]>
 *   }
 *
 * Filtering runs through `src/lib/query.ts` so that the exact same semantics
 * apply whether the work happens here or on a server later.
 */
import type { ApiResponse, Employee, EmployeeQuery, WorkLog, WorkLogQuery } from '@/types'
import { MOCK_EMPLOYEES, MOCK_WORK_LOGS, WEEK_ENDINGS, CURRENT_WEEK, ROLE_TITLES } from '@/data/mockData'
import { applyEmployeeQuery, applyWorkLogQuery } from '@/lib/query'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Simulated network latency, so loading states are real rather than decorative. */
const LATENCY_MS = { min: 140, max: 340 }

function delay(): Promise<void> {
  const ms = LATENCY_MS.min + Math.random() * (LATENCY_MS.max - LATENCY_MS.min)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function envelope<T>(data: T, total: number): ApiResponse<T> {
  return { data, meta: { total, generatedAt: new Date().toISOString() } }
}

/* ------------------------------------------------------------- employees -- */

// TODO: replace with API call — GET /api/employees
export async function getEmployees(query: EmployeeQuery = {}): Promise<ApiResponse<Employee[]>> {
  await delay()
  const rows = applyEmployeeQuery(MOCK_EMPLOYEES, query)
  return envelope(rows, rows.length)
}

// TODO: replace with API call — GET /api/employees/:id
export async function getEmployee(id: string): Promise<ApiResponse<Employee>> {
  await delay()
  const found = MOCK_EMPLOYEES.find((e) => e.id === id || e.employeeId === id)
  if (!found) throw new ApiError(404, `Employee ${id} not found`)
  return envelope(found, 1)
}

/* -------------------------------------------------------------- work logs -- */

// TODO: replace with API call — GET /api/work-logs
export async function getWorkLogs(query: WorkLogQuery = {}): Promise<ApiResponse<WorkLog[]>> {
  await delay()
  const rows = applyWorkLogQuery(MOCK_WORK_LOGS, query)
  return envelope(rows, rows.length)
}

// TODO: replace with API call — GET /api/employees/:id/work-logs
export async function getWorkLogsForEmployee(employeeId: string): Promise<ApiResponse<WorkLog[]>> {
  return getWorkLogs({ employeeId, sortBy: 'weekEnding', sortDir: 'desc' })
}

/* ------------------------------------------------------------- mutations -- */

/**
 * Manager-side edits (adding a review note, reclassifying a submission).
 * Phase 1 resolves the merged row and the store writes it into local state;
 * Phase 2 this becomes `PATCH /api/work-logs/:id` and the store re-fetches.
 */
// TODO: replace with API call — PATCH /api/work-logs/:id
export async function updateWorkLog(id: string, patch: Partial<WorkLog>): Promise<ApiResponse<WorkLog>> {
  await delay()
  const found = MOCK_WORK_LOGS.find((l) => l.id === id)
  if (!found) throw new ApiError(404, `Work log ${id} not found`)
  return envelope({ ...found, ...patch }, 1)
}

/* --------------------------------------------------------------- lookups -- */

export interface Metadata {
  /** Week-ending dates, newest first. */
  weeks: string[]
  currentWeek: string
  roles: string[]
}

// TODO: replace with API call — GET /api/meta
export async function getMetadata(): Promise<ApiResponse<Metadata>> {
  await delay()
  return envelope(
    { weeks: [...WEEK_ENDINGS].reverse(), currentWeek: CURRENT_WEEK, roles: ROLE_TITLES },
    1,
  )
}
