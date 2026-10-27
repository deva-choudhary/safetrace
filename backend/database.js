
const { DatabaseSync } = require('node:sqlite')

const db = new DatabaseSync('./safetrace.db')

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incidentType TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    submittedAt TEXT NOT NULL
  )
`)

// Add new fields to existing databases without deleting reports.
const columns = db.prepare('PRAGMA table_info(reports)').all()
const columnNames = columns.map((column) => column.name)

if (!columnNames.includes('editTokenHash')) {
  db.exec('ALTER TABLE reports ADD COLUMN editTokenHash TEXT')
}

if (!columnNames.includes('status')) {
  db.exec(
    "ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'Under Review'"
  )
}

// Preserve previous versions of submitted reports.
db.exec(`
  CREATE TABLE IF NOT EXISTS report_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reportId INTEGER NOT NULL,
    incidentType TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    changedAt TEXT NOT NULL,
    changedBy TEXT NOT NULL,
    changeReason TEXT,
    FOREIGN KEY (reportId) REFERENCES reports(id)
  )
`)

console.log('SafeTrace database is ready!')

module.exports = db
