/**
 * Chart components (Recharts).
 *
 * Every chart takes already-aggregated data — the aggregation lives in
 * `src/lib/analytics.ts` so it can move server-side later without touching
 * presentation.
 *
 * NOTE: `isAnimationActive={false}` on every series is deliberate, not an
 * oversight. Recharts starts the bar mount animation from ResponsiveContainer's
 * initial zero-width measurement and never recovers, leaving bars 1px wide (or
 * invisible entirely, as with lines). Do not re-enable it without verifying that
 * every chart still renders on a cold load.
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WeekSummary, DepartmentSummary } from '@/types'
import { useIsDark } from '@/hooks/useIsDark'
import { SERIES, chartNeutrals, DEPARTMENT_COLORS } from './chartTheme'
import { formatCompact, formatNumber, formatShortDate } from '@/lib/format'

interface TooltipEntry {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  valueFormatter?: (v: number, key: string) => string
  labelFormatter?: (l: string) => string
}) {
  const dark = useIsDark()
  const n = chartNeutrals(dark)
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ background: n.tooltipBg, borderColor: n.tooltipBorder, color: n.tooltipText }}
    >
      <p className="mb-1.5 font-semibold">
        {labelFormatter ? labelFormatter(String(label)) : String(label)}
      </p>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 whitespace-nowrap">
            <span className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
            <span className="opacity-70">{entry.name}</span>
            <span className="ml-auto font-medium tnum">
              {valueFormatter
                ? valueFormatter(Number(entry.value), String(entry.dataKey))
                : formatNumber(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const AXIS_TICK = { fontSize: 11 }

/* ------------------------------------------------ submissions over time -- */

export function SubmissionsTrendChart({ data }: { data: WeekSummary[] }) {
  const dark = useIsDark()
  const n = chartNeutrals(dark)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={n.grid} />
        <XAxis
          dataKey="weekEnding"
          tickFormatter={formatShortDate}
          tick={{ ...AXIS_TICK, fill: n.axis }}
          tickLine={false}
          axisLine={{ stroke: n.grid }}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tick={{ ...AXIS_TICK, fill: n.axis }}
          tickLine={false}
          axisLine={false}
          width={44}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: dark ? '#ffffff08' : '#0f172808' }}
          content={<ChartTooltip labelFormatter={(l) => `Week ending ${formatShortDate(l)}`} />}
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: n.axis }}
        />
        <Bar dataKey="onTime" name="On time" stackId="s" fill={SERIES.onTime} isAnimationActive={false} />
        <Bar dataKey="late" name="Late" stackId="s" fill={SERIES.late} isAnimationActive={false} />
        <Bar dataKey="missing" name="Missing" stackId="s" fill={SERIES.missing} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ---------------------------------------------------------- output trend -- */

export function OutputTrendChart({ data }: { data: WeekSummary[] }) {
  const dark = useIsDark()
  const n = chartNeutrals(dark)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="outputFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.brand} stopOpacity={dark ? 0.35 : 0.22} />
            <stop offset="100%" stopColor={SERIES.brand} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={n.grid} />
        <XAxis
          dataKey="weekEnding"
          tickFormatter={formatShortDate}
          tick={{ ...AXIS_TICK, fill: n.axis }}
          tickLine={false}
          axisLine={{ stroke: n.grid }}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(v as number)}
          tick={{ ...AXIS_TICK, fill: n.axis }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(l) => `Week ending ${formatShortDate(l)}`}
              valueFormatter={(v) => formatNumber(v)}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="totalOutput"
          name="Units logged"
          stroke={SERIES.brand}
          strokeWidth={2}
          fill="url(#outputFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: n.tooltipBg }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ----------------------------------------------------- hours by department -- */

export function DepartmentHoursChart({ data }: { data: DepartmentSummary[] }) {
  const dark = useIsDark()
  const n = chartNeutrals(dark)
  const rows = [...data].sort((a, b) => b.totalHours - a.totalHours)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={n.grid} />
        <XAxis
          type="number"
          tickFormatter={(v) => formatCompact(v as number)}
          tick={{ ...AXIS_TICK, fill: n.axis }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="department"
          tick={{ ...AXIS_TICK, fill: n.axis }}
          tickLine={false}
          axisLine={false}
          width={104}
          tickFormatter={(v: string) => (v === 'Warehouse & Logistics' ? 'Warehouse' : v === 'Quality Assurance' ? 'Quality' : v)}
        />
        <Tooltip
          cursor={{ fill: dark ? '#ffffff08' : '#0f172808' }}
          content={<ChartTooltip valueFormatter={(v) => `${formatNumber(v)} hrs`} />}
        />
        <Bar dataKey="totalHours" name="Hours logged" radius={[0, 4, 4, 0]} barSize={22} isAnimationActive={false}>
          {rows.map((row) => (
            <Cell key={row.department} fill={DEPARTMENT_COLORS[row.department] ?? SERIES.brand} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------ per-employee trend -- */

export function EmployeeHistoryChart({
  data,
}: {
  data: { weekEnding: string; hours: number; output: number }[]
}) {
  const dark = useIsDark()
  const n = chartNeutrals(dark)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid vertical={false} stroke={n.grid} />
        <XAxis
          dataKey="weekEnding"
          tickFormatter={formatShortDate}
          tick={{ ...AXIS_TICK, fill: n.axis }}
          tickLine={false}
          axisLine={{ stroke: n.grid }}
          minTickGap={20}
        />
        <YAxis
          yAxisId="hours"
          tick={{ ...AXIS_TICK, fill: n.axis }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <YAxis
          yAxisId="output"
          orientation="right"
          tickFormatter={(v) => formatCompact(v as number)}
          tick={{ ...AXIS_TICK, fill: n.axis }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(l) => `Week ending ${formatShortDate(l)}`}
              valueFormatter={(v, key) => (key === 'hours' ? `${v.toFixed(1)} hrs` : formatNumber(v))}
            />
          }
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={26}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: n.axis }}
        />
        <Line
          yAxisId="hours"
          type="monotone"
          dataKey="hours"
          name="Hours"
          stroke={SERIES.brand}
          strokeWidth={2}
          dot={{ r: 2.5, strokeWidth: 0, fill: SERIES.brand }}
          isAnimationActive={false}
        />
        <Line
          yAxisId="output"
          type="monotone"
          dataKey="output"
          name="Output"
          stroke={SERIES.onTime}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={{ r: 2.5, strokeWidth: 0, fill: SERIES.onTime }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------- sparkline -- */

export function Sparkline({ data, color = SERIES.brand }: { data: number[]; color?: string }) {
  const rows = data.map((v, i) => ({ i, v }))
  // Pad the domain so a nearly-flat series reads as a line rather than a solid
  // block filling the card.
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pad = Math.max((max - min) * 0.6, Math.abs(max) * 0.04, 0.5)

  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={rows} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <YAxis hide domain={[min - pad, max + pad]} />
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.6}
          fill={`url(#spark-${color.replace('#', '')})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
