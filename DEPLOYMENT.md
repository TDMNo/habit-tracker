# Habit Tracker — Deployment

## 1. Status

CI/CD и production runtime реализованы, но реальный PROD всё ещё намеренно заблокирован.

Новая full-stack версия уже содержит React + TypeScript frontend, Node 22 + Express API, PostgreSQL, server-side sessions, migrations и Docker Compose topology.

На `docker-home` отсутствует activation file:

`/opt/stacks/habit-tracker/.prod-enabled`

Пока файла нет, deploy workflow завершается безопасно до любых production-изменений.

## 2. Release flow

```text
feature / PR
→ GitHub-hosted CI
→ merge to main
→ CI exact main commit
→ CI PASS
→ Habit Tracker PROD Deploy
→ repository-scoped runner on docker-home
→ scripts/deploy-prod.sh
→ activation gate
→ preflight
→ verified backup when DB already exists
→ build exact source commit
→ PostgreSQL health
→ migrations
→ application update
→ private/public health checks
→ production checkout fast-forward
```

## 3. CI

Workflow: `.github/workflows/ci.yml`.

CI проверяет:

- обязательную документацию;
- shell syntax operations scripts;
- TypeScript typecheck;
- unit tests;
- production build;
- PostgreSQL migrations;
- initial admin bootstrap;
- session auth;
- habit API;
- production-like Docker Compose build/start;
- PostgreSQL custom-format backup;
- checksum;
- disposable restore verification.

## 4. Production runner

- host: `docker-home`;
- runner: `docker-home-habit-tracker`;
- user: `leo`;
- installation: `/home/leo/actions-runner-habit-tracker/actions-runner`;
- durable checkout: `/opt/stacks/habit-tracker`.

Runner отдельный от Genealogy.

## 5. Production configuration

Real config хранится только на сервере:

`/opt/stacks/habit-tracker/.env.production`

Template: `.env.production.example`.

Обязательные production values:

- `POSTGRES_DB`;
- `POSTGRES_USER`;
- `POSTGRES_PASSWORD`;
- `POSTGRES_DATA_DIR`;
- `POSTGRES_BACKUP_DIR`;
- `SESSION_SECRET`;
- `HOST_PORT`.

Optional:

- `BACKUP_RETENTION_DAYS` — если не задан, backup script ничего автоматически не удаляет;
- `PUBLIC_HEALTH_URL` — включается после появления реального HTTPS route.

Deploy script не создаёт persistent directories автоматически: data и backup paths должны быть заранее осознанно подготовлены и writable.

## 6. Backup before deploy

Если production PostgreSQL уже запущен, перед build/migration выполняется:

1. `pg_dump -Fc`;
2. проверка backup через `pg_restore --list`;
3. SHA-256 checksum;
4. восстановление backup во временную disposable database;
5. проверка обязательных таблиц;
6. удаление только временной verification database.

Scripts:

- `scripts/backup-postgres.sh`;
- `scripts/verify-backup-restore.sh`.

При первом deploy, когда production PostgreSQL ещё не существует, pre-deploy backup отсутствующих данных не требуется.

## 7. Migrations

Migrations применяются только после успешного backup/restore verification существующей БД и после healthy PostgreSQL.

Применяется image exact source commit через:

`node dist/migrate.cjs`.

Migration runner использует ordered files, SHA-256 checksums и PostgreSQL advisory lock.

Production migrations должны оставаться backward-compatible с предыдущей application version, потому что старый app container продолжает обслуживать запросы до переключения на новую версию.

## 8. Application update and rollback

Перед build текущий app image, если он есть, получает локальный tag:

`habit-tracker-app:rollback`

Новая версия собирается как:

`habit-tracker-app:prod`

После запуска проверяются:

- Docker health;
- `http://127.0.0.1:<HOST_PORT>/api/health`;
- optional `PUBLIC_HEALTH_URL`.

Если новая версия не становится healthy или health endpoint не проходит, deploy script возвращает предыдущий image tag и перезапускает старую application version.

Автоматический rollback не откатывает уже успешно применённую migration. Поэтому destructive/non-backward-compatible migrations запрещены без отдельного migration/rollback плана.

## 9. Production checkout

Durable checkout `/opt/stacks/habit-tracker` обновляется `--ff-only` только после успешного runtime health-check.

Deploy дополнительно проверяет:

- exact CI-tested `TARGET_SHA`;
- чистый production working tree;
- branch `main`;
- fast-forward history;
- что `origin/main` всё ещё указывает на тот же `TARGET_SHA`.

Это предотвращает ситуацию, когда неуспешная версия отмечается в production checkout как успешно развернутая.

## 10. Docker isolation

Compose project: `habit_tracker_prod`.

Containers:

- `habit_tracker_prod_app`;
- `habit_tracker_prod_postgres`.

Network:

- `habit_tracker_internal`.

PostgreSQL не публикуется наружу. App публикуется только на `127.0.0.1:<HOST_PORT>` для последующего reverse proxy.

## 11. Verified server baseline

Read-only baseline на `docker-home` 11 сентября 2026 показал:

- existing services используют 3000, 3001, 3010, 5173, 8081, 8082, 9000 и 9443;
- порт 3011 в момент проверки не слушался;
- `/opt/stacks/habit-tracker` существует;
- отдельные `/opt/data/habit-tracker` и `/opt/backups/habit-tracker` ещё не были подготовлены;
- root filesystem был заполнен примерно на 82%, поэтому persistent storage нельзя выбирать наугад.

`HOST_PORT=3011` в example является текущим кандидатом и должен быть повторно проверен непосредственно перед activation.

## 12. Still open before activation

До создания `.prod-enabled` нужно отдельно подтвердить:

- реальный persistent PostgreSQL path;
- реальный backup path и физический storage;
- retention policy, если нужна автоматическая очистка;
- production secrets;
- повторную доступность выбранного `HOST_PORT`;
- domain/reverse proxy/HTTPS route;
- public health URL;
- первую controlled deployment procedure.

Activation и изменение production infrastructure выполняются отдельно, после этих проверок.
