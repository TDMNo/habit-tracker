# Habit Tracker — Architecture

## 1. Роль документа

Этот файл описывает текущую основу и целевую архитектуру новой версии Habit Tracker.

С 11 сентября 2026 года в репозитории реализована новая mobile-first основа на React + TypeScript + Vite. Backend и PostgreSQL ещё не реализованы. Старый Vanilla JS прототип сохранён в Git history и не является текущей кодовой базой.

## 2. Целевая схема

```text
PWA / Web client
 ↓
React + TypeScript frontend
 ↓ API
Backend service
 ↓
PostgreSQL
```

Сервер является source of truth. Клиент хранит локальный кеш для быстрого старта и offline fallback.

## 3. Основные компоненты

- Mobile-first PWA frontend — реализована первая версия экрана Today.
- Local cache — временно реализован через versioned LocalStorage adapter до появления серверной синхронизации.
- Service worker и Web App Manifest — добавлена базовая установка и offline shell.
- Backend API — запланирован.
- PostgreSQL — запланирован.
- Server-side auth/session layer.
- Local client cache.
- Background sync where appropriate.
- Admin interface.

## 4. Основные сущности

- User
- Habit
- HabitEntry
- HabitTarget / target history
- HabitType
- Friendship
- Group
- GroupMember
- Achievement
- MonthlyScore

`Habit` описывает саму привычку.

`HabitEntry` фиксирует выполнение в конкретный день.

Историческое выполнение не должно изменяться при последующем изменении цели привычки.

## 5. Типы привычек

Архитектура должна поддерживать как минимум:

- Binary;
- Count;
- Duration;
- target value поверх Count/Duration.

Тип привычки не должен быть зашит в отдельный UI без общей модели данных.

## 6. Быстрый UX

Ключевой сценарий:

```text
launch → cached today screen → background refresh → sync
```

Основной экран не должен быть пустым только потому, что сеть отвечает медленно.

При отметке привычки UI реагирует сразу, а серверная синхронизация происходит максимально незаметно.

Конфликты синхронизации должны разрешаться предсказуемо и не терять пользовательские действия.

## 7. Offline / cache

LocalStorage не является целевым source of truth. На первом frontend-этапе он временно хранит локальные данные через отдельный storage adapter.

Для новой версии следует использовать подходящее локальное хранилище PWA как кеш и очередь временно несинхронизированных действий.

Offline режим должен позволять как минимум:

- открыть последний актуальный Today screen;
- отметить доступные привычки;
- сохранить изменения локально;
- синхронизировать их после восстановления сети.

## 8. Auth

Целевой подход — полноценная серверная авторизация по модели, проверенной в Genealogy, но без слепого копирования реализации.

Требования:

- login/password;
- secure session;
- recovery flow;
- optional 2FA;
- блокировка пользователя;
- приватность по умолчанию.

## 9. Социальная модель

Социальная часть опциональна.

Пользователь не обязан участвовать в рейтингах или делиться привычками.

Visibility привычки/результата:

- private;
- friends;
- group.

Доступ к приватным данным должен контролироваться на backend, а не только скрываться в UI.

## 10. Statistics

Статистика строится из сохранённой истории HabitEntry и исторических целей.

Нужны недельные/месячные агрегаты, streaks, completion %, averages и monthly score.

Тяжёлые вычисления не должны замедлять старт Today screen.

## 11. Admin

Admin отделён от пользовательского интерфейса.

Admin должен управлять аккаунтами, состоянием системы, группами и диагностикой, но не давать администратору ненужный доступ к приватному содержимому привычек.

## 12. PWA

PWA должна поддерживать:

- installability;
- service worker;
- корректное обновление версии;
- mobile safe areas;
- Android/iOS home screen сценарий;
- offline fallback.

## 13. Миграция со старого прототипа

Старый LocalStorage формат не становится новой серверной схемой автоматически.

Если понадобится импорт старых данных, он проектируется как отдельный migration/import flow.

## 14. Изменение архитектуры

Если меняются backend stack, database, auth model, sync model или основная модель данных — обновить этот файл и при необходимости `PROJECT_INSTRUCTIONS.md`.
