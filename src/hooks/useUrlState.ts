/**
 * Filter state synced to the URL query string.
 *
 * Keeping filters in the URL means a manager can bookmark "Production, missing,
 * this week" or paste it to a colleague — the kind of thing that separates a
 * usable internal tool from a toy. Defaults are omitted from the URL so links
 * stay short.
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useUrlState<T extends Record<string, string | boolean>>(defaults: T) {
  const [params, setParams] = useSearchParams()

  const state = useMemo(() => {
    const next = { ...defaults }
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const raw = params.get(String(key))
      if (raw === null) continue
      next[key] = (typeof defaults[key] === 'boolean' ? raw === 'true' : raw) as T[keyof T]
    }
    return next
  }, [params, defaults])

  const setState = useCallback(
    (patch: Partial<T>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            const isDefault = value === defaults[key as keyof T]
            if (isDefault || value === '' || value === false) next.delete(key)
            else next.set(key, String(value))
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams, defaults],
  )

  const reset = useCallback(() => setParams({}, { replace: true }), [setParams])

  const activeCount = useMemo(
    () =>
      (Object.keys(defaults) as (keyof T)[]).filter(
        (k) => state[k] !== defaults[k] && state[k] !== '' && state[k] !== false,
      ).length,
    [state, defaults],
  )

  return { state, setState, reset, activeCount }
}
