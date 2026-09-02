/**
 * ============================================================================
 * MOCK DATABASE  —  Phase 1 only
 * ============================================================================
 *
 * This module is the *entire* fake persistence layer. Nothing else in the app
 * generates data. When the real backend arrives:
 *
 *   1. Delete this file.
 *   2. Point the functions in `src/api/client.ts` at real HTTP endpoints.
 *   3. Leave every component untouched — they only ever see `Employee`,
 *      `WorkLog` and `ApiResponse<T>` from `src/types`.
 *
 * The generator is seeded, so the same 50 people and the same numbers appear on
 * every load. Week boundaries are computed from the real current date so the
 * dashboard always reads as "this week" during a demo.
 */
import type { Employee, WorkLog, SubmissionStatus, Shift, EmployeeStatus, Department } from '@/types'
import { ROLES, JOB_NAMES, FACILITIES, type RoleProfile } from './roles'
import { FIRST_NAMES, LAST_NAMES, NOTE_POOL, LATE_REASONS } from './names'
import { makeRng, hashString, int, float, pick, chance, weightedPick, gaussian, type Rng } from './random'

const SEED = 20260902
const EMPLOYEE_COUNT = 50
/**
 * Weeks of history for the longest-tenured employees. 64 weeks (~15 months)
 * is deliberate: it is the minimum that makes year-over-year comparisons real
 * ("how is she doing vs. this time last year") rather than something the
 * assistant has to decline.
 */
const MAX_WEEKS = 64

/* ------------------------------------------------------------------ dates -- */

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

/** The Saturday that closed the most recently completed work week. */
function mostRecentWeekEnding(from = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  // getDay(): 0 = Sunday … 6 = Saturday. Step back to the previous Saturday.
  const back = d.getDay() === 6 ? 0 : d.getDay() + 1
  return addDays(d, -back)
}

/** Week-ending dates, oldest first. Index MAX_WEEKS-1 is the current week. */
function buildWeekEndings(): string[] {
  const latest = mostRecentWeekEnding()
  const weeks: string[] = []
  for (let i = MAX_WEEKS - 1; i >= 0; i--) weeks.push(toISODate(addDays(latest, -7 * i)))
  return weeks
}

export const WEEK_ENDINGS: string[] = buildWeekEndings()
export const CURRENT_WEEK: string = WEEK_ENDINGS[WEEK_ENDINGS.length - 1]

/* -------------------------------------------------------------- employees -- */

function emailFor(first: string, last: string, taken: Set<string>): string {
  const base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '')
  let handle = base
  let n = 2
  while (taken.has(handle)) handle = `${base}${n++}`
  taken.add(handle)
  return `${handle}@quadrellabeling.com`
}

function facilityFor(dept: Department, rng: Rng): string {
  switch (dept) {
    case 'Administration':
      return FACILITIES[3]
    case 'Warehouse & Logistics':
      return chance(rng, 0.75) ? FACILITIES[2] : FACILITIES[0]
    case 'Quality Assurance':
      return chance(rng, 0.7) ? FACILITIES[0] : FACILITIES[1]
    default:
      return chance(rng, 0.6) ? FACILITIES[0] : FACILITIES[1]
  }
}

function shiftFor(dept: Department, rng: Rng): Shift {
  if (dept === 'Administration') return chance(rng, 0.92) ? 'Day Shift' : 'Swing Shift'
  return weightedPick(rng, [
    ['Day Shift', 6],
    ['Night Shift', 3],
    ['Swing Shift', 1.5],
  ] as const)
}

/** Per-employee traits that drive how their weekly rows look. Not persisted —
 *  a real system would derive equivalent signals from actual submission history. */
interface Persona {
  /** 'terse' | 'standard' | 'detailed' | 'listy' | 'casual' — writing style. */
  voice: 'terse' | 'standard' | 'detailed' | 'listy' | 'casual'
  /** 0–1. Probability a given week is submitted on time. */
  reliability: number
  /** Output multiplier vs. the role baseline. */
  performance: number
  /** Typical weekly hours before noise. */
  baseHours: number
  /** How often they leave a note/flag. */
  chattiness: number
  /** Some people drop the trailing period. */
  dropsPeriods: boolean
}

