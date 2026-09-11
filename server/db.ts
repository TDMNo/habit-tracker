import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  max: Number(process.env.PGPOOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error)
})

export async function databaseHealth(): Promise<void> {
  await pool.query('SELECT 1')
}
