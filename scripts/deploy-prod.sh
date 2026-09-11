#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_SHA="${TARGET_SHA:?TARGET_SHA is required}"
PROD_DIR="${PROD_DIR:-/opt/stacks/habit-tracker}"
SOURCE_DIR="${SOURCE_DIR:-$(git rev-parse --show-toplevel)}"
PROD_LOCK_FILE="${PROD_LOCK_FILE:-$PROD_DIR/.prod-enabled}"

fail() {
  echo "DEPLOY ERROR: $*" >&2
  exit 1
}

[[ -d "$PROD_DIR/.git" ]] || fail "production repo not found: $PROD_DIR"

if [[ ! -f "$PROD_LOCK_FILE" ]]; then
  echo "PROD_LOCKED: deployment wiring is ready, but production activation is intentionally disabled"
  echo "Lock file is absent: $PROD_LOCK_FILE"
  exit 0
fi

[[ -f "$SOURCE_DIR/package.json" ]] || fail "modern application package.json is missing"
[[ -f "$SOURCE_DIR/docker-compose.prod.yml" ]] || fail "docker-compose.prod.yml is missing"
[[ -f "$PROD_DIR/.env.production" ]] || fail "production environment file is missing"

SOURCE_SHA="$(git -C "$SOURCE_DIR" rev-parse HEAD)"
[[ "$SOURCE_SHA" == "$TARGET_SHA" ]] || fail "checkout SHA $SOURCE_SHA != target $TARGET_SHA"

BRANCH="$(git -C "$PROD_DIR" branch --show-current)"
[[ "$BRANCH" == "main" ]] || fail "production checkout is on branch '$BRANCH', expected main"
[[ -z "$(git -C "$PROD_DIR" status --porcelain)" ]] || fail "production working tree is not clean"

CURRENT_SHA="$(git -C "$PROD_DIR" rev-parse HEAD)"
git -C "$SOURCE_DIR" merge-base --is-ancestor "$CURRENT_SHA" "$TARGET_SHA" \
  || fail "target is not a fast-forward from current production commit"

fail "production is unlocked, but final Docker deployment implementation has not been approved yet"
