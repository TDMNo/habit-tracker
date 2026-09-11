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
- durable offline queues для создания, редактирования и выполнения привычек;
- idempotent server-side habit creation по client-generated UUID;
- исторические цели привычки через `HabitTarget`;
- архивирование без удаления истории;
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

PostgreSQL/сервер — source of truth. Клиентский storage используется как быстрый per-user cache, offline fallback и durable очередь ещё не синхронизированных действий.

## 3. Быстрый старт и синхронизация

Клиент работает по схеме:

```text
launch
→ cached user/day immediately when available
→ validate server session in background
→ flush pending habit creations
→ flush pending habit definition/target/archive changes
→ flush pending day entries
→ refresh selected day
```

Очереди хранятся отдельно для каждого пользователя.

Изменения применяются локально сразу. Server refresh накладывается под pending local state, поэтому медленный ответ сервера не должен затереть ещё не отправленное действие пользователя.

### Создание

Новая привычка получает client-generated UUID и сохраняется в `pendingHabits`. Server POST идемпотентен: повтор той же операции с тем же UUID и теми же данными не создаёт дубль.

### Редактирование

Offline-редактирование хранится в `pendingHabitChanges`.

Порядок синхронизации важен:

1. создать ещё не существующую привычку;
2. применить её definition/target/archive changes;
3. отправить дневные значения.

Это позволяет без сети создать привычку, изменить её и сразу отметить выполнение.

Базовые поля `title`, `emoji`, `color` относятся к самой привычке и обновляются глобально.

`target` и `unit` исторические: изменение цели получает `effectiveDate`, поэтому прошлые дни продолжают использовать прежнюю цель.

### Архив

Архивирование не удаляет `Habit`, `HabitTarget` или прошлые `HabitEntry`.

В текущем мобильном UX команда «Архивировать после этого дня» ставит `archivedOn` на следующий календарный день. Выбранный день остаётся частью истории, а привычка исчезает начиная со следующего дня.

Несинхронизированные дневные изменения на датах после архива локально удаляются из очереди, чтобы клиент не отправлял значения для уже неактивной привычки.

## 4. Backend

Backend отвечает за:

- `/api/health`;
- session auth;
- ownership checks;
- idempotent habit creation;
- редактирование базовых полей привычки;
- исторические target changes;
- archive date;
- выполнение по конкретным датам.

Пароли хранятся только как bcrypt hash. Session identifier хранится в httpOnly cookie, session state — в PostgreSQL.

## 5. Модель данных

Server-side основа:

- `User` — аккаунт и роль;
- `Habit` — определение привычки и `archived_on`;
- `HabitTarget` — цель с датой вступления в силу;
- `HabitEntry` — фактическое значение за конкретную дату;
- `user_sessions` — server-side sessions.

Изменение цели, например 10 → 20 → 30 минут, не переписывает старую статистику.

Client-side состояние дополнительно содержит:

- cached days;
- `pendingHabits`;
- `pendingHabitChanges`;
- `pendingEntries`.

Текущая client cache schema version: `v5`.

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
