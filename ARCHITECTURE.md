# Habit Tracker — Architecture

## 1. Текущее состояние

Habit Tracker переводится со старого Vanilla JS прототипа на новую mobile-first архитектуру.

Реализовано:

- React + TypeScript + Vite Web/PWA frontend;
- экран Today и навигация по локальным календарным датам;
- отдельные `Habit` и `HabitEntry`, чтобы выполнение одного дня не меняло саму привычку;
- временный versioned local adapter с миграцией v1 → v2;
- Node 22 + Express backend foundation;
- PostgreSQL schema и versioned SQL migrations;
- server-side session auth;
- habit/entry/target API;
- Docker production runtime foundation.

Frontend пока не синхронизирован с API. До подключения sync локальные данные остаются временным frontend-состоянием, а не production source of truth.

## 2. Целевая схема

```text
PWA / Web client
 ↓
React + TypeScript
 ↓ JSON API
Node 22 + Express
 ↓
PostgreSQL
```

PostgreSQL/сервер являются целевым source of truth. Клиентский storage после подключения API используется как быстрый cache, offline fallback и очередь несинхронизированных действий.

## 3. Backend

Backend запускается единым application service и отвечает за:

- `/api/health`;
- session auth;
- доступ к пользовательским привычкам;
- выполнение по конкретным датам;
- историю целей привычки;
- авторизацию доступа к данным.

Пароли хранятся только как bcrypt hash. Session identifier хранится в httpOnly cookie, а session state — в PostgreSQL.

## 4. Модель данных

Текущая server-side основа:

- `User` — аккаунт и роль;
- `Habit` — определение привычки;
- `HabitTarget` — цель с датой вступления в силу;
- `HabitEntry` — фактическое значение привычки за конкретную дату;
- `user_sessions` — server-side sessions.

Это позволяет менять цель, например 10 → 20 → 30 минут, не переписывая старую статистику.

Позже добавляются:

- Friendship;
- Group / GroupMember;
- Achievement;
- MonthlyScore.

## 5. Типы привычек

Поддерживаемая модель:

- `binary` — выполнено / не выполнено;
- `count` — количество;
- `duration` — длительность;
- target history для count/duration.

Daily value хранится в `HabitEntry`, а не внутри `Habit`.

## 6. Даты

Календарная дата пользователя хранится как `YYYY-MM-DD` и формируется из local calendar components, а не через UTC `toISOString()`.

Это важно, чтобы около полуночи выполнение не попадало в соседний день из-за timezone conversion.

## 7. Миграции БД

SQL migrations лежат в `migrations/` и применяются отдельным migration runner.

Правила:

- migrations выполняются по порядку;
- применённая migration фиксируется вместе с SHA-256 checksum;
- изменение уже применённого файла вызывает ошибку;
- используется PostgreSQL advisory lock, чтобы две миграции не запускались одновременно;
- production schema не должна изменяться через ручной ad-hoc SQL без отдельного решения.

## 8. Auth

Реализован foundation:

- login/password;
- bcrypt password verification;
- server-side session;
- `me` / login / logout;
- active/blocked state на уровне пользователя;
- backend ownership checks для привычек.

Следующие auth-функции:

- recovery flow;
- optional 2FA;
- полноценная user/admin management модель.

## 9. Быстрый UX и sync

Целевая последовательность:

```text
launch
→ cached Today immediately
→ background API refresh
→ optimistic local change
→ background sync
```

Следующий архитектурный этап — подключить текущий frontend к API через отдельный sync/cache layer без блокировки Today screen сетью.

## 10. PWA

Базовые manifest/service worker уже есть.

Перед production release должны быть проверены:

- installability;
- Android/iOS home-screen flow;
- safe areas;
- offline shell;
- обновление service worker;
- совместимость кешированного клиента с текущим API.

## 11. Production runtime

Целевая production topology уже описана в `docker-compose.prod.yml`:

- `habit_tracker_prod_app`;
- `habit_tracker_prod_postgres`;
- отдельная internal Docker network;
- PostgreSQL наружу не публикуется;
- application bind происходит только на localhost host-порту для последующего reverse proxy.

Конкретные production port, data path, secrets и domain не фиксируются до проверки реального состояния сервера.

## 12. Изменение архитектуры

Если меняются backend stack, database, auth/session model, sync model или основная data model — обновить этот файл, `PROJECT_INSTRUCTIONS.md` и при необходимости `DECISIONS.md`.
