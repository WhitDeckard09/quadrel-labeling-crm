/**
 * Question parsing: turn plain English into entities + a time window.
 *
 * Everything here is rule-based and deterministic. The goal is not to understand
 * arbitrary language — it is to reliably recognise the handful of things a
 * manager actually asks about: a person, a department, a role, a status, a
 * period, and a metric.
 */
import type { Department, Employee, SubmissionStatus } from '@/types'
import type { AssistantContext, Metric, ParsedQuery, TimeWindow } from './types'
import { SHIFTS } from '@/data/roles'

/* ------------------------------------------------------------- normalize -- */

const PUNCT = /[?!.,;:()"'`]/g

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean)
}

/** Words that must never be treated as a person's name. */
const NAME_STOPWORDS = new Set([
  'best', 'top', 'most', 'worst', 'grant', 'reed', 'bishop', 'blake', 'may', 'mark',
  'will', 'week', 'team', 'lead', 'day', 'night', 'shift', 'line', 'press', 'quality',
])

/* --------------------------------------------------------------- people -- */

/**
 * Resolve employee mentions. Matches full name, first name, last name and badge
 * number. Ambiguous first names (two Bridgets) return both so the caller can ask
 * which one was meant.
 */
export function findEmployees(normalized: string, employees: Employee[]): Employee[] {
  const hits = new Map<string, Employee>()

  // Badge numbers: "QL-1023" or a bare "1023".
  const badge = normalized.match(/\bql[- ]?(\d{4})\b/) ?? normalized.match(/\b(10[0-4]\d)\b/)
  if (badge) {
    const found = employees.find((e) => e.employeeId === `QL-${badge[1]}`)
    if (found) hits.set(found.id, found)
  }

  // Full name first — an exact "amara bellamy" beats two people called Amara.
  for (const e of employees) {
    if (normalized.includes(e.fullName.toLowerCase())) hits.set(e.id, e)
  }
  if (hits.size > 0) return orderByMention(normalized, [...hits.values()])

  const tokens = new Set(tokenize(normalized))
  for (const e of employees) {
    const last = e.lastName.toLowerCase()
    const first = e.firstName.toLowerCase()
    if (tokens.has(last) && !NAME_STOPWORDS.has(last)) hits.set(e.id, e)
    else if (tokens.has(first) && !NAME_STOPWORDS.has(first)) hits.set(e.id, e)
  }

  return orderByMention(normalized, [...hits.values()])
}

/** Keep the order the names appeared in, so "compare A and B" reads A then B. */
function orderByMention(normalized: string, matches: Employee[]): Employee[] {
  const positionOf = (e: Employee) => {
    const candidates = [e.fullName, e.lastName, e.firstName]
      .map((n) => normalized.indexOf(n.toLowerCase()))
      .filter((i) => i >= 0)
    return candidates.length ? Math.min(...candidates) : Number.MAX_SAFE_INTEGER
  }
  return [...matches].sort((a, b) => positionOf(a) - positionOf(b))
}

/* ---------------------------------------------------------- other entities -- */

const DEPARTMENT_ALIASES: [RegExp, Department][] = [
  [/\bproduction\b|\bprod\b|\bpress room\b/, 'Production'],
  [/\bquality\b|\bqa\b|\bqc\b|\bquality assurance\b/, 'Quality Assurance'],
  [/\bwarehouse\b|\blogistics\b|\bshipping\b|\bwarehousing\b/, 'Warehouse & Logistics'],
  [/\bmaintenance\b|\bmaint\b/, 'Maintenance'],
  [/\badmin\b|\badministration\b|\boffice\b/, 'Administration'],
]

export function findDepartments(normalized: string): Department[] {
  const out: Department[] = []
  for (const [re, dept] of DEPARTMENT_ALIASES) {
    if (re.test(normalized) && !out.includes(dept)) out.push(dept)
  }
  return out
}

export function findRoles(normalized: string, roles: string[]): string[] {
  const out: string[] = []
  for (const role of roles) {
    const lower = role.toLowerCase()
    // Match the full title, or a distinctive plural ("line operators").
    if (normalized.includes(lower) || normalized.includes(`${lower}s`)) out.push(role)
  }
  return out
}

