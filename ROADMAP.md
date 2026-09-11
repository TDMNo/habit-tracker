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

- `DONE` Backend direction: Node 22 + Express + PostgreSQL.
- `DONE` Versioned PostgreSQL schema and checksum-verified migrations.
- `DONE` User, Habit, HabitEntry and HabitTarget history foundation.
- `DONE` Login/session/logout backend foundation.
- `DONE` Authenticated habit/day-entry API foundation.
- `NEXT` Connect frontend login and session state.
- `NEXT` Replace temporary local-only state with cache + API sync queue.
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
- `NEXT` Confirm server port, persistent DB path and backup path from real host state.
- `NEXT` Implement and verify automatic PostgreSQL backup + restore procedure.
- `NEXT` Complete production deploy script and controlled first deploy.
- `LATER` Assign production domain + HTTPS reverse proxy route.
- `LATER` Add monitoring and backup freshness alerts.
- `LATER` PWA install/update verification on Android and iOS.
