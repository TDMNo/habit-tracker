# Habit Tracker — Roadmap

Статусы: `DONE` — реализовано и проверено, `NEXT` — следующий этап, `LATER` — запланировано.

## Phase 1 — Mobile foundation

- `DONE` React + TypeScript + Vite foundation.
- `DONE` Mobile-first Today screen.
- `DONE` Binary, count and duration interactions.
- `DONE` Day progress and quick habit creation.
- `DONE` Habit definitions separated from daily HabitEntry history.
- `DONE` Local calendar date handling without UTC day-shift bug.
- `DONE` Base PWA manifest and offline shell.
- `NEXT` Visual acceptance on real phone viewport.

## Phase 2 — Data and accounts

- `DONE` Backend: Node 22 + Express + PostgreSQL.
- `DONE` Versioned PostgreSQL schema and checksum-verified migrations.
- `DONE` User, Habit, HabitEntry and HabitTarget history foundation.
- `DONE` Login/session/logout backend foundation.
- `DONE` Authenticated habit/day-entry API foundation.
- `DONE` Frontend login and background session validation.
- `DONE` Per-user cache + optimistic API sync queue for existing habit entries.
- `DONE` Reconnect flow that flushes pending values before refreshing the day.
- `DONE` Offline-safe habit creation with client UUID and idempotent server retry.
- `NEXT` Offline-safe editing/archiving of habit definitions.
- `NEXT` Recovery flow and optional 2FA.

## Phase 3 — Product depth

- `LATER` Weekly/monthly statistics, streaks and averages.
- `LATER` Friends, groups and privacy controls.
- `LATER` Stars, achievements and monthly score.
- `LATER` Separate Admin interface.

## Phase 4 — Production

- `DONE` Production host confirmed: docker-home.
- `DONE` Dedicated repository-scoped self-hosted runner.
- `DONE` GitHub main → CI → locked PROD workflow wiring.
- `DONE` Isolated Docker app/PostgreSQL topology defined.
- `DONE` Read-only server baseline and current host-port map captured; 3011 identified as a candidate.
- `DONE` PostgreSQL backup + checksum + disposable restore verification implemented and exercised in CI.
- `DONE` Backup-first production deploy script, health checks and app image rollback implemented and exercised in CI.
- `NEXT` Inspect real block devices/mounts and choose persistent PostgreSQL + backup storage paths.
- `NEXT` Prepare server-only production environment/secrets and directories.
- `NEXT` Controlled first PROD activation and deployment.
- `LATER` Assign production domain + HTTPS reverse proxy route.
- `LATER` Add scheduled backup/freshness monitoring and disk alerts.
- `LATER` PWA install/update verification on Android and iOS.
