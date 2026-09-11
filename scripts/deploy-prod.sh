#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_SHA="${TARGET_SHA:?TARGET_SHA is required}"
PROD_DIR="${PROD_DIR:-/opt/stacks/habit-tracker}"
SOURCE_DIR="${SOURCE_DIR:-$(git rev-parse --show-toplevel)}"
PROD_LOCK_FILE="${PROD_LOCK_FILE:-$PROD_DIR/.prod-enabled}"
ENV_FILE="${ENV_FILE:-$PROD_DIR/.env.production}"
COMPOSE_FILE="$SOURCE_DIR/docker-compose.prod.yml"

fail() {
  echo "DEPLOY ERROR: $*" >&2
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

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

wait_healthy() {
  local container="$1"
  local attempts="${2:-45}"
  local status=""
  for ((i=1; i<=attempts; i++)); do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
    if [[ "$status" == "healthy" ]]; then
      return 0
    fi
    if [[ "$status" == "exited" || "$status" == "dead" ]]; then
      return 1
    fi
    sleep 2
  done
  return 1
}

rollback_app() {
  if docker image inspect habit-tracker-app:rollback >/dev/null 2>&1; then
    echo "Rolling application image back"
    docker tag habit-tracker-app:rollback habit-tracker-app:prod
    compose up -d --no-deps app || true
    wait_healthy habit_tracker_prod_app 30 || true
  fi
}

[[ -d "$PROD_DIR/.git" ]] || fail "production repo not found: $PROD_DIR"

if [[ ! -f "$PROD_LOCK_FILE" ]]; then
  echo "PROD_LOCKED: production activation is intentionally disabled"
  echo "Lock file is absent: $PROD_LOCK_FILE"
  exit 0
fi

[[ -f "$SOURCE_DIR/package.json" ]] || fail "application package.json is missing"
[[ -f "$COMPOSE_FILE" ]] || fail "docker-compose.prod.yml is missing"
[[ -f "$SOURCE_DIR/scripts/backup-postgres.sh" ]] || fail "backup script is missing"
[[ -f "$SOURCE_DIR/scripts/verify-backup-restore.sh" ]] || fail "restore verification script is missing"
[[ -f "$ENV_FILE" ]] || fail "production environment file is missing"

SOURCE_SHA="$(git -C "$SOURCE_DIR" rev-parse HEAD)"
[[ "$SOURCE_SHA" == "$TARGET_SHA" ]] || fail "checkout SHA $SOURCE_SHA != target $TARGET_SHA"

BRANCH="$(git -C "$PROD_DIR" branch --show-current)"
[[ "$BRANCH" == "main" ]] || fail "production checkout is on branch '$BRANCH', expected main"
[[ -z "$(git -C "$PROD_DIR" status --porcelain)" ]] || fail "production working tree is not clean"

CURRENT_SHA="$(git -C "$PROD_DIR" rev-parse HEAD)"
git -C "$SOURCE_DIR" merge-base --is-ancestor "$CURRENT_SHA" "$TARGET_SHA" \
  || fail "target is not a fast-forward from current production commit"

POSTGRES_DATA_DIR="$(read_env_value POSTGRES_DATA_DIR || true)"
POSTGRES_BACKUP_DIR="$(read_env_value POSTGRES_BACKUP_DIR || true)"
HOST_PORT="$(read_env_value HOST_PORT || true)"

[[ "$POSTGRES_DATA_DIR" == /* ]] || fail "POSTGRES_DATA_DIR must be an absolute path"
[[ "$POSTGRES_BACKUP_DIR" == /* ]] || fail "POSTGRES_BACKUP_DIR must be an absolute path"
[[ -d "$POSTGRES_DATA_DIR" ]] || fail "POSTGRES_DATA_DIR must already exist"
[[ -d "$POSTGRES_BACKUP_DIR" && -w "$POSTGRES_BACKUP_DIR" ]] || fail "POSTGRES_BACKUP_DIR must already exist and be writable"
[[ "$HOST_PORT" =~ ^[0-9]+$ && "$HOST_PORT" -ge 1 && "$HOST_PORT" -le 65535 ]] || fail "HOST_PORT is invalid"

compose config --quiet

if ! docker container inspect habit_tracker_prod_app >/dev/null 2>&1; then
  if ss -ltnH "sport = :$HOST_PORT" | grep -q .; then
    fail "HOST_PORT $HOST_PORT is already in use"
  fi
fi

EXISTING_POSTGRES="$(compose ps -q postgres 2>/dev/null || true)"
if [[ -n "$EXISTING_POSTGRES" && "$(docker inspect -f '{{.State.Running}}' "$EXISTING_POSTGRES" 2>/dev/null || true)" == "true" ]]; then
  echo "Creating pre-deploy PostgreSQL backup"
  BACKUP_OUTPUT="$(PROD_DIR="$PROD_DIR" ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" POSTGRES_BACKUP_DIR="$POSTGRES_BACKUP_DIR" bash "$SOURCE_DIR/scripts/backup-postgres.sh")"
  echo "$BACKUP_OUTPUT"
  BACKUP_FILE="$(printf '%s\n' "$BACKUP_OUTPUT" | awk '/^BACKUP_OK /{sub(/^BACKUP_OK /, ""); print}' | tail -n 1)"
  [[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]] || fail "backup script did not return a valid backup file"

  echo "Verifying backup with disposable restore"
  PROD_DIR="$PROD_DIR" ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" BACKUP_FILE="$BACKUP_FILE" \
    bash "$SOURCE_DIR/scripts/verify-backup-restore.sh"
else
  echo "No existing PostgreSQL container: pre-deploy backup is not required for first deployment"
fi

if docker container inspect habit_tracker_prod_app >/dev/null 2>&1; then
  OLD_APP_IMAGE="$(docker inspect -f '{{.Image}}' habit_tracker_prod_app)"
  docker tag "$OLD_APP_IMAGE" habit-tracker-app:rollback
fi

compose build app
compose up -d postgres
wait_healthy habit_tracker_prod_postgres 45 || fail "PostgreSQL did not become healthy"

compose run --rm --no-deps app node dist/migrate.cjs

set +e
compose up -d --no-deps app
APP_UP_RC=$?
if [[ "$APP_UP_RC" -eq 0 ]]; then
  wait_healthy habit_tracker_prod_app 45
  APP_HEALTH_RC=$?
else
  APP_HEALTH_RC="$APP_UP_RC"
fi
set -e

if [[ "$APP_HEALTH_RC" -ne 0 ]]; then
  rollback_app
  fail "new application container failed health check"
fi

HOST_HEALTH="http://127.0.0.1:${HOST_PORT}/api/health"
curl -fsS --max-time 10 "$HOST_HEALTH" | grep -q '"status":"ok"' || {
  rollback_app
  fail "private host health check failed: $HOST_HEALTH"
}

PUBLIC_HEALTH_URL="$(read_env_value PUBLIC_HEALTH_URL || true)"
if [[ -n "$PUBLIC_HEALTH_URL" ]]; then
  curl -fsS --max-time 15 "$PUBLIC_HEALTH_URL" | grep -q '"status":"ok"' || {
    rollback_app
    fail "public health check failed"
  }
fi

# Update the durable production checkout only after the new runtime is healthy.
git -C "$PROD_DIR" fetch --prune origin main
REMOTE_MAIN="$(git -C "$PROD_DIR" rev-parse origin/main)"
[[ "$REMOTE_MAIN" == "$TARGET_SHA" ]] || {
  rollback_app
  fail "origin/main moved during deployment: $REMOTE_MAIN != $TARGET_SHA"
}
git -C "$PROD_DIR" merge --ff-only "$TARGET_SHA"
[[ "$(git -C "$PROD_DIR" rev-parse HEAD)" == "$TARGET_SHA" ]] || fail "production checkout did not reach target SHA"

printf 'DEPLOY_OK %s\n' "$TARGET_SHA"
