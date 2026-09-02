/**
 * The assistant's answer engine.
 *
 * `answerQuestion` parses the question, then tries each handler in priority
 * order until one claims it. Handlers return `null` when the question isn't
 * theirs. Every number in every answer is computed from `WorkLog` rows — the
 * assistant has no generative component and cannot invent a figure.
 */
import type { Employee, WorkLog } from '@/types'
import type { Answer, AnswerBlock, AssistantContext, ParsedQuery, PersonRow, Tone } from './types'
import { parseQuestion, parseWindow, priorWindow, stripYearPhrases, yearEarlier } from './parse'
import { aggregate, describeChange, outputIndex, pctChange, roleOutputBaselines, type Agg } from './stats'
import { formatCompact, formatNumber, formatPercent, formatShortDate } from '@/lib/format'

type Handler = (q: ParsedQuery, ctx: AssistantContext) => Answer | null

/* ----------------------------------------------------------- small utils -- */

const text = (t: string): AnswerBlock => ({ kind: 'text', text: t })
const note = (t: string): AnswerBlock => ({ kind: 'note', text: t })

function logsFor(ctx: AssistantContext, weeks: string[], predicate?: (l: WorkLog) => boolean): WorkLog[] {
  const set = new Set(weeks)
  return ctx.workLogs.filter((l) => set.has(l.weekEnding) && (!predicate || predicate(l)))
}

function scopeFilter(q: ParsedQuery): ((l: WorkLog) => boolean) | undefined {
  const { departments, roles } = q
  if (!departments.length && !roles.length) return undefined
  return (l) =>
    (!departments.length || departments.includes(l.department)) &&
    (!roles.length || roles.includes(l.role))
}

/**
 * A leading-space prepositional phrase, e.g. " among Line Operators in
 * Production". Always safe to splice into a sentence; empty when unscoped.
 */
