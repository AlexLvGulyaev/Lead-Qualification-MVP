# Руководство по развёртыванию Lead Qualification MVP

Этот документ — пошаговый протокол развёртывания. Пройдите его последовательно от начала до конца. После каждого шага есть проверка и критерий успешного завершения.

---

## 1. Purpose

### Что разворачивается

Lead Qualification MVP — система автоматической квалификации входящих лидов из Website и Telegram.

**Компоненты:**

| Компонент | Назначение |
|-----------|------------|
| **PostgreSQL** | База данных (2 базы: n8n + lead_qualification) |
| **n8n** | Workflow engine — оркестрация всех процессов |
| **Admin Backend** | FastAPI — API для Admin Console |
| **Admin UI** | Static HTML — Dashboard, Lead Queue, Lead Details |
| **Client UI** | Static HTML — Landing page с формой заявки |

### Что вы получите после завершения

- Работающую систему приёма лидов с Website и Telegram
- AI-классификацию лидов (hot/warm/cold/spam)
- Автоматическое создание сделок в Kommo CRM
- Admin Console для мониторинга лидов

---

## 2. Deployment Models

### 2.1. Local Deployment (Разработка)

**Назначение:** Локальная разработка и тестирование.

**Архитектура:**

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose                          │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL:15432 ←── n8n:5678                              │
│                      ←── Admin Backend:8000                 │
│                      ←── Admin UI:8080                      │
│                      ←── Client UI:5180                     │
└─────────────────────────────────────────────────────────────┘
```

**URLs:**

| Сервис | URL |
|--------|-----|
| Client UI | http://localhost:5180 |
| Admin UI | http://localhost:8080 |
| Admin API | http://localhost:8000/docs |
| n8n UI | http://localhost:5678 |
| PostgreSQL | localhost:15432 |

**Требования:**

- Docker 24.0+
- Docker Compose 2.20+
- 4 GB RAM минимум
- 40 GB диск

---

### 2.2. Demo Deployment (Production)

**Назначение:** Публичная демонстрация.

**Важно:** Все домены в этом документе являются примерами. При развёртывании используйте собственные домены.

**Архитектура:**

```
┌─────────────────────────────────────────────────────────────┐
│                     VPS Server                              │
├─────────────────────────────────────────────────────────────┤
│  Traefik (внешний)                                          │
│      │                                                      │
│      ├── lead-qual.example.com ──→ Client UI:5180          │
│      ├── lead-qual.example.com/webhook ──→ n8n:5678       │
│      └── lead-qual-admin.example.com ──→ Admin UI:8080     │
│              └─→ Admin Backend:8000                        │
│                                                             │
│  Telegram Bot API ──────────────────────────────────────┐   │
│      │                                                  │   │
│      └─→ n8n:5678 (Telegram Trigger)                   │   │
│              └─→ PostgreSQL                             │   │
│                                                             │
│  Docker Compose (внутренний)                                │
│      PostgreSQL:5432 (внутренний порт)                     │
│      n8n:5678                                               │
│      Admin Backend:8000                                     │
│      Admin UI:80                                            │
│      Client UI:80                                           │
└─────────────────────────────────────────────────────────────┘
```

**Public Entry Points:**

Для полноценной демонстрации Lead Qualification MVP должны быть доступны все публичные точки входа системы:

| Точка входа | Назначение | Обязательна для Demo |
|-------------|------------|---------------------|
| **Landing Page** | Презентация проекта | ✅ Да |
| **Website Form** | Создание лида через Web | ✅ Да |
| **Telegram Bot** | Создание лида через Telegram | ✅ Да |
| **Admin Console** | Мониторинг обработки | ✅ Да |

**Важно:** Website Form и Telegram Bot являются двумя основными пользовательскими каналами системы. Оба обязательны для полноценного Demo Deployment. Отсутствие любого из перечисленных компонентов делает демонстрационный контур неполным.

**Отличия от Local Deployment:**

| Аспект | Local | Demo |
|--------|-------|------|
| Traefik | ❌ Не требуется | ✅ Обязателен |
| SSL | ❌ Нет | ✅ Let's Encrypt |
| Ports | Все внешние | Только 80, 443 |
| WEBHOOK_URL | http://localhost:5678 | https://lead-qual.example.com |
| N8N_API_KEY | Не обязателен | ✅ Обязателен |

---

### 2.3. Production Adaptation

**Для развёртывания у клиента:**

1. Заменить домены `lead-qual.example.com` на домены клиента
2. Настроить SSL сертификаты клиента
3. Настроить VPN или whitelist IP для n8n UI
4. Настроить backup PostgreSQL
5. Настроить monitoring (logs, metrics)

---

## 3. Architecture Overview

### Схема данных

```
┌─────────────────┐     ┌─────────────────┐
│   contacts      │     │ channel_identities │
├─────────────────┤     ├─────────────────────┤
│ id (PK)         │───┐ │ id (PK)             │
│ name            │   │ │ contact_id (FK)     │───┐
│ phone           │   │ │ channel             │   │
│ email           │   │ │ external_id         │   │
│ company         │   │ └─────────────────────┘   │
│ created_at      │   │                             │
│ updated_at      │   │ UNIQUE(channel, external_id)
└─────────────────┘   │
        │ 1:N         │
        ▼             │
