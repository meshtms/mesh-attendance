import initSqlJs, { Database } from 'sql.js'
import { createHash } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import Papa from 'papaparse'
import type { ImportResult, StudentAbsence, StudentCourseAbsence, StudentReasonAbsence, AbsenceRecord, Notification, NewNotification } from '../shared/types'

let db: Database | null = null

function getDbPath(): string {
  return join(app.getPath('userData'), 'attendance.db')
}

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs()
  const dbPath = getDbPath()

  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath)
    db = new SQL.Database(new Uint8Array(fileBuffer))
  } else {
    db = new SQL.Database()
  }

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
      reason TEXT PRIMARY KEY NOT NULL
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
      const update = db.prepare('UPDATE attendance SET hash = ? WHERE id = ?')
      for (const r of rows[0].values) {
        const [id, sid, fn, ln, date, course, reason] = r as [
          number, string, string, string, string, string, string,
        ]
        update.run([hashKey(sid, fn, ln, date, course, reason), id])
      }
      update.free()
    }
    db.run('PRAGMA user_version = 1')
  }

  saveDatabase()
}

function saveDatabase(): void {
  if (!db) return
  const data = db.export()
  writeFileSync(getDbPath(), Buffer.from(data))
}

function hashKey(
  studentId: string,
  firstName: string,
  lastName: string,
  attendanceDate: string,
  course: string,
  reason: string,
): string {
  const joined = [studentId, firstName, lastName, attendanceDate, course, reason].join('\x1F')
  return createHash('sha256').update(joined).digest('hex')
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

export async function importCSV(filePath: string): Promise<ImportResult> {
  if (!db) throw new Error('Database not initialized')

  const csvString = readFileSync(filePath, 'utf-8')
  const parsed = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (value) => value.trim(),
  })

  let inserted = 0
  let skipped = 0
  const total = parsed.data.length

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO attendance
     (hash, attendance_date, reason, attendance_category, student_first_name,
      student_last_name, course, meeting_time, head_teacher, excused_unexcused, absence_value, student_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  for (const row of parsed.data) {
    const values = COLUMNS.map((col) => row[col] ?? '')
    const studentId = row[STUDENT_ID_COLUMN] ?? ''
    const hash = hashKey(
      studentId,
      row['Student first name'] ?? '',
      row['Student last name'] ?? '',
      row['Attendance date'] ?? '',
      row['Course'] ?? '',
      row['Reason'] ?? '',
    )
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

function getExcludedReasonsClause(): string {
  if (!db) return ''
  const results = db.exec(`SELECT reason FROM excluded_reasons`)
  if (results.length === 0 || results[0].values.length === 0) return ''
  const reasons = results[0].values.map((row: unknown[]) => (row[0] as string).replace(/'/g, "''"))
  return `AND reason NOT IN ('${reasons.join("','")}')`
}

export function getStudentAbsences(): StudentAbsence[] {
  if (!db) throw new Error('Database not initialized')

  const cutoff = getFallCutoff()
  if (!cutoff) return []

  const excludeClause = getExcludedReasonsClause()
  const subqueryExclude = excludeClause.replace(/AND /g, 'AND a2.')
  const excludeCourses = `AND LOWER(a2.course) NOT LIKE '%study hall%' AND LOWER(a2.course) NOT LIKE '%chapel%' AND LOWER(a2.course) NOT LIKE '%lunch%'`

  const results = db.exec(`
    SELECT
      student_first_name,
      student_last_name,
      SUM(absence_value) as total_absences,
      SUM(CASE WHEN attendance_date <= '${cutoff}' THEN absence_value ELSE 0 END) as fall_absences,
      SUM(CASE WHEN attendance_date > '${cutoff}' THEN absence_value ELSE 0 END) as spring_absences,
      MAX(student_id) as student_id,
      (SELECT MAX(class_total) FROM (
        SELECT SUM(a2.absence_value) as class_total
        FROM attendance a2
        WHERE a2.student_first_name = attendance.student_first_name
          AND a2.student_last_name = attendance.student_last_name
          ${subqueryExclude}
          ${excludeCourses}
        GROUP BY a2.course
      )) as max_class_absences,
      (SELECT MAX(class_total) FROM (
        SELECT SUM(a2.absence_value) as class_total
        FROM attendance a2
        WHERE a2.student_first_name = attendance.student_first_name
          AND a2.student_last_name = attendance.student_last_name
          AND a2.attendance_date <= '${cutoff}'
          ${subqueryExclude}
          ${excludeCourses}
        GROUP BY a2.course
      )) as max_class_fall,
      (SELECT MAX(class_total) FROM (
        SELECT SUM(a2.absence_value) as class_total
        FROM attendance a2
        WHERE a2.student_first_name = attendance.student_first_name
          AND a2.student_last_name = attendance.student_last_name
          AND a2.attendance_date > '${cutoff}'
          ${subqueryExclude}
          ${excludeCourses}
        GROUP BY a2.course
      )) as max_class_spring
    FROM attendance
    WHERE 1=1 ${excludeClause}
    GROUP BY student_first_name, student_last_name
    ORDER BY student_last_name, student_first_name
  `)

  if (results.length === 0) return []

  return results[0].values.map((row: unknown[]) => ({
    student_first_name: row[0] as string,
    student_last_name: row[1] as string,
    total_absences: row[2] as number,
    fall_absences: row[3] as number,
    spring_absences: row[4] as number,
    student_id: (row[5] as string) || '',
    max_class_absences: (row[6] as number) || 0,
    max_class_fall: (row[7] as number) || 0,
    max_class_spring: (row[8] as number) || 0,
  }))
}

export function getStudentCourseAbsences(firstName: string, lastName: string): StudentCourseAbsence[] {
  if (!db) throw new Error('Database not initialized')

  const cutoff = getFallCutoff()
  if (!cutoff) return []

  const excludeClause = getExcludedReasonsClause()

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

  const excludeClause = getExcludedReasonsClause()

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

export function getStudentRecords(firstName: string, lastName: string): AbsenceRecord[] {
  if (!db) throw new Error('Database not initialized')

  const excludeClause = getExcludedReasonsClause()

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

  const excludeClause = getExcludedReasonsClause()

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

  const excludeClause = getExcludedReasonsClause()

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

export function getAllReasons(): string[] {
  if (!db) throw new Error('Database not initialized')

  const results = db.exec(`SELECT DISTINCT reason FROM attendance ORDER BY reason`)
  if (results.length === 0) return []

  return results[0].values.map((row: unknown[]) => row[0] as string)
}

export function getExcludedReasons(): string[] {
  if (!db) throw new Error('Database not initialized')

  const results = db.exec(`SELECT reason FROM excluded_reasons ORDER BY reason`)
  if (results.length === 0) return []

  return results[0].values.map((row: unknown[]) => row[0] as string)
}

export function setExcludedReasons(reasons: string[]): void {
  if (!db) throw new Error('Database not initialized')

  db.run(`DELETE FROM excluded_reasons`)
  const stmt = db.prepare(`INSERT INTO excluded_reasons (reason) VALUES (?)`)
  for (const reason of reasons) {
    stmt.run([reason])
  }
  stmt.free()
  saveDatabase()
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
