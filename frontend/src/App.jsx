import { useState } from 'react'
import './App.css'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [token, setToken] = useState('')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [editToken, setEditToken] = useState('')
  const [reportId, setReportId] = useState('')
  const [editTokenInput, setEditTokenInput] = useState('')
  const [myReport, setMyReport] = useState(null)
  const [myReportError, setMyReportError] = useState('')
  const [myReportMessage, setMyReportMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    incidentType: '',
    location: '',
    description: '',
  })
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [sortOrder, setSortOrder] = useState('newest')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')


  const API_URL = 'http://localhost:5000/api/reports'
  async function handleAdminLogin(event) {
    event.preventDefault()
    setLoginError('')

    try {
      const response = await fetch(
        'http://localhost:5000/api/admin/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: loginUsername,
            password: loginPassword,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Login failed.')
      }

      setToken(data.token)
      setLoginPassword('')
      setCurrentPage('admin')

      await loadReports(data.token)
    } catch (err) {
      setLoginError(err.message || 'Could not connect to the backend.')
    }
  }

  async function loadReports(authToken) {
    try {
      setError('')
      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Could not load reports.')
      }

      const data = await response.json()
      setReports(data)
    } catch (err) {
      setError('Could not load reports. Check whether the backend is running.')
    } finally {
      setLoading(false)
    }
  }


  const dateFilteredReports = reports.filter((report) => {
    const reportDate = report.submittedAt.slice(0, 10)

    const matchesStartDate =
      !startDate || reportDate >= startDate

    const matchesEndDate =
      !endDate || reportDate <= endDate

    return matchesStartDate && matchesEndDate
  })
  const filteredReports = dateFilteredReports
    .filter((report) => {
      const search = searchTerm.toLowerCase().trim()

      const matchesSearch =
        report.location.toLowerCase().includes(search) ||
        report.description.toLowerCase().includes(search) ||
        report.incidentType.toLowerCase().includes(search)

      const matchesType =
        typeFilter === 'All' ||
        report.incidentType === typeFilter

      return matchesSearch && matchesType
    })
    .sort((a, b) => {
      const dateA = new Date(a.submittedAt).getTime()
      const dateB = new Date(b.submittedAt).getTime()

      return sortOrder === 'newest'
        ? dateB - dateA
        : dateA - dateB
    })

  const today = new Date().toLocaleDateString()

  const todaysReports = dateFilteredReports.filter((report) => {
    return new Date(report.submittedAt).toLocaleDateString() === today
  }).length

  const incidentTypes = new Set(
    dateFilteredReports.map((report) => report.incidentType)
  ).size

  const incidentBreakdown = [
    'Harassment',
    'Unsafe Location',
    'Stalking',
    'Other',
  ].map((type) => ({
    type,
    count: dateFilteredReports.filter(
      (report) => report.incidentType === type
    ).length,
  }))


  async function handleSubmit(event) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    const reportData = {
      incidentType: formData.get('incidentType'),
      location: formData.get('location'),
      description: formData.get('description'),
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Could not submit report.')
      }
      setReportId(data.reportId)
      setEditToken(data.editToken)
      setSubmitted(true)
      setShowForm(false)

      if (token) {
        await loadReports(token)
      }
    } catch (err) {
      alert(err.message || 'Could not submit report. Check whether the backend is running.')
    }
  }

  function downloadAccessDetails() {
    if (!editToken) {
      alert('No private edit code is available to download.')
      return
    }

    const accessDetails = [
      'SafeTrace — Private Report Access Details',
      '==========================================',
      '',
      `Report ID: ${reportId || 'Not available'}`,
      `Private Edit Code: ${editToken}`,
      '',
      'How to access your report:',
      '1. Open the SafeTrace website.',
      '2. Find the "Edit My Report" section.',
      '3. Enter your private edit code.',
      '4. Retrieve your report to make corrections.',
      '',
      'SECURITY WARNING:',
      'Keep this file private. Anyone with your edit code may',
      'be able to access and change your report.',
      'Do not share it or upload it to a public website.',
    ].join('\n')

    const file = new Blob([accessDetails], {
      type: 'text/plain;charset=utf-8',
    })

    const fileUrl = URL.createObjectURL(file)
    const link = document.createElement('a')

    link.href = fileUrl
    link.download = 'SafeTrace-Private-Report-Access.txt'
    document.body.appendChild(link)
    link.click()
    link.remove()

    setTimeout(() => URL.revokeObjectURL(fileUrl), 1000)
  }


  async function findMyReport(event) {
    event.preventDefault()

    setMyReportError('')
    setMyReportMessage('')
    setMyReport(null)

    try {
      const response = await fetch(
        'http://localhost:5000/api/my-report',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            editToken: editTokenInput.trim(),
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Could not find your report.')
      }

      setMyReport(data.report)
    } catch (err) {
      setMyReportError(
        err.message || 'Could not connect to the backend.'
      )
    }
  }



  async function deleteReport(id) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this report?'
    )

    if (!confirmed) return

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Could not delete report.')
      }

      await loadReports()
    } catch (err) {
      alert('Could not delete report. Please try again.')
    }
  }

  function startEditing(report) {
    setEditingId(report.id)
    setEditForm({
      incidentType: report.incidentType,
      location: report.location,
      description: report.description,
    })
  }

  async function saveEdit(event) {
    event.preventDefault()

    try {
      const response = await fetch(`${API_URL}/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.message || 'Could not update report.'
        )
      }

      setEditingId(null)
      await loadReports()
    } catch (err) {
      alert(err.message || 'Could not update report.')
    }
  }

  return (

    <div className="hero">

      <h1>SafeTrace</h1>
      <h2>Women Safety Reporting Platform</h2>

      <p>
        Report incidents. Raise awareness.
        Help build safer communities.
      </p>
      {currentPage === 'home' && (
        <button
          className="report-button"
          onClick={() => {
            setShowForm(!showForm)
            setSubmitted(false)
          }}
        >
          {showForm ? 'Close Form' : 'Report an Incident'}
        </button>
      )}
      <p>

      </p>
      <nav className="main-nav">
        <button
          type="button"
          onClick={() => setCurrentPage('home')}
          className="nav-button"
        >
          Report an Incident
        </button>


        <button
          type="button"
          onClick={() => setCurrentPage('admin')}
          className="nav-button"
        >

          {currentPage === 'admin' && !token && (
            <form className="report-form" onSubmit={handleAdminLogin}>
              <h3>Admin Login</h3>

              <label htmlFor="loginUsername">Username</label>
              <input
                id="loginUsername"
                type="text"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                required
              />

              <label htmlFor="loginPassword">Password</label>
              <input
                id="loginPassword"
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
              />

              {loginError && <p role="alert">{loginError}</p>}

              <button type="submit" className="report-button">
                Log In
              </button>
            </form>
          )}

          Admin Dashboard
        </button>
      </nav>
      {currentPage === 'admin' && (
        <>
          <section className="dashboard">
            <article className="stat-card">
              <h3>Total Reports</h3>
              <p className="stat-number">{dateFilteredReports.length}</p>
            </article>

            <article className="stat-card">
              <h3>Today's Reports</h3>
              <p className="stat-number">{todaysReports}</p>
            </article>

            <article className="stat-card">
              <h3>Incident Types</h3>
              <p className="stat-number">{incidentTypes}</p>
            </article>
          </section>
          <section className="incident-breakdown">
            <h3>Incident Type Breakdown</h3>

            {incidentBreakdown.map((item) => (
              <div className="breakdown-item" key={item.type}>
                <div className="breakdown-label">
                  <span>{item.type}</span>
                  <strong>{item.count}</strong>
                </div>

                <div className="breakdown-track">
                  <div
                    className="breakdown-fill"
                    style={{
                      width: `${reports.length === 0
                        ? 0
                        : (item.count / reports.length) * 100
                        }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </section>
          <div className="charts-container">
            <section className="chart-section">
              <h2>Incident Reports Analytics</h2>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={incidentBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis allowDecimals={false} />
                  <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="count" position="insideTop" fill="#ffffff" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section className="chart-section">
              <h2>Incident Distribution</h2>

              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={incidentBreakdown.filter((item) => item.count > 0)}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={4}
                    label
                  >
                    {incidentBreakdown
                      .filter((item) => item.count > 0)
                      .map((item, index) => (
                        <Cell
                          key={item.type}
                          fill={['#2563eb', '#16a34a', '#f59e0b', '#dc2626'][index % 4]}
                        />
                      ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </section>
          </div>
        </>
      )}


      {submitted && (
        <p className="success-message" role="status">
          Your report has been saved successfully!
        </p>
      )}


      {currentPage === 'home' && submitted && editToken && (
        <section className="report-form">
          <h3>Report Submitted Successfully!</h3>

          <p>
            Keep this private edit code safe. You will need it to
            retrieve and correct your report later.
          </p>

          <label htmlFor="privateEditToken">Your private edit code</label>

          <input
            id="privateEditToken"
            type="text"
            value={editToken}
            readOnly
          />

          <button
            type="button"
            className="report-button"

            onClick={() => {
              navigator.clipboard.writeText(editToken)
                .then(() => {
                  alert('Private edit code copied!')
                  setSubmitted(false)
                })
                .catch(() => {
                  alert('Please copy the code manually.')
                })
            }}

          >
            Copy Edit Code
          </button>
          <button
            type="button"
            className="report-button"
            onClick={downloadAccessDetails}
          >
            Download Access Details
          </button>

          <p>
            Anyone with this code may be able to access and change
            your report. Do not share it with others.
          </p>
        </section>
      )}


      {currentPage === 'home' && (
        <section className="report-form">
          <h3>Edit My Report</h3>

          <p>
            Already submitted a report? Enter your private edit code
            to retrieve it and make corrections.
          </p>

          {myReportMessage && (
            <p role="status">{myReportMessage}</p>
          )}

          <form onSubmit={findMyReport}>
            <label htmlFor="editTokenInput">
              Private edit code
            </label>

            <input
              id="editTokenInput"
              type="text"
              value={editTokenInput}
              onChange={(event) => setEditTokenInput(event.target.value)}
              placeholder="Paste your private edit code"
              required
            />

            <button type="submit" className="report-button">
              Find My Report
            </button>
          </form>

          {myReportError && (
            <p role="alert">{myReportError}</p>
          )}
        </section>
      )}


      {currentPage === 'home' && myReport && (
        <section className="report-form">
          <h3>Correct Your Report</h3>

          <p>
            Update the information below and save your corrections.
            Your previous version will be preserved.
          </p>

          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setMyReportError('')
              setMyReportMessage('')

              const formData = new FormData(event.currentTarget)

              try {
                const response = await fetch(
                  'http://localhost:5000/api/my-report',
                  {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      editToken: editTokenInput.trim(),
                      incidentType: formData.get('incidentType'),
                      location: formData.get('location'),
                      description: formData.get('description'),
                    }),
                  }
                )

                const data = await response.json()

                if (!response.ok) {
                  throw new Error(
                    data.message || 'Could not update your report.'
                  )
                }


                setMyReportMessage(data.message)
                setMyReport(null)
                setEditTokenInput('')

              } catch (err) {
                setMyReportError(
                  err.message || 'Could not connect to the backend.'
                )
              }
            }}
          >
            <label htmlFor="editIncidentType">Incident Type</label>
            <input
              id="editIncidentType"
              name="incidentType"
              defaultValue={myReport.incidentType}
              required
            />

            <label htmlFor="editLocation">Location</label>
            <input
              id="editLocation"
              name="location"
              defaultValue={myReport.location}
              required
            />

            <label htmlFor="editDescription">Description</label>
            <textarea
              id="editDescription"
              name="description"
              defaultValue={myReport.description}
              rows={5}
              required
            />

            {myReportMessage && (
              <p role="status">{myReportMessage}</p>
            )}

            {myReportError && (
              <p role="alert">{myReportError}</p>
            )}

            <button type="submit" className="report-button">
              Save Corrections
            </button>
          </form>
        </section>
      )}


      {currentPage === 'home' && showForm && (
        <form className="report-form" onSubmit={handleSubmit}>
          <h3>Report an Incident</h3>

          <label htmlFor="incidentType">Incident Type</label>
          <select
            id="incidentType"
            name="incidentType"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select incident type
            </option>
            <option>Harassment</option>
            <option>Unsafe Location</option>
            <option>Stalking</option>
            <option>Other</option>
          </select>

          <label htmlFor="location">Location</label>
          <input
            id="location"
            name="location"
            type="text"
            placeholder="Enter incident location"
            required
          />

          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            placeholder="Describe what happened"
            required
          />

          <button type="submit" className="report-button">
            Submit Report
          </button>
        </form>
      )}
      {currentPage === 'admin' && (
        <>
          <section className="saved-reports">
            <h3>Incident Reports: {reports.length}</h3>

            {loading && <p>Loading reports...</p>}

            {error && (
              <p role="alert">{error}</p>
            )}

            {!loading && !error && reports.length === 0 && (
              <p>No reports yet. Submit a test report to get started.</p>
            )}

            {!loading && !error && reports.length > 0 && (
              <div className="table-container">
                <h3>Admin Reports Table</h3>
                <div className="date-filter">
                  <label>
                    Start date
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </label>

                  <label>
                    End date
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('')
                      setEndDate('')
                    }}
                  >
                    Clear dates
                  </button>
                </div>
                <div className="report-controls">
                  <input
                    type="search"
                    placeholder="Search location, description, or type..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    aria-label="Search reports"
                  />

                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    aria-label="Filter by incident type"
                  >
                    <option value="All">All Incident Types</option>
                    <option value="Harassment">Harassment</option>
                    <option value="Unsafe Location">Unsafe Location</option>
                    <option value="Stalking">Stalking</option>
                    <option value="Other">Other</option>
                  </select>

                  <select
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                    aria-label="Sort reports by date"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>


                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Incident Type</th>
                      <th>Location</th>
                      <th>Description</th>
                      <th>Submitted At</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.id}>
                        <td>{report.id}</td>
                        <td>{report.incidentType}</td>
                        <td>{report.location}</td>
                        <td>{report.description}</td>
                        <td>
                          {new Date(report.submittedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {filteredReports.length === 0 && (
                      <tr>
                        <td colSpan="5">
                          No matching reports found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {filteredReports.map((report) => (
              <article key={report.id} className="report-form">
                {editingId === report.id ? (
                  <form onSubmit={saveEdit}>
                    <h4>Edit Incident Report</h4>

                    <label htmlFor={`type-${report.id}`}>
                      Incident Type
                    </label>
                    <select
                      id={`type-${report.id}`}
                      value={editForm.incidentType}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          incidentType: event.target.value,
                        })
                      }
                      required
                    >
                      <option value="Harassment">Harassment</option>
                      <option value="Unsafe Location">Unsafe Location</option>
                      <option value="Stalking">Stalking</option>
                      <option value="Other">Other</option>
                    </select>

                    <label htmlFor={`location-${report.id}`}>
                      Location
                    </label>
                    <input
                      id={`location-${report.id}`}
                      value={editForm.location}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          location: event.target.value,
                        })
                      }
                      required
                    />

                    <label htmlFor={`description-${report.id}`}>
                      Description
                    </label>
                    <textarea
                      id={`description-${report.id}`}
                      value={editForm.description}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          description: event.target.value,
                        })
                      }
                      required
                    />

                    <button type="submit" className="report-button">
                      Save Changes
                    </button>

                    <button
                      type="button"
                      className="report-button"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <h4>{report.incidentType}</h4>

                    <p>
                      <strong>Location:</strong> {report.location}
                    </p>

                    <p>
                      <strong>Description:</strong> {report.description}
                    </p>

                    <p>
                      <strong>Submitted:</strong>{' '}
                      {new Date(report.submittedAt).toLocaleString()}
                    </p>

                    <button
                      type="button"
                      className="report-button"
                      onClick={() => startEditing(report)}
                    >
                      Edit Report
                    </button>

                    <button
                      type="button"
                      className="report-button"
                      onClick={() => deleteReport(report.id)}
                    >
                      Delete Report
                    </button>
                  </>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

export default App
