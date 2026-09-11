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
- durable pending-entry queue для offline/temporary network failure;
- Docker production runtime foundation.

## 2. Основная схема

```text
PWA / Web client
 ↓ cached screen + sync layer
React + TypeScript
 ↓ JSON API / session cookie
Node 22 + Express
 ↓
PostgreSQL
```

PostgreSQL/сервер — source of truth. Клиентский storage используется только как быстрый per-user cache, offline fallback и очередь ещё не синхронизированных действий.

## 3. Быстрый старт и синхронизация

Целевой сценарий уже заложен в клиент:

```text
launch
→ cached user/day immediately when available
→ validate server session in background
→ refresh selected day
→ optimistic local entry change
→ queue pending value
→ sequential background sync
```

Очередь хранится отдельно для каждого пользователя. Это не позволяет данным разных аккаунтов смешиваться на одном браузере.

Pending values накладываются поверх server refresh, поэтому медленный ответ сервера не должен затереть ещё не отправленное действие пользователя.

Записи синхронизируются последовательно. Это защищает от race condition при быстрых повторных нажатиях `+/-`, когда более старый запрос мог бы прийти позже нового.

При потере сети доступен последний cached day. Изменения существующих привычек сохраняются локально и отправляются после восстановления соединения. Создание новой привычки пока требует серверного соединения.

## 4. Backend

Backend отвечает за:

- `/api/health`;
- session auth;
- доступ к пользовательским привычкам;
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

Конкретные production port, persistent data path, backup path, secrets и domain фиксируются только после проверки реального состояния `docker-home`.

## 12. Изменение архитектуры

Если меняются backend stack, database, auth/session model, sync model или основная data model — обновить этот файл, `PROJECT_INSTRUCTIONS.md` и при необходимости `DECISIONS.md`.