function scopeLabel(q: ParsedQuery): string {
  const parts: string[] = []
  if (q.roles.length) parts.push(`among ${q.roles.join(' and ')}s`)
  if (q.departments.length) parts.push(`in ${q.departments.join(' and ')}`)
  return parts.length ? ` ${parts.join(' ')}` : ''
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function rateTone(rate: number): Tone {
  return rate >= 90 ? 'positive' : rate >= 70 ? 'warning' : 'critical'
}

function personRow(e: Employee, sub: string, value?: string, valueSub?: string, tone?: Tone): PersonRow {
  return { employeeId: e.id, name: e.fullName, sub, value, valueSub, tone }
}

/** Standard stat tiles for an aggregate. */
function aggStats(a: Agg, opts: { showOutput?: boolean; outputLabel?: string } = {}) {
  const items = [
    { label: 'On-time rate', value: formatPercent(a.onTimeRate), tone: rateTone(a.onTimeRate) },
    { label: 'Submitted', value: `${a.submitted}/${a.expected}`, sub: `${a.late} late · ${a.missing} missing` },
    { label: 'Avg hours / wk', value: a.avgHours.toFixed(1) },
  ]
  if (opts.showOutput !== false) {
    items.push({
      label: 'Avg output / wk',
      value: formatCompact(Math.round(a.avgOutput)),
      sub: opts.outputLabel,
    } as never)
  }
  return { kind: 'stats' as const, items }
}

/* ------------------------------------------------------------- handlers -- */

const handleHelp: Handler = (q) => {
  if (!/\bhelp\b|\bwhat can you (do|answer)\b|\bwhat can i ask\b|\bhow do (i|you) use\b|^\s*hi\b|^\s*hello\b/.test(q.normalized))
    return null
  return {
    blocks: [
      text(
        "I read the weekly work logs directly — 50 employees, 64 weeks of history, about 3,000 submissions. Ask me about a person, a department, a period, or anything written in a work summary.",
      ),
      note(
        'I compute every figure from the actual records, so I can only answer what the data supports. If a question is outside it, I will say so rather than guess.',
      ),
    ],
    followUps: [
      'Who has the best stats this week?',
      'Who is missing a submission this week?',
      'How is Production doing this month?',
      'What has been flagged recently?',
    ],
  }
}

const handleDisambiguate: Handler = (q) => {
  if (q.employees.length < 2) return null
  // Two employees plus a comparison word is a real comparison, not ambiguity.
  if (/\bvs\b|\bversus\b|\bcompare|\bagainst\b|\bbetween\b|\band\b/.test(q.normalized) && q.employees.length === 2)
    return null
  return {
    blocks: [
      text(`I found ${q.employees.length} people matching that. Which one did you mean?`),
      {
        kind: 'people',
        items: q.employees.map((e) => personRow(e, `${e.role} · ${e.department}`, e.employeeId)),
      },
    ],
    followUps: q.employees.slice(0, 4).map((e) => `How is ${e.fullName} doing?`),
  }
}

/** "How is X doing vs this time last year" — explicit period comparison. */
const handleEmployeeYoY: Handler = (q, ctx) => {
  if (q.employees.length !== 1) return null
  if (!/\blast year\b|\ba year ago\b|\byear over year\b|\byoy\b|\bthis time last year\b|\bsame time last year\b/.test(q.normalized))
    return null

  const e = q.employees[0]
  const weeksAsc = [...ctx.weeks].sort()
  // q.window would have resolved to the year-ago period itself, so re-read the
  // window from the sentence with the comparison clause removed.
  const stated = parseWindow(stripYearPhrases(q.normalized), weeksAsc)
  // Default to 4 weeks so one noisy week doesn't drive the comparison.
  const current =
    stated.inferred || stated.weeks.length === 1
      ? { weeks: weeksAsc.slice(-4), label: 'the last 4 weeks', inferred: false }
      : stated
  const priorYear = yearEarlier(current, weeksAsc)

  const mine = (weeks: string[]) => logsFor(ctx, weeks, (l) => l.employeeId === e.id)
  const now = aggregate(mine(current.weeks))

  if (!priorYear || !mine(priorYear.weeks).length) {
    const first = [...ctx.workLogs.filter((l) => l.employeeId === e.id)].sort((a, b) => (a.weekEnding < b.weekEnding ? -1 : 1))[0]
    return {
      blocks: [
        text(
          `I can't run a year-over-year comparison for ${e.fullName} — the records only go back to ${first ? formatShortDate(first.weekEnding) : 'recently'}, which isn't a full year.`,
        ),
        text(`Here's how ${e.firstName} looks over ${current.label} instead:`),
        aggStats(now, { outputLabel: mine(current.weeks)[0]?.outputUnit }),
      ],
      followUps: [`How is ${e.fullName} doing?`, `What did ${e.fullName} work on last week?`],
    }
  }

  const then = aggregate(mine(priorYear.weeks))
  const baselines = roleOutputBaselines(ctx.workLogs)
  const idxNow = outputIndex(mine(current.weeks), baselines)
  const idxThen = outputIndex(mine(priorYear.weeks), baselines)

  const hoursDelta = pctChange(now.avgHours, then.avgHours)
  const outputDelta = pctChange(now.avgOutput, then.avgOutput)
  const rateDelta = now.onTimeRate - then.onTimeRate
  const unit = mine(current.weeks)[0]?.outputUnit ?? 'units'

  return {
    blocks: [
      text(
        `${e.fullName} — ${e.role}, ${e.department}. Comparing ${current.label} (ending ${formatShortDate(current.weeks[current.weeks.length - 1])}) against the same stretch a year earlier.`,
      ),
      {
        kind: 'table',
        columns: [
          { key: 'metric', label: 'Metric' },
          { key: 'then', label: 'A year ago', align: 'right' },
          { key: 'now', label: 'Now', align: 'right' },
          { key: 'change', label: 'Change', align: 'right' },
        ],
        rows: [
          {
            metric: 'Avg hours / week',
            then: then.avgHours.toFixed(1),
            now: now.avgHours.toFixed(1),
            change: describeChange(hoursDelta),
          },
          {
            metric: `Avg ${unit} / week`,
            then: formatNumber(Math.round(then.avgOutput)),
            now: formatNumber(Math.round(now.avgOutput)),
            change: describeChange(outputDelta),
          },
          {
            metric: 'On-time rate',
            then: formatPercent(then.onTimeRate),
            now: formatPercent(now.onTimeRate),
            change: Math.abs(rateDelta) < 1 ? 'about flat' : `${rateDelta > 0 ? '+' : ''}${rateDelta.toFixed(0)} pts`,
          },
          {
            metric: 'vs. role average',
            then: idxThen === null ? '—' : formatPercent(idxThen * 100),
            now: idxNow === null ? '—' : formatPercent(idxNow * 100),
            change: idxNow !== null && idxThen !== null ? describeChange(pctChange(idxNow, idxThen)) : '—',
          },
        ],
      },
      text(
        `In short: output is ${describeChange(outputDelta)} and hours are ${describeChange(hoursDelta)}. ${
          rateDelta > 1
            ? `${e.firstName} is submitting more reliably than a year ago.`
            : rateDelta < -1
              ? `${e.firstName} is submitting less reliably than a year ago.`
              : `Submission reliability is unchanged.`
        }`,
      ),
    ],
    followUps: [
      `What did ${e.fullName} work on last week?`,
      `How is ${e.department} doing this month?`,
      `Show ${e.fullName}'s flagged notes`,
    ],
  }
}

/** "What did X work on last week?" */
const handleEmployeeRecentWork: Handler = (q, ctx) => {
  if (q.employees.length !== 1) return null
  if (!/\bwhat (did|has|is)\b|\bwork(ing|ed)? on\b|\bsummar|\bdoing last week\b|\bwrote\b|\bsay\b|\bsaid\b|\breport(ed)?\b/.test(q.normalized))
    return null

  const e = q.employees[0]
  const window = q.window.inferred ? { ...q.window, weeks: [...ctx.weeks].sort().slice(-3), label: 'the last 3 weeks' } : q.window
  const rows = logsFor(ctx, window.weeks, (l) => l.employeeId === e.id).sort((a, b) =>
    a.weekEnding < b.weekEnding ? 1 : -1,
  )

  if (!rows.length)
    return {
      blocks: [text(`No submissions on record for ${e.fullName} in ${window.label}.`)],
      followUps: [`How is ${e.fullName} doing?`],
    }

  return {
    blocks: [
      text(`${e.fullName} — ${e.role}, ${e.department}. Here is what ${e.firstName} filed over ${window.label}.`),
      { kind: 'logs', items: rows.slice(0, 5) },
    ],
    followUps: [
      `How is ${e.fullName} doing compared to last year?`,
      `How is ${e.fullName} doing?`,
    ],
  }
}

/** "How is X doing?" — the general per-person read. */
const handleEmployeeStatus: Handler = (q, ctx) => {
  if (q.employees.length !== 1) return null

  const e = q.employees[0]
  const weeksAsc = [...ctx.weeks].sort()
  const window = q.window.inferred
    ? { weeks: weeksAsc.slice(-4), label: 'the last 4 weeks', inferred: false }
    : q.window

  const mine = (weeks: string[]) => logsFor(ctx, weeks, (l) => l.employeeId === e.id)
  const rows = mine(window.weeks)

  if (!rows.length)
    return {
      blocks: [
        text(
          `${e.fullName} has no submissions in ${window.label}. Their status is ${e.status}${
            e.status === 'Inactive' ? ' — they are no longer on the roster' : ''
          }.`,
        ),
      ],
      followUps: [`Show ${e.fullName}'s full history`],
    }

  const now = aggregate(rows)
  const prior = priorWindow(window, weeksAsc)
  const before = prior ? aggregate(mine(prior.weeks)) : null
  const baselines = roleOutputBaselines(ctx.workLogs)
  const idx = outputIndex(rows, baselines)
  const unit = rows[0].outputUnit
  const flagged = rows.filter((l) => l.notes)

  const blocks: AnswerBlock[] = [
    text(
      `${e.fullName} — ${e.role}, ${e.department}, ${e.shift.toLowerCase()} at ${e.facility}. Here's ${window.label}.`,
    ),
    aggStats(now, { outputLabel: unit }),
  ]

  if (idx !== null) {
    blocks.push(
      text(
        `Output is running at ${formatPercent(idx * 100)} of the typical ${e.role} week — ${
          idx >= 1.1 ? 'clearly above the role average' : idx >= 0.95 ? 'right around the role average' : idx >= 0.8 ? 'a little below the role average' : 'well below the role average'
        }.`,
      ),
    )
  }

  if (before && before.submitted > 0) {
    blocks.push(
      text(
        `Against ${prior!.label}: hours ${describeChange(pctChange(now.avgHours, before.avgHours))}, output ${describeChange(
          pctChange(now.avgOutput, before.avgOutput),
        )}.`,
      ),
    )
  }

  if (now.missing > 0 || now.late > 0) {
    blocks.push(
      note(
        `${now.missing > 0 ? `${now.missing} missing submission${now.missing > 1 ? 's' : ''}` : ''}${
          now.missing > 0 && now.late > 0 ? ' and ' : ''
        }${now.late > 0 ? `${now.late} late submission${now.late > 1 ? 's' : ''}` : ''} in this period.`,
      ),
    )
  }

  if (e.status !== 'Active') {
    blocks.push(note(`${e.firstName} is currently marked ${e.status}.`))
  }

  if (flagged.length) {
    blocks.push(text(`${e.firstName} flagged something in ${flagged.length} of these weeks:`))
    blocks.push({ kind: 'logs', items: flagged.slice(0, 3) })
  } else {
    blocks.push({ kind: 'logs', items: rows.slice(0, 1) })
  }

  return {
    blocks,
    followUps: [
      `How is ${e.fullName} doing compared to this time last year?`,
      `What did ${e.fullName} work on last week?`,
      `Who has the best stats in ${e.department} this month?`,
    ],
  }
}

/** "Compare X and Y" */
const handleComparePeople: Handler = (q, ctx) => {
  if (q.employees.length !== 2) return null
  if (!/\bvs\b|\bversus\b|\bcompare|\bagainst\b|\bbetween\b|\bor\b|\band\b/.test(q.normalized)) return null

  const weeksAsc = [...ctx.weeks].sort()
  const window = q.window.inferred
    ? { weeks: weeksAsc.slice(-4), label: 'the last 4 weeks', inferred: false }
    : q.window
  const baselines = roleOutputBaselines(ctx.workLogs)
  const [a, b] = q.employees

  const build = (e: Employee) => {
    const rows = logsFor(ctx, window.weeks, (l) => l.employeeId === e.id)
    return { e, agg: aggregate(rows), idx: outputIndex(rows, baselines), unit: rows[0]?.outputUnit ?? '—' }
  }
  const A = build(a)
  const B = build(b)

  return {
    blocks: [
      text(`${a.fullName} vs ${b.fullName} over ${window.label}.`),
      {
        kind: 'table',
        columns: [
          { key: 'metric', label: 'Metric' },
          { key: 'a', label: a.firstName, align: 'right' },
          { key: 'b', label: b.firstName, align: 'right' },
        ],
        rows: [
          { metric: 'Role', a: A.e.role, b: B.e.role },
          { metric: 'On-time rate', a: formatPercent(A.agg.onTimeRate), b: formatPercent(B.agg.onTimeRate) },
          { metric: 'Avg hours / wk', a: A.agg.avgHours.toFixed(1), b: B.agg.avgHours.toFixed(1) },
          {
            metric: 'Avg output / wk',
            a: `${formatCompact(Math.round(A.agg.avgOutput))} ${A.unit}`,
            b: `${formatCompact(Math.round(B.agg.avgOutput))} ${B.unit}`,
          },
          {
            metric: 'vs. role average',
            a: A.idx === null ? '—' : formatPercent(A.idx * 100),
            b: B.idx === null ? '—' : formatPercent(B.idx * 100),
          },
          { metric: 'Flags raised', a: A.agg.flags, b: B.agg.flags },
        ],
      },
      A.e.role !== B.e.role
        ? note(
            `${a.firstName} and ${b.firstName} do different jobs, so their raw output isn't comparable — the "vs. role average" row is the fair one.`,
          )
        : text(
            `Both are ${A.e.role}s, so the output figures are directly comparable here.`,
          ),
    ],
    followUps: [`How is ${a.fullName} doing?`, `How is ${b.fullName} doing?`],
  }
}

/* --------------------------------------------------- submission-status Qs -- */

const handleStatusList: Handler = (q, ctx) => {
  const target = q.statuses[0]
  if (!target) return null
  if (q.employees.length === 1) return null

  // "who *keeps* missing" is a pattern question — one week cannot answer it.
  const recurring = /\bkeeps?\b|\balways\b|\brepeated|\boften\b|\bchronic|\bregularly\b|\bhabitual|\bfrequently\b|\bmultiple times\b|\ba lot\b/.test(
    q.normalized,
  )
  const weeksAsc = [...ctx.weeks].sort()
  const window = q.window.inferred
    ? recurring
      ? { weeks: weeksAsc.slice(-13), label: 'the last 13 weeks', inferred: false }
      : { weeks: weeksAsc.slice(-1), label: 'this week', inferred: false }
    : q.window
  const rows = logsFor(ctx, window.weeks, (l) => l.status === target).filter(scopeFilter(q) ?? (() => true))
  const label = target === 'missing' ? 'missing' : target === 'late' ? 'late' : 'on time'

  if (!rows.length)
    return {
      blocks: [
        text(`Nobody${scopeLabel(q)} was ${label} in ${window.label} — everything is accounted for.`),
      ],
      followUps: ['Who has the best stats this week?', 'What has been flagged recently?'],
    }

  const byEmployee = new Map<string, WorkLog[]>()
  for (const r of rows) {
    const bucket = byEmployee.get(r.employeeId)
    if (bucket) bucket.push(r)
    else byEmployee.set(r.employeeId, [r])
  }

  // "Keeps missing" implies more than once — narrow to repeat offenders when
  // there are any, otherwise say so rather than padding the list.
  const entries = [...byEmployee.entries()]
  const repeatOnly = recurring ? entries.filter(([, list]) => list.length > 1) : entries
  const usedEntries = recurring && repeatOnly.length ? repeatOnly : entries

  const people: PersonRow[] = usedEntries
    .map(([id, list]) => {
      const e = ctx.employees.find((x) => x.id === id)!
      return personRow(
        e,
        `${e.role} · ${e.department}`,
        recurring ? `${list.length} ${list.length === 1 ? 'week' : 'weeks'}` : list.length > 1 ? `${list.length} weeks` : formatShortDate(list[0].weekEnding),
        undefined,
        target === 'missing' ? 'critical' : target === 'late' ? 'warning' : 'positive',
      )
    })
    .sort((a, b) =>
      recurring
        ? (byEmployee.get(b.employeeId)?.length ?? 0) - (byEmployee.get(a.employeeId)?.length ?? 0) ||
          a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    )

  const blocks: AnswerBlock[] = [
    text(
      recurring
        ? repeatOnly.length
          ? `${repeatOnly.length} ${repeatOnly.length === 1 ? 'person has' : 'people have'} been ${label} more than once over ${window.label}${scopeLabel(q)} — most frequent first.`
          : `Nobody has been ${label} more than once over ${window.label}${scopeLabel(q)}. Here is everyone with a single occurrence.`
        : `${rows.length} ${label} submission${rows.length > 1 ? 's' : ''}${scopeLabel(q)} in ${window.label}, across ${byEmployee.size} ${byEmployee.size > 1 ? 'people' : 'person'}.`,
    ),
    { kind: 'people', items: people.slice(0, 15) },
  ]
  if (people.length > 15) blocks.push(note(`Showing the first 15 of ${people.length}.`))
  if (target === 'missing')
    blocks.push(note('Employees on approved leave are excluded — no submission is expected from them.'))

  return {
    blocks,
    followUps: [
      target === 'missing' ? 'Who was late this week?' : 'Who is missing a submission this week?',
      'Who keeps missing submissions?',
    ],
  }
}

/* ------------------------------------------------------------ superlatives -- */

const TOP_RE = /\bbest\b|\btop\b|\bhighest\b|\bmost\b|\bstrongest\b|\bleading\b|\bstar\b|\bwho is killing it\b/
const BOTTOM_RE = /\bworst\b|\blowest\b|\bleast\b|\bfalling behind\b|\bstruggl|\bat risk\b|\bweakest\b|\bproblem\b|\bbehind\b|\bunderperform/

const handleRanking: Handler = (q, ctx) => {
  const wantsTop = TOP_RE.test(q.normalized)
  const wantsBottom = BOTTOM_RE.test(q.normalized)
  if (!wantsTop && !wantsBottom) return null
  if (q.employees.length === 1) return null

  // "Falling behind" / "at risk" is about keeping up with submissions, and it
  // implies a pattern — so it reads reliability over a multi-week window rather
  // than one week's output.
  const riskPhrasing = /\bfalling behind\b|\bat risk\b|\bstruggl|\bbehind\b|\bproblem\b|\bunderperform|\bchase\b|\bfollow up\b/.test(
    q.normalized,
  )
  const weeksAsc = [...ctx.weeks].sort()
  const window = q.window.inferred
    ? riskPhrasing
      ? { weeks: weeksAsc.slice(-6), label: 'the last 6 weeks', inferred: false }
      : { weeks: weeksAsc.slice(-1), label: 'this week', inferred: false }
    : q.window
  const filter = scopeFilter(q)
  const baselines = roleOutputBaselines(ctx.workLogs)
  const metric = q.metric ?? 'output'

  const reliabilityAsked =
    q.statuses.length > 0 || metric === 'onTime' || metric === 'submissions' || riskPhrasing

  interface Ranked {
    employee: Employee
    agg: Agg
    idx: number | null
    unit: string
    score: number
    display: string
    displaySub: string
  }

  const ranked: Ranked[] = []
  for (const employee of ctx.employees) {
    const rows = logsFor(ctx, window.weeks, (l) => l.employeeId === employee.id).filter(filter ?? (() => true))
    if (!rows.length) continue
    const agg = aggregate(rows)
    const idx = outputIndex(rows, baselines)
    const unit = rows[0].outputUnit

    let score: number
    let display: string
    let displaySub: string

    if (metric === 'hours') {
      score = agg.avgHours
      display = `${agg.avgHours.toFixed(1)} hrs`
      displaySub = window.weeks.length > 1 ? 'avg / week' : 'this week'
    } else if (reliabilityAsked) {
      score = agg.onTimeRate
      display = formatPercent(agg.onTimeRate)
      displaySub = `${agg.late} late · ${agg.missing} missing`
    } else {
      if (idx === null || agg.submitted === 0) continue
      score = idx
      display = formatPercent(idx * 100)
      displaySub = `${formatCompact(Math.round(agg.avgOutput))} ${unit}`
    }
    ranked.push({ employee, agg, idx, unit, score, display, displaySub })
  }

  if (!ranked.length)
    return {
      blocks: [text(`I don't have any submissions${scopeLabel(q)} for ${window.label}.`)],
    }

  ranked.sort((a, b) => (wantsBottom ? a.score - b.score : b.score - a.score))
  // Nobody with a clean record belongs on a "falling behind" list.
  const pool = riskPhrasing && wantsBottom ? ranked.filter((r) => r.agg.late > 0 || r.agg.missing > 0) : ranked
  if (riskPhrasing && wantsBottom && !pool.length) {
    return {
      blocks: [
        text(
          `Nobody${scopeLabel(q)} has a late or missing submission over ${window.label} — the whole group is keeping up.`,
        ),
      ],
      followUps: ['Who has the best stats this week?', 'Are submissions improving?'],
    }
  }
  const picked = pool.slice(0, q.limit)

  const metricName =
    metric === 'hours'
      ? 'hours worked'
      : reliabilityAsked
        ? 'submission reliability'
        : 'output against their own role average'

  const blocks: AnswerBlock[] = [
    text(
      riskPhrasing && wantsBottom
        ? `${picked.length} ${picked.length === 1 ? 'person' : 'people'}${scopeLabel(q)} to follow up on over ${window.label}, weakest submission record first.`
        : `${wantsBottom ? 'Lowest' : 'Top'} ${picked.length}${scopeLabel(q)} for ${window.label}, ranked by ${metricName}.`,
    ),
    {
      kind: 'people',
      items: picked.map((r) =>
        personRow(
          r.employee,
          `${r.employee.role} · ${r.employee.department}`,
          r.display,
          r.displaySub,
          reliabilityAsked ? rateTone(r.agg.onTimeRate) : wantsBottom ? 'warning' : 'positive',
        ),
      ),
    },
  ]

  if (!reliabilityAsked && metric !== 'hours') {
    blocks.push(
      note(
        'Roles produce different things — labels printed, pallets moved, invoices processed — so this ranks each person against the median week for their own role. 100% is a typical week.',
      ),
    )
  }

  return {
    blocks,
    followUps: [
      wantsBottom ? 'Who has the best stats this week?' : 'Who is falling behind?',
      'Who is missing a submission this week?',
      `How is ${picked[0].employee.fullName} doing compared to last year?`,
    ],
  }
}

/* ------------------------------------------------------------------ flags -- */

const handleFlags: Handler = (q, ctx) => {
  if (!/\bflag|\bnote|\bissue|\bconcern|\bcomplain|\braised\b|\bequipment\b|\btime off\b|\bpto\b|\brequest/.test(q.normalized))
    return null

  const window = q.window.inferred
    ? { ...q.window, weeks: [...ctx.weeks].sort().slice(-4), label: 'the last 4 weeks' }
    : q.window
  const filter = scopeFilter(q)
  let rows = logsFor(ctx, window.weeks, (l) => Boolean(l.notes)).filter(filter ?? (() => true))
  if (q.employees.length === 1) rows = rows.filter((l) => l.employeeId === q.employees[0].id)

  // Topic narrowing: "any equipment issues" should filter, not just list everything.
  // Word-bounded on purpose: an unanchored /press/ matches "compressed".
  const topic = /\bequipment\b|\bmachine\b|\bbroken\b|\brepair\b|\bmaintenance issue\b/.test(q.normalized)
    ? /\b(equipment|slitter|rewinder|press|machine|fault|repair|noise|jam|scale|dock door|reading inconsistently)\b/i
    : /\btime off\b|\bpto\b|\bvacation\b|\bleave\b|\bday off\b/.test(q.normalized)
      ? /\b(time off|pto|vacation|jury duty|surgery|appointment|leave|be out|out monday|family situation)\b/i
      : /\bsafety\b/.test(q.normalized)
        ? /\b(safety|near-miss|near miss|incident|eyewash|hazard)\b/i
        : null
  if (topic) rows = rows.filter((l) => topic.test(l.notes ?? ''))

  rows.sort((a, b) => (a.weekEnding < b.weekEnding ? 1 : -1))

  if (!rows.length)
    return {
      blocks: [text(`Nothing flagged${scopeLabel(q)} in ${window.label}.`)],
      followUps: ['What has been flagged recently?'],
    }

  return {
    blocks: [
      text(
        `${rows.length} flagged ${rows.length === 1 ? 'entry' : 'entries'}${scopeLabel(q)} in ${window.label}${topic ? ' matching that topic' : ''}.`,
      ),
      { kind: 'logs', items: rows.slice(0, 6) },
    ],
    followUps: ['Who is missing a submission this week?', 'Any equipment issues reported?'],
  }
}

/* ------------------------------------------------------------ departments -- */

const handleDepartment: Handler = (q, ctx) => {
  if (!q.departments.length && !q.roles.length) return null
  if (q.employees.length) return null

  const weeksAsc = [...ctx.weeks].sort()
  const window = q.window.inferred
    ? { weeks: weeksAsc.slice(-4), label: 'the last 4 weeks', inferred: false }
    : q.window
  const filter = scopeFilter(q)!
  const rows = logsFor(ctx, window.weeks).filter(filter)

  if (!rows.length)
    return { blocks: [text(`No submissions${scopeLabel(q)} in ${window.label}.`)] }

  const agg = aggregate(rows)
  const prior = priorWindow(window, weeksAsc)
  const before = prior ? aggregate(logsFor(ctx, prior.weeks).filter(filter)) : null
  const headcount = ctx.employees.filter(
    (e) =>
      (!q.departments.length || q.departments.includes(e.department)) &&
      (!q.roles.length || q.roles.includes(e.role)),
  )
  const baselines = roleOutputBaselines(ctx.workLogs)

  const leaders = headcount
    .map((e) => {
      const own = rows.filter((l) => l.employeeId === e.id)
      return { e, idx: outputIndex(own, baselines), agg: aggregate(own) }
    })
    .filter((r) => r.idx !== null)
    .sort((a, b) => (b.idx ?? 0) - (a.idx ?? 0))

  const blocks: AnswerBlock[] = [
    text(
      `${q.roles.length ? q.roles.join(' and ') : q.departments.join(' and ')} over ${window.label} — ${headcount.length} ${headcount.length === 1 ? 'person' : 'people'} on the roster.`,
    ),
    aggStats(agg, { showOutput: false }),
  ]

  if (before && before.submitted) {
    blocks.push(
      text(
        `Against ${prior!.label}: hours ${describeChange(pctChange(agg.hours, before.hours))}, on-time rate ${
          Math.abs(agg.onTimeRate - before.onTimeRate) < 1
            ? 'about flat'
            : `${agg.onTimeRate > before.onTimeRate ? 'up' : 'down'} ${Math.abs(agg.onTimeRate - before.onTimeRate).toFixed(0)} ${
                Math.round(Math.abs(agg.onTimeRate - before.onTimeRate)) === 1 ? 'point' : 'points'
              }`
        }.`,
      ),
    )
  }

  if (agg.missing || agg.late) {
    blocks.push(
      note(`${agg.missing} missing and ${agg.late} late submission${agg.late === 1 ? '' : 's'} in this period.`),
    )
  }

  if (leaders.length) {
    blocks.push(text('Strongest output relative to role average:'))
    blocks.push({
      kind: 'people',
      items: leaders.slice(0, 3).map((r) =>
        personRow(r.e, r.e.role, formatPercent((r.idx ?? 0) * 100), 'of role average', 'positive'),
      ),
    })
  }

  return {
    blocks,
    followUps: [
      `Who is falling behind${scopeLabel(q)}?`,
      `What has been flagged${scopeLabel(q)}?`,
      q.departments[0] ? `How is ${q.departments[0]} trending?` : 'Are submissions improving?',
    ],
  }
}

/* ---------------------------------------------------------- roster / count -- */

const handleRoster: Handler = (q, ctx) => {
  if (
    !/\bhow many\b|\blist\b|\bwho works\b|\bwho is on\b|\bshow me\b|\bwho are\b|\bnames of\b|\bwho reports to\b|\bheadcount\b|\broster\b|\bwho else\b/.test(
      q.normalized,
    )
  )
    return null
  // A performance question that happens to say "show me" belongs elsewhere.
  if (/\bdoing\b|\bperform|\bbest\b|\bworst\b|\btrend|\baverage\b|\btotal\b/.test(q.normalized)) return null

  // "who reports to X"
  if (/\breports to\b/.test(q.normalized) && q.employees.length === 1) {
    const manager = q.employees[0]
    const reports = ctx.employees.filter((e) => e.managerId === manager.id)
    const blocks: AnswerBlock[] = reports.length
      ? [
          text(`${reports.length} ${reports.length === 1 ? 'person reports' : 'people report'} to ${manager.fullName}.`),
          { kind: 'people', items: reports.map((e) => personRow(e, `${e.role} · ${e.shift}`, e.status)) },
        ]
      : [text(`Nobody currently reports to ${manager.fullName}.`)]
    return { blocks }
  }

  const matches = ctx.employees.filter(
    (e) =>
      (!q.departments.length || q.departments.includes(e.department)) &&
      (!q.roles.length || q.roles.includes(e.role)) &&
      (!q.shifts.length || q.shifts.some((s) => e.shift.startsWith(s.replace(' Shift', '')))) &&
      (!/\bactive\b/.test(q.normalized) || e.status === 'Active') &&
      (!/\bon leave\b/.test(q.normalized) || e.status === 'On Leave'),
  )

  const noun = q.roles.length
    ? `${q.roles.join(' and ')}${matches.length === 1 ? '' : 's'}`
    : matches.length === 1
      ? 'person'
      : 'people'
  const qualifiers = [
    q.departments.length ? `in ${q.departments.join(' and ')}` : '',
    q.shifts.length ? `on ${q.shifts.join(' or ')}` : '',
    /\bon leave\b/.test(q.normalized) ? 'currently on leave' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const tail = qualifiers ? ` ${qualifiers}` : q.roles.length ? '' : ' on the roster'

  const blocks: AnswerBlock[] = [
    text(`${matches.length} ${noun}${tail}.`),
    {
      kind: 'people',
      items: matches.slice(0, 20).map((e) => personRow(e, `${e.role} · ${e.department}`, e.shift, e.status)),
    },
  ]
  if (matches.length > 20) blocks.push(note(`Showing the first 20 of ${matches.length}.`))

  return {
    blocks,
    followUps: ['Who has the best stats this week?', 'Who is missing a submission this week?'],
  }
}

/* -------------------------------------------------------------- aggregate -- */

const handleAggregate: Handler = (q, ctx) => {
  if (!q.metric) return null
  if (!/\baverage\b|\bavg\b|\btotal\b|\bhow much\b|\bhow many\b|\bsum\b|\bmean\b/.test(q.normalized)) return null

  const window = q.window.inferred
    ? { ...q.window, weeks: [...ctx.weeks].sort().slice(-4), label: 'the last 4 weeks' }
    : q.window
  const rows = logsFor(ctx, window.weeks).filter(scopeFilter(q) ?? (() => true))
  if (!rows.length) return { blocks: [text(`No submissions${scopeLabel(q)} in ${window.label}.`)] }

  const agg = aggregate(rows)
  const wantsTotal = /\btotal\b|\bsum\b|\ball together\b/.test(q.normalized)

  const items =
    q.metric === 'hours'
      ? [
          { label: wantsTotal ? 'Total hours' : 'Avg hours / person / week', value: wantsTotal ? formatNumber(agg.hours) : agg.avgHours.toFixed(1) },
          { label: 'Submissions counted', value: formatNumber(agg.submitted) },
        ]
      : q.metric === 'onTime'
        ? [
            { label: 'On-time rate', value: formatPercent(agg.onTimeRate), tone: rateTone(agg.onTimeRate) },
            { label: 'Late', value: formatNumber(agg.late) },
            { label: 'Missing', value: formatNumber(agg.missing) },
          ]
        : q.metric === 'flags'
          ? [{ label: 'Flagged entries', value: formatNumber(agg.flags) }]
          : [
              { label: wantsTotal ? 'Total units' : 'Avg units / week', value: wantsTotal ? formatNumber(agg.output) : formatCompact(Math.round(agg.avgOutput)) },
              { label: 'Submissions counted', value: formatNumber(agg.submitted) },
            ]

  const blocks: AnswerBlock[] = [
    text(`${scopeLabel(q).trim() ? capitalizeFirst(scopeLabel(q).trim()) : 'Across the whole company'} for ${window.label}:`),
    { kind: 'stats', items },
  ]
  if (q.metric === 'output' && !q.roles.length) {
    blocks.push(
      note('Output units differ by role, so this total is a volume indicator rather than one physical quantity.'),
    )
  }
  return { blocks, followUps: ['Who has the best stats this week?', 'How is Production doing this month?'] }
}

/* ------------------------------------------------------------------ trend -- */

const handleTrend: Handler = (q, ctx) => {
  if (!/\btrend|\bover time\b|\bimproving\b|\bgetting (better|worse)\b|\bdirection\b|\btrajectory\b/.test(q.normalized))
    return null

  const weeksAsc = [...ctx.weeks].sort()
  const window = q.window.inferred
    ? { weeks: weeksAsc.slice(-13), label: 'the last 13 weeks', inferred: false }
    : q.window
  const filter = scopeFilter(q) ?? (() => true)
  const half = Math.floor(window.weeks.length / 2)
  const firstHalf = aggregate(logsFor(ctx, window.weeks.slice(0, half)).filter(filter))
  const secondHalf = aggregate(logsFor(ctx, window.weeks.slice(half)).filter(filter))

  return {
    blocks: [
      text(`Comparing the two halves of ${window.label}${scopeLabel(q)}:`),
      {
        kind: 'table',
        columns: [
          { key: 'metric', label: 'Metric' },
          { key: 'first', label: 'Earlier half', align: 'right' },
          { key: 'second', label: 'Recent half', align: 'right' },
          { key: 'change', label: 'Change', align: 'right' },
        ],
        rows: [
          {
            metric: 'On-time rate',
            first: formatPercent(firstHalf.onTimeRate),
            second: formatPercent(secondHalf.onTimeRate),
            change: describeChange(pctChange(secondHalf.onTimeRate, firstHalf.onTimeRate), 1),
          },
          {
            metric: 'Avg hours / week',
            first: firstHalf.avgHours.toFixed(1),
            second: secondHalf.avgHours.toFixed(1),
            change: describeChange(pctChange(secondHalf.avgHours, firstHalf.avgHours)),
          },
          {
            metric: 'Avg output / week',
            first: formatCompact(Math.round(firstHalf.avgOutput)),
            second: formatCompact(Math.round(secondHalf.avgOutput)),
            change: describeChange(pctChange(secondHalf.avgOutput, firstHalf.avgOutput)),
          },
          {
            metric: 'Missing submissions',
            first: firstHalf.missing,
            second: secondHalf.missing,
            change: describeChange(pctChange(secondHalf.missing, firstHalf.missing)),
          },
        ],
      },
    ],
    followUps: ['Who is falling behind?', 'How is Production doing this quarter?'],
  }
}

/* ---------------------------------------------------------------- search -- */

const SEARCH_STOPWORDS = new Set([
  'who', 'what', 'when', 'which', 'how', 'is', 'are', 'was', 'were', 'the', 'a', 'an', 'did',
  'does', 'do', 'has', 'have', 'had', 'about', 'anyone', 'anybody', 'mention', 'mentioned',
  'mentions', 'talk', 'talked', 'talking', 'said', 'say', 'says', 'me', 'show', 'find', 'search',
  'for', 'any', 'in', 'on', 'at', 'to', 'of', 'and', 'or', 'this', 'that', 'week', 'weeks',
  'month', 'months', 'year', 'employees', 'employee', 'people', 'anything', 'someone', 'their',
])

const handleSearch: Handler = (q, ctx) => {
  const terms = q.residual
    .split(' ')
    .filter((t) => t.length > 3 && !SEARCH_STOPWORDS.has(t))
  if (!terms.length) return null

  const window = q.window.inferred ? { ...q.window, weeks: [...ctx.weeks], label: 'the full history' } : q.window
  const rows = logsFor(ctx, window.weeks, (l) => {
    const hay = `${l.summary} ${l.notes ?? ''}`.toLowerCase()
    return terms.every((t) => hay.includes(t))
  }).filter(scopeFilter(q) ?? (() => true))

  if (!rows.length) return null

  rows.sort((a, b) => (a.weekEnding < b.weekEnding ? 1 : -1))
  const people = new Set(rows.map((r) => r.employeeId))

  const blocks: AnswerBlock[] = [
    text(
      `${rows.length} submission${rows.length === 1 ? '' : 's'} from ${people.size} ${people.size === 1 ? 'person' : 'people'} mention ${terms.map((t) => `“${t}”`).join(' and ')}.`,
    ),
    { kind: 'logs', items: rows.slice(0, 6) },
  ]
  if (rows.length > 6) blocks.push(note(`Showing the 6 most recent of ${rows.length}.`))

  return {
    blocks,
    followUps: ['What has been flagged recently?', 'Any equipment issues reported?'],
  }
}

/* -------------------------------------------------------------- overview -- */

const handleOverview: Handler = (q, ctx) => {
  if (!/\bhow are we\b|\bhow is (the )?(company|team|everyone|business|plant)\b|\boverview\b|\bsummary\b|\bstatus\b|\bhow did we do\b|\bhow was\b/.test(q.normalized))
    return null

  const weeksAsc = [...ctx.weeks].sort()
  const window = q.window.inferred
    ? { weeks: weeksAsc.slice(-1), label: 'this week', inferred: false }
    : q.window
  const rows = logsFor(ctx, window.weeks)
  const agg = aggregate(rows)
  const prior = priorWindow(window, weeksAsc)
  const before = prior ? aggregate(logsFor(ctx, prior.weeks)) : null

  const blocks: AnswerBlock[] = [
    text(`Company-wide for ${window.label} (week ending ${formatShortDate(window.weeks[window.weeks.length - 1])}):`),
    aggStats(agg, { showOutput: false }),
  ]
  if (before) {
    blocks.push(
      text(
        `Versus ${prior!.label}: on-time rate ${describeChange(pctChange(agg.onTimeRate, before.onTimeRate), 1)}, hours ${describeChange(pctChange(agg.hours, before.hours))}.`,
      ),
    )
  }
  if (agg.missing) {
    blocks.push(note(`${agg.missing} submission${agg.missing === 1 ? '' : 's'} still outstanding.`))
  }
  return {
    blocks,
    followUps: ['Who is missing a submission this week?', 'Who has the best stats this week?', 'What has been flagged recently?'],
  }
}

/* ------------------------------------------------------------- fallback -- */

function fallback(q: ParsedQuery): Answer {
  return {
    blocks: [
      text(
        "I couldn't turn that into a query I can answer from the work logs. I'm a lookup engine over this dataset rather than a general chatbot, so I do best with questions about specific people, departments, periods, or wording inside a work summary.",
      ),
      note(
        q.employees.length
          ? `I did recognise ${q.employees.map((e) => e.fullName).join(' and ')} — try asking how they're doing, or what they worked on.`
          : 'Try naming a person, a department, or a time period.',
      ),
    ],
    followUps: [
      'Who has the best stats this week?',
      'Who is missing a submission this week?',
      'How is Production doing this month?',
      'Any equipment issues reported?',
    ],
  }
}

/* ------------------------------------------------------------------ main -- */

const HANDLERS: Handler[] = [
  handleHelp,
  handleDisambiguate,
  handleComparePeople,
  handleEmployeeYoY,
  handleEmployeeRecentWork,
  handleStatusList,
  handleFlags,
  handleRoster,
  handleRanking,
  handleEmployeeStatus,
  handleAggregate,
  handleDepartment,
  handleTrend,
  handleOverview,
  handleSearch,
]

export function answerQuestion(raw: string, ctx: AssistantContext): Answer {
  const q = parseQuestion(raw, ctx)
  for (const handler of HANDLERS) {
    const answer = handler(q, ctx)
    if (answer) return answer
  }
  return fallback(q)
}
