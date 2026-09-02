# Quadrel Labeling — Weekly Work Log CRM

**Live demo → https://whitdeckard09.github.io/quadrel-labeling-crm/**

Internal tool for managers to review the weekly work logs submitted by Quadrel
Labeling employees. One row per employee per week: hours, output, what they did,
anything they flagged, and whether the submission arrived on time.

**Phase 1 — frontend prototype.** There is no backend, database or auth. All data
is generated locally by a seeded fixture module and held in React state. The app
is structured so that connecting a real API is a contained change (see
[Wiring up a real backend](#wiring-up-a-real-backend)).

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript only |

---

## Stack

| Choice | Why |
| --- | --- |
| **React 18 + TypeScript** | Typed domain models (`Employee`, `WorkLog`) double as the API contract, so the backend swap is checked by the compiler rather than by hand. |
| **Vite 6** | Instant dev server, ~1.5s production builds. |
| **Tailwind CSS v4** | CSS-first config. Semantic tokens (`bg-surface`, `text-ink-muted`) are defined once in `src/index.css`, so the whole theme — including dark mode — retunes from one file. |
| **Recharts** | Small, declarative, React-native charting. Split into its own bundle chunk. |
| **React Router 6** | Real URLs, so filtered views are bookmarkable and shareable. |
| **lucide-react** | Consistent, tree-shakeable icon set. |

No state-management library: the dataset is 50 employees and ~750 rows, which a
single context plus `useMemo` handles comfortably. Introducing TanStack Query is
the natural next step *when* real endpoints exist, not before.

---

## Features

**Dashboard** — submissions/missing/hours/output for the current reporting week
with week-over-week deltas; 16-week submission history (stacked by status);
output trend; hours by department; missing-this-week follow-up list; recently
flagged entries; a follow-up list ranking the weakest submission records over the
trailing six weeks; recent activity feed.

**Employee directory** — all 50 employees, searchable by name/badge/email/role
and filterable by department, role, status and shift, with every column
sortable. Shows each person's trailing-6-week on-time rate and latest submission.

**Employee profile** — identity and employment details, rolled-up stats,
hours-vs-output chart, and the complete weekly history as either a timeline or a
table. Accepts `?week=YYYY-MM-DD` to highlight and scroll to a specific week.

**Weekly submissions** — every employee-week in one table. Combinable filters
(week × department × status × flagged-only × free text), sortable columns,
pagination, CSV export, and a detail drawer where a manager can mark an entry
reviewed and attach an internal note.

**Global search (⌘K / Ctrl-K)** — searches employee names, badges and roles
alongside the full free text of every work summary and flag.

**Ask (⌘J / Ctrl-J)** — a plain-English assistant over the dataset. See
[The assistant](#the-assistant).

**Also** — light/dark theme (persisted, no flash on load), URL-synced filters,
loading skeletons on first load, keyboard-navigable palette, responsive down to
tablet.

---

## Project structure

```
src/
├── types/index.ts          Domain model — the API contract
├── data/                   ── MOCK DATA. Delete this folder in Phase 2. ──
│   ├── mockData.ts           Generates the 50 employees + ~750 weekly logs
│   ├── roles.ts              Role catalog + per-role writing pools
│   ├── names.ts              Name pools, flag notes, late reasons
│   └── random.ts             Seeded PRNG helpers
├── api/client.ts           THE SEAM. Async functions returning ApiResponse<T>
├── lib/
│   ├── query.ts              Filter/sort semantics, shared by API and store
│   ├── analytics.ts          Pure aggregations (weekly trend, dept rollups…)
│   ├── format.ts             Date/number/label formatting
│   └── assistant/            ── THE ASK ASSISTANT ──
│       ├── types.ts            Answer blocks, parsed-query shape
│       ├── parse.ts            Entity + time-expression parsing
│       ├── stats.ts            Aggregation + role-normalised output index
│       └── engine.ts           Intent routing and answer handlers
├── hooks/
│   ├── useDataStore.tsx      Loads once via the API, holds live state
│   ├── useUrlState.ts        Filter state ⇄ query string
│   └── useIsDark.ts          Theme observer for chart colors
├── components/
│   ├── layout/               AppShell, sidebar, top bar, ⌘K palette
│   ├── assistant/            Ask panel + answer-block renderers
│   ├── ui/                   Buttons, badges, table bits, metric card, drawer
│   └── charts/               Recharts wrappers + shared palette
└── pages/                  Dashboard, Employees, EmployeeProfile, Submissions
```

---

## The mock data

Generated deterministically from a fixed seed, so every demo shows the same
people and the same numbers. Week boundaries are computed from the real current
date, so the dashboard always reads as "this week".

- **50 employees** — sequential badges `QL-1001`…`QL-1050`, 18 role titles across
  5 departments, 4 Ohio facilities, three shifts, hire dates spanning 5 months to
  8 years, mostly Active with a few on leave or departed. Each reports to a
  supervisor or lead in their own department.
- **~3,000 weekly logs** — 64 weeks (~15 months) of history, ~90% on time / ~7%
  late / ~3% missing. Reliability is a per-person trait, so the same handful of
  people show up on the follow-up list week after week, the way they would in
  reality. Output is anchored to each person's own level with modest weekly
  variation rather than redrawn at random, so period-over-period comparisons
  mean something.
- **2,917 work summaries, all unique.** Each role has its own pools of opening,
  secondary and closing clauses written in real label-industry vocabulary (flexo
  press, anilox rolls, matrix waste, cold foil, BOPP liner). Each employee gets a
  writing persona — terse, detailed, list-style, casual with contractions — plus
  quirks like dropping trailing periods. Fragments rotate so nobody reuses a
  phrase for weeks, and a final uniqueness pass guarantees no summary is ever
  written twice.
- **~418 flagged notes**, never the same note twice in one week.

History runs 64 weeks specifically so that year-over-year questions have a real
answer. Employees hired inside the last year have correspondingly shorter
histories, and the assistant says so rather than comparing against nothing.

Modelling decisions worth revisiting before the schema is fixed:

- A **missing** week is materialized as a `WorkLog` row with `status: 'missing'`
  so the UI has something to render and count. A real schema would more likely
  keep an `expected_submissions` table and left-join the actual submission.
- Someone on **approved leave produces no row at all** — no submission is
  expected — so "missing" always means genuinely unaccounted for. Same for
  employees who have left.
- **Output units differ by role** (labels printed, pallets moved, units
  inspected, invoices processed…). Totals across roles are therefore relative
  volume, not one physical quantity; the UI labels them as mixed.

---

## The assistant

The **Ask** panel (⌘J) answers plain-English questions about the dataset:

> *Who has put up the best stats this week?*
> *How is Amara Bellamy doing compared to this time last year?*
> *Who keeps missing submissions?*
> *Any equipment issues reported?*
> *What's the average hours in the warehouse last month?*
> *Compare Amara Bellamy and Lucas Ramsey*
> *Who mentioned the slitter?*

**There is no model and no API call.** It is a deterministic query engine over
the same in-memory records the tables render, which is a deliberate choice for a
demo: it works offline, costs nothing, never varies between runs, and **cannot
hallucinate a number** — every figure it prints is computed from `WorkLog` rows
you can click through to and verify.

How a question is handled:

1. **`parse.ts`** extracts entities — people (full name, first name, surname or
   badge, with disambiguation when two Bridgets match), departments, roles,
   shifts, submission statuses, a metric, and a time window. Time expressions
   understood include *this week*, *last week*, *last 6 weeks*, *this month*,
   *last quarter*, *year to date*, *in May*, *all time*, and *this time last
   year*.
2. **`engine.ts`** runs a priority-ordered list of handlers; the first one that
   recognises the question owns it. Handlers cover per-person status, year-over-
   year and prior-period comparison, head-to-head comparison, rankings, missing
   and late lists, flags (narrowed by topic), department rollups, roster and
   headcount lookups, aggregates, trend, company overview, and free-text search
   across every work summary.
3. The answer comes back as **structured blocks** — prose, stat tiles, tables,
   clickable people rows, submission cards — rather than a paragraph, so results
   link straight into the rest of the app.

Two details worth knowing:

- **Rankings normalise for role.** A Line Operator prints ~120,000 labels a week
  and an AP Clerk processes ~200 invoices, so raw output can never be compared
  across roles. "Best stats" ranks each person against the *median week for their
  own role* — 100% is a typical week — and the answer says so.
- **It declines rather than guesses.** Ask for a year-over-year read on someone
  hired eight months ago and it tells you the history doesn't reach, then offers
  what it can show instead. Questions outside the dataset get an honest miss plus
  suggestions, not an invented answer.

Swapping this for a real LLM later means replacing `answerQuestion()` with a
call that passes the same `AssistantContext` as tool-callable data. The panel
already renders structured blocks, so the UI would not change.

## Wiring up a real backend

Everything that touches fake data is behind `src/api/client.ts`. Each function is
already async, already returns an `ApiResponse<T>` envelope, and is marked with a
`// TODO: replace with API call — GET /api/…` comment naming the endpoint it
expects.

Replacing one looks like this:

```ts
export async function getEmployees(query: EmployeeQuery = {}): Promise<ApiResponse<Employee[]>> {
  const res = await fetch(`/api/employees?${new URLSearchParams(query as never)}`)
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}
```

Endpoints the UI is already shaped around:

| Function | Endpoint |
| --- | --- |
| `getEmployees(query)` | `GET /api/employees` |
| `getEmployee(id)` | `GET /api/employees/:id` |
| `getWorkLogs(query)` | `GET /api/work-logs` |
| `getWorkLogsForEmployee(id)` | `GET /api/employees/:id/work-logs` |
| `updateWorkLog(id, patch)` | `PATCH /api/work-logs/:id` |
| `getMetadata()` | `GET /api/meta` |

Then: delete `src/data/`, and drop the `MOCK_*` imports from `client.ts`. No
component changes are required — pages only ever see the types in `src/types`.

**On filtering.** The store loads the working set once and filters client-side
through `src/lib/query.ts`, which keeps search instant at this data size. The API
layer runs those *same* functions, so the semantics already match. If the dataset
outgrows a client-side cache, have the page hooks call `api.getWorkLogs(query)`
instead of `applyWorkLogQuery(...)` — the query objects they build are already in
the right shape.

---

## Known Phase 1 limitations

- Manager review state (reviewed flag, internal notes) lives in memory and resets
  on reload — there is nowhere to persist it yet.
- No authentication, roles or permissions. The signed-in manager in the top right
  is hardcoded.
- Pagination is client-side.
- The employee-facing weekly form is explicitly **not** part of this phase.
- The assistant understands the question shapes listed above. It is a query
  engine, not a general chatbot — genuinely novel phrasings can miss, and it says
  so rather than guessing.
- `isAnimationActive={false}` on every chart series is deliberate: Recharts
  starts its mount animation from `ResponsiveContainer`'s initial zero-width
  measurement and never recovers, leaving bars 1px wide and lines invisible.
  Don't re-enable it without checking that every chart still renders cold.
