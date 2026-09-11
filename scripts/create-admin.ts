import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool()

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function run() {
  const login = required('ADMIN_LOGIN').toLowerCase()
  const password = required('ADMIN_PASSWORD')
  const displayName = required('ADMIN_DISPLAY_NAME')

  if (!/^[a-z0-9._-]{3,64}$/.test(login)) throw new Error('ADMIN_LOGIN has invalid format')
  if (password.length < 12 || password.length > 256) throw new Error('ADMIN_PASSWORD must contain 12-256 characters')
  if (displayName.length > 80) throw new Error('ADMIN_DISPLAY_NAME is too long')

  const passwordHash = await bcrypt.hash(password, 12)
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (id, login, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, 'admin')
     ON CONFLICT (login) DO NOTHING
     RETURNING id`,
    [randomUUID(), login, passwordHash, displayName],
  )

  if (result.rows[0]) console.log(`Admin created: ${login}`)
  else console.log(`Admin already exists: ${login}; password was not changed`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