┌─────────────────┐   │
│     leads       │   │
├─────────────────┤   │
│ id (PK)         │   │
│ contact_id (FK) │───┘
│ public_number   │
│ source          │
│ status          │
│ created_at      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────────────┐     ┌─────────────────┐
│    messages     │     │ qualifications  │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ lead_id (FK)    │     │ lead_id (FK)    │
│ channel         │     │ lead_type       │
│ direction       │     │ confidence      │
│ content         │     │ processed_at    │
│ created_at      │     └─────────────────┘
└─────────────────┘
                                  │
┌─────────────────┐              │
│    crm_sync     │              │
├─────────────────┤              │
│ id (PK)         │◄─────────────┘
│ lead_id (FK)    │
│ kommo_lead_id   │
│ crm_synced_at   │
└─────────────────┘
```

### n8n Workflows

| Workflow | Trigger | Назначение |
|----------|---------|------------|
| **Lead Ingestion V2** | Webhook POST | Приём лидов с Website |
| **Lead Ingestion Telegram** | Telegram Trigger | Приём лидов из Telegram |
| **Lead Classification MVP** | Schedule (5 min) | AI-классификация с fallback |
| **Kommo Writer MVP** | Schedule (1 min) | Создание сделок в Kommo |
| **CRM Status Sync MVP** | Schedule (15 min) | Синхронизация статусов из Kommo |

---

## 4. Prerequisites

### 4.1. Требования к серверу

| Параметр | Минимум | Рекомендуется |
|----------|---------|---------------|
| **CPU** | 2 cores | 4 cores |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 40 GB SSD | 80 GB SSD |
| **OS** | Ubuntu 20.04+ | Ubuntu 22.04 |

### 4.2. Требования к ПО

| ПО | Версия | Проверка |
|----|--------|----------|
| **Docker** | 24.0+ | `docker --version` |
| **Docker Compose** | 2.20+ | `docker compose version` |

### 4.3. Внешние зависимости

| Зависимость | Назначение | Как получить |
|-------------|------------|--------------|
| **OpenAI API** | AI-классификация | https://platform.openai.com/api-keys |
| **Telegram Bot Token** | Приём лидов | @BotFather → /newbot |
| **Kommo CRM** | Создание сделок | https://kommo.com → Settings → API |

---

## 5. Environment Variables

### 5.1. Создание .env файла

**Шаг**

Скопировать шаблон и заполнить переменные.

### Действие

```bash
cd /path/to/n8n-lead-qualification/infra
cp .env.example .env
```

### Ожидаемый результат

Создан файл `.env` в директории `infra/`.

### Проверка

```bash
ls -la .env
```

### Критерий успешного завершения

Файл `.env` существует и доступен для редактирования.

---

### 5.2. Обязательные переменные (4 штуки)

**Эти переменные должны быть установлены. Без них система не запустится.**

#### N8N_BASIC_AUTH_USER

| Параметр | Значение |
|----------|----------|
| **Переменная** | `N8N_BASIC_AUTH_USER` |
| **Обязательно** | ❌ Нет (есть значение по умолчанию) |
| **По умолчанию** | `admin` |
| **Назначение** | Имя пользователя для доступа к n8n UI |
| **Пример** | `admin` |

**Действие:**

Найти строку:
```bash
N8N_BASIC_AUTH_USER=admin
```

При необходимости изменить:
```bash
N8N_BASIC_AUTH_USER=<ваше_имя_пользователя>
```

**Примечание:** По умолчанию используется `admin`. Рекомендуется оставить без изменения для упрощения развёртывания.

---

#### POSTGRES_PASSWORD

| Параметр | Значение |
|----------|----------|
| **Переменная** | `POSTGRES_PASSWORD` |
| **Обязательно** | ✅ Да |
| **Назначение** | Пароль пользователя PostgreSQL |
| **Пример** | `your_secure_password_here` |
| **Как получить** | Придумать самостоятельно |

**Действие:**

```bash
# Отредактировать .env
nano .env
```

Найти строку:
```bash
POSTGRES_PASSWORD=your_secure_password_here
```

Заменить на:
```bash
POSTGRES_PASSWORD=<ваш_надёжный_пароль>
```

---

#### N8N_BASIC_AUTH_PASSWORD

| Параметр | Значение |
|----------|----------|
| **Переменная** | `N8N_BASIC_AUTH_PASSWORD` |
| **Обязательно** | ✅ Да |
| **Назначение** | Пароль для доступа к n8n UI |
| **Пример** | `admin_secure_password_here` |
| **Как получить** | Придумать самостоятельно |

**Действие:**

Найти строку:
```bash
N8N_BASIC_AUTH_PASSWORD=your_admin_password_here
```

Заменить на:
```bash
N8N_BASIC_AUTH_PASSWORD=<ваш_надёжный_пароль>
```

---

#### OPENAI_API_KEY

| Параметр | Значение |
|----------|----------|
| **Переменная** | `OPENAI_API_KEY` |
| **Обязательно** | ✅ Да |
| **Назначение** | API ключ для AI-классификации |
| **Пример** | `sk-proj-...` |
| **Как получить** | https://platform.openai.com/api-keys |

**Действие:**

1. Перейти на https://platform.openai.com/api-keys
2. Нажать "Create new secret key"
3. Скопировать ключ
4. Вставить в `.env`:

```bash
OPENAI_API_KEY=sk-proj-XXXXXXXXXXXXXXXXXXXXXXXX
```

---

#### TELEGRAM_BOT_TOKEN

| Параметр | Значение |
|----------|----------|
| **Переменная** | `TELEGRAM_BOT_TOKEN` |
| **Обязательно** | ✅ Да |
| **Назначение** | Токен Telegram бота для приёма лидов |
| **Пример** | `1234567890:ABCdefGHI...` |
| **Как получить** | @BotFather в Telegram |

**Действие:**

1. Открыть Telegram
2. Найти @BotFather
3. Отправить `/newbot`
4. Указать имя бота (например: `Lead Qual Bot`)
5. Указать username (например: `leadqual_bot`)
6. Скопировать полученный токен
7. Вставить в `.env`:

```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

