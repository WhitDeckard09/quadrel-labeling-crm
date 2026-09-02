/**
 * Types for the local work-log assistant.
 *
 * The assistant is a deterministic query engine, not a language model: it parses
 * a question into entities + a time window, routes it to a handler, and computes
 * the answer from the same in-memory dataset the rest of the app uses. That
 * means it can never hallucinate a number — every figure it reports is derived
 * from `WorkLog` rows you can go and look at.
 */
import type { Employee, WorkLog, Department, SubmissionStatus } from '@/types'

export type Tone = 'neutral' | 'positive' | 'warning' | 'critical'

export interface StatItem {
  label: string
  value: string
  sub?: string
  tone?: Tone
}

export interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

export interface PersonRow {
  employeeId: string
  name: string
  sub: string
  value?: string
  valueSub?: string
  tone?: Tone
}

/** A renderable piece of an answer. The panel maps each to a component. */
export type AnswerBlock =
  | { kind: 'text'; text: string }
  | { kind: 'stats'; items: StatItem[] }
  | { kind: 'table'; columns: TableColumn[]; rows: Record<string, string | number>[] }
  | { kind: 'people'; items: PersonRow[] }
  | { kind: 'logs'; items: WorkLog[] }
  | { kind: 'note'; text: string }
  | { kind: 'chips'; items: { label: string; to: string }[] }

export interface Answer {
  blocks: AnswerBlock[]
  /** Follow-up questions offered as one-tap buttons. */
  followUps?: string[]
}

/** A contiguous run of week-ending dates, oldest first. */
export interface TimeWindow {
  weeks: string[]
  /** Human phrasing used in the reply, e.g. "the last 4 weeks". */
  label: string
  /** True when the user didn't specify a period and a default was applied. */
  inferred: boolean
}

export interface ParsedQuery {
  raw: string
  normalized: string
  tokens: string[]
  employees: Employee[]
  departments: Department[]
  roles: string[]
  statuses: SubmissionStatus[]
  shifts: string[]
  window: TimeWindow
  /** A second window for explicit comparisons ("vs. this time last year"). */
  compareWindow: TimeWindow | null
  metric: Metric | null
  limit: number
  /** Free-text left over after entities were stripped — used for summary search. */
  residual: string
}

export type Metric = 'output' | 'hours' | 'onTime' | 'submissions' | 'flags'

export interface AssistantContext {
  employees: Employee[]
  workLogs: WorkLog[]
  /** Week-ending dates, newest first (as the store holds them). */
  weeks: string[]
  currentWeek: string
  roles: string[]
}