export function findStatuses(normalized: string): SubmissionStatus[] {
  const out: SubmissionStatus[] = []
  if (/\bmissing\b|\bmissed\b|\bhasn t submitted\b|\bhaven t submitted\b|\bdidn t submit\b|\bno submission\b|\bnot submitted\b/.test(normalized))
    out.push('missing')
  if (/\blate\b|\boverdue\b|\btardy\b/.test(normalized)) out.push('late')
  if (/\bon time\b|\bontime\b|\bpunctual\b/.test(normalized)) out.push('on_time')
  return out
}

export function findShifts(normalized: string): string[] {
  return SHIFTS.filter((s) => normalized.includes(s.toLowerCase().replace(' shift', '')))
}

export function findMetric(normalized: string): Metric | null {
  if (/\boutput\b|\bproduced\b|\bproduction volume\b|\bunits\b|\bvolume\b|\bthroughput\b/.test(normalized)) return 'output'
  if (/\bhours\b|\bhrs\b|\bovertime\b|\btime worked\b/.test(normalized)) return 'hours'
  if (/\bon time\b|\bcompliance\b|\breliab/.test(normalized)) return 'onTime'
  if (/\bflag|\bnote|\bissue|\bconcern|\bcomplain/.test(normalized)) return 'flags'
  if (/\bsubmission|\bsubmitted\b|\breports?\b/.test(normalized)) return 'submissions'
  return null
}

export function findLimit(normalized: string): number {
  const m = normalized.match(/\b(?:top|bottom|best|worst|first)\s+(\d{1,2})\b/) ?? normalized.match(/\b(\d{1,2})\s+(?:people|employees|workers)\b/)
  if (m) return Math.min(25, Math.max(1, Number(m[1])))
  return 5
}

/* ------------------------------------------------------------------ time -- */

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

function monthOf(weekEnding: string): number {
  return Number(weekEnding.slice(5, 7)) - 1
}

function yearOf(weekEnding: string): number {
  return Number(weekEnding.slice(0, 4))
}

/**
 * Resolve a time expression to a run of weeks.
 *
 * `weeksOldestFirst` must be the full history in ascending order; the last entry
 * is the current reporting week.
 */
export function parseWindow(normalized: string, weeksOldestFirst: string[]): TimeWindow {
  const all = weeksOldestFirst
  const last = (n: number, label: string): TimeWindow => ({
    weeks: all.slice(-n),
    label,
    inferred: false,
  })

  if (/\ball time\b|\bever\b|\boverall\b|\bin total\b|\ball history\b|\bto date\b/.test(normalized))
    return { weeks: all, label: 'the full history on record', inferred: false }

  // "this time last year", "a year ago", "vs last year" -> the matching week 52 back.
  if (/\bthis time last year\b|\ba year ago\b|\blast year\b|\byear over year\b|\byoy\b|\bsame time last year\b/.test(normalized)) {
    const target = all.length - 52
    if (target >= 0) {
      return { weeks: all.slice(Math.max(0, target - 3), target + 1), label: 'the same 4 weeks a year ago', inferred: false }
    }
  }

  const explicitWeeks = normalized.match(/\b(?:last|past|previous|recent)\s+(\d{1,2})\s+weeks?\b/)
  if (explicitWeeks) return last(Math.min(all.length, Number(explicitWeeks[1])), `the last ${explicitWeeks[1]} weeks`)

  const explicitMonths = normalized.match(/\b(?:last|past|previous)\s+(\d{1,2})\s+months?\b/)
  if (explicitMonths) {
    const n = Math.min(all.length, Number(explicitMonths[1]) * 4)
    return last(n, `the last ${explicitMonths[1]} months`)
  }

  if (/\blast week\b|\bprevious week\b|\bthe week before\b/.test(normalized))
    return { weeks: all.slice(-2, -1), label: 'last week', inferred: false }

  if (/\bthis week\b|\bcurrent week\b|\bthis reporting week\b|\bright now\b|\bnow\b/.test(normalized))
    return { weeks: all.slice(-1), label: 'this week', inferred: false }

  if (/\blast month\b/.test(normalized)) return { weeks: all.slice(-8, -4), label: 'last month', inferred: false }
  if (/\bthis month\b|\bpast month\b|\bthe month\b/.test(normalized)) return last(4, 'the last 4 weeks')
  if (/\blast quarter\b|\bpast quarter\b|\bthis quarter\b|\bqtr\b/.test(normalized)) return last(13, 'the last quarter')
  if (/\bthis year\b|\bytd\b|\byear to date\b/.test(normalized)) {
    const currentYear = yearOf(all[all.length - 1])
    return { weeks: all.filter((w) => yearOf(w) === currentYear), label: 'year to date', inferred: false }
  }
  if (/\bsix months\b|\b6 months\b|\bhalf year\b/.test(normalized)) return last(26, 'the last 6 months')

  // Named month: "in May", "during October".
  for (let i = 0; i < MONTHS.length; i++) {
    if (new RegExp(`\\b${MONTHS[i]}\\b`).test(normalized)) {
      const weeks = all.filter((w) => monthOf(w) === i)
      if (weeks.length) {
        const years = [...new Set(weeks.map(yearOf))]
        const label = years.length > 1 ? `${capitalize(MONTHS[i])} (both years on record)` : capitalize(MONTHS[i])
        return { weeks, label, inferred: false }
      }
    }
  }

  // Nothing stated — the caller decides what default reads best.
  return { weeks: all.slice(-1), label: 'this week', inferred: true }
}

