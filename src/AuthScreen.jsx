import { useState } from 'react'
import './AuthScreen.css'

function AuthScreen({ onAuthenticated, error: initialError = '' }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState(false)
  const isRegistering = mode === 'register'

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (isRegistering && password !== confirmPassword) {
      setError('Those passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to authenticate.')
      await onAuthenticated(result.user)
    } catch (requestError) {
      setError(requestError.message || 'Unable to reach the sign-in service. Start the app with npm run dev.')
    } finally {
      setBusy(false)
    }
  }

  const changeMode = (nextMode) => {
    setMode(nextMode)
    setError('')
  }

  return (
    <div className="auth-shell">
      <header className="topbar auth-topbar">
        <a className="brand" href="#top" aria-label="VIT Result home">
          <span className="brand-mark">V</span>
          <span>VIT <span className="brand-light">RESULT DESK</span></span>
        </a>
        <span className="auth-top-label">STUDENT WORKSPACE</span>
      </header>
      <main className="auth-main" id="top">
        <section className="auth-story">
          <p className="eyebrow"><span className="eyebrow-line" /> YOUR SEMESTER, IN FOCUS</p>
          <h1>One account.<br /><span>Every mark</span><br />in its place.</h1>
          <p className="auth-story-note">Keep your subjects, weighted scores and CGPA estimate together in a private workspace.</p>
          <div className="auth-formula"><span>30%</span><i /> <span>70%</span><b>MSE + ESE</b></div>
        </section>
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-panel-heading">
            <span className="auth-overline">{isRegistering ? 'GET STARTED' : 'YOUR WORKSPACE'}</span>
            <h2 id="auth-title">{isRegistering ? 'Create an account' : 'Welcome back'}</h2>
            <p>{isRegistering ? 'Set up your private semester desk.' : 'Sign in to pick up where you left off.'}</p>
          </div>
          <div className="auth-tabs" role="tablist" aria-label="Account options">
            <button type="button" role="tab" aria-selected={!isRegistering} className={!isRegistering ? 'active' : ''} onClick={() => changeMode('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={isRegistering} className={isRegistering ? 'active' : ''} onClick={() => changeMode('register')}>Create account</button>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {isRegistering && <label className="auth-field"><span>FULL NAME</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" minLength={2} maxLength={80} required /></label>}
            <label className="auth-field"><span>EMAIL ADDRESS</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
            <label className="auth-field"><span>PASSWORD</span><input type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegistering ? 'At least 8 characters' : 'Your password'} minLength={isRegistering ? 8 : undefined} maxLength={128} required /></label>
            {isRegistering && <label className="auth-field"><span>CONFIRM PASSWORD</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" minLength={8} maxLength={128} required /></label>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}<span aria-hidden="true">↗</span></button>
          </form>
          <p className="auth-security-note"><span /> Passwords are protected with a one-way password hash.</p>
        </section>
      </main>
      <footer className="auth-footer"><span>VIT RESULT DESK</span><span>Private account · Saved as you work</span></footer>
    </div>
  )
}

export default AuthScreen