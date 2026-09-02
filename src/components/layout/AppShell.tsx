/**
 * Persistent chrome: sidebar navigation, top bar, and the ⌘K palette.
 * Sidebar is fixed on laptop widths and becomes an overlay drawer on tablet.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import {
  LayoutDashboard,
  Users,
  CalendarRange,
  Menu,
  X,
  Search,
  RefreshCw,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { CommandPalette } from './CommandPalette'
import { AssistantPanel } from '@/components/assistant/AssistantPanel'
import { useDataStore } from '@/hooks/useDataStore'
import { formatShortDate } from '@/lib/format'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/employees', label: 'Employees', icon: Users, end: false },
  { to: '/submissions', label: 'Weekly Submissions', icon: CalendarRange, end: false },
]

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const { currentWeek, loading, refresh, error } = useDataStore()
  const location = useLocation()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setNavOpen(false), [location.pathname])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setAssistantOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex min-h-full bg-canvas">
      {/* Backdrop for the tablet/mobile drawer */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200 lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
          <Logo />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-ink">Quadrel Labeling</p>
            <p className="truncate text-[11px] text-ink-subtle">Work Log CRM</p>
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-ink-muted hover:bg-surface-3 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-300'
                    : 'text-ink-muted hover:bg-surface-3 hover:text-ink',
                )
              }
            >
              <Icon className="size-4.5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
              Reporting week
            </p>
            <p className="mt-0.5 text-sm font-medium text-ink tnum">
              {currentWeek ? `Ending ${formatShortDate(currentWeek)}` : '—'}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-subtle">
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
              Phase 1 · sample data
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-3 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="group flex h-9 max-w-md flex-1 items-center gap-2.5 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm text-ink-subtle transition-colors hover:border-line-strong hover:bg-surface-3"
          >
            <Search className="size-4" />
            <span className="truncate">Search people or work summaries…</span>
            <kbd className="ml-auto hidden shrink-0 rounded border border-line-strong bg-surface px-1.5 py-0.5 text-[10px] font-medium sm:block">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="mr-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              <Sparkles className="size-4" />
              <span className="hidden sm:inline">Ask</span>
              <kbd className="ml-0.5 hidden rounded bg-white/20 px-1 py-0.5 text-[10px] font-medium lg:inline">
                ⌘J
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              title="Reload data"
              aria-label="Reload data"
              className="inline-flex size-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50"
            >
              <RefreshCw className={clsx('size-4.5', loading && 'animate-spin')} />
            </button>
            <ThemeToggle />
            <div className="ml-2 hidden items-center gap-2.5 border-l border-line pl-3 sm:flex">
              <div className="text-right leading-tight">
                <p className="text-xs font-medium text-ink">Dana Whitfield</p>
                <p className="text-[11px] text-ink-subtle">Operations Manager</p>
              </div>
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                DW
              </span>
            </div>
          </div>
        </header>

        {error && (
          <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-6 py-2.5 text-sm text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  )
}

/** Consistent page heading used by every route. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