---

### 5.3. Переменные Kommo CRM (25 штук)

**Эти переменные необходимы для интеграции с Kommo. Без них лиды не будут передаваться в CRM.**

#### KOMMO_ACCESS_TOKEN

| Параметр | Значение |
|----------|----------|
| **Переменная** | `KOMMO_ACCESS_TOKEN` |
| **Обязательно** | ✅ Да |
| **Назначение** | Access токен для Kommo API |
| **Пример** | `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` |
| **Как получить** | Kommo → Settings → API |

---

#### KOMMO_SUBDOMAIN

| Параметр | Значение |
|----------|----------|
| **Переменная** | `KOMMO_SUBDOMAIN` |
| **Обязательно** | ✅ Да |
| **Назначение** | Поддомен вашего аккаунта Kommo |
| **Пример** | `yourcompany` (для `yourcompany.kommo.com`) |
| **Как получить** | Из URL вашего аккаунта |

---

#### KOMMO_PIPELINE_ID

| Параметр | Значение |
|----------|----------|
| **Переменная** | `KOMMO_PIPELINE_ID` |
| **Обязательно** | ✅ Да |
| **Назначение** | ID воронки, в которую будут падать лиды |
| **Пример** | `12345` |
| **Как получить** | Kommo → Leads → открыть pipeline → ID в URL |

**Действие:**

1. Открыть Kommo
2. Перейти в Leads (Сделки)
3. Выбрать нужную воронку
4. Посмотреть URL: `https://yourcompany.kommo.com/leads/pipeline/12345`
5. Скопировать ID: `12345`

---

#### KOMMO_STATUS_* (статусы воронки)

**6 обязательных статусов:**

| Переменная | Назначение | Пример |
|------------|------------|--------|
| `KOMMO_STATUS_INCOMING` | ID статуса "Входящая заявка" | `5423456` |
| `KOMMO_STATUS_INITIAL_CONTACT` | ID статуса "Первичный контакт" | `5423457` |
| `KOMMO_STATUS_DISCUSSIONS` | ID статуса "Переговоры" | `5423458` |
| `KOMMO_STATUS_DECISION_MAKING` | ID статуса "Принимается решение" | `5423459` |
| `KOMMO_STATUS_WON` | ID статуса "Успешно" | `142` |
| `KOMMO_STATUS_LOST` | ID статуса "Закрыто" | `143` |

**Как получить ID статусов:**

1. Открыть Kommo
2. Перейти в Leads → Pipeline
3. Нажать на статус (карточка статуса)
4. Посмотреть URL: `...status/5423456`
5. Скопировать ID статуса

---

#### KOMMO_RESPONSIBLE_USER_ID

| Параметр | Значение |
|----------|----------|
| **Переменная** | `KOMMO_RESPONSIBLE_USER_ID` |
| **Обязательно** | ✅ Да |
| **Назначение** | ID пользователя, ответственного за лиды |
| **Пример** | `1234567` |
| **Как получить** | Kommo → Settings → Users → ID в URL или извлечь из JWT токена |

**Действие:**

1. Открыть Kommo
2. Перейти в Settings → Users
3. Кликнуть на пользователя
4. Посмотреть URL: `.../users/1234567`
5. Скопировать ID

---

#### KOMMO_*_FIELD_ID (кастомные поля)

**6 обязательных полей:**

| Переменная | Назначение | Как получить |
|------------|------------|--------------|
| `KOMMO_LEAD_TYPE_FIELD_ID` | ID поля "Lead Type" | Создать поле, получить ID |
| `KOMMO_PRIORITY_FIELD_ID` | ID поля "Priority" | Создать поле, получить ID |
| `KOMMO_CONFIDENCE_FIELD_ID` | ID поля "Confidence" | Создать поле, получить ID |
| `KOMMO_PUBLIC_NUMBER_FIELD_ID` | ID поля "Public Number" | Создать поле, получить ID |
| `KOMMO_CATEGORY_FIELD_ID` | ID поля "Category" (опционально) | Создать поле, получить ID |
| `KOMMO_ACTION_FIELD_ID` | ID поля "Suggested Action" (опционально) | Создать поле, получить ID |

**Как создать поля в Kommo:**