function buildPersona(rng: Rng): Persona {
  return {
    voice: weightedPick(rng, [
      ['standard', 4],
      ['terse', 3],
      ['detailed', 3],
      ['casual', 2],
      ['listy', 1.2],
    ] as const),
    // Most people submit reliably; a handful are chronically late.
    reliability: weightedPick(rng, [
      [float(rng, 0.96, 1.0, 3), 6],
      [float(rng, 0.86, 0.95, 3), 3],
      [float(rng, 0.62, 0.82, 3), 1.2],
    ] as const),
    performance: gaussian(rng, 1, 0.32, 0.6, 1.55),
    baseHours: weightedPick(rng, [
      [float(rng, 39, 42, 1), 6],
      [float(rng, 43, 51, 1), 2.5],
      [float(rng, 30, 38, 1), 1.5],
    ] as const),
    chattiness: float(rng, 0.04, 0.24, 3),
    dropsPeriods: chance(rng, 0.18),
  }
}

interface SeededEmployee {
  employee: Employee
  role: RoleProfile
  persona: Persona
  /** Weeks of history this person has (bounded by tenure). */
  historyWeeks: number
  /** For Inactive employees: how many weeks ago they left. */
  weeksSinceDeparture: number
}

function generateEmployees(): SeededEmployee[] {
  const rng = makeRng(SEED)
  const takenEmails = new Set<string>()
  const usedNames = new Set<string>()
  // Surnames may repeat once (families do work the same plant) but not more —
  // three Weatherbys in a 50-person roster reads as generated, not real.
  const surnameUse = new Map<string, number>()
  const roleTable = ROLES.flatMap((r) => Array<RoleProfile>(Math.round(r.weight * 2)).fill(r))

  const seeded: SeededEmployee[] = []

  for (let i = 0; i < EMPLOYEE_COUNT; i++) {
    let firstName = pick(rng, FIRST_NAMES)
    let lastName = pick(rng, LAST_NAMES)
    let guard = 0
    while (
      (usedNames.has(`${firstName} ${lastName}`) || (surnameUse.get(lastName) ?? 0) >= 2) &&
      guard++ < 60
    ) {
      firstName = pick(rng, FIRST_NAMES)
      lastName = pick(rng, LAST_NAMES)
    }
    usedNames.add(`${firstName} ${lastName}`)
    surnameUse.set(lastName, (surnameUse.get(lastName) ?? 0) + 1)

    const role = pick(rng, roleTable)
    const department = role.department
    const status: EmployeeStatus = weightedPick(rng, [
      ['Active', 88],
      ['On Leave', 6],
      ['Inactive', 6],
    ] as const)

    const tenureDays = int(rng, 150, 365 * 8)
    const hireDate = toISODate(addDays(new Date(), -tenureDays))
    const tenureWeeks = Math.floor(tenureDays / 7)

    const employee: Employee = {
      id: `emp_${String(1001 + i)}`,
      employeeId: `QL-${1001 + i}`,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: emailFor(firstName, lastName, takenEmails),
      role: role.title,
      department,
      hireDate,
      status,
      shift: shiftFor(department, rng),
      facility: facilityFor(department, rng),
      managerId: null, // assigned in a second pass once supervisors exist
      phone: `(${pick(rng, ['614', '937', '740'] as const)}) 555-${String(int(rng, 1000, 9999))}`,
    }

    seeded.push({
      employee,
      role,
      persona: buildPersona(rng),
      historyWeeks: Math.min(MAX_WEEKS, Math.max(4, tenureWeeks)),
      weeksSinceDeparture: status === 'Inactive' ? int(rng, 2, 9) : 0,
    })
  }

  // Second pass: point everyone at a supervisor/lead inside their department.
  const leadTitles = ['Shift Supervisor', 'Team Lead', 'Maintenance Supervisor', 'Compliance Specialist', 'HR Coordinator']
  const rng2 = makeRng(SEED + 7)
  for (const s of seeded) {
    if (leadTitles.includes(s.employee.role)) continue
    const candidates = seeded.filter(
      (c) =>
        c.employee.department === s.employee.department &&
        leadTitles.includes(c.employee.role) &&
        c.employee.id !== s.employee.id &&
        c.employee.status === 'Active',
    )
    if (candidates.length) s.employee.managerId = pick(rng2, candidates).employee.id
  }

  return seeded
}

