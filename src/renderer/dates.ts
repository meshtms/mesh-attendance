// Attendance and notification dates are stored as plain 'YYYY-MM-DD' calendar
// dates. `new Date('2026-09-11')` reads that as midnight UTC, which in US time
// zones is the previous evening, so weekdays and displayed dates come out one
// day early. These helpers keep calendar dates in local time.

/** Parses 'YYYY-MM-DD' as a local calendar date (midnight local time). */
export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Today's local date as 'YYYY-MM-DD'. */
export function todayLocal(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
