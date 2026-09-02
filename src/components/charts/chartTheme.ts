/** Shared chart palette. Series colors are fixed across light/dark for
 *  recognition; only the neutral grid/axis colors flip. */
export const SERIES = {
  onTime: '#10b981',
  late: '#f59e0b',
  missing: '#f43f5e',
  brand: '#2159e6',
  brandSoft: '#94bffb',
} as const

export function chartNeutrals(dark: boolean) {
  return {
    grid: dark ? '#232d3d' : '#eceef2',
    axis: dark ? '#67768c' : '#8b97a8',
    tooltipBg: dark ? '#161e2b' : '#ffffff',
    tooltipBorder: dark ? '#2b3648' : '#e5e8ec',
    tooltipText: dark ? '#e8edf5' : '#0f1728',
  }
}

export const DEPARTMENT_COLORS: Record<string, string> = {
  Production: '#2159e6',
  'Quality Assurance': '#0ea5e9',
  'Warehouse & Logistics': '#8b5cf6',
  Maintenance: '#f59e0b',
  Administration: '#14b8a6',
}