См. раздел [10. Kommo Custom Fields Setup](#10-kommo-custom-fields-setup).

---

### 5.4. Полный список переменных

**Файл .env с обязательными переменными:**

```bash
# PostgreSQL
POSTGRES_USER=n8n
POSTGRES_PASSWORD=<ВАШ_ПАРОЛЬ>
POSTGRES_PORT=15432

# n8n
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=<ВАШ_ПАРОЛЬ>
N8N_LOG_LEVEL=info

# n8n (для Demo/Production)
WEBHOOK_URL=https://ваш-домен.com
NODE_ENV=production

# OpenAI
OPENAI_API_KEY=<ВАШ_API_KEY>

# Telegram
TELEGRAM_BOT_TOKEN=<ВАШ_ТОКЕН>

# Kommo
KOMMO_ACCESS_TOKEN=<ВАШ_ТОКЕН>
KOMMO_SUBDOMAIN=<ВАШ_ПОДДОМЕН>
KOMMO_PIPELINE_ID=<ID_ВОРОНКИ>
KOMMO_STATUS_INCOMING=<ID_СТАТУСА>
KOMMO_STATUS_INITIAL_CONTACT=<ID_СТАТУСА>
KOMMO_STATUS_DISCUSSIONS=<ID_СТАТУСА>
KOMMO_STATUS_DECISION_MAKING=<ID_СТАТУСА>
KOMMO_STATUS_WON=142
KOMMO_STATUS_LOST=143
KOMMO_LEAD_TYPE_FIELD_ID=<ID_ПОЛЯ>
KOMMO_PRIORITY_FIELD_ID=<ID_ПОЛЯ>
KOMMO_CONFIDENCE_FIELD_ID=<ID_ПОЛЯ>
KOMMO_PUBLIC_NUMBER_FIELD_ID=<ID_ПОЛЯ>
KOMMO_RESPONSIBLE_USER_ID=<ID_ПОЛЬЗОВАТЕЛЯ>

# Timezone
TIMEZONE=Europe/Moscow
```

---

### 5.5. Переменные для Demo/Production

#### WEBHOOK_URL

| Параметр | Значение |
|----------|----------|
| **Переменная** | `WEBHOOK_URL` |
| **Обязательно** | ✅ Да для Demo/Production |
| **Назначение** | Базовый URL для webhook-ов n8n |
| **Пример** | `https://lead-qual.example.com` |
| **Как получить** | Ваш публичный домен |

**Действие:**

Для Demo/Production добавить в `.env`:
```bash
WEBHOOK_URL=https://ваш-домен.com
```

**Примечание:** 
- Для Local Deployment не требуется — используется значение по умолчанию `http://localhost:5678`.
- **Все домены в примерах (`lead-qual.example.com`, `lead-qual-admin.example.com`) являются примерами. При развёртывании используйте собственные домены.**

---

#### NODE_ENV

| Параметр | Значение |
|----------|----------|
| **Переменная** | `NODE_ENV` |
| **Обязательно** | ❌ Нет |
| **По умолчанию** | `production` |
| **Назначение** | Режим работы n8n (production/development) |
| **Пример** | `production` |

**Примечание:** Рекомендуется оставить значение по умолчанию `production`. Не требует изменения для стандартного развёртывания.

---

#### N8N_API_KEY

| Параметр | Значение |
|----------|----------|
| **Переменная** | `N8N_API_KEY` |
| **Обязательно** | ❌ Нет (рекомендуется для Production) |
| **По умолчанию** | `n8n-api-key-lead-qual-2024` |
| **Назначение** | API ключ для автоматизации n8n |
| **Пример** | `your-secure-api-key-here` |

**Действие:**

Для Production добавить в `.env`:
```bash
N8N_API_KEY=<ваш_надёжный_api_ключ>
```

**Примечание:** По умолчанию используется значение из docker-compose.yml. Для production рекомендуется задать уникальный ключ.

---

## 6. Database Initialization

### 6.1. Обзор SQL-файлов

**База данных инициализируется 6 SQL-файлами в строгом порядке:**

| Порядок | Файл | Назначение |
|---------|------|------------|
| 1 | `00-init-databases.sh` | Создание баз данных `n8n` и `lead_qualification` |
| 2 | `01-schema.sql` | Начальная схема: leads, messages, qualifications, crm_sync, logs |
| 3 | `02-target-model.sql` | Data Model v2: contacts, channel_identities, функции миграции |
| 4 | `03-runtime-objects.sql` | Runtime: sequence, public_number, функция generate_public_number() |
| 5 | `04-crm-snapshot.sql` | CRM sync extension: kommo_* поля, функции мониторинга |
| 6 | `05-telegram-sessions.sql` | Telegram sessions: таблица, функции диалогов |

**Важно:** Файлы применяются автоматически при первом запуске Docker Compose через `docker-entrypoint-initdb.d`.

---

### 6.2. Запуск PostgreSQL

**Шаг**

Запустить PostgreSQL и дождаться инициализации баз данных.

### Действие

```bash
cd /path/to/n8n-lead-qualification/infra
docker compose up -d postgres
```

### Ожидаемый результат

Контейнер `lead-qualification-postgres` запущен.

### Проверка

```bash
docker compose ps postgres
```

### Критерий успешного завершения

```
NAME                              STATUS
lead-qualification-postgres        running (healthy)
```

---

### 6.3. Проверка создания баз данных

**Шаг**

Убедиться, что базы данных созданы.

### Действие

```bash
docker compose exec postgres psql -U n8n -l
```

### Ожидаемый результат

Список баз данных включает `n8n` и `lead_qualification`.

### Проверка

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c "\dt"
```

### Критерий успешного завершения

Вывод содержит 8 таблиц:

```
                     List of relations
 Schema |            Name             | Type  | Owner
--------+-----------------------------+-------+-------
 public | channel_identities          | table | n8n
 public | contacts                    | table | n8n
 public | crm_sync                    | table | n8n
 public | leads                       | table | n8n
 public | logs                        | table | n8n
 public | messages                    | table | n8n
 public | qualifications              | table | n8n
 public | telegram_sessions           | table | n8n
```

---

## 7. Service Startup

### 7.1. Запуск всех сервисов

**Шаг**

Запустить все сервисы через Docker Compose.

### Действие

```bash
cd /path/to/n8n-lead-qualification/infra
docker compose up -d
```

### Ожидаемый результат

Все 5 контейнеров запущены.

### Проверка

```bash
docker compose ps
```

### Критерий успешного завершения

```
NAME                              STATUS
lead-qualification-postgres        running (healthy)
lead-qualification-n8n             running (healthy)
lead-qualification-admin-backend   running (healthy)
lead-qualification-admin-ui        running (healthy)
lead-qualification-client-ui       running (healthy)
```

---

### 7.2. Проверка PostgreSQL

**Шаг**

Проверить подключение к PostgreSQL.

### Действие

```bash
docker compose exec postgres pg_isready -U n8n -d n8n
docker compose exec postgres pg_isready -U n8n -d lead_qualification
```

### Ожидаемый результат

Обе команды возвращают `accepting connections`.

### Критерий успешного завершения

```
postgres:5432 - accepting connections
postgres:5432 - accepting connections
```

---

### 7.3. Проверка n8n

**Шаг**

Проверить доступность n8n UI.

### Действие

```bash
curl -s http://localhost:5678/health
```

### Ожидаемый результат

n8n отвечает на health check.

### Критерий успешного завершения

```json
{"status":"ok"}
```

---

### 7.4. Проверка Admin Backend

**Шаг**

Проверить доступность Admin Backend API.

### Действие

```bash
curl -s http://localhost:8000/api/admin/health
```

### Ожидаемый результат

Admin Backend отвечает на health check.

### Критерий успешного завершения

```json
{"status":"healthy"}
```

---

### 7.5. Проверка Admin UI

**Шаг**

Проверить доступность Admin UI.

### Действие

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/
```

### Ожидаемый результат

Admin UI доступен.

### Критерий успешного завершения

HTTP статус `200`.

---

### 7.6. Проверка Client UI

**Шаг**

Проверить доступность Client UI.

### Действие

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5180/
```

### Ожидаемый результат

Client UI доступен.

### Критерий успешного завершения

HTTP статус `200`.

---

## 8. Workflow Import

### 8.1. Обзор workflows

**5 workflows для импорта:**

| Файл | Workflow Name | Trigger | Назначение |
|------|---------------|---------|------------|
| `Lead Ingestion V2 - Complete.json` | Lead Ingestion V2 | Webhook POST | Приём лидов с Website |
| `Lead Ingestion - Telegram UX MVP.json` | Lead Ingestion Telegram | Telegram Trigger | Приём лидов из Telegram |
| `Lead Classification MVP.json` | Lead Classification MVP | Schedule (5 min) | AI-классификация |
| `Lead CRM Sync - Kommo Writer MVP.json` | Kommo Writer MVP | Schedule (1 min) | Создание сделок в Kommo |
| `CRM Status Sync MVP.json` | CRM Status Sync MVP | Schedule (15 min) | Синхронизация статусов |

---

### 8.2. Открыть n8n UI

**Шаг**

Открыть n8n UI в браузере.

### Действие

```
http://localhost:5678/
```

### Ожидаемый результат

Открылась страница авторизации n8n.

### Проверка

Ввести логин и пароль из `.env`:
- Username: `admin` (или `N8N_BASIC_AUTH_USER`)
- Password: `<ваш_пароль>`

### Критерий успешного завершения

Открылся главный экран n8n с пустым списком workflows.

---

### 8.3. Импорт Lead Ingestion V2

**Шаг**

Импортировать workflow Lead Ingestion V2.

### Действие

1. Нажать меню (☰) в левом верхнем углу
2. Выбрать "Import from File"
3. Выбрать файл: `workflow/n8n/workflows/Lead Ingestion V2 - Complete.json`
4. Нажать "Import"

### Ожидаемый результат

Workflow импортирован и открыт в редакторе.

### Проверка

Название workflow: "Lead Ingestion V2 - Complete"

### Критерий успешного завершения

Workflow отображается в списке workflows.

---

### 8.4. Импорт Lead Ingestion Telegram

**Шаг**

Импортировать workflow Lead Ingestion Telegram.

### Действие

1. Нажать меню (☰)
2. Выбрать "Import from File"
3. Выбрать файл: `workflow/n8n/workflows/Lead Ingestion - Telegram UX MVP.json`
4. Нажать "Import"

### Критерий успешного завершения

Workflow отображается в списке workflows.

---

### 8.5. Импорт Lead Classification MVP

**Шаг**

Импортировать workflow Lead Classification MVP.

### Действие

1. Нажать меню (☰)
2. Выбрать "Import from File"
3. Выбрать файл: `workflow/n8n/workflows/Lead Classification MVP.json`
4. Нажать "Import"

### Критерий успешного завершения

Workflow отображается в списке workflows.

---

### 8.6. Импорт Kommo Writer MVP

**Шаг**

Импортировать workflow Kommo Writer MVP.

### Действие

1. Нажать меню (☰)
2. Выбрать "Import from File"
3. Выбрать файл: `workflow/n8n/workflows/Lead CRM Sync - Kommo Writer MVP.json`
4. Нажать "Import"

### Критерий успешного завершения

Workflow отображается в списке workflows.

---

### 8.7. Импорт CRM Status Sync MVP

**Шаг**

Импортировать workflow CRM Status Sync MVP.

### Действие

1. Нажать меню (☰)
2. Выбрать "Import from File"
3. Выбрать файл: `workflow/n8n/workflows/CRM Status Sync MVP.json`
4. Нажать "Import"

### Критерий успешного завершения

5 workflows отображаются в списке.

---

## 9. Credentials Setup

### 9.1. Обзор credentials

**4 credentials для создания:**

| Credential | Type | Назначение |
|------------|------|------------|
| **PostgreSQL** | PostgreSQL | Подключение к БД lead_qualification |
| **OpenAI** | OpenAI API | AI-классификация |
| **Telegram** | Telegram API | Приём лидов из Telegram |
| **Kommo** | HTTP Header Auth | Интеграция с Kommo CRM |

---

### 9.2. Создание PostgreSQL Credential

**Шаг**

Создать credential для подключения к PostgreSQL.

### Действие

1. В n8n UI нажать "Credentials" в левом меню
2. Нажать "Add Credential"
3. Выбрать "PostgreSQL"
4. Заполнить поля:
   - **Name:** `Lead Qualification DB`
   - **Host:** `postgres`
   - **Port:** `5432`
   - **Database:** `lead_qualification`
   - **User:** `n8n`
   - **Password:** `<POSTGRES_PASSWORD из .env>`
5. Нажать "Save"

### Ожидаемый результат

Credential создан и доступен в списке.

### Проверка

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c "SELECT 1"
```

### Критерий успешного завершения

Credential отображается в списке с зелёной галочкой.

---

### 9.3. Создание OpenAI Credential

**Шаг**

Создать credential для OpenAI API.

### Действие

1. Нажать "Add Credential"
2. Выбрать "OpenAI API"
3. Заполнить поля:
   - **Name:** `OpenAI API`
   - **API Key:** `<OPENAI_API_KEY из .env>`
4. Нажать "Save"

### Критерий успешного завершения

Credential отображается в списке.

---

### 9.4. Создание Telegram Credential

**Шаг**

Создать credential для Telegram Bot API.

### Действие

1. Нажать "Add Credential"
2. Выбрать "Telegram API"
3. Заполнить поля:
   - **Name:** `Telegram Bot`
   - **Access Token:** `<TELEGRAM_BOT_TOKEN из .env>`
4. Нажать "Save"

### Критерий успешного завершения

Credential отображается в списке.

---

### 9.5. Создание Kommo Credential

**Шаг**

Создать credential для Kommo CRM.

### Действие

1. Нажать "Add Credential"
2. Выбрать "Header Auth"
3. Заполнить поля:
   - **Name:** `Kommo Auth`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer <KOMMO_ACCESS_TOKEN из .env>`
4. Нажать "Save"

### Критерий успешного завершения

Credential отображается в списке.

---

### 9.6. Привязка credentials к workflows

**Шаг**

Привязать credentials к каждому workflow.

### Действие

Для каждого workflow:

1. Открыть workflow
2. Найти nodes, требующие credentials (PostgreSQL, OpenAI, Telegram, HTTP Request)
3. Кликнуть на node
4. В поле "Credential" выбрать соответствующий credential
5. Сохранить workflow (Ctrl+S)

**Lead Ingestion V2:**
- PostgreSQL nodes → `Lead Qualification DB`

**Lead Ingestion Telegram:**
- Telegram Trigger → `Telegram Bot`
- PostgreSQL nodes → `Lead Qualification DB`

**Lead Classification MVP:**
- OpenAI node → `OpenAI API`
- PostgreSQL nodes → `Lead Qualification DB`

**Kommo Writer MVP:**
- PostgreSQL nodes → `Lead Qualification DB`
- HTTP Request (Kommo) → `Kommo Auth`

**CRM Status Sync MVP:**
- PostgreSQL nodes → `Lead Qualification DB`
- HTTP Request (Kommo) → `Kommo Auth`

### Критерий успешного завершения

Все nodes во всех workflows имеют привязанные credentials.

---

### 9.7. Активация workflows

**Шаг**

Активировать все workflows.

### Действие

Для каждого workflow:

1. Открыть workflow
2. В правом верхнем углу переключить "Active" в положение ON
3. Сохранить workflow (Ctrl+S)

### Проверка

```bash
# Замените ${N8N_API_KEY} на ваше значение из .env
curl -s -H "X-N8N-API-KEY: ${N8N_API_KEY}" http://localhost:5678/api/v1/workflows | jq '.[].active'
```

**Примечание:** По умолчанию `N8N_API_KEY=n8n-api-key-lead-qual-2024` задан в docker-compose.yml. Для production рекомендуется изменить.

### Критерий успешного завершения

Все workflows имеют статус `true` (active).

---

## 10. Kommo Custom Fields Setup

### 10.1. Создание полей в Kommo

**Шаг**

Создать 4 обязательных кастомных поля в Kommo.

### Действие

**В Kommo UI:**

1. Открыть Kommo
2. Перейти в Leads (Сделки)
3. Открыть любую сделку
4. Найти вкладку "Setup" (Настройка) слева
5. Выбрать раздел "Lead"

**Поле 1: Lead Type**

1. Нажать "+ Add field"
2. Name: `Lead Type`
3. Type: `Select`
4. Добавить варианты:
   - `hot` (sort: 1)
   - `warm` (sort: 2)
   - `cold` (sort: 3)
   - `spam` (sort: 4)
5. Save
6. **Записать ID поля**

**Поле 2: Priority**

1. Нажать "+ Add field"
2. Name: `Priority`
3. Type: `Select`
4. Добавить варианты:
   - `high` (sort: 1)
   - `medium` (sort: 2)
   - `low` (sort: 3)
5. Save
6. **Записать ID поля**

**Поле 3: Confidence**

1. Нажать "+ Add field"
2. Name: `Confidence`
3. Type: `Numeric`
4. Save
5. **Записать ID поля**

**Поле 4: Public Number**

1. Нажать "+ Add field"
2. Name: `Public Number`
3. Type: `Text`
4. Save
5. **Записать ID поля**

### Критерий успешного завершения

В Kommo созданы 4 кастомных поля, их ID записаны.

---

### 10.2. Получение ID полей через API

**Альтернативный способ получения ID:**

```bash
curl -s -X GET \
  "https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4/leads/custom_fields" \
  -H "Authorization: Bearer ${KOMMO_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
```

### Критерий успешного завершения

JSON содержит все созданные поля с их ID.

---

### 10.3. Обновление .env с ID полей

**Шаг**

Добавить ID полей в .env.

### Действие

```bash
# Отредактировать .env
nano .env
```

Добавить:

```bash
KOMMO_LEAD_TYPE_FIELD_ID=<ID_ПОЛЯ_LEAD_TYPE>
KOMMO_PRIORITY_FIELD_ID=<ID_ПОЛЯ_PRIORITY>
KOMMO_CONFIDENCE_FIELD_ID=<ID_ПОЛЯ_CONFIDENCE>
KOMMO_PUBLIC_NUMBER_FIELD_ID=<ID_ПОЛЯ_PUBLIC_NUMBER>
```

### Критерий успешного завершения

Переменные добавлены в .env.

---

## 11. Smoke Test

### 11.1. Тест Website Lead Ingestion

**Шаг**

Отправить тестовый лид через webhook.

### Действие

```bash
curl -X POST http://localhost:5678/webhook/lead \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Тестовый Лид",
    "phone": "+79991234567",
    "email": "test@example.com",
    "message": "Тестовое сообщение для проверки E2E pipeline, готов купить прямо сейчас",
    "source": "smoke_test"
  }'
