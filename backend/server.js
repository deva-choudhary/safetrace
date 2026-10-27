require('dotenv').config()

const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('./database')
const crypto = require('node:crypto')

const app = express()
const PORT = 5000

app.use(cors())
app.use(express.json())

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body

  if (
    !username ||
    !password ||
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      message: 'Invalid username or password.',
    })
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      message: 'Server authentication is not configured.',
    })
  }

  const token = jwt.sign(
    { role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )

  res.json({
    message: 'Login successful!',
    token,
  })
})
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Authentication required.',
    })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (decoded.role !== 'admin') {
      return res.status(403).json({
        message: 'Admin access required.',
      })
    }

    next()
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired token.',
    })
  }
}
// Test the backend
app.get('/', (req, res) => {
  res.send('SafeTrace backend is running!')
})

// Get all reports from the database
app.get('/api/reports', verifyAdmin, (req, res) => {
  const reports = db.prepare(`
  SELECT id, incidentType, location, description, submittedAt, status
  FROM reports
  ORDER BY id DESC
`).all()

  res.json(reports)
})

// Save a new report to the database

app.post('/api/reports', (req, res) => {
  const { incidentType, location, description } = req.body

  if (
    typeof incidentType !== 'string' ||
    typeof location !== 'string' ||
    typeof description !== 'string' ||
    !incidentType.trim() ||
    !location.trim() ||
    !description.trim()
  ) {
    return res.status(400).json({
      message: 'Please provide all report fields.',
    })
  }

  // Generate a private, unpredictable editing token.
  const editToken = crypto.randomBytes(32).toString('hex')
  const editTokenHash = crypto
    .createHash('sha256')
    .update(editToken)
    .digest('hex')

  const submittedAt = new Date().toISOString()

  const result = db.prepare(`
    INSERT INTO reports (
      incidentType,
      location,
      description,
      submittedAt,
      editTokenHash
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    incidentType.trim(),
    location.trim(),
    description.trim(),
    submittedAt,
    editTokenHash
  )

  const reportId = Number(result.lastInsertRowid)

  res.status(201).json({
    message: 'Report saved successfully!',
    reportId,
    editToken,
  })
})

app.post('/api/my-report', (req, res) => {
  const { editToken } = req.body

  if (
    typeof editToken !== 'string' ||
    !/^[a-f0-9]{64}$/.test(editToken)
  ) {
    return res.status(400).json({
      message: 'Please provide a valid report edit token.',
    })
  }

  const editTokenHash = crypto
    .createHash('sha256')
    .update(editToken)
    .digest('hex')

  const report = db.prepare(`
    SELECT id, incidentType, location, description, submittedAt, status
    FROM reports
    WHERE editTokenHash = ?
  `).get(editTokenHash)

  if (!report) {
    return res.status(404).json({
      message: 'Report not found. Check your private edit code.',
    })
  }

  res.json({
    report,
  })
})

app.put('/api/my-report', (req, res) => {
  const { editToken, incidentType, location, description } = req.body

  if (
    typeof editToken !== 'string' ||
    !/^[a-f0-9]{64}$/.test(editToken) ||
    typeof incidentType !== 'string' ||
    typeof location !== 'string' ||
    typeof description !== 'string' ||
    !incidentType.trim() ||
    !location.trim() ||
    !description.trim()
  ) {
    return res.status(400).json({
      message: 'Please provide a valid edit token and all report fields.',
    })
  }

  const editTokenHash = crypto
    .createHash('sha256')
    .update(editToken)
    .digest('hex')

  const findReport = db.prepare(`
    SELECT id, incidentType, location, description, submittedAt
    FROM reports
    WHERE editTokenHash = ?
  `)

  const report = findReport.get(editTokenHash)

  if (!report) {
    return res.status(404).json({
      message: 'Report not found. Check your private edit code.',
    })
  }

  const changedAt = new Date().toISOString()

  try {
    db.exec('BEGIN')

    // Preserve the existing version before making changes.
    db.prepare(`
      INSERT INTO report_history (
        reportId,
        incidentType,
        location,
        description,
        changedAt,
        changedBy,
        changeReason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      report.id,
      report.incidentType,
      report.location,
      report.description,
      changedAt,
      'report_owner',
      'Previous version before owner correction'
    )

    db.prepare(`
      UPDATE reports
      SET incidentType = ?,
          location = ?,
          description = ?
      WHERE id = ? AND editTokenHash = ?
    `).run(
      incidentType.trim(),
      location.trim(),
      description.trim(),
      report.id,
      editTokenHash
    )

    db.exec('COMMIT')
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {}

    console.error('Report correction failed.')

    return res.status(500).json({
      message: 'Could not save your correction. Please try again.',
    })
  }

  const updatedReport = db.prepare(`
    SELECT id, incidentType, location, description, submittedAt, status
    FROM reports
    WHERE id = ?
  `).get(report.id)

  res.json({
    message: 'Your report has been updated successfully.',
    report: updatedReport,
  })
})








app.listen(PORT, () => {
  console.log(`SafeTrace server running at http://localhost:${PORT}`)
})
