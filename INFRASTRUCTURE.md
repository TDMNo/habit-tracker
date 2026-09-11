# Habit Tracker — Infrastructure

## 1. Status

Full-stack production topology уже реализована в коде, но не активирована на `docker-home`.

GitHub остаётся source of truth. Реальный deploy закрыт server-side activation gate до подготовки persistent storage, backup storage, secrets и HTTPS route.

## 2. Source of truth

- repository: `TDMNo/habit-tracker`;
- branch: `main`;
- production checkout: `/opt/stacks/habit-tracker`;
- production host: `docker-home`;
- deploy runner user: `leo`.

## 3. Application stack

- frontend: React + TypeScript + Vite PWA;
- backend: Node 22 + Express;
- database: PostgreSQL 16;
- auth: server-side sessions in PostgreSQL;
- runtime: Docker + Docker Compose.

## 4. Production Compose topology

Compose project:

- `habit_tracker_prod`.

Containers:

- `habit_tracker_prod_app`;
- `habit_tracker_prod_postgres`.

Network:

- `habit_tracker_internal`.

App image:

- `habit-tracker-app:prod`;
- temporary rollback image: `habit-tracker-app:rollback`.

PostgreSQL не имеет host port. Application публикуется только на localhost:

`127.0.0.1:<HOST_PORT> → app:3000`

## 5. Isolation

Habit Tracker имеет отдельные:

- checkout;
- containers;
- Docker network;
- PostgreSQL instance;
- persistent data directory;
- backup directory;
- `.env.production`;
- health endpoints;
- будущий public route/domain.

Normal deploy не должен restart/recreate другие project containers.

## 6. Server baseline

Read-only inspection на `docker-home` 11 сентября 2026 подтвердила:

- Habit Tracker checkout существует;
- existing host listeners: 3000, 3001, 3010, 5173, 8081, 8082, 9000, 9443;
- 3011 в момент проверки был свободен;
- `/opt/data` используется другими сервисами, но Habit Tracker data directory ещё не создан;
- `/opt/backups` содержит Genealogy backups, но Habit Tracker backup directory ещё не создан;
- root filesystem: около 38 GB total, около 6.5 GB free, ~82% used.

Из-за заполнения root filesystem production PostgreSQL и backups нельзя размещать до проверки реальных block devices/mounts и выбора storage.

## 7. Persistent data

Compose требует абсолютный `POSTGRES_DATA_DIR`.

Deploy script намеренно не создаёт этот directory. Он должен быть подготовлен отдельно после выбора физического storage и проверен как writable пользователем deploy runner.

PostgreSQL volume монтируется:

`POSTGRES_DATA_DIR → /var/lib/postgresql/data`

Normal deploy никогда не выполняет `docker compose down -v` и не удаляет persistent database directory.

## 8. Backup storage

Production config требует `POSTGRES_BACKUP_DIR`.

Backup format:

- PostgreSQL custom format (`pg_dump -Fc`);
- SHA-256 sidecar checksum;
- disposable restore verification before deploy.

Автоматическое удаление backup выключено по умолчанию. Retention включается только явным `BACKUP_RETENTION_DAYS`.

Физический backup storage ещё должен быть выбран и подтверждён.

## 9. Production safety gate

Activation file:

`/opt/stacks/habit-tracker/.prod-enabled`

Пока его нет, deploy workflow может проверить runner wiring, но production stack не меняется.

Создание activation file считается отдельным production action после готовности storage/secrets/backup/route.

## 10. Health and monitoring

Implemented health endpoint:

- `/api/health` проверяет application и PostgreSQL availability.

Deploy checks:

- Docker health PostgreSQL;
- Docker health app;
- private localhost HTTP health;
- optional public HTTPS health.

Target monitoring после activation:

- public availability;
- backend/database health;
- backup freshness;
- disk usage;
- application errors.

## 11. Public access

Dedicated production domain пока не назначен.

После выбора domain нужен reverse proxy/HTTPS route на выбранный localhost `HOST_PORT`, после чего URL фиксируется как `PUBLIC_HEALTH_URL`.

## 12. Open infrastructure decisions

До PROD activation требуется:

- проверить реальные block devices/mounts на `docker-home`;
- выбрать `POSTGRES_DATA_DIR`;
- выбрать `POSTGRES_BACKUP_DIR` желательно с учётом отказа основного storage;
- определить retention policy или оставить ручное хранение;
- создать server-only `.env.production`;
- повторно проверить host port;
- назначить domain и HTTPS route;
- подключить monitoring/backup freshness alert.