```

### Ожидаемый результат

```json
{
  "success": true,
  "lead_id": "uuid",
  "public_number": "LQ-XXXXXX",
  "message": "Lead received successfully"
}
```

### Проверка

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c \
  "SELECT id, public_number, source, status FROM leads ORDER BY created_at DESC LIMIT 1"
```

### Критерий успешного завершения

В таблице `leads` появилась новая запись со статусом `received`.

---

### 11.2. Тест AI Classification

**Шаг**

Дождаться классификации лида (до 5 минут).

### Действие

```bash
# Подождать 5 минут или проверить сразу
docker compose exec postgres psql -U n8n -d lead_qualification -c \
  "SELECT lead_type, confidence, suggested_action FROM qualifications ORDER BY processed_at DESC LIMIT 1"
```

### Ожидаемый результат

```
 lead_type | confidence | suggested_action
-----------+------------+-----------------
 hot       |       0.92 | call
```

### Критерий успешного завершения

В таблице `qualifications` появилась запись с `lead_type` и `confidence > 0`.

---

### 11.3. Тест CRM Sync

**Шаг**

Проверить синхронизацию с Kommo.

### Действие

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c \
  "SELECT lead_id, sync_status, kommo_lead_id FROM crm_sync ORDER BY synced_at DESC LIMIT 1"
