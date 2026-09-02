/**
 * The "Ask" panel — a chat surface over the local query engine.
 *
 * There is no model and no network call here. Questions go to
 * `answerQuestion()` in `src/lib/assistant/engine.ts`, which parses them and
 * computes the answer from the same in-memory records the tables render. The
 * short delay before a reply is cosmetic, so the panel feels conversational.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Sparkles, X, ArrowUp, RotateCcw, Database } from 'lucide-react'
import { useDataStore } from '@/hooks/useDataStore'
import { answerQuestion } from '@/lib/assistant/engine'
import type { Answer, AssistantContext } from '@/lib/assistant/types'
import { AnswerBlockView } from './AnswerBlocks'
import { formatNumber } from '@/lib/format'

interface Turn {
  id: string
  question: string
  answer: Answer | null
}

const STARTERS = [
  'Who has the best stats this week?',
  'Who is missing a submission this week?',
  'Who keeps missing submissions?',
  'How is Production doing this month?',
  'Any equipment issues reported?',
  'Are submissions improving?',
]

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { employees, workLogs, weeks, currentWeek, roles, loading } = useDataStore()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])

  const ctx: AssistantContext = useMemo(
    () => ({ employees, workLogs, weeks, currentWeek, roles }),
    [employees, workLogs, weeks, currentWeek, roles],
  )

  const ask = useCallback(
    (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || thinking) return
      const id = `${Date.now()}-${Math.random()}`
      setTurns((prev) => [...prev, { id, question: trimmed, answer: null }])
      setDraft('')
      setThinking(true)

      // The engine is synchronous; the pause is purely so answers don't snap in.
      const timer = window.setTimeout(
        () => {
          const answer = answerQuestion(trimmed, ctx)
          setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, answer } : t)))
          setThinking(false)
        },
        320 + Math.random() * 260,
      )
      timers.current.push(timer)
    },
    [ctx, thinking],
  )

  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, thinking])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Ask about the work logs">
      <div className="absolute inset-0 animate-fade bg-slate-950/40" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 flex w-full max-w-xl animate-fade-up flex-col border-l border-line bg-canvas shadow-2xl">
        {/* ------------------------------------------------------ header -- */}
        <div className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Ask the work logs</p>
            <p className="truncate text-xs text-ink-subtle tnum">
              {loading
                ? 'Loading records…'
                : `${employees.length} employees · ${formatNumber(workLogs.length)} weekly submissions · ${weeks.length} weeks`}
            </p>
          </div>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => setTurns([])}
              title="Clear conversation"
              aria-label="Clear conversation"
              className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <RotateCcw className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ----------------------------------------------------- messages -- */}
        <div ref={scrollRef} className="scroll-slim flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {turns.length === 0 && (
            <div className="animate-fade">
              <p className="text-sm leading-relaxed text-ink">
                Ask about anyone on the roster, any department, any period, or anything written
                inside a weekly summary.
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
                <Database className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" />
                <p className="text-xs leading-relaxed text-ink-muted">
                  This runs entirely on the local dataset — no model, no API. Every figure is
                  computed from the same records the tables show, so it can&apos;t invent one.
                </p>
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Try one of these
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className="space-y-3">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-3.5 py-2 text-sm text-white">
                  {turn.question}
                </p>
              </div>

              {turn.answer ? (
                <div className="animate-fade-up space-y-3">
                  {turn.answer.blocks.map((block, i) => (
                    <AnswerBlockView key={i} block={block} onNavigate={onClose} />
                  ))}

                  {turn.answer.followUps && turn.answer.followUps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {turn.answer.followUps.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => ask(f)}
                          className="rounded-full border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-1" aria-label="Working">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 animate-bounce rounded-full bg-ink-subtle"
                      style={{ animationDelay: `${i * 120}ms`, animationDuration: '900ms' }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* -------------------------------------------------------- input -- */}
        <div className="border-t border-line bg-surface p-3">
          <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  ask(draft)
                }
              }}
              rows={1}
              placeholder="Ask about a person, a team, or a week…"
              className="max-h-28 min-h-6 flex-1 resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
            />
            <button
              type="button"
              onClick={() => ask(draft)}
              disabled={!draft.trim() || thinking}
              aria-label="Send question"
              className={clsx(
                'flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                draft.trim() && !thinking
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'bg-surface-3 text-ink-subtle',
              )}
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-ink-subtle">
            Local demo engine · answers computed from the sample dataset
          </p>
        </div>
      </div>
    </div>
  )
}
