/**
 * Domain model for the Quadrel Labeling work-log CRM.
 *
 * These interfaces are the contract between the UI and the data layer. When the
 * real backend lands, the only thing that should change is *where* these objects
 * come from (`src/api/client.ts`) — not their shape. Keep field names aligned
 * with whatever the API/database ends up exposing.
 */

export type Department =
  | 'Production'
  | 'Quality Assurance'
  | 'Warehouse & Logistics'
  | 'Maintenance'
  | 'Administration'

export type EmployeeStatus = 'Active' | 'On Leave' | 'Inactive'

export type Shift = 'Day Shift' | 'Night Shift' | 'Swing Shift'

/** Submission lifecycle for a single employee-week. */
export type SubmissionStatus = 'on_time' | 'late' | 'missing'

export interface Employee {
  /** Stable primary key. Would be a DB uuid; FKs on WorkLog point here. */
  id: string
  /** Human-facing badge number, e.g. "QL-1004". */
  employeeId: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: string
  department: Department
  /** ISO-8601 date (YYYY-MM-DD). */
  hireDate: string
  status: EmployeeStatus
  shift: Shift
  facility: string
  /** Employee.id of this person's manager, or null for facility leadership. */
  managerId: string | null
  phone: string
}

export interface WorkLog {
  id: string
  /** FK -> Employee.id */
  employeeId: string
  /** Denormalized for list rendering. A real API would either join or expand. */
  employeeName: string
  employeeBadge: string
  department: Department
  role: string
  /** ISO-8601 date of the Saturday that closes the work week. */
  weekEnding: string
  hoursWorked: number
  /** Free-text summary the employee wrote in the weekly form. */
  summary: string
  /** Volume metric; the unit varies by role — see `outputUnit`. */
  output: number
  outputUnit: string
  /** Optional manager-relevant flag written by the employee. */
  notes: string | null
  status: SubmissionStatus
  /** ISO-8601 timestamp, or null when the week was never submitted. */
  submittedAt: string | null
  /** Manager-side review state. Set from the submissions drawer. */
  reviewed: boolean
  /** Manager's own note on this entry — distinct from the employee's `notes`. */
  managerNote: string | null
}

/** Envelope every API call resolves to — mirrors a typical REST/JSON response. */
export interface ApiResponse<T> {
  data: T
  meta: {
    total: number
    generatedAt: string
    /** Present on paginated collection endpoints. */
    page?: number
    pageSize?: number
  }
}

/* ---------- Query / filter shapes ---------- */

export interface EmployeeQuery {
  search?: string
  department?: Department | 'all'
  role?: string | 'all'
  status?: EmployeeStatus | 'all'
  shift?: Shift | 'all'
  sortBy?: keyof Employee
  sortDir?: 'asc' | 'desc'
}

export interface WorkLogQuery {
  search?: string
  weekEnding?: string | 'all'
  department?: Department | 'all'
  submissionStatus?: SubmissionStatus | 'all'
  employeeId?: string
  flaggedOnly?: boolean
  sortBy?: 'weekEnding' | 'hoursWorked' | 'output' | 'employeeName' | 'status' | 'department'
  sortDir?: 'asc' | 'desc'
}

/* ---------- Derived analytics shapes ---------- */

export interface WeekSummary {
  weekEnding: string
  onTime: number
  late: number
  missing: number
  expected: number
  totalHours: number
  totalOutput: number
  avgHours: number
  complianceRate: number
}

export interface DepartmentSummary {
  department: Department
  headcount: number
  totalHours: number
  avgHours: number
  totalOutput: number
  onTime: number
  late: number
  missing: number
  complianceRate: number
}