```

### Ожидаемый результат

```
 sync_status | kommo_lead_id
-------------+---------------
 success     | 12345678
```

### Критерий успешного завершения

В таблице `crm_sync` появилась запись со статусом `success` и `kommo_lead_id`.

---

### 11.4. Тест Admin Console

**Шаг**

Проверить отображение лида в Admin Console.

### Действие

1. Открыть http://localhost:8080/
2. Перейти в раздел "Leads"

### Ожидаемый результат

Лид отображается в списке с полями:
- Public Number
- Contact Name
- Lead Type
- Confidence
- CRM Status

### Критерий успешного завершения

Лид виден в Admin Console, клик по нему открывает детали.

---

### 11.5. Тест Telegram Bot

**Шаг**

Проверить приём лидов через Telegram.

### Действие

1. Открыть Telegram
2. Найти бота по username
3. Отправить `/start`
4. Отправить текст: "Хочу узнать о ваших услугах, перезвоните"

### Ожидаемый результат

Бот отвечает приветствием на `/start` и подтверждением на сообщение.

### Проверка

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c \
  "SELECT id, source FROM leads WHERE source='telegram' ORDER BY created_at DESC LIMIT 1"
```

### Критерий успешного завершения

В таблице `leads` появился лид с `source='telegram'`.

