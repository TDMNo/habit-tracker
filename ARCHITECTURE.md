# Habit Tracker — Architecture

## 1. Текущее состояние

Habit Tracker переведён со старого Vanilla JS прототипа на новую mobile-first основу.

Реализовано:

- React + TypeScript + Vite Web/PWA frontend;
- экран Today и навигация по локальным календарным датам;
- `Habit` отдельно от дневного `HabitEntry`;
- Node 22 + Express backend;
- PostgreSQL schema и versioned SQL migrations;
- server-side session auth;
- habit/entry/target API;
- per-user client cache;
- background refresh и optimistic entry updates;
- durable pending-entry queue;
- durable pending-habit queue для создания привычек без сети;
- idempotent server-side habit creation по client-generated UUID;
- Docker production runtime foundation.

## 2. Основная схема

```text
PWA / Web client
 ↓ cached screen + durable sync queues
React + TypeScript
 ↓ JSON API / session cookie
Node 22 + Express
 ↓
PostgreSQL
```

PostgreSQL/сервер — source of truth. Клиентский storage используется как быстрый per-user cache, offline fallback и очередь ещё не синхронизированных действий.

## 3. Быстрый старт и синхронизация

Клиент работает по схеме:

```text
launch
→ cached user/day immediately when available
→ validate server session in background
→ flush pending habit definitions
→ flush pending day entries
→ refresh selected day
```

Любое изменение дневного значения сначала применяется локально, затем ставится в очередь и последовательно отправляется на сервер.

Новая привычка также создаётся локально сразу. Клиент генерирует UUID, сохраняет определение в `pendingHabits` и показывает его в Today screen даже без сети. После восстановления соединения тот же UUID отправляется на сервер.

Server POST создания привычки идемпотентен для одного пользователя: повтор той же операции с тем же UUID и теми же полями возвращает уже созданную привычку вместо дубля. Если тот же UUID используется с другими данными или другим владельцем, сервер отвечает конфликтом.

Pending habit definitions синхронизируются раньше pending entries. Поэтому пользователь может офлайн создать новую привычку и сразу отметить её выполнение: после reconnect сначала создаётся Habit, потом отправляется HabitEntry.

Очереди и кеш хранятся отдельно для каждого пользователя. Server refresh накладывает локальные pending values/definitions поверх ответа сервера, поэтому медленный ответ не должен затереть ещё не отправленное действие.

## 4. Backend

Backend отвечает за:

- `/api/health`;
- session auth;
- доступ к пользовательским привычкам;
- idempotent habit creation;
- выполнение по конкретным датам;
- историю целей привычки;
- ownership checks.

Пароли хранятся только как bcrypt hash. Session identifier хранится в httpOnly cookie, session state — в PostgreSQL.

## 5. Модель данных

Server-side основа:

- `User` — аккаунт и роль;
- `Habit` — определение привычки;
- `HabitTarget` — цель с датой вступления в силу;
- `HabitEntry` — фактическое значение за конкретную дату;
- `user_sessions` — server-side sessions.

Изменение цели, например 10 → 20 → 30 минут, не переписывает старую статистику.

Client-side временное состояние дополнительно содержит:

- cached days;
- `pendingHabits`;
- `pendingEntries`.

Позже добавляются Friendship, Group / GroupMember, Achievement и MonthlyScore.

## 6. Типы привычек

Поддерживаемая модель:

- `binary` — выполнено / не выполнено;
- `count` — количество;
- `duration` — длительность;
- target history для count/duration.

Фактическое дневное значение хранится в `HabitEntry`, а не внутри `Habit`.

## 7. Даты

Календарная дата пользователя хранится как `YYYY-MM-DD` и формируется из local calendar components, а не через UTC `toISOString()`.

Это предотвращает попадание выполнения в соседний день из-за timezone conversion около полуночи.

## 8. Миграции БД

SQL migrations лежат в `migrations/` и применяются отдельным migration runner.

Правила:

- migrations выполняются по порядку;
- применённая migration фиксируется вместе с SHA-256 checksum;
- изменение уже применённого файла вызывает ошибку;
- используется PostgreSQL advisory lock;
- production schema не меняется через ручной ad-hoc SQL без отдельного решения.

## 9. Auth

Реализовано:

- login/password;
- bcrypt verification;
- server-side session;
- `me` / login / logout;
- active/blocked state;
- backend ownership checks;
- mobile login screen;
- background session validation.

Следующие auth-функции: recovery flow, optional 2FA и полноценная user/admin management модель.

## 10. PWA

Базовые manifest/service worker уже есть.

Перед production release должны быть проверены:

- installability;
- Android/iOS home-screen flow;
- safe areas;
- offline shell;
- service-worker update flow;
- совместимость кешированного клиента с текущим API.

## 11. Production runtime

`docker-compose.prod.yml` определяет отдельные:

- `habit_tracker_prod_app`;
- `habit_tracker_prod_postgres`;
- internal Docker network.

PostgreSQL наружу не публикуется. Application bind происходит только на localhost host-порту для последующего reverse proxy.

Production deploy использует safety lock, backup/restore verification, migrations, health checks и application-image rollback. Persistent storage, secrets и public route выбираются только после проверки реального состояния `docker-home`.

## 12. Изменение архитектуры

Если меняются backend stack, database, auth/session model, sync model или основная data model — обновить этот файл, `PROJECT_INSTRUCTIONS.md` и при необходимости `DECISIONS.md`.
