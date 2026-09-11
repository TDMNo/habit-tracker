# Habit Tracker — Infrastructure

## 1. Status

Infrastructure for the new Habit Tracker is not deployed yet.

Current repository contains an old static Vanilla JS prototype plus target project documentation.

This file describes the intended production shape and the decisions that still need to be made before implementation.

## 2. Source of truth

- GitHub repository: `TDMNo/habit-tracker`.
- Production code must come from GitHub.
- Local development copies must not become independent sources of truth.

## 3. Target runtime

Recommended direction:

- frontend: React + TypeScript PWA;
- backend API;
- PostgreSQL;
- Docker-based runtime where appropriate;
- reverse proxy / HTTPS;
- backups;
- health checks;
- monitoring.

Exact production host, domain and provider are not confirmed yet.

## 4. Environments

Target separation:

- DEV — local/isolated development;
- TEST or staging — when useful for risky changes;
- PROD — real user data.

Production secrets and data must not be reused casually in DEV.

## 5. Data

Server database is the source of truth.

Persistent production components should include:

- PostgreSQL data;
- backup storage;
- application secrets/config outside Git.

Client-side storage is cache/offline state only.

## 6. Backups

Before real production use, define and test:

- automatic PostgreSQL backup;
- retention;
- off-host copy;
- restore procedure;
- periodic restore test.

## 7. Public access

Production should use a dedicated domain and HTTPS.

Only required public application endpoints should be exposed. PostgreSQL must not be public.

## 8. Monitoring

Minimum production monitoring:

- frontend availability;
- backend health;
- database health;
- backup freshness;
- disk/storage usage;
- application errors.

## 9. Performance infrastructure

Because fast startup is a product requirement, infrastructure choices should support:

- low-latency API responses;
- efficient caching;
- compression;
- optimized static assets;
- predictable database performance;
- graceful behavior during temporary network issues.

## 10. Decisions still open

Before production deployment confirm:

- production domain;
- hosting provider/host;
- exact backend framework;
- auth/session implementation;
- backup location;
- CI/CD runner model;
- monitoring target;
- notification/push infrastructure if added.

Do not invent these values in code or documentation before they are approved.