/**
 * Application data store.
 *
 * Loads the working set once through the API layer (with real async loading
 * states), then keeps it in React state. Filtering and sorting run client-side
 * against that cached set via the shared helpers in `src/lib/query.ts`, which
 * keeps search instant while preserving the exact semantics the server will use.
 *
 * Phase 2 note: for a roster this size (50 people, ~750 rows) caching the whole
 * set is the right call. If the dataset grows past a few thousand rows, move the
 * filtering back over the wire by having the page hooks call
 * `api.getWorkLogs(query)` instead of `applyWorkLogQuery(...)` — the query
 * objects are already in the right shape.
 */
import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Employee, WorkLog } from '@/types'
import * as api from '@/api/client'
import { DataStoreContext, type DataStore } from './dataStoreContext'

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [weeks, setWeeks] = useState<string[]>([])
  const [currentWeek, setCurrentWeek] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // TODO: replace with a single `GET /api/bootstrap` once the backend exists.
      const [employeeRes, logRes, metaRes] = await Promise.all([
        api.getEmployees(),
        api.getWorkLogs(),
        api.getMetadata(),
      ])
      setEmployees(employeeRes.data)
      setWorkLogs(logRes.data)
      setWeeks(metaRes.data.weeks)
      setCurrentWeek(metaRes.data.currentWeek)
      setRoles(metaRes.data.roles)
      setLastSyncedAt(new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const updateWorkLog = useCallback(async (id: string, patch: Partial<WorkLog>) => {
    // Optimistic: apply locally first so the table never feels laggy.
    setWorkLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    try {
      await api.updateWorkLog(id, patch)
    } catch {
      // A real implementation would roll back here and surface a toast.
      setError('Could not save that change.')
    }
  }, [])

  const employeeIndex = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  const logsByEmployee = useMemo(() => {
    const map = new Map<string, WorkLog[]>()
    for (const log of workLogs) {
      const bucket = map.get(log.employeeId)
      if (bucket) bucket.push(log)
      else map.set(log.employeeId, [log])
    }
    for (const rows of map.values()) rows.sort((a, b) => (a.weekEnding < b.weekEnding ? 1 : -1))
    return map
  }, [workLogs])

  const value = useMemo<DataStore>(
    () => ({
      employees,
      workLogs,
      weeks,
      currentWeek,
      roles,
      loading,
      error,
      lastSyncedAt,
      refresh: load,
      updateWorkLog,
      employeeById: (id) => employeeIndex.get(id),
      logsForEmployee: (employeeId) => logsByEmployee.get(employeeId) ?? [],
    }),
    [employees, workLogs, weeks, currentWeek, roles, loading, error, lastSyncedAt, load, updateWorkLog, employeeIndex, logsByEmployee],
  )

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>
}

export function useDataStore(): DataStore {
  const ctx = useContext(DataStoreContext)
  if (!ctx) throw new Error('useDataStore must be used inside <DataStoreProvider>')
  return ctx
}
