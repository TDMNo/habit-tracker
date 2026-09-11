# Habit Tracker — Roadmap

Статусы: `DONE` — реализовано и проверено, `NEXT` — следующий этап, `LATER` — запланировано.

## Phase 1 — Mobile foundation

- `DONE` React + TypeScript + Vite project foundation.
- `DONE` Mobile-first Today screen.
- `DONE` Binary, count and duration interactions.
- `DONE` Day progress and quick habit creation.
- `DONE` Versioned local persistence adapter.
- `DONE` Base PWA manifest and offline shell.
- `NEXT` User visual review on a real phone viewport.

## Phase 2 — Data and accounts

- `NEXT` Confirm backend framework and auth/session implementation.
- `NEXT` Define versioned PostgreSQL schema and migrations.
- `NEXT` Implement User, Habit, HabitEntry and HabitTarget history.
- `NEXT` Add login, session and recovery flow.
- `NEXT` Replace local-only persistence with cache + sync queue.

## Phase 3 — Product depth

- `LATER` Weekly and monthly statistics, streaks and averages.
- `LATER` Friends, groups and privacy controls.
- `LATER` Stars, achievements and monthly score.
- `LATER` Separate Admin interface.

## Phase 4 — Production

- `LATER` Confirm domain, host and CI/CD runner.
- `LATER` Backups, monitoring and health checks.
- `LATER` Safe automated GitHub main → CI → PROD deployment.
- `LATER` PWA installation/update verification on Android and iOS.
