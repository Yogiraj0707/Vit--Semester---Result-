import { useEffect, useState } from 'react'
import AuthScreen from './AuthScreen'
import './App.css'

const initialCourses = [
  { id: 1, name: 'Data Structures & Algorithms', mse: '', ese: '', credits: 3 },
  { id: 2, name: 'Discrete Mathematics', mse: '', ese: '', credits: 3 },
  { id: 3, name: 'Computer Organization', mse: '', ese: '', credits: 3 },
  { id: 4, name: 'Web Technologies', mse: '', ese: '', credits: 3 },
]

const initialStudent = { name: '', registration: '', semester: 'Fall 2026' }
const isValidMark = (mark) => mark !== '' && Number(mark) >= 0 && Number(mark) <= 100

const gradeForScore = (score) => {
  if (score >= 90) return { letter: 'S', points: 10 }
  if (score >= 80) return { letter: 'A', points: 9 }
  if (score >= 70) return { letter: 'B', points: 8 }
  if (score >= 60) return { letter: 'C', points: 7 }
  if (score >= 50) return { letter: 'D', points: 6 }
  if (score >= 40) return { letter: 'E', points: 5 }
  return { letter: 'F', points: 0 }
}

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const result = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(result?.message || 'The request could not be completed.')
  return result
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [saveState, setSaveState] = useState('saved')
  const [student, setStudent] = useState(initialStudent)
  const [courses, setCourses] = useState(initialCourses)

  useEffect(() => {
    let active = true
    const restoreSession = async () => {
      try {
        const session = await apiRequest('/api/auth/session')
        if (!session.user) return
        const { results } = await apiRequest('/api/results')
        if (!active) return
        if (results) {
          setStudent(results.student)
          setCourses(results.courses)
        } else {
          setStudent({ ...initialStudent, name: session.user.name })
        }
        setUser(session.user)
        setWorkspaceReady(true)
      } catch {
        if (active) setAuthError('The account service is unavailable. Start the app with npm run dev and try again.')
      } finally {
        if (active) setAuthLoading(false)
      }
    }
    restoreSession()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user || !workspaceReady) return undefined
    const timeout = window.setTimeout(async () => {
      try {
        await apiRequest('/api/results', {
          method: 'PUT',
          body: JSON.stringify({ student, courses }),
        })
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    }, 450)
    return () => window.clearTimeout(timeout)
  }, [courses, student, user, workspaceReady])

  const startWorkspace = async (signedInUser) => {
    const { results } = await apiRequest('/api/results')
    if (results) {
      setStudent(results.student)
      setCourses(results.courses)
    } else {
      setStudent({ ...initialStudent, name: signedInUser.name })
      setCourses(initialCourses)
    }
    setAuthError('')
    setUser(signedInUser)
    setWorkspaceReady(true)
  }

  const signOut = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setWorkspaceReady(false)
      setStudent(initialStudent)
      setCourses(initialCourses)
    }
  }

  const completedCourses = courses.filter(
    (course) => isValidMark(course.mse) && isValidMark(course.ese),
  )
  const semesterAverage = completedCourses.length
    ? completedCourses.reduce((sum, course) => sum + Number(course.mse) * 0.3 + Number(course.ese) * 0.7, 0) /
      completedCourses.length
    : 0
  const totalCredits = completedCourses.reduce((sum, course) => sum + Number(course.credits || 3), 0)
  const cgpa = completedCourses.length === courses.length && totalCredits
    ? completedCourses.reduce((sum, course) => {
      const score = Number(course.mse) * 0.3 + Number(course.ese) * 0.7
      return sum + gradeForScore(score).points * Number(course.credits || 3)
    }, 0) / totalCredits
    : null
  const progress = Math.round((completedCourses.length / courses.length) * 100)
  const topCourse = completedCourses.reduce((top, course) => {
    const score = Number(course.mse) * 0.3 + Number(course.ese) * 0.7
    return !top || score > top.score ? { name: course.name, score } : top
  }, null)

  const updateCourse = (id, key, value) => {
    setCourses((current) =>
      current.map((course) => (course.id === id ? {
        ...course,
        [key]: key === 'credits' ? Math.max(1, Math.min(20, Number(value) || 1)) : value,
      } : course)),
    )
  }

  const downloadReport = () => {
    if (!user) return
    const rows = [
      ['Student', student.name],
      ['Registration number', student.registration],
      ['Semester', student.semester],
      [],
      ['Subject', 'Credits', 'MSE / 100', 'ESE / 100', 'Weighted score', 'Grade', 'Grade points'],
      ...courses.map((course) => {
        const mse = isValidMark(course.mse) ? Number(course.mse) : 0
        const ese = isValidMark(course.ese) ? Number(course.ese) : 0
        const score = mse * 0.3 + ese * 0.7
        const grade = gradeForScore(score)
        return [course.name, course.credits, mse, ese, score.toFixed(1), grade.letter, grade.points]
      }),
      [],
      ['Semester average', `${semesterAverage.toFixed(1)}%`],
      ['Estimated CGPA', cgpa === null ? 'Not calculated' : `${cgpa.toFixed(2)} / 10`],
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'vit-semester-result.csv'
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (authLoading) return <div className="auth-loading">Opening your workspace…</div>
  if (!user) return <AuthScreen onAuthenticated={startWorkspace} error={authError} />

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="VIT Result home">
          <span className="brand-mark">V</span>
          <span>VIT <span className="brand-light">RESULT DESK</span></span>
        </a>
        <div className="topbar-right"><span className="status-dot" /> {saveState === 'error' ? 'Save failed' : 'Autosave on'} <span className="topbar-divider" /> <span className="account-email">{user.email}</span><button className="signout-button" type="button" onClick={signOut} aria-label="Sign out">↗</button></div>
      </header>

      <main id="top">
        <section className="intro-row">
          <div className="intro-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> SEMESTER PLANNER <span className="eyebrow-term">01 / 01</span></p>
            <h1>Your marks,<br /><span>made clear.</span></h1>
            <p className="intro-note">A simple place to bring your semester together.</p>
          </div>
          <section className="average-panel" aria-live="polite">
            <div className="average-heading"><span>ESTIMATED CGPA</span><span className="average-icon">↗</span></div>
            <div className="average-number">{cgpa === null ? '—' : cgpa.toFixed(2)}<span>/ 10</span></div>
            <div className="average-footer"><span>{completedCourses.length} of 4 subjects · {semesterAverage.toFixed(1)}% average</span><span className="progress-track"><span style={{ width: `${progress}%` }} /></span></div>
          </section>
        </section>

        <section className="student-strip" aria-label="Student details">
          <label className="student-field student-name"><span>STUDENT NAME</span><input value={student.name} onChange={(event) => setStudent({ ...student, name: event.target.value })} placeholder="Your name" /></label>
          <label className="student-field"><span>REGISTRATION NUMBER</span><input value={student.registration} onChange={(event) => setStudent({ ...student, registration: event.target.value })} placeholder="e.g. 24BCE0000" /></label>
          <label className="student-field semester-field"><span>SEMESTER</span><select value={student.semester} onChange={(event) => setStudent({ ...student, semester: event.target.value })}><option>Fall 2026</option><option>Winter 2026</option><option>Fall 2025</option><option>Winter 2025</option></select></label>
        </section>

        <div className="section-heading">
          <div><p className="eyebrow">THE COURSEWORK</p><h2>Four subjects <span>·</span> one picture</h2></div>
          <button className="download-button" type="button" onClick={downloadReport}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5v9m0 0 3.5-3.5M10 11.5 6.5 8M3.5 13.5v3h13v-3" /></svg>
            Download report
          </button>
        </div>

        <section className="course-grid" aria-label="Subject marks">
          {courses.map((course, index) => {
            const complete = isValidMark(course.mse) && isValidMark(course.ese)
            const weightedScore = complete ? Number(course.mse) * 0.3 + Number(course.ese) * 0.7 : null
            return (
              <article className={`course-card course-card-${index + 1}`} key={course.id}>
                <div className="course-topline"><span className="course-index">0{index + 1}</span><span className={`course-state ${complete ? 'is-complete' : ''}`}><span />{complete ? 'Calculated' : 'Awaiting marks'}</span></div>
                <div className="course-heading-row">
                  <label className="course-title-field"><span className="course-name-label">SUBJECT NAME</span><input className="course-name" id={`course-name-${course.id}`} value={course.name} onChange={(event) => updateCourse(course.id, 'name', event.target.value)} aria-label={`Subject ${index + 1} name`} /></label>
                  <label className="credit-field"><span>CREDITS</span><input type="number" min="1" max="20" value={course.credits ?? 3} onChange={(event) => updateCourse(course.id, 'credits', event.target.value)} aria-label={`${course.name} credits`} /></label>
                </div>
                <div className="mark-inputs">
                  <label className="mark-field"><span>MSE <b>30%</b></span><span className="input-wrap"><input type="number" min="0" max="100" step="0.5" value={course.mse} onChange={(event) => updateCourse(course.id, 'mse', event.target.value)} placeholder="—" aria-label={`${course.name} MSE mark out of 100`} /><small>/ 100</small></span></label>
                  <label className="mark-field"><span>ESE <b>70%</b></span><span className="input-wrap"><input type="number" min="0" max="100" step="0.5" value={course.ese} onChange={(event) => updateCourse(course.id, 'ese', event.target.value)} placeholder="—" aria-label={`${course.name} ESE mark out of 100`} /><small>/ 100</small></span></label>
                </div>
                <div className="course-result">
                  <div><span>WEIGHTED SCORE</span><strong>{weightedScore === null ? '—' : `${weightedScore.toFixed(1)}%`}</strong></div>
                  <div className="grade-result"><span>GRADE / POINT</span><strong>{weightedScore === null ? '—' : `${gradeForScore(weightedScore).letter} / ${gradeForScore(weightedScore).points}`}</strong></div>
                </div>
                <div className="score-track"><span style={{ width: `${weightedScore ?? 0}%` }} /></div>
              </article>
            )
          })}
        </section>

        <section className="summary-row" aria-label="Result summary">
          <div className="formula-note"><span className="formula-mark">ƒx</span><div><strong>Credit-weighted grade points</strong><span>CGPA = Σ (course credits × grade points) ÷ total credits</span></div></div>
          <div className="top-subject"><span>HIGHEST SUBJECT</span><strong>{topCourse ? topCourse.name : 'Add marks to see your result'}</strong><span>{topCourse ? `${topCourse.score.toFixed(1)}% weighted score` : 'Your best result will appear here'}</span></div>
        </section>
        <footer className="page-footer"><span>VIT RESULT DESK</span><span>Estimate bands: S 90+, A 80+, B 70+, C 60+, D 50+, E 40+, F below 40. Official VIT relative grading may differ.</span></footer>
      </main>
    </div>
  )
}

export default App
