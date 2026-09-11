# Habit Tracker

Mobile-first PWA для ежедневных повторяющихся привычек.

Текущая версия уже использует React + TypeScript frontend, Node/Express API и PostgreSQL. Реализованы серверные сессии, история привычек по датам, per-user cache и фоновая синхронизация дневных значений. Production остаётся закрыт safety-lock до подготовки реального storage/backup окружения на `docker-home`.

## Локальный запуск

Нужен PostgreSQL и переменные окружения по примеру `.env.example`.

```bash
npm install
npm run db:migrate
npm run dev
```

## Проверка

```bash
npm run typecheck
npm test
npm run build
```

CI дополнительно проверяет migrations, auth/API и production-like Docker Compose stack с созданием и тестовым восстановлением PostgreSQL backup.

## Production

- host: `docker-home`;
- checkout: `/opt/stacks/habit-tracker`;
- Compose: `docker-compose.prod.yml`;
- real environment: `.env.production` только на сервере;
- activation gate: `/opt/stacks/habit-tracker/.prod-enabled`;
- deploy: GitHub `main` → CI → self-hosted runner → `scripts/deploy-prod.sh`.

Пока activation gate отсутствует, pipeline не меняет production runtime.

## Документация

- `PROJECT_INSTRUCTIONS.md` — продуктовые правила и утверждённые решения.
- `ARCHITECTURE.md` — текущая архитектура и sync model.
- `INFRASTRUCTURE.md` — сервер и production topology.
- `DEPLOYMENT.md` — CI/CD, backup, health-check и rollback.
- `ROADMAP.md` — состояние этапов разработки.
