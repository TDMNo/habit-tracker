#!/usr/bin/env bash
set -Eeuo pipefail

PROD_DIR="${PROD_DIR:-/opt/stacks/habit-tracker}"
ENV_FILE="${ENV_FILE:-$PROD_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROD_DIR/docker-compose.prod.yml}"
BACKUP_FILE="${BACKUP_FILE:?BACKUP_FILE is required}"

fail() {
  echo "RESTORE VERIFY ERROR: $*" >&2
  exit 1
}

[[ -f "$ENV_FILE" ]] || fail "environment file not found: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || fail "compose file not found: $COMPOSE_FILE"
[[ -f "$BACKUP_FILE" ]] || fail "backup file not found: $BACKUP_FILE"
[[ -s "$BACKUP_FILE" ]] || fail "backup file is empty: $BACKUP_FILE"

if [[ -f "$BACKUP_FILE.sha256" ]]; then
  (cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "$BACKUP_FILE").sha256") >/dev/null
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

POSTGRES_CONTAINER="$(compose ps -q postgres)"
[[ -n "$POSTGRES_CONTAINER" ]] || fail "postgres container is not running"

TEST_DB="habit_restore_check_$(date -u +'%Y%m%d%H%M%S')_$$"
TEST_DB="${TEST_DB//[^a-zA-Z0-9_]/_}"

cleanup() {
  compose exec -T postgres sh -ec 'dropdb -U "$POSTGRES_USER" --if-exists "$1"' _ "$TEST_DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

compose exec -T postgres sh -ec 'createdb -U "$POSTGRES_USER" "$1"' _ "$TEST_DB"
compose exec -T postgres sh -ec 'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --no-privileges' _ "$TEST_DB" < "$BACKUP_FILE"

for table in users habits habit_entries schema_migrations; do
  query="SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}' LIMIT 1;"
  result="$(compose exec -T postgres sh -ec 'psql -U "$POSTGRES_USER" -d "$1" -Atqc "$2"' _ "$TEST_DB" "$query")"
  [[ "$result" == "1" ]] || fail "restored database is missing required table: $table"
done

cleanup
trap - EXIT
printf 'RESTORE_VERIFY_OK %s\n' "$BACKUP_FILE"