---

### 11.6. Полный E2E Check

**Шаг**

Выполнить полный цикл проверки.

### Действие

```bash
# 1. Проверить все сервисы
docker compose ps

# 2. Проверить БД
docker compose exec postgres psql -U n8n -d lead_qualification -c "\dt"

# 3. Проверить n8n workflows
# Замените ${N8N_API_KEY} на ваше значение из .env
curl -s -H "X-N8N-API-KEY: ${N8N_API_KEY}" http://localhost:5678/api/v1/workflows | jq '.[].name'

# 4. Проверить Admin API
curl -s http://localhost:8000/api/admin/dashboard | jq '.'
```

### Критерий успешного завершения

- Все 5 сервисов running (healthy)
- БД содержит 8 таблиц
- 5 workflows активны
- Dashboard API возвращает метрики

---

## 12. Troubleshooting

### 12.1. PostgreSQL не запускается

**Симптом:** Контейнер postgres не стартует.

**Проверка:**

```bash
docker compose logs postgres --tail 50
```

**Возможные причины:**

| Причина | Решение |
|---------|---------|
| Порт 15432 занят | Освободить порт или изменить `POSTGRES_PORT` |
| Volume повреждён | `docker compose down -v && docker compose up -d` |
| POSTGRES_PASSWORD не установлен | Проверить `.env` |

---

### 12.2. n8n не подключается к PostgreSQL

**Симптом:** n8n падает с ошибкой подключения к БД.