/* ------------------------------------------------------------- summaries -- */

const CONTRACTIONS: [RegExp, string][] = [
  [/\bdo not\b/g, "don't"],
  [/\bdid not\b/g, "didn't"],
  [/\bdoes not\b/g, "doesn't"],
  [/\bwas not\b/g, "wasn't"],
  [/\bhave not\b/g, "haven't"],
  [/\bit is\b/g, "it's"],
  [/\bwe are\b/g, "we're"],
  [/\bI am\b/g, "I'm"],
  [/\bthat is\b/g, "that's"],
  [/\bcould not\b/g, "couldn't"],
  [/\bwould not\b/g, "wouldn't"],
  [/\bis not\b/g, "isn't"],
  [/\bcannot\b/g, "can't"],
]

function fillPlaceholders(text: string, rng: Rng, output: number, shift: string): string {
  return text
    .replace(/\{out\}/g, output.toLocaleString('en-US'))
    .replace(/\{shift\}/g, shift)
    .replace(/\{job\}/g, () => pick(rng, JOB_NAMES))
    .replace(/\{pct\}/g, () => String(int(rng, 88, 99)))
    .replace(/\{n2\}/g, () => String(int(rng, 12, 35)))
    .replace(/\{n\}/g, () => String(int(rng, 2, 9)))
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Picks from a pool while avoiding whatever this employee used recently.
 * Without this, the same operator writes "reworked the crew assignments after
 * the Tuesday call-off" three weeks running, which is exactly the templated
 * feel the dataset is meant to avoid.
 */
function makeRotatingPicker(rng: Rng, pool: readonly string[]) {
  // Exhaust the pool before repeating, so a 16-week history reads as 16
  // different weeks rather than five phrases on rotation.
  const memorySize = Math.max(1, pool.length - 1)
  const recent: number[] = []
  return function next(): string {
    let index = Math.floor(rng() * pool.length)
    let guard = 0
    while (recent.includes(index) && guard++ < 25) index = Math.floor(rng() * pool.length)
    recent.push(index)
    if (recent.length > memorySize) recent.shift()
    return pool[index]
  }
}

interface Pickers {
  primary: () => string
  secondary: () => string
  detail: () => string
}

/**
 * Compose a weekly summary from the role's fragment pools using the employee's
 * voice. The same three fragments produce visibly different prose depending on
 * who "wrote" it, which is what keeps 700 summaries from looking templated.
 */
function writeSummary(
  rng: Rng,
  pickers: Pickers,
  persona: Persona,
  output: number,
  shift: string,
): string {
  const p = fillPlaceholders(pickers.primary(), rng, output, shift)
  const s = fillPlaceholders(pickers.secondary(), rng, output, shift)
  const d = fillPlaceholders(pickers.detail(), rng, output, shift)

  // Several sentence shapes per voice. Reusing the same three fragments in a
  // different arrangement is what keeps a 64-week history from reading like a
  // form letter, without needing an unmanageably large phrase bank.
  const shape = int(rng, 0, 3)
  let text: string
  switch (persona.voice) {
    case 'terse':
      text =
        shape === 0
          ? capitalize(p)
          : shape === 1
            ? `${capitalize(p)}. ${capitalize(d)}`
            : shape === 2
              ? `${capitalize(d)}. ${capitalize(p)}`
              : `${capitalize(p)} — ${d}`
      break
    case 'detailed':
      text =
        shape === 0
          ? `${capitalize(p)}, and ${s}. ${capitalize(d)}.`
          : shape === 1
            ? `${capitalize(p)}. ${capitalize(s)}, and ${d}.`
            : shape === 2
              ? `${capitalize(p)}. ${capitalize(s)}. ${capitalize(d)}.`
              : `${capitalize(d)}. ${capitalize(p)}, and ${s}.`
      break
    case 'listy':
      text =
        shape === 0
          ? `${capitalize(p)} · ${s} · ${d}`
          : shape === 1
            ? `${capitalize(p)}; ${s}; ${d}`
            : shape === 2
              ? `${capitalize(p)} · ${d}`
              : `${capitalize(s)} · ${p} · ${d}`
      break
    case 'casual': {
      const base =
        shape === 0
          ? `${p} and ${s}. ${capitalize(d)}.`
          : shape === 1
            ? `${p}. ${s} too. ${capitalize(d)}.`
            : shape === 2
              ? `${p} — ${s}. ${capitalize(d)}.`
              : `${p} and ${s}, so ${d}.`
      let joined = base
      for (const [re, rep] of CONTRACTIONS) joined = joined.replace(re, rep)
      text = chance(rng, 0.15) ? joined : capitalize(joined)
      break
    }
    default:
      text =
        shape === 0
          ? `${capitalize(p)}. ${capitalize(s)}.`
          : shape === 1
            ? `${capitalize(p)}. ${capitalize(d)}.`
            : shape === 2
              ? `${capitalize(p)}. ${capitalize(s)}. ${capitalize(d)}.`
              : `${capitalize(p)} — ${s}.`
  }

  if (persona.dropsPeriods) text = text.replace(/\.$/, '')
  return text.replace(/\s+/g, ' ').trim()
}

/* ------------------------------------------------------------- work logs -- */

/**
 * Note on modelling: a "missing" week still produces a WorkLog row so the UI has
 * something to render and count. A real schema would more likely materialize an
 * `expected_submissions` row and left-join the actual submission — worth
 * settling before the backend is built.
 */
function generateWorkLogs(seeded: SeededEmployee[]): WorkLog[] {
  const logs: WorkLog[] = []
  // Hard guarantee against templated-looking output: no summary is ever written
  // twice, by the same person or by anyone else.
  const usedSummaries = new Set<string>()
  // Two people filing the identical flag in the same week reads as generated
  // data, so a note is claimed for at most one employee per week.
  const claimedNotes = new Set<string>()

  function pickNote(rng: Rng, weekEnding: string): string {
    let note = pick(rng, NOTE_POOL)
    let guard = 0
    while (claimedNotes.has(`${weekEnding}:${note}`) && guard++ < 12) {
      note = pick(rng, NOTE_POOL)
    }
    claimedNotes.add(`${weekEnding}:${note}`)
    return note
  }

  for (const { employee, role, persona, historyWeeks, weeksSinceDeparture } of seeded) {
    const startIndex = WEEK_ENDINGS.length - historyWeeks

    // One stream per employee (not per week) so the rotating pickers below can
    // remember what this person already wrote about.
    const rng = makeRng(hashString(employee.id))
    const pickers: Pickers = {
      primary: makeRotatingPicker(rng, role.primary),
      secondary: makeRotatingPicker(rng, role.secondary),
      detail: makeRotatingPicker(rng, role.detail),
    }
    const shiftWord = employee.shift.replace(' Shift', '').toLowerCase()

    // Each person settles at their own output level inside the role's range and
    // varies modestly around it week to week. Drawing fresh from the full role
    // range every week made individual histories pure noise — which looked fine
    // in aggregate but made any period-over-period comparison meaningless.
    const [outLo, outHi] = role.outputRange
    const personalLevel = Math.min(
      outHi,
      Math.max(outLo, outLo + (outHi - outLo) * gaussian(rng, 0.5, 0.3, 0.05, 0.95) * persona.performance),
    )

    for (let w = startIndex; w < WEEK_ENDINGS.length; w++) {
      const weekEnding = WEEK_ENDINGS[w]
      const weeksAgo = WEEK_ENDINGS.length - 1 - w

      // Terminated employees stop generating expected submissions after they left.
      if (employee.status === 'Inactive' && weeksAgo < weeksSinceDeparture) continue

      // Someone on approved leave is not expected to submit, so no row is
      // generated — "missing" then means genuinely unaccounted for, which is
      // what the dashboard follow-up list is for.
      if (employee.status === 'On Leave' && weeksAgo <= 2) continue

      const status: SubmissionStatus = weightedPick(rng, [
        ['on_time', persona.reliability * 100],
        ['late', (1 - persona.reliability) * 68],
        ['missing', (1 - persona.reliability) * 32],
      ] as const)

      const weekEndDate = new Date(`${weekEnding}T12:00:00`)

      if (status === 'missing') {
        logs.push({
          id: `log_${employee.id}_${weekEnding}`,
          employeeId: employee.id,
          employeeName: employee.fullName,
          employeeBadge: employee.employeeId,
          department: employee.department,
          role: employee.role,
          weekEnding,
          hoursWorked: 0,
          summary: '',
          output: 0,
          outputUnit: role.outputUnit,
          notes: null,
          status: 'missing',
          submittedAt: null,
          reviewed: false,
          managerNote: null,
        })
        continue
      }

      // Hours: personal baseline + weekly noise, occasionally a short/long week.
      let hours = gaussian(rng, persona.baseHours, 4.5, 12, 62)
      if (chance(rng, 0.06)) hours = float(rng, 14, 28, 1) // holiday / partial week
      hours = Math.round(hours * 10) / 10

      // Output tracks the person's own level, the hours they actually worked,
      // and a mild company-wide upward trend, plus ±15% weekly variation.
      const trend = 0.9 + (w / WEEK_ENDINGS.length) * 0.18
      const hoursFactor = hours / 40
      const output = Math.max(
        1,
        Math.round(personalLevel * hoursFactor * trend * float(rng, 0.85, 1.15, 3)),
      )

      let summary = writeSummary(rng, pickers, persona, output, shiftWord)
      for (let attempt = 0; usedSummaries.has(summary) && attempt < 30; attempt++) {
        summary = writeSummary(rng, pickers, persona, output, shiftWord)
      }
      usedSummaries.add(summary)
      if (status === 'late' && chance(rng, 0.4)) {
        // Close the sentence first — some voices deliberately drop the period.
        const stem = /[.!?]$/.test(summary) ? summary : `${summary}.`
        summary = `${stem} ${pick(rng, LATE_REASONS)}`
      }

      // Submission timestamp: Friday afternoon for on-time, the following week for late.
      const submittedAt = new Date(weekEndDate)
      if (status === 'on_time') {
        submittedAt.setDate(submittedAt.getDate() - int(rng, 0, 1))
        submittedAt.setHours(int(rng, 13, 19), int(rng, 0, 59), 0, 0)
      } else {
        submittedAt.setDate(submittedAt.getDate() + int(rng, 2, 5))
        submittedAt.setHours(int(rng, 8, 22), int(rng, 0, 59), 0, 0)
      }

      logs.push({
        id: `log_${employee.id}_${weekEnding}`,
        employeeId: employee.id,
        employeeName: employee.fullName,
        employeeBadge: employee.employeeId,
        department: employee.department,
        role: employee.role,
        weekEnding,
        hoursWorked: hours,
        summary,
        output,
        outputUnit: role.outputUnit,
        notes: chance(rng, persona.chattiness) ? pickNote(rng, weekEnding) : null,
        status,
        submittedAt: submittedAt.toISOString(),
        // Older weeks are mostly already signed off; the recent ones are the work.
        reviewed: weeksAgo > 2 && chance(rng, 0.72),
        managerNote: null,
      })
    }
  }

  return logs.sort((a, b) => (a.weekEnding < b.weekEnding ? 1 : a.weekEnding > b.weekEnding ? -1 : a.employeeName.localeCompare(b.employeeName)))
}

/* ------------------------------------------------------------------ build -- */

const seededRoster = generateEmployees()

/** The 50-person roster. Sorted by badge number. */
export const MOCK_EMPLOYEES: Employee[] = seededRoster
  .map((s) => s.employee)
  .sort((a, b) => a.employeeId.localeCompare(b.employeeId))

/** ~750 weekly submissions, newest week first. */
export const MOCK_WORK_LOGS: WorkLog[] = generateWorkLogs(seededRoster)

/** Distinct role titles present on the roster, for filter dropdowns. */
export const ROLE_TITLES: string[] = [...new Set(MOCK_EMPLOYEES.map((e) => e.role))].sort()
