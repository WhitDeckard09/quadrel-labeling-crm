/**
 * The store's context object lives in its own module on purpose.
 *
 * If `createContext` sits in the same file as the provider component, every hot
 * update to that file mints a fresh context while mounted consumers still hold
 * the old one — which surfaces in dev as "useDataStore must be used inside
 * <DataStoreProvider>" until a full reload. Keeping the context here means edits
 * to the provider never change its identity.
 */
import { createContext } from 'react'
import type { Employee, WorkLog } from '@/types'

export interface DataStore {
  employees: Employee[]
  workLogs: WorkLog[]
  /** Week-ending dates, newest first. */
  weeks: string[]
  currentWeek: string
  roles: string[]
  loading: boolean
  error: string | null
  lastSyncedAt: string | null
  refresh: () => Promise<void>
  /** Local write-through edit; mirrors what a PATCH + refetch would produce. */
  updateWorkLog: (id: string, patch: Partial<WorkLog>) => Promise<void>
  employeeById: (id: string) => Employee | undefined
  logsForEmployee: (employeeId: string) => WorkLog[]
}

export const DataStoreContext = createContext<DataStore | null>(null)