**Проверка:**

```bash
docker compose logs n8n --tail 50 | grep -i "database\|postgres\|connection"
```

**Возможные причины:**

| Причина | Решение |
|---------|---------|
| PostgreSQL не готов | Дождаться health check |
| Неверный пароль | Проверить `POSTGRES_PASSWORD` в `.env` |
| Network issue | `docker compose down && docker compose up -d` |

---

### 12.3. OpenAI API ошибки

**Симптом:** Classification падает с ошибкой OpenAI.

**Проверка:**

```bash
docker compose logs n8n --tail 50 | grep -i "openai"
```

**Возможные причины:**

| Причина | Решение |
|---------|---------|
| Неверный API ключ | Проверить `OPENAI_API_KEY` |
| Rate limit | Подождать или увеличить лимиты |
| Нет кредитов | Пополнить баланс OpenAI |

---

### 12.4. Telegram Bot не отвечает

**Симптом:** Бот не отвечает на сообщения.

**Проверка:**

```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
```

**Возможные причины:**

| Причина | Решение |
|---------|---------|
| Неверный токен | Проверить `TELEGRAM_BOT_TOKEN` |
| Workflow не активен | Активировать workflow в n8n |
| Credential не привязан | Привязать Telegram credential |

---

### 12.5. Kommo интеграция не работает

**Симптом:** Лиды не передаются в Kommo.

**Проверка:**

```bash
curl -s "https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4/account" \
  -H "Authorization: Bearer ${KOMMO_ACCESS_TOKEN}"
```

**Возможные причины:**

| Причина | Решение |
|---------|---------|
| Неверный токен | Проверить `KOMMO_ACCESS_TOKEN` |
| Неверный subdomain | Проверить `KOMMO_SUBDOMAIN` |
| Missing field IDs | Проверить `KOMMO_*_FIELD_ID` |
| Missing pipeline/status IDs | Проверить `KOMMO_PIPELINE_ID`, `KOMMO_STATUS_*` |

---

### 12.6. Admin UI не открывается

**Симптом:** Admin UI возвращает ошибку.

**Проверка:**

```bash
docker compose logs admin-backend --tail 50
docker compose logs admin-ui --tail 50
```

**Возможные причины:**

| Причина | Решение |
|---------|---------|
| Backend не запущен | `docker compose up -d admin-backend` |
| Database URL неверный | Проверить переменные окружения |
| CORS ошибка | Проверить `CORS_ORIGINS` |

---

## 13. Production Notes

### 13.1. Отличия Demo от Production

**Важно:** Все домены в примерах (`lead-qual.example.com`, `lead-qual-admin.example.com`) являются примерами. При развёртывании используйте собственные домены.

| Аспект | Demo | Production |
|--------|------|------------|
| **Traefik** | Не требуется | Обязателен |
| **SSL** | Нет | Let's Encrypt |
| **Ports** | Все внешние | Только 80, 443 |
| **WEBHOOK_URL** | http://localhost:5678 | https://domain.com |
| **N8N_API_KEY** | Не обязателен | Обязателен |
| **Backup** | Не требуется | Обязателен |

---

### 13.2. Настройка Traefik для Production

**Шаг**

Создать Docker network для Traefik.

### Действие

```bash
docker network create n8n_default
```

### Ожидаемый результат

Network `n8n_default` создана.

---

### 13.3. Настройка SSL

**Требования:**

- Traefik настроен с Let's Encrypt
- Домены настроены в dynamic.yml

**Конфигурация Traefik:**

См. внешнюю документацию Traefik.

---

### 13.4. Backup PostgreSQL

**Рекомендуемая стратегия:**

```bash
# Ежедневный backup
docker compose exec postgres pg_dump -U n8n lead_qualification > backup_$(date +%Y%m%d).sql

# Восстановление
cat backup_20260616.sql | docker compose exec -T postgres psql -U n8n lead_qualification
```

---

### 13.5. Monitoring

**Рекомендуемые метрики:**

| Метрика | Проверка |
|---------|----------|
| Container status | `docker compose ps` |
| PostgreSQL connections | `pg_stat_activity` |
| n8n workflow executions | Admin Console |
| Lead processing time | `qualifications.processing_ms` |
| CRM sync rate | `crm_sync.sync_status` |

---

## 14. Appendix

### 14.1. Полный список ENV переменных

См. `.env.example` в репозитории.

### 14.2. Схема БД

См. `infra/sql/*.sql` файлы.

### 14.3. Workflows

См. `workflow/n8n/workflows/README.md`.

### 14.4. API Endpoints

| Endpoint | Method | Назначение |
|----------|--------|------------|
| `/webhook/lead` | POST | Приём лидов с Website |
| `/api/admin/health` | GET | Health check Admin Backend |
| `/api/admin/dashboard` | GET | Метрики dashboard |
| `/api/admin/leads` | GET | Список лидов |
| `/api/admin/leads/:id` | GET | Детали лида |

---

## Заключение

После прохождения всех шагов у вас должна работать система:

- ✅ PostgreSQL с 8 таблицами
- ✅ n8n с 5 активными workflows
- ✅ 4 credentials созданы
- ✅ Kommo custom fields созданы
- ✅ Website lead ingestion работает
- ✅ Telegram bot отвечает
- ✅ AI classification работает
- ✅ CRM sync работает
- ✅ Admin Console отображает лиды

---

**Документ подготовлен:** 2026-06-18
**Версия:** 2.0
**На основе:** Deployment Inventory, Gap Analysis, исходный код проекта