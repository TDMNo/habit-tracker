import path from 'node:path'
import { fileURLToPath } from 'node:url'
import connectPgSimple from 'connect-pg-simple'
import express, { type ErrorRequestHandler } from 'express'
import session from 'express-session'
import { authRouter } from './server/auth'
import { config } from './server/config'
import { databaseHealth, pool } from './server/db'
import { habitsRouter } from './server/habits'

const app = express()
const PgSession = connectPgSimple(session)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.disable('x-powered-by')
if (config.trustProxy) app.set('trust proxy', 1)
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', async (_request, response) => {
  try {
    await databaseHealth()
    response.json({ status: 'ok', database: 'ok' })
  } catch {
    response.status(503).json({ status: 'degraded', database: 'unavailable' })
  }
})

app.use(session({
  name: 'habit.sid',
  secret: config.sessionSecret,
  store: new PgSession({
    pool,
    tableName: 'user_sessions',
    pruneSessionInterval: 15 * 60,
  }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
}))

app.use('/api/auth', authRouter)
app.use('/api/habits', habitsRouter)

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'not_found' })
})

if (config.nodeEnv === 'production') {
  app.use(express.static(__dirname, {
    etag: true,
    maxAge: '1h',
    setHeaders(response, filename) {
      if (filename.endsWith('index.html') || filename.endsWith('sw.js') || filename.endsWith('manifest.webmanifest')) {
        response.setHeader('Cache-Control', 'no-cache')
      }
    },
  }))
  app.get('*', (_request, response) => response.sendFile(path.join(__dirname, 'index.html')))
} else {
  const { createServer: createViteServer } = await import('vite')
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
}

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error)
  if (response.headersSent) return
  response.status(500).json({ error: 'internal_error' })
}
app.use(errorHandler)

const server = app.listen(config.port, config.host, () => {
  console.log(`Habit Tracker listening on ${config.host}:${config.port}`)
})

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down`)
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
