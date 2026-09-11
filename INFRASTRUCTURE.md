# Habit Tracker — Infrastructure

## 1. Status

The new Habit Tracker application is not deployed yet, but its production execution path now has a verified server target and dedicated GitHub Actions runner.

The legacy Vanilla JS prototype remains in the repository only as a product/UX reference during migration. It is not the target production architecture.

## 2. Source of truth

- GitHub repository: `TDMNo/habit-tracker`.
- Main branch: `main`.
- GitHub remains the source of truth for code and release history.
- Production checkout: `/opt/stacks/habit-tracker`.

## 3. Production host

Confirmed production host:

- host: `docker-home`;
- user used by deploy runner: `leo`;
- runtime: Docker + Docker Compose;
- dedicated repository runner: `docker-home-habit-tracker`;
- runner installation: `/home/leo/actions-runner-habit-tracker/actions-runner`.

The Habit Tracker runner is separate from the Genealogy runner.

## 4. Target application runtime

Approved direction:

- mobile-first Web/PWA;
- React + TypeScript frontend;
- backend API;
- PostgreSQL as server-side source of truth;
- Docker-based production runtime;
- reverse proxy / HTTPS once a domain is assigned;
- local PWA cache for fast startup and offline fallback only.

Exact backend framework and final Compose topology will be chosen during implementation of the new application.

## 5. Deployment isolation

Habit Tracker must have its own:

- production checkout;
- containers;
- PostgreSQL instance/data;
- environment file;
- backup path;
- health endpoints;
- public route/domain.

Normal Habit Tracker deployment must not restart, recreate or modify Genealogy or other project containers.

## 6. Production safety state

Real deployment is currently locked by the absence of:

`/opt/stacks/habit-tracker/.prod-enabled`

The CI/CD wiring may run and validate the runner, but it cannot publish the legacy prototype or mutate the production stack while this lock remains absent.

## 7. Data and backups

The future PostgreSQL database will be the server-side source of truth. Persistent storage paths, backup storage and retention are not fixed yet and must be selected before enabling real production deployment.

Required before real users/data:

- automatic PostgreSQL backup;
- backup verification;
- retention policy;
- restore procedure;
- periodic restore test;
- no public PostgreSQL exposure.

## 8. Public access

A dedicated production domain and HTTPS route will be assigned later.

Until the new application and proxy route are ready, no production domain should be invented or documented as active.

## 9. Monitoring

Minimum target monitoring:

- frontend availability;
- backend health;
- database health;
- backup freshness;
- disk/storage usage;
- application errors.

## 10. Next infrastructure decisions

Before unlocking production deployment confirm:

- backend framework;
- final Docker Compose services and ports;
- database/storage paths;
- backup path and retention;
- domain/reverse proxy route;
- health endpoints;
- production secrets/session configuration;
- monitoring target.