export const YEAR_PHRASE_RE =
  /\bthis time last year\b|\bsame time last year\b|\ba year ago\b|\blast year\b|\byear over year\b|\byoy\b|\bversus last year\b/g

/**
 * Remove year-ago phrasing so the *current* window can be read from the rest of
 * the sentence. "How is she doing this month vs this time last year" should
 * anchor on "this month", not on the comparison clause.
 */
export function stripYearPhrases(normalized: string): string {
  return normalized.replace(YEAR_PHRASE_RE, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * The equivalent window one year earlier, or null when history doesn't reach.
 */
export function yearEarlier(window: TimeWindow, weeksOldestFirst: string[]): TimeWindow | null {
  const startIndex = weeksOldestFirst.indexOf(window.weeks[0])
  if (startIndex < 0) return null
  const shifted = startIndex - 52
  if (shifted < 0) return null
  const weeks = weeksOldestFirst.slice(shifted, shifted + window.weeks.length)
  if (!weeks.length) return null
  return { weeks, label: 'the same period last year', inferred: false }
}

/** The window immediately before this one, of the same length. */
export function priorWindow(window: TimeWindow, weeksOldestFirst: string[]): TimeWindow | null {
  const startIndex = weeksOldestFirst.indexOf(window.weeks[0])
  const size = window.weeks.length
  if (startIndex < size) return null
  return {
    weeks: weeksOldestFirst.slice(startIndex - size, startIndex),
    label: size === 1 ? 'the week before' : `the previous ${size} weeks`,
    inferred: false,
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ------------------------------------------------------------------ main -- */

export function parseQuestion(raw: string, ctx: AssistantContext): ParsedQuery {
  const normalized = normalize(raw)
  const weeksOldestFirst = [...ctx.weeks].sort()

  const employees = findEmployees(normalized, ctx.employees)
  const departments = findDepartments(normalized)
  const roles = findRoles(normalized, ctx.roles)
  const window = parseWindow(normalized, weeksOldestFirst)

  // Strip recognised entities so what remains can be used as a text search.
  let residual = normalized
  for (const e of employees) {
    residual = residual
      .replace(e.fullName.toLowerCase(), ' ')
      .replace(e.firstName.toLowerCase(), ' ')
      .replace(e.lastName.toLowerCase(), ' ')
  }
  for (const r of roles) residual = residual.replace(r.toLowerCase(), ' ')

  return {
    raw,
    normalized,
    tokens: tokenize(normalized),
    employees,
    departments,
    roles,
    statuses: findStatuses(normalized),
    shifts: findShifts(normalized),
    window,
    compareWindow: null,
    metric: findMetric(normalized),
    limit: findLimit(normalized),
    residual: residual.replace(/\s+/g, ' ').trim(),
  }
}
