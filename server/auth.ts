import bcrypt from 'bcryptjs'
import { Router, type RequestHandler } from 'express'
import { pool } from './db'

type UserRow = {
  id: string
  login: string
  display_name: string
  role: 'user' | 'admin'
  is_active: boolean
  password_hash: string
}

function normalizeLogin(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function publicUser(user: UserRow) {
  return {
    id: user.id,
    login: user.login,
    displayName: user.display_name,
    role: user.role,
  }
}

function regenerateSession(request: Parameters<RequestHandler>[0]): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => (error ? reject(error) : resolve()))
  })
}

function saveSession(request: Parameters<RequestHandler>[0]): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.save((error) => (error ? reject(error) : resolve()))
  })
}

export const requireAuth: RequestHandler = (request, response, next) => {
  if (!request.session.userId) {
    response.status(401).json({ error: 'authentication_required' })
    return
  }
  next()
}

export const authRouter = Router()

authRouter.get('/me', async (request, response, next) => {
  try {
    if (!request.session.userId) {
      response.json({ user: null })
      return
    }

    const result = await pool.query<UserRow>(
      `SELECT id, login, display_name, role, is_active, password_hash
       FROM users
       WHERE id = $1`,
      [request.session.userId],
    )
    const user = result.rows[0]

    if (!user?.is_active) {
      request.session.destroy(() => undefined)
      response.json({ user: null })
      return
    }

    response.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/login', async (request, response, next) => {
  try {
    const login = normalizeLogin(request.body?.login)
    const password = typeof request.body?.password === 'string' ? request.body.password : ''

    if (!login || password.length < 1 || password.length > 256) {
      response.status(400).json({ error: 'invalid_credentials' })
      return
    }

    const result = await pool.query<UserRow>(
      `SELECT id, login, display_name, role, is_active, password_hash
       FROM users
       WHERE login = $1`,
      [login],
    )
    const user = result.rows[0]
    const valid = user?.is_active ? await bcrypt.compare(password, user.password_hash) : false

    if (!user || !valid) {
      response.status(401).json({ error: 'invalid_credentials' })
      return
    }

    await regenerateSession(request)
    request.session.userId = user.id
    await saveSession(request)
    response.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/logout', (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error)
      return
    }
    response.status(204).end()
  })
})
