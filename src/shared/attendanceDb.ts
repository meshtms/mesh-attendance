// Attendance database shared by the desktop (Electron) and web builds. All
// storage-specific work is behind DbHost: the desktop build keeps the database
// in a file under userData, the web build keeps it in the browser's IndexedDB.
// Nothing in here may import Node or browser-only modules.
import type { Database, SqlJsStatic } from 'sql.js'
import Papa from 'papaparse'
import type { CategoryInfo, CategoryType, CategoryTypeAssignment, ExcludedReason, ImportResult, StudentAbsence, StudentCourseAbsence, StudentReasonAbsence, AbsenceRecord, Notification, NewNotification } from '../shared/types'

export interface DbHost {
  /** Loads sql.js (each build locates the .wasm differently). */
  sql: () => Promise<SqlJsStatic>
  /** The saved database, or null on first run. */
  load: () => Promise<Uint8Array | null>
  /** Persists the whole database after every write. */
  save: (bytes: Uint8Array) => void
}

let db: Database | null = null
let host: DbHost | null = null

export async function initDatabase(dbHost: DbHost): Promise<void> {
  host = dbHost
  const SQL = await host.sql()
  const saved = await host.load()
  db = saved ? new SQL.Database(saved) : new SQL.Database()

  // Migrate: add absence_value column if missing (existing databases)
  const cols = db.exec("PRAGMA table_info(attendance)")
  const hasAbsenceValue = cols.length > 0 && cols[0].values.some((row: unknown[]) => row[1] === 'absence_value')
  if (cols.length > 0 && !hasAbsenceValue) {
    db.run("ALTER TABLE attendance ADD COLUMN absence_value REAL NOT NULL DEFAULT 1.0")
    db.run("UPDATE attendance SET absence_value = 0.5 WHERE LOWER(reason) LIKE '%partial absence%'")
  }

  // Migrate: add student_id column if missing (existing databases)
  const hasStudentId = cols.length > 0 && cols[0].values.some((row: unknown[]) => row[1] === 'student_id')
  if (cols.length > 0 && !hasStudentId) {
    db.run("ALTER TABLE attendance ADD COLUMN student_id TEXT DEFAULT ''")
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT UNIQUE NOT NULL,
      attendance_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      attendance_category TEXT NOT NULL,
      student_first_name TEXT NOT NULL,
      student_last_name TEXT NOT NULL,
      course TEXT NOT NULL,
      meeting_time TEXT NOT NULL,
      head_teacher TEXT NOT NULL,
      excused_unexcused TEXT NOT NULL,
      absence_value REAL NOT NULL DEFAULT 1.0,
      student_id TEXT DEFAULT ''
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS excluded_reasons (
      attendance_category TEXT NOT NULL,
      reason TEXT NOT NULL,
      PRIMARY KEY (attendance_category, reason)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      category TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL DEFAULT 'ABSENCE'
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_first_name TEXT NOT NULL,
      student_last_name TEXT NOT NULL,
      student_id TEXT DEFAULT '',
      notification_date TEXT NOT NULL,
      threshold_value REAL NOT NULL,
      comment TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_notifications_student
    ON notifications (student_first_name, student_last_name)
  `)

  // Migrate hash key (user_version 1): dedupe by new key and recompute hashes.
  // The previous hash was computed over the full row (including columns like
  // attendance_category and head_teacher) which meant minor upstream CSV
  // formatting drift produced duplicate rows. New key is the natural identity:
  // student + date + course + meeting_time + reason.
  const versionResult = db.exec('PRAGMA user_version')
  const userVersion =
    versionResult.length > 0 ? Number(versionResult[0].values[0][0] ?? 0) : 0
  if (userVersion < 1) {
    db.run(`
      DELETE FROM attendance WHERE id NOT IN (
        SELECT MIN(id) FROM attendance
        GROUP BY student_id, student_first_name, student_last_name,
                 attendance_date, course, reason
      )
    `)
    const rows = db.exec(`
      SELECT id, student_id, student_first_name, student_last_name,
             attendance_date, course, reason
      FROM attendance
    `)
    if (rows.length > 0) {
      const rehashed = await Promise.all(
        rows[0].values.map(async (r) => {
          const [id, sid, fn, ln, date, course, reason] = r as [
            number, string, string, string, string, string, string,
          ]
          return [await hashKey(sid, fn, ln, date, course, reason), id]
        }),
      )
      const update = db.prepare('UPDATE attendance SET hash = ? WHERE id = ?')
      for (const pair of rehashed) update.run(pair)
      update.free()
    }
    db.run('PRAGMA user_version = 1')
  }

  // Category-scoped exclusions (user_version 2): the school began emitting a
  // "Tardy" category whose reasons ("Illness", "Medical Appt", ...) collide with
  // real absence reasons, so a reason-only exclusion could not separate them.
  // Existing exclusions expand to every category that uses that reason, which
  // preserves what the user had configured before the split.
  if (userVersion < 2) {
    const exCols = db.exec('PRAGMA table_info(excluded_reasons)')
    const exScoped =
      exCols.length > 0 &&
      exCols[0].values.some((row: unknown[]) => row[1] === 'attendance_category')
    if (exCols.length > 0 && !exScoped) {
      const old = db.exec('SELECT reason FROM excluded_reasons')
      const oldReasons =
        old.length > 0 ? old[0].values.map((row: unknown[]) => row[0] as string) : []
      db.run('DROP TABLE excluded_reasons')
      db.run(`
        CREATE TABLE excluded_reasons (
          attendance_category TEXT NOT NULL,
          reason TEXT NOT NULL,
          PRIMARY KEY (attendance_category, reason)
        )
      `)
      const expand = db.prepare(`
        INSERT OR IGNORE INTO excluded_reasons (attendance_category, reason)
        SELECT DISTINCT attendance_category, reason FROM attendance WHERE reason = ?
      `)
      for (const reason of oldReasons) expand.run([reason])
      expand.free()
    }
    seedCategories()
    db.run('PRAGMA user_version = 2')
  }

  saveDatabase()
}

function saveDatabase(): void {
  if (!db || !host) return
  host.save(db.export())
}

// SHA-256 via Web Crypto, which both Node (Electron main) and browsers provide.
// The digest matches the earlier node:crypto createHash('sha256') output, so
// existing databases keep deduplicating against the same keys.
async function hashKey(
  studentId: string,
  firstName: string,
  lastName: string,
  attendanceDate: string,
  course: string,
  reason: string,
): Promise<string> {
  const joined = [studentId, firstName, lastName, attendanceDate, course, reason].join('\x1F')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const COLUMNS = [
  'Attendance date',
  'Reason',
  'Attendance category',
  'Student first name',
  'Student last name',
  'Course',
  'Meeting time',
  'Head teacher',
  'Excused/Unexcused',
] as const

const STUDENT_ID_COLUMN = 'Student id'

export async function importCSV(csvString: string): Promise<ImportResult> {
  if (!db) throw new Error('Database not initialized')

  const parsed = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (value) => value.trim(),
  })

  let inserted = 0
  let skipped = 0
  const total = parsed.data.length

  // Hash every row before touching the database: hashing is async, and the
  // inserts below should not interleave with other calls.
  const hashes = await Promise.all(
    parsed.data.map((row) =>
      hashKey(
        row[STUDENT_ID_COLUMN] ?? '',
        row['Student first name'] ?? '',
        row['Student last name'] ?? '',
        row['Attendance date'] ?? '',
        row['Course'] ?? '',
        row['Reason'] ?? '',
      ),
    ),
  )

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO attendance
     (hash, attendance_date, reason, attendance_category, student_first_name,
      student_last_name, course, meeting_time, head_teacher, excused_unexcused, absence_value, student_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  for (const [i, row] of parsed.data.entries()) {
    const values = COLUMNS.map((col) => row[col] ?? '')
    const studentId = row[STUDENT_ID_COLUMN] ?? ''
    const hash = hashes[i]
    const reason = (row['Reason'] ?? '').toLowerCase()
    const absenceValue = reason.includes('partial absence') ? 0.5 : 1.0

    stmt.run([hash, ...values, absenceValue, studentId])
    const modified = db.getRowsModified()
    if (modified === 1) {
      inserted++
    } else {
      skipped++
    }
  }

  stmt.free()
  seedCategories()
  saveDatabase()

  return { total, inserted, skipped }
}

export function clearAttendance(): void {
  if (!db) throw new Error('Database not initialized')
  db.run('DELETE FROM attendance')
  saveDatabase()
}

function getFallCutoff(): string | null {
  if (!db) return null
  const minDateResult = db.exec(`SELECT MIN(attendance_date) FROM attendance`)
  if (minDateResult.length === 0 || minDateResult[0].values[0][0] === null) return null
  const minDate = minDateResult[0].values[0][0] as string
  const minYear = parseInt(minDate.substring(0, 4))
  const minMonth = parseInt(minDate.substring(5, 7))
  const fallYear = minMonth <= 7 ? minYear - 1 : minYear
  return `${fallYear}-12-31`
}

// Joins a category to a reason to form the exclusion key. Unit separator can
// not occur inside a CSV field, so the composite key is unambiguous.
const CATEGORY_SEPARATOR = '\x1F'

// New categories default to ABSENCE so an upstream addition never silently
// vanishes from the totals; the user re-types it in Settings.
function seedCategories(): void {
  if (!db) return
  db.run(`
    INSERT OR IGNORE INTO categories (category, type)
    SELECT DISTINCT attendance_category, 'ABSENCE' FROM attendance
    WHERE attendance_category IS NOT NULL
  `)
}

/**
 * Runs a write inside a transaction. Without this, a statement that throws
 * part way through leaves the in-memory database half-written and never saved:
 * a failed Save in Settings would appear to erase every excluded reason until
 * the app was restarted.
 */
function transact(run: () => void): void {
  if (!db) throw new Error('Database not initialized')
  db.run('BEGIN')
  try {
    run()
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  saveDatabase()
}

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/** Membership test: the row's category is typed for this bucket. */
function typeClause(type: CategoryType, alias = ''): string {
  const col = alias ? `${alias}.` : ''
  return `${col}attendance_category IN (SELECT category FROM categories WHERE type = ${sqlQuote(type)})`
}

/** Drops (category, reason) pairs the user excluded in Settings. */
function exclusionClause(alias = ''): string {
  if (!db) return ''
  const col = alias ? `${alias}.` : ''
  const results = db.exec(`SELECT attendance_category, reason FROM excluded_reasons`)
  if (results.length === 0 || results[0].values.length === 0) return ''
  const pairs = results[0].values
    .map((row: unknown[]) => sqlQuote(`${row[0] as string}${CATEGORY_SEPARATOR}${row[1] as string}`))
    .join(',')
  return ` AND (${col}attendance_category || ${sqlQuote(CATEGORY_SEPARATOR)} || ${col}reason) NOT IN (${pairs})`
}

/**
 * Rows that count toward a bucket: the row's category must be typed for that
 * bucket, and its (category, reason) pair must not be excluded. `alias` scopes
 * the columns when the clause is spliced into a correlated subquery.
 */
function buildFilterClause(type: CategoryType = 'ABSENCE', alias = ''): string {
  if (!db) return ''
  return ` AND ${typeClause(type, alias)}${exclusionClause(alias)}`
}

/**
 * Heaviest single course for one student in a bucket. Homeroom-style courses
 * are ignored because a student missing a whole day always misses those.
 */
function maxClassSubquery(type: CategoryType, dateClause: string): string {
  return `(SELECT MAX(class_total) FROM (
        SELECT SUM(a2.absence_value) as class_total
        FROM attendance a2
        WHERE a2.student_first_name = attendance.student_first_name
          AND a2.student_last_name = attendance.student_last_name
          AND ${typeClause(type, 'a2')}
          ${dateClause}
          ${exclusionClause('a2')}
          AND LOWER(a2.course) NOT LIKE '%study hall%'
          AND LOWER(a2.course) NOT LIKE '%chapel%'
          AND LOWER(a2.course) NOT LIKE '%lunch%'
        GROUP BY a2.course
      ))`
}

export function getStudentAbsences(): StudentAbsence[] {
  if (!db) throw new Error('Database not initialized')

  const cutoff = getFallCutoff()
  if (!cutoff) return []

  const exclude = exclusionClause()
  // Absences and tardies are summed from the same rows in one pass so a student
  // with only tardies still appears in the grid.
  const bucketSums = (type: CategoryType) => {
    const member = typeClause(type)
    return `
      SUM(CASE WHEN ${member} THEN absence_value ELSE 0 END),
      SUM(CASE WHEN ${member} AND attendance_date <= '${cutoff}' THEN absence_value ELSE 0 END),
      SUM(CASE WHEN ${member} AND attendance_date > '${cutoff}' THEN absence_value ELSE 0 END),
      ${maxClassSubquery(type, '')},
      ${maxClassSubquery(type, `AND a2.attendance_date <= '${cutoff}'`)},
      ${maxClassSubquery(type, `AND a2.attendance_date > '${cutoff}'`)}`
  }

  const results = db.exec(`
    SELECT
      student_first_name,
      student_last_name,
      MAX(student_id),
      ${bucketSums('ABSENCE')},
      ${bucketSums('TARDY')}
    FROM attendance
    WHERE 1=1 ${exclude}
    GROUP BY student_first_name, student_last_name
    ORDER BY student_last_name, student_first_name
  `)

  if (results.length === 0) return []

  return results[0].values.map((row: unknown[]) => ({
    student_first_name: row[0] as string,
    student_last_name: row[1] as string,
    student_id: (row[2] as string) || '',
    total_absences: (row[3] as number) || 0,
    fall_absences: (row[4] as number) || 0,
    spring_absences: (row[5] as number) || 0,
    max_class_absences: (row[6] as number) || 0,
    max_class_fall: (row[7] as number) || 0,
    max_class_spring: (row[8] as number) || 0,
    total_tardies: (row[9] as number) || 0,
    fall_tardies: (row[10] as number) || 0,
    spring_tardies: (row[11] as number) || 0,
    max_class_tardies: (row[12] as number) || 0,
    max_class_tardies_fall: (row[13] as number) || 0,
    max_class_tardies_spring: (row[14] as number) || 0,
  }))
}

export function getStudentCourseAbsences(firstName: string, lastName: string): StudentCourseAbsence[] {
  if (!db) throw new Error('Database not initialized')

  const cutoff = getFallCutoff()
  if (!cutoff) return []

  const excludeClause = buildFilterClause('ABSENCE')

  const stmt = db.prepare(`
    SELECT
      course,
      SUM(absence_value) as total_absences,
      SUM(CASE WHEN attendance_date <= '${cutoff}' THEN absence_value ELSE 0 END) as fall_absences,
      SUM(CASE WHEN attendance_date > '${cutoff}' THEN absence_value ELSE 0 END) as spring_absences
    FROM attendance
    WHERE student_first_name = ? AND student_last_name = ? ${excludeClause}
    GROUP BY course
    ORDER BY total_absences DESC
  `)

  const rows: StudentCourseAbsence[] = []
  stmt.bind([firstName, lastName])
  while (stmt.step()) {
    const row = stmt.get()
    rows.push({
      course: row[0] as string,
      total_absences: row[1] as number,
      fall_absences: row[2] as number,
      spring_absences: row[3] as number,
    })
  }
  stmt.free()

  return rows
}

export function getStudentReasonAbsences(firstName: string, lastName: string): StudentReasonAbsence[] {
  if (!db) throw new Error('Database not initialized')

  const cutoff = getFallCutoff()
  if (!cutoff) return []

  const excludeClause = buildFilterClause('ABSENCE')

  const stmt = db.prepare(`
    SELECT
      reason,
      SUM(absence_value) as total_absences,
      SUM(CASE WHEN attendance_date <= '${cutoff}' THEN absence_value ELSE 0 END) as fall_absences,
      SUM(CASE WHEN attendance_date > '${cutoff}' THEN absence_value ELSE 0 END) as spring_absences
    FROM attendance
    WHERE student_first_name = ? AND student_last_name = ? ${excludeClause}
    GROUP BY reason
    ORDER BY total_absences DESC
  `)

  const rows: StudentReasonAbsence[] = []
  stmt.bind([firstName, lastName])
  while (stmt.step()) {
    const row = stmt.get()
    rows.push({
      reason: row[0] as string,
      total_absences: row[1] as number,
      fall_absences: row[2] as number,
      spring_absences: row[3] as number,
    })
  }
  stmt.free()

  return rows
}

export function getStudentRecords(
  firstName: string,
  lastName: string,
  type: CategoryType = 'ABSENCE',
): AbsenceRecord[] {
  if (!db) throw new Error('Database not initialized')

  const excludeClause = buildFilterClause(type)

  const stmt = db.prepare(`
    SELECT attendance_date, reason, course, excused_unexcused, absence_value
    FROM attendance
    WHERE student_first_name = ? AND student_last_name = ? ${excludeClause}
    ORDER BY attendance_date DESC
  `)

  const rows: AbsenceRecord[] = []
  stmt.bind([firstName, lastName])
  while (stmt.step()) {
    const row = stmt.get()
    rows.push({
      attendance_date: row[0] as string,
      reason: row[1] as string,
      course: row[2] as string,
      excused_unexcused: row[3] as string,
      absence_value: row[4] as number,
    })
  }
  stmt.free()

  return rows
}

export function getStudentCourseRecords(firstName: string, lastName: string, course: string): AbsenceRecord[] {
  if (!db) throw new Error('Database not initialized')

  const excludeClause = buildFilterClause('ABSENCE')

  const stmt = db.prepare(`
    SELECT attendance_date, reason, course, excused_unexcused, absence_value
    FROM attendance
    WHERE student_first_name = ? AND student_last_name = ? AND course = ? ${excludeClause}
    ORDER BY attendance_date DESC
  `)

  const rows: AbsenceRecord[] = []
  stmt.bind([firstName, lastName, course])
  while (stmt.step()) {
    const row = stmt.get()
    rows.push({
      attendance_date: row[0] as string,
      reason: row[1] as string,
      course: row[2] as string,
      excused_unexcused: row[3] as string,
      absence_value: row[4] as number,
    })
  }
  stmt.free()

  return rows
}

export function getStudentReasonRecords(firstName: string, lastName: string, reason: string): AbsenceRecord[] {
  if (!db) throw new Error('Database not initialized')

  const excludeClause = buildFilterClause('ABSENCE')

  const stmt = db.prepare(`
    SELECT attendance_date, reason, course, excused_unexcused, absence_value
    FROM attendance
    WHERE student_first_name = ? AND student_last_name = ? AND reason = ? ${excludeClause}
    ORDER BY attendance_date DESC
  `)

  const rows: AbsenceRecord[] = []
  stmt.bind([firstName, lastName, reason])
  while (stmt.step()) {
    const row = stmt.get()
    rows.push({
      attendance_date: row[0] as string,
      reason: row[1] as string,
      course: row[2] as string,
      excused_unexcused: row[3] as string,
      absence_value: row[4] as number,
    })
  }
  stmt.free()

  return rows
}

/**
 * Every category the imported data has produced, each with its bucket type and
 * the reasons seen under it. Drives the grouped Settings tree.
 */
export function getCategoryTree(): CategoryInfo[] {
  if (!db) throw new Error('Database not initialized')

  seedCategories()

  const results = db.exec(`
    SELECT c.category, c.type, a.reason
    FROM categories c
    LEFT JOIN (SELECT DISTINCT attendance_category, reason FROM attendance) a
      ON a.attendance_category = c.category
    ORDER BY c.category, a.reason
  `)
  if (results.length === 0) return []

  const byCategory = new Map<string, CategoryInfo>()
  for (const row of results[0].values as unknown[][]) {
    const category = row[0] as string
    let entry = byCategory.get(category)
    if (!entry) {
      entry = { category, type: (row[1] as CategoryType) ?? 'ABSENCE', reasons: [] }
      byCategory.set(category, entry)
    }
    if (row[2] !== null) entry.reasons.push(row[2] as string)
  }

  return [...byCategory.values()]
}

export function getExcludedReasons(): ExcludedReason[] {
  if (!db) throw new Error('Database not initialized')

  const results = db.exec(`
    SELECT attendance_category, reason FROM excluded_reasons
    ORDER BY attendance_category, reason
  `)
  if (results.length === 0) return []

  return results[0].values.map((row: unknown[]) => ({
    attendance_category: row[0] as string,
    reason: row[1] as string,
  }))
}

export function setExcludedReasons(reasons: ExcludedReason[]): void {
  if (!db) throw new Error('Database not initialized')

  transact(() => {
    db!.run(`DELETE FROM excluded_reasons`)
    const stmt = db!.prepare(
      `INSERT OR IGNORE INTO excluded_reasons (attendance_category, reason) VALUES (?, ?)`
    )
    try {
      for (const { attendance_category, reason } of reasons) {
        // Name the offending row: a bare constraint message gives the user
        // nothing to act on.
        if (typeof attendance_category !== 'string' || typeof reason !== 'string') {
          throw new Error(
            `Bad excluded reason: ${JSON.stringify({ attendance_category, reason })}`,
          )
        }
        try {
          stmt.run([attendance_category, reason])
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          throw new Error(`Could not exclude "${reason}" in "${attendance_category}": ${message}`)
        }
      }
    } finally {
      stmt.free()
    }
  })
}

export function setCategoryTypes(types: CategoryTypeAssignment[]): void {
  if (!db) throw new Error('Database not initialized')

  transact(() => {
    const stmt = db!.prepare(
      `INSERT INTO categories (category, type) VALUES (?, ?)
       ON CONFLICT(category) DO UPDATE SET type = excluded.type`
    )
    try {
      for (const { category, type } of types) {
        try {
          stmt.run([category, type])
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          throw new Error(`Could not set "${category}" to ${type}: ${message}`)
        }
      }
    } finally {
      stmt.free()
    }
  })
}

export function getStudentNotifications(firstName: string, lastName: string): Notification[] {
  if (!db) throw new Error('Database not initialized')

  const stmt = db.prepare(`
    SELECT id, student_first_name, student_last_name, student_id, notification_date,
           threshold_value, comment, created_at
    FROM notifications
    WHERE student_first_name = ? AND student_last_name = ?
    ORDER BY notification_date DESC
  `)

  const rows: Notification[] = []
  stmt.bind([firstName, lastName])
  while (stmt.step()) {
    const row = stmt.get()
    rows.push({
      id: row[0] as number,
      student_first_name: row[1] as string,
      student_last_name: row[2] as string,
      student_id: (row[3] as string) || '',
      notification_date: row[4] as string,
      threshold_value: row[5] as number,
      comment: (row[6] as string) || '',
      created_at: row[7] as string,
    })
  }
  stmt.free()

  return rows
}

export function addNotification(notification: NewNotification): number {
  if (!db) throw new Error('Database not initialized')

  const stmt = db.prepare(`
    INSERT INTO notifications (student_first_name, student_last_name, student_id, notification_date, threshold_value, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run([
    notification.student_first_name,
    notification.student_last_name,
    notification.student_id || '',
    notification.notification_date,
    notification.threshold_value,
    notification.comment || '',
  ])
  stmt.free()
  saveDatabase()

  const result = db.exec('SELECT last_insert_rowid()')
  return result[0].values[0][0] as number
}

export function deleteNotification(id: number): void {
  if (!db) throw new Error('Database not initialized')

  const stmt = db.prepare('DELETE FROM notifications WHERE id = ?')
  stmt.run([id])
  stmt.free()
  saveDatabase()
}
