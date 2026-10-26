import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

const scrypt = promisify(scryptCallback)
const app = express()
const port = Number(process.env.PORT) || 3001
const directory = path.dirname(fileURLToPath(import.meta.url))
const dataDirectory = path.join(directory, 'data')
const usersFile = path.join(dataDirectory, 'users.json')
const sessions = new Map()
const sessionCookie = 'vit_result_session'
const sessionLifetime = 7 * 24 * 60 * 60 * 1000

const loadUsers = () => {
  if (!existsSync(usersFile)) return []
  try {
    return JSON.parse(readFileSync(usersFile, 'utf8'))
  } catch {
    return []
  }
}

let users = loadUsers()

const saveUsers = () => {
  mkdirSync(dataDirectory, { recursive: true })
  const temporaryFile = `${usersFile}.tmp`
  writeFileSync(temporaryFile, JSON.stringify(users, null, 2), { mode: 0o600 })
  renameSync(temporaryFile, usersFile)
}

const publicUser = ({ id, name, email }) => ({ id, name, email })

const createSession = (res, userId) => {
  const token = randomBytes(32).toString('base64url')
  sessions.set(token, { userId, expiresAt: Date.now() + sessionLifetime })
  res.cookie(sessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionLifetime,
    path: '/',
  })
}

const findSessionUser = (req) => {
  const token = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookie}=`))
    ?.slice(sessionCookie.length + 1)
  if (!token) return null
  const session = sessions.get(token)
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token)
    return null
  }
  return users.find((user) => user.id === session.userId) ?? null
}

const requireUser = (req, res, next) => {
  const user = findSessionUser(req)
  if (!user) return res.status(401).json({ message: 'Please sign in to continue.' })
  req.user = user
  next()
}

app.use(express.json({ limit: '20kb' }))

app.get('/api/auth/session', (req, res) => {
  const user = findSessionUser(req)
  res.json({ user: user ? publicUser(user) : null })
})

app.post('/api/auth/register', async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Enter a name between 2 and 80 characters.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })
  if (password.length < 8 || password.length > 128) return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' })
  if (users.some((user) => user.email === email)) return res.status(409).json({ message: 'An account with that email already exists.' })

  const salt = randomBytes(16).toString('hex')
  const passwordHash = (await scrypt(password, salt, 64)).toString('hex')
  const user = { id: randomBytes(16).toString('hex'), name, email, salt, passwordHash, results: null }
  users.push(user)
  saveUsers()
  createSession(res, user.id)
  res.status(201).json({ user: publicUser(user) })
})

app.post('/api/auth/login', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  const user = users.find((candidate) => candidate.email === email)
  const salt = user?.salt ?? 'vit-result-desk-invalid-user'
  const passwordHash = (await scrypt(password, salt, 64)).toString('hex')
  const passwordMatches = user && timingSafeEqual(Buffer.from(passwordHash, 'hex'), Buffer.from(user.passwordHash, 'hex'))
  if (!passwordMatches) return res.status(401).json({ message: 'Email or password is incorrect.' })
  createSession(res, user.id)
  res.json({ user: publicUser(user) })
})

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookie}=`))
    ?.slice(sessionCookie.length + 1)
  if (token) sessions.delete(token)
  res.clearCookie(sessionCookie, { httpOnly: true, sameSite: 'lax', path: '/' })
  res.status(204).end()
})

app.get('/api/results', requireUser, (req, res) => {
  res.json({ results: req.user.results })
})

app.put('/api/results', requireUser, (req, res) => {
  const { student, courses } = req.body
  if (!student || !Array.isArray(courses) || courses.length !== 4) {
    return res.status(400).json({ message: 'A student record and exactly four subjects are required.' })
  }
  const safeCourses = courses.map((course, index) => {
    const mark = (value) => {
      if (value === '' || value === null || value === undefined) return ''
      const number = Number(value)
      return Number.isFinite(number) && number >= 0 && number <= 100 ? number : ''
    }
    const credits = Number(course.credits)
    return {
      id: index + 1,
      name: typeof course.name === 'string' ? course.name.trim().slice(0, 100) : `Subject ${index + 1}`,
      mse: mark(course.mse),
      ese: mark(course.ese),
      credits: Number.isFinite(credits) ? Math.max(1, Math.min(20, credits)) : 3,
    }
  })
  req.user.results = {
    student: {
      name: typeof student.name === 'string' ? student.name.trim().slice(0, 80) : '',
      registration: typeof student.registration === 'string' ? student.registration.trim().slice(0, 40) : '',
      semester: typeof student.semester === 'string' ? student.semester.slice(0, 40) : 'Fall 2026',
    },
    courses: safeCourses,
  }
  saveUsers()
  res.status(204).end()
})

const buildDirectory = path.join(directory, 'dist')
if (existsSync(buildDirectory)) {
  app.use(express.static(buildDirectory))
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(buildDirectory, 'index.html'))
  })
}

app.listen(port, '127.0.0.1', () => {
  console.log(`VIT Result Desk API listening on http://127.0.0.1:${port}`)
})