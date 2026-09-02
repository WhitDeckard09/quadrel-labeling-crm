/**
 * Global search (⌘K / Ctrl-K).
 *
 * Searches employee names, badges and roles alongside the free-text of every
 * weekly work summary — the two things a manager actually hunts for. Results are
 * grouped and keyboard-navigable.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Search, CornerDownLeft, Users, FileText } from 'lucide-react'
import { useDataStore } from '@/hooks/useDataStore'
import { avatarTint, formatShortDate } from '@/lib/format'
import { Avatar, SubmissionBadge } from '@/components/ui/primitives'

interface Result {
  key: string
  kind: 'employee' | 'log'
  to: string
  node: React.ReactNode
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { employees, workLogs } = useDataStore()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      // Focus after the dialog paints.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []

    const people = employees
      .filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.role.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map<Result>((e) => ({
        key: `emp-${e.id}`,
        kind: 'employee',
        to: `/employees/${e.id}`,
        node: (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={e.fullName} tint={avatarTint(e.id)} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{e.fullName}</p>
              <p className="truncate text-xs text-ink-muted">
                {e.employeeId} · {e.role}
              </p>
            </div>
          </div>
        ),
      }))

    const logs = workLogs
      .filter(
        (l) =>
          l.status !== 'missing' &&
          (l.summary.toLowerCase().includes(q) || (l.notes?.toLowerCase().includes(q) ?? false)),
      )
      .slice(0, 6)
      .map<Result>((l) => ({
        key: `log-${l.id}`,
        kind: 'log',
        to: `/employees/${l.employeeId}?week=${l.weekEnding}`,
        node: (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-ink">{l.employeeName}</p>
              <span className="shrink-0 text-xs text-ink-subtle">
                week ending {formatShortDate(l.weekEnding)}
              </span>
              <SubmissionBadge status={l.status} />
            </div>
            <p className="mt-0.5 truncate text-xs text-ink-muted">{l.summary}</p>
          </div>
        ),
      }))

    return [...people, ...logs]
  }, [query, employees, workLogs])

  useEffect(() => setCursor(0), [query])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(c + 1, Math.max(0, results.length - 1)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(c - 1, 0))
      } else if (e.key === 'Enter' && results[cursor]) {
        e.preventDefault()
        navigate(results[cursor].to)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, cursor, navigate, onClose])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  const employeeResults = results.filter((r) => r.kind === 'employee')
  const logResults = results.filter((r) => r.kind === 'log')

  return (
    <div className="fixed inset-0 z-50 animate-fade" role="dialog" aria-modal="true" aria-label="Global search">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative mx-auto mt-[12vh] w-[min(42rem,calc(100vw-2rem))] animate-fade-up overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, roles, or anything written in a weekly summary…"
            className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
          />
          <kbd className="hidden shrink-0 rounded border border-line-strong px-1.5 py-0.5 text-[10px] font-medium text-ink-subtle sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="scroll-slim max-h-[52vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-muted">
              Type at least two characters to search.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-muted">
              No matches for “{query.trim()}”.
            </p>
          ) : (
            <>
              {employeeResults.length > 0 && (
                <Group icon={<Users className="size-3" />} label="People">
                  {employeeResults.map((r) => (
                    <Row
                      key={r.key}
                      result={r}
                      active={results.indexOf(r) === cursor}
                      onHover={() => setCursor(results.indexOf(r))}
                      onSelect={() => {
                        navigate(r.to)
                        onClose()
                      }}
                    />
                  ))}
                </Group>
              )}
              {logResults.length > 0 && (
                <Group icon={<FileText className="size-3" />} label="Weekly submissions">
                  {logResults.map((r) => (
                    <Row
                      key={r.key}
                      result={r}
                      active={results.indexOf(r) === cursor}
                      onHover={() => setCursor(results.indexOf(r))}
                      onSelect={() => {
                        navigate(r.to)
                        onClose()
                      }}
                    />
                  ))}
                </Group>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-surface-2 px-4 py-2 text-[11px] text-ink-subtle">
          <span className="flex items-center gap-1.5">
            <CornerDownLeft className="size-3" /> to open
          </span>
          <span>↑ ↓ to navigate</span>
        </div>
      </div>
    </div>
  )
}

function Group({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
        {icon}
        {label}
      </div>
      {children}
    </div>
  )
}

function Row({
  result,
  active,
  onHover,
  onSelect,
}: {
  result: Result
  active: boolean
  onHover: () => void
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      data-active={active}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={clsx(
        'flex w-full items-center rounded-lg px-3 py-2 text-left transition-colors',
        active ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-surface-3',
      )}
    >
      {result.node}
    </button>
  )
}
