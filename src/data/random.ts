/**
 * Deterministic pseudo-random helpers.
 *
 * The mock dataset is regenerated on every page load, so it must be *stable*:
 * a demo should show the same 50 people and the same numbers every time. Every
 * random choice below runs through a seeded mulberry32 PRNG rather than
 * Math.random(), which keeps the data reproducible while still looking messy
 * and human.
 */

export type Rng = () => number

/** mulberry32 — small, fast, good enough distribution for fixture data. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable 32-bit string hash, so each employee can have its own sub-stream. */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function int(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function float(rng: Rng, min: number, max: number, decimals = 1): number {
  const v = rng() * (max - min) + min
  const p = 10 ** decimals
  return Math.round(v * p) / p
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Pick `count` distinct members, preserving no particular order. */
export function pickMany<T>(rng: Rng, arr: readonly T[], count: number): T[] {
  const pool = [...arr]
  const out: T[] = []
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  }
  return out
}

/** True with probability `p` (0–1). */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p
}

/**
 * Weighted pick. Weights need not sum to 1.
 * weightedPick(rng, [['a', 8], ['b', 2]]) returns 'a' ~80% of the time.
 */
export function weightedPick<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [value, weight] of entries) {
    r -= weight
    if (r <= 0) return value
  }
  return entries[entries.length - 1][0]
}

/** Roughly-normal number via the mean of 3 uniforms, clamped to [min, max]. */
export function gaussian(rng: Rng, mean: number, spread: number, min: number, max: number): number {
  const u = (rng() + rng() + rng()) / 3 // central-limit-ish, range 0–1 centered on .5
  const v = mean + (u - 0.5) * 2 * spread
  return Math.min(max, Math.max(min, v))
}
