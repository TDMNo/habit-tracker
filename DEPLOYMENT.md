# Habit Tracker — Deployment

## 1. Status

Automated production deployment for the new Habit Tracker has not been configured yet.

The current repository contains the first React + TypeScript PWA frontend foundation. It is not production-ready because backend, server storage, authentication and automated deployment are not implemented yet.

## 2. Target flow

Planned model:

```text
GitHub main
 → CI
 → build/test
 → deploy to PROD
 → health checks
```

GitHub remains source of truth.

## 3. CI requirements

Before enabling production deploy, CI should verify at minimum:

- dependency installation;
- typecheck/lint;
- frontend build;
- backend build;
- unit/smoke tests;
- production configuration validity where safe.

## 4. Production deploy requirements

Deploy should:

- use an approved production target;
- preserve persistent database data;
- apply migrations safely;
- start/update services;
- verify health;
- fail clearly instead of silently publishing a broken release.

## 5. Database migrations

Schema changes must be versioned.

High-risk migrations require:

- backup before migration;
- rollback or recovery plan;
- validation after migration.

## 6. PWA release

Because Habit Tracker is installable, release verification must include:

- manifest correctness;
- service worker behavior;
- cache invalidation/update behavior;
- install/update scenario on phone;
- compatibility of cached client with current API.

## 7. Rollback

Rollback should restore a known-good application build first.

Database restore is a separate, higher-risk action and is used only when data/schema damage requires it.

## 8. What must be decided before automation

- production host/provider;
- domain;
- CI platform;
- deploy runner/mechanism;
- secret management;
- backup location;
- exact health endpoints.

After these are approved, replace target descriptions in this document with confirmed production facts.
