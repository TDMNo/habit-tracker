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

SCHEMA_CHECK="$(compose exec -T postgres sh -ec 'psql -U "$POSTGRES_USER" -d "$1" -Atqc "SELECT concat_ws(\",\", to_regclass(\"public.users\"), to_regclass(\"public.habits\"), to_regclass(\"public.habit_entries\"), to_regclass(\"public.schema_migrations\"));"' _ "$TEST_DB")"
[[ "$SCHEMA_CHECK" == *users* && "$SCHEMA_CHECK" == *habits* && "$SCHEMA_CHECK" == *habit_entries* && "$SCHEMA_CHECK" == *schema_migrations* ]] \
  || fail "restored database is missing required tables"

cleanup
trap - EXIT
printf 'RESTORE_VERIFY_OK %s\n' "$BACKUP_FILE"
