import 'dotenv/config'

function parsePort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid port: ${value}`)
  return port
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: process.env.APP_BIND_ADDRESS ?? '0.0.0.0',
  port: parsePort(process.env.APP_PORT, 3000),
  sessionSecret: required('SESSION_SECRET'),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  trustProxy: process.env.TRUST_PROXY === 'true',
}
