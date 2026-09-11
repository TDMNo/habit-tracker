import 'dotenv/config'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool()
const migrationsDir = path.resolve(process.cwd(), 'migrations')

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

async function run() {
  const client = await pool.connect()
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('habit_tracker_migrations'))")
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const files = (await readdir(migrationsDir))
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort()

    for (const name of files) {
      const sql = await readFile(path.join(migrationsDir, name), 'utf8')
      const hash = checksum(sql)
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE name = $1',
        [name],
      )

      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== hash) {
          throw new Error(`Migration checksum mismatch: ${name}`)
        }
        console.log(`skip ${name}`)
        continue
      }

      console.log(`apply ${name}`)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
          [name, hash],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext('habit_tracker_migrations'))")
    } catch {
      // Connection shutdown releases the lock even if explicit unlock fails.
    }
    client.release()
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
