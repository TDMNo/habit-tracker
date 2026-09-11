#!/usr/bin/env bash
set -Eeuo pipefail

PROD_DIR="${PROD_DIR:-/opt/stacks/habit-tracker}"
ENV_FILE="${ENV_FILE:-$PROD_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROD_DIR/docker-compose.prod.yml}"

fail() {
  echo "BACKUP ERROR: $*" >&2
  exit 1
}

read_env_value() {
  local key="$1"
  local line value
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 1
  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

[[ -f "$ENV_FILE" ]] || fail "environment file not found: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || fail "compose file not found: $COMPOSE_FILE"

BACKUP_DIR="${POSTGRES_BACKUP_DIR:-$(read_env_value POSTGRES_BACKUP_DIR || true)}"
[[ -n "$BACKUP_DIR" ]] || fail "POSTGRES_BACKUP_DIR is required"
[[ "$BACKUP_DIR" == /* ]] || fail "POSTGRES_BACKUP_DIR must be an absolute path"
[[ -d "$BACKUP_DIR" ]] || fail "backup directory does not exist: $BACKUP_DIR"
[[ -w "$BACKUP_DIR" ]] || fail "backup directory is not writable: $BACKUP_DIR"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

POSTGRES_CONTAINER="$(compose ps -q postgres)"
[[ -n "$POSTGRES_CONTAINER" ]] || fail "postgres container is not running"
[[ "$(docker inspect -f '{{.State.Running}}' "$POSTGRES_CONTAINER")" == "true" ]] || fail "postgres container is not running"

umask 077
STAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
FINAL="$BACKUP_DIR/habit_tracker_${STAMP}.dump"
TEMP="$BACKUP_DIR/.habit_tracker_${STAMP}.dump.part"
CHECKSUM="$FINAL.sha256"

cleanup() {
  rm -f "$TEMP"
}
trap cleanup EXIT

compose exec -T postgres sh -ec 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges' > "$TEMP"
[[ -s "$TEMP" ]] || fail "pg_dump produced an empty backup"

compose exec -T postgres pg_restore --list < "$TEMP" >/dev/null
mv "$TEMP" "$FINAL"
sha256sum "$FINAL" > "$CHECKSUM"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-$(read_env_value BACKUP_RETENTION_DAYS || true)}"
if [[ -n "$RETENTION_DAYS" ]]; then
  [[ "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]] || fail "BACKUP_RETENTION_DAYS must be a positive integer"
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'habit_tracker_*.dump' -mtime "+$RETENTION_DAYS" -print -delete
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'habit_tracker_*.dump.sha256' -mtime "+$RETENTION_DAYS" -print -delete
fi

trap - EXIT
printf 'BACKUP_OK %s\n' "$FINAL"
