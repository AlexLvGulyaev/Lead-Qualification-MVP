# Архитектура Lead Qualification MVP

Документ описывает **реализованную архитектуру** Lead Qualification MVP, а также отделяет:

- **as-is (реализовано в коде)**;
- **target (описано в планах, но может быть не реализовано)**;
- **roadmap/future work**.

Нормативные источники: [SPEC.md](SPEC.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [PROJECT_STATE.md](PROJECT_STATE.md).

---

## Визуальная архитектура

### Общая схема

```
Website / Telegram → Lead Ingestion → AI Classification → PostgreSQL → Kommo CRM → Admin Console
```

### Ключевые n8n Workflows

**Lead Ingestion V2** — приём лидов с Website

![n8n: Lead Ingestion](screenshots/workflow-lead-ingestion-v2.png)

**Lead Classification MVP** — AI-классификация с fallback

![n8n: Classification](screenshots/workflow-lead-classification-mvp.png)

**Kommo Writer MVP** — создание сделок и задач в CRM

![n8n: Kommo Writer](screenshots/workflow-kommo-writer-mvp.png)

**CRM Status Sync MVP** — синхронизация статусов

![n8n: Status Sync](screenshots/workflow-crm-status-sync-mvp.png)

---

## 1. Общая схема системы (as-is)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ВНЕШНИЕ СИСТЕМЫ                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│   │   KOMMO     │    │  TELEGRAM   │    │   OPENAI    │    │   CLIENT    │  │
│   │   CRM API   │    │   BOT API   │    │    API      │    │  BROWSER    │  │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│          │                  │                   │                   │        │
└──────────┼──────────────────┼───────────────────┼───────────────────┼────────┘
           │                  │                   │                   │
           └──────────────────┼───────────────────┼───────────────────┘
                              │                   │
                              ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TRAEFIK (Reverse Proxy)                          │
│                    /opt/n8n/dynamic.yml (внешний конфиг)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┬──────────────────┐
           │                  │                  │                  │
           ▼                  ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   CLIENT UI     │ │   ADMIN UI      │ │   ADMIN API     │ │      n8n        │
│   (static)      │ │   (static)     │ │   (FastAPI)     │ │   (workflows)   │
│   Nginx         │ │   Nginx         │ │   Port 8000     │ │   Port 5678     │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
                                                  │                   │
                                                  └─────────┬─────────┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              POSTGRESQL                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│   ┌─────────────────────────────────┐   ┌─────────────────────────────────┐  │
│   │     Database: n8n               │   │  Database: lead_qualification   │  │
│   │     (n8n internal tables)       │   │  (business data)                │  │
│   │     ~107 tables                 │   │  contacts, leads, messages,    │  │
│   │                                 │   │  qualifications, crm_sync, logs │  │
│   └─────────────────────────────────┘   └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Запуск:** [`infra/docker-compose.yml`](../infra/docker-compose.yml) поднимает `postgres`, `n8n`, `admin-backend`, `admin-ui`, `client-ui`.

---

## 2. Контуры и компоненты

### 2.1 Клиентский контур (Public)

**Назначение:** Приём заявок от клиентов через два канала.

**Реализованные каналы:**

| Канал | Технология | Endpoint | Статус |
|-------|------------|----------|--------|
| **Website** | HTTP POST | `/webhook/lead` | ✅ Active |
| **Telegram** | Telegram Bot API | Webhook/Polling | ✅ Active |

**Ключевой инвариант:** Клиент не видит внутренние сущности (qualifications, confidence, crm_sync). Клиент видит только подтверждение приёма заявки.

**Реализованные маршруты (Frontend):**

**Demo Landing** (https://lead-qual-demo.alex-n8n.site):
- `/` — Demo Landing Hub — точка входа в демонстрационный контур
- Попадание на Web-сайт, Telegram Bot, Admin Console через popover

**Client UI** (https://lead-qual.alex-n8n.site):
- `/` — Landing page с формой заявки
- `/success` — Подтверждение отправки

**Admin UI** (https://lead-qual-admin.alex-n8n.site):
- `/` — Dashboard с метриками
- `/leads` — Lead Queue
- `/lead/:id` — Lead Details

---

### 2.2 Контур оркестрации (n8n)

**Назначение:** Оркестрация всех workflows обработки лидов.

**Реализованные workflows:**

| Workflow | Trigger | Назначение | Статус |
|----------|---------|------------|--------|
| **Lead Ingestion V2** | Webhook POST | Приём лидов с Website | ✅ Active |
| **Lead Ingestion Telegram** | Telegram Trigger | Приём лидов из Telegram | ✅ Active |
| **Lead Classification MVP** | Schedule (5 min) | AI-классификация с fallback | ✅ Active |
| **Lead CRM Sync - Kommo Writer** | Webhook | Создание сделок и задач в Kommo | ✅ Active |
| **CRM Status Sync MVP** | Schedule (15 min) | Синхронизация snapshot из Kommo | ✅ Active |

---

### 2.3 Контур хранения (PostgreSQL)

**Назначение:** Персистентное хранение бизнес-данных.

**Архитектура баз данных:**

```
PostgreSQL Container
├── Database: n8n                    # n8n internal tables (~107 tables)
│   ├── workflow_entity
│   ├── execution_entity
│   ├── credentials_entity
│   └── ... (n8n platform tables)
│
└── Database: lead_qualification      # Business data (Target Model v2)
    ├── contacts                      # Контакты (люди/организации)
    ├── channel_identities            # Идентификаторы в каналах
    ├── leads                         # Обращения
    ├── messages                      # Сообщения
    ├── qualifications                # Результаты AI-классификации
    ├── crm_sync                      # CRM мониторинговый snapshot
    └── logs                          # События системы
```

**Data Model v2 Features:**
- Contact-centric architecture — один контакт → много обращений
- Channel identities для дедупликации
- Public numbers для человекочитаемых идентификаторов (LQ-NNNNNN)

---

### 2.4 Контур администрирования (Admin Console)

**Назначение:** Мониторинг системы и просмотр квалификации лидов.

**Реализованные области:**

| Область | URL | Функции |
|---------|-----|---------|
| **Dashboard** | `/` | Метрики, распределение по типам, CRM status |
| **Lead Queue** | `/leads` | Список лидов с фильтрами |
| **Lead Details** | `/leads/:id` | Полная информация о лиде |

**Backend API Endpoints:**

| Endpoint | Method | Назначение |
|----------|--------|------------|
| `/api/admin/dashboard` | GET | Метрики для dashboard |
| `/api/admin/leads` | GET | Список лидов с фильтрами |
| `/api/admin/leads/:id` | GET | Детали лида |

---

## 3. n8n Workflows (as-is)

### 3.1 Workflow: Lead Ingestion V2 (Website)

**Триггер:** HTTP POST `/webhook/lead`

**Поток данных:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Webhook       │────▶│   Validate      │────▶│   Find/Create   │
│   Trigger       │     │   Input         │     │   Contact       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Response      │◀────│   Create        │◀────│   Create        │
│   (LQ-NNNNNN)   │     │   Log           │     │   Lead          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Входные данные:**

```json
{
  "name": "Иван Петров",
  "phone": "+79991234567",
  "email": "ivan@example.com",
  "message": "Хочу узнать подробнее о ваших услугах",
  "source": "website_contact_form"
}
```

**Выходные данные:**

```json
{
  "success": true,
  "lead_id": "uuid",
  "public_number": "LQ-000001",
  "message": "Lead received successfully"
}
```

**Валидация:**
- `message` — обязательно, min 10 символов
- `phone` или `email` — хотя бы одно поле

---

### 3.2 Workflow: Lead Ingestion Telegram

**Триггер:** Telegram Bot API (входящее сообщение)

**Поток данных:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Telegram      │────▶│   Parse         │────▶│   Is Command?   │
│   Trigger       │     │   Message       │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                            ┌───────────────────────────┴───────────┐
                            │                                       │
                            ▼                                       ▼
                    ┌─────────────────┐                     ┌─────────────────┐
                    │   Send Welcome  │                     │   Process      │
                    │   Message       │                     │   Lead         │
                    └─────────────────┘                     └─────────────────┘
```

**Обработка команд:**

| Команда | Действие |
|---------|----------|
| `/start` | Отправка приветственного сообщения |
| `/help` | Отправка справки |
| Текст > 10 символов | Создание лида |

**Telegram UX:**
- Inline-кнопки для quick actions
- Confirmation с номером заявки (LQ-NNNNNN)
- Menu для навигации

---

### 3.3 Workflow: Lead Classification MVP

**Триггер:** Schedule (every 5 minutes)

**Поток данных:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Query Leads   │────▶│   For Each      │────▶│   Build         │
│   (status=      │     │   Unqualified   │     │   Prompt        │
│    received)    │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Update Lead   │◀────│   Save          │◀────│   Call          │
│   Status        │     │   Qualification │     │   OpenAI API    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   Fallback      │
                                                │   (rule-based)  │
                                                └─────────────────┘
```

**AI Request (OpenAI):**

```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "Ты — AI-классификатор входящих лидов..."
    },
    {
      "role": "user",
      "content": "Обращение клиента: {{lead_message}}"
    }
  ],
  "temperature": 0.3,
  "response_format": { "type": "json_object" }
}
```

**AI Response Schema:**

```json
{
  "lead_type": "hot|warm|cold|spam",
  "interest": "high|medium|low",
  "priority": "high|medium|low",
  "category": "string",
  "summary": "string",
  "confidence": 0.85,
  "suggested_action": "call|email|archive|reject",
  "reasoning": "string"
}
```

**Fallback Logic:**

При недоступности OpenAI или низкой уверенности (< 0.5) применяется rule-based классификация по ключевым словам:

```javascript
const RULES = {
  spam: ['купить базу', 'предложение сотрудничества', 'рекламное'],
  hot: ['срочно', 'хочу купить', 'готов оплатить', 'завтра'],
  warm: ['хочу узнать', 'интересует', 'подробнее'],
  cold: ['может быть', 'подумаю', 'позже']
};
```

---

### 3.4 Workflow: Lead CRM Sync - Kommo Writer

**Триггер:** Webhook от Classification workflow

**Поток данных:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Receive       │────▶│   Prepare       │────▶│   Create        │
│   Lead Data     │     │   Kommo Payload │     │   Kommo Lead    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Save to       │◀────│   Create        │◀────│   Create        │
│   crm_sync      │     │   Task          │     │   Contact       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Kommo Lead Creation:**

```json
{
  "name": "{{lead_name}}",
  "pipeline_id": "{{pipeline_by_lead_type}}",
  "status_id": "{{status_by_lead_type}}",
  "custom_fields_values": [
    { "field_id": "lead_type_field", "values": [{ "value": "{{lead_type}}" }] },
    { "field_id": "priority_field", "values": [{ "value": "{{priority}}" }] },
    { "field_id": "confidence_field", "values": [{ "value": "{{confidence}}" }] }
  ],
  "_embedded": {
    "contacts": [...],
    "notes": [{ "note_type": "common", "params": { "text": "{{summary}}" } }]
  }
}
```

**Initial Task Creation Rules:**

| Lead Type | Task | Deadline |
|-----------|------|----------|
| **Hot** | Звонок клиенту | +15 минут |
| **Warm** | Звонок клиенту | +24 часа |
| **Cold** | Звонок клиенту | +7 дней |
| **Spam** | Не создаётся | — |

---

### 3.5 Workflow: CRM Status Sync MVP

**Триггер:** Schedule (every 15 minutes)

**Поток данных:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Query Active   │────▶│   For Each:     │────▶│   Get Kommo     │
│   CRM Syncs      │     │   Kommo Lead    │     │   Lead Data     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Log Sync      │◀────│   Update        │◀────│   Extract:      │
│   Result        │     │   crm_sync      │     │   pipeline,     │
└─────────────────┘     └─────────────────┘     │   status,       │
                                                │   tasks         │
                                                └─────────────────┘
```

**Синхронизируемые поля:**

| Поле в crm_sync | Источник | Описание |
|-----------------|----------|----------|
| `kommo_pipeline_id` | Kommo API | ID воронки |
| `kommo_pipeline_name` | Kommo API | Название воронки (cached) |
| `kommo_status_id` | Kommo API | ID статуса |
| `kommo_status_name` | Kommo API | Название статуса (cached) |
| `kommo_responsible_user_id` | Kommo API | ID ответственного |
| `crm_has_active_task` | Kommo API | Есть активные задачи |
| `crm_closest_task_at` | Kommo API | Ближайшая задача |
| `crm_closed_at` | Kommo API | Дата закрытия |

---

## 4. Data Model (as-is)

### 4.1 ER-диаграмма

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              POSTGRESQL SCHEMA v2                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐       ┌─────────────────────┐
│    contacts     │       │ channel_identities  │
├─────────────────┤       ├─────────────────────┤
│ id (PK)         │───┐   │ id (PK)             │
│ name            │   │   │ contact_id (FK)     │───┐
│ phone           │   │   │ channel             │   │
│ email           │   │   │ external_id         │   │
│ company         │   │   │ channel_data (JSONB)│   │
│ notes           │   │   └─────────────────────┘   │
│ created_at      │   │                             │
│ updated_at      │   │   UNIQUE(channel, external_id)
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
│ utm_source      │
│ utm_campaign    │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────────────┐       ┌─────────────────┐
│    messages     │       │ qualifications  │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ lead_id (FK)    │       │ lead_id (FK)    │
│ channel         │       │ lead_type       │
│ direction       │       │ interest        │
│ content         │       │ priority        │
│ created_at      │       │ confidence      │
└─────────────────┘       │ ...             │
                          └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│    crm_sync     │       │      logs       │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ lead_id (FK)    │       │ lead_id (FK)    │
│ kommo_lead_id   │       │ event_type      │
│ kommo_pipeline  │       │ event_data      │
│ kommo_status    │       │ status          │
│ crm_synced_at   │       │ created_at      │
└─────────────────┘       └─────────────────┘
```

### 4.2 Таблицы

#### contacts

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | Идентификатор контакта |
| `name` | VARCHAR(255) | Имя контакта |
| `phone` | VARCHAR(50) | Телефон (indexed) |
| `email` | VARCHAR(255) | Email (indexed) |
| `company` | VARCHAR(255) | Компания |
| `notes` | TEXT | Заметки |
| `created_at` | TIMESTAMP | Время создания |
| `updated_at` | TIMESTAMP | Время обновления |

#### leads

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | Идентификатор лида |
| `contact_id` | UUID | Ссылка на contacts |
| `public_number` | VARCHAR(20) | Человекочитаемый номер (LQ-NNNNNN) |
| `source` | VARCHAR(50) | Источник: web, telegram |
| `status` | VARCHAR(50) | Статус: received, qualified, processed |
| `created_at` | TIMESTAMP | Время создания |

#### qualifications

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | Идентификатор |
| `lead_id` | UUID | Ссылка на leads |
| `lead_type` | VARCHAR(20) | Тип: hot, warm, cold, spam |
| `interest` | VARCHAR(20) | Интерес: high, medium, low |
| `priority` | VARCHAR(20) | Приоритет: high, medium, low |
| `confidence` | DECIMAL(3,2) | Уверенность: 0.00-1.00 |
| `suggested_action` | VARCHAR(50) | Действие: call, email, archive, reject |
| `summary` | TEXT | Краткое описание |
| `reasoning` | TEXT | Обоснование |
| `ai_model` | VARCHAR(50) | Модель AI |
| `processed_at` | TIMESTAMP | Время обработки |

#### crm_sync (Monitoring Snapshot)

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | Идентификатор |
| `lead_id` | UUID | Ссылка на leads |
| `kommo_lead_id` | BIGINT | ID сделки в Kommo |
| `kommo_pipeline_id` | BIGINT | ID воронки |
| `kommo_pipeline_name` | VARCHAR(255) | Название воронки (cached) |
| `kommo_status_id` | BIGINT | ID статуса |
| `kommo_status_name` | VARCHAR(255) | Название статуса (cached) |
| `kommo_responsible_user_id` | BIGINT | ID ответственного |
| `crm_has_active_task` | BOOLEAN | Есть активные задачи |
| `crm_closest_task_at` | TIMESTAMP | Ближайшая задача |
| `crm_closed_at` | TIMESTAMP | Дата закрытия |
| `crm_synced_at` | TIMESTAMP | Последняя синхронизация |

**Важно:** Kommo остаётся Source of Truth для сделок и задач. LQ хранит только snapshot для мониторинга.

---

## 5. Интеграции (as-is)

### 5.1 OpenAI API

**Endpoint:** `https://api.openai.com/v1/chat/completions`

**Модель:** `gpt-4o-mini`

**Параметры:**

| Параметр | Значение | Обоснование |
|----------|----------|-------------|
| `temperature` | 0.3 | Консистентность классификации |
| `max_tokens` | 500 | Достаточно для JSON response |
| `response_format` | `{ "type": "json_object" }` | Гарантия JSON на выходе |

**Rate Limits:**
- 500 RPM (requests per minute)
- 30 000 TPM (tokens per minute)

**Обработка ошибок:**
- Timeout (> 10s) → Fallback
- Rate limit → Fallback
- Invalid JSON → Fallback

---

### 5.2 Telegram Bot API

**Endpoint:** `https://api.telegram.org/bot{{token}}`

**Используемые методы:**

| Метод | Назначение |
|-------|------------|
| `sendMessage` | Отправка сообщения |
| `editMessageText` | Редактирование сообщения |
| `editMessageReplyMarkup` | Обновление inline-кнопок |
| `answerCallbackQuery` | Ответ на callback query |

**Webhook vs Polling:**
- Polling используется в MVP
- Webhook возможен в production

---

### 5.3 Kommo CRM API

**Endpoint:** `https://{{subdomain}}.kommo.com/api/v4`

**Используемые endpoints:**

| Endpoint | Method | Назначение |
|----------|--------|------------|
| `/leads` | POST | Создание сделки |
| `/contacts` | POST | Создание контакта |
| `/tasks` | POST | Создание задачи |
| `/leads/{id}` | GET | Получение данных сделки |

**Аутентификация:** Bearer Token

**Custom Fields Mapping:**

| LQ Field | Kommo Field ID | Тип |
|----------|----------------|-----|
| `lead_type` | Custom | Dropdown |
| `priority` | Custom | Dropdown |
| `confidence` | Custom | Numeric |
| `source` | Custom | Text |

---

## 6. Модель развёртывания (as-is)

### 6.1 Docker Compose Services

```yaml
services:
  postgres:
    image: postgres:14
    ports: ["15432:5432"]
    volumes: [postgres-data:/var/lib/postgresql/data]

  n8n:
    image: n8nio/n8n
    ports: ["5678:5678"]
    environment:
      - DB_TYPE=postgresdb
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - KOMMO_ACCESS_TOKEN=${KOMMO_ACCESS_TOKEN}

  admin-backend:
    build: ../admin-backend
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=postgresql://n8n:${POSTGRES_PASSWORD}@postgres:5432/lead_qualification

  admin-ui:
    image: nginx:alpine
    ports: ["8080:80"]
    volumes: [../admin-ui:/usr/share/nginx/html]

  client-ui:
    image: nginx:alpine
    ports: ["5180:80"]
    volumes: [../client-ui:/usr/share/nginx/html]
```

### 6.2 Сетевая архитектура

```
Internet
    │
    ▼
Traefik (external, /opt/n8n/dynamic.yml)
    │
    ├──▶ lead-qual.alex-n8n.site/        → Client UI
    ├──▶ lead-qual.alex-n8n.site/webhook → n8n
    └──▶ lead-qual-admin.alex-n8n.site/ → Admin UI + Admin API
```

### 6.3 Volumes

| Volume | Назначение |
|--------|------------|
| `lead-qualification-postgres-data` | Данные PostgreSQL |
| `lead-qualification-n8n-data` | Данные n8n (workflows, credentials) |

---

## 7. Observability (as-is)

### 7.1 Logging

**Таблица logs:**

```sql
SELECT 
  created_at,
  event_type,
  lead_id,
  status,
  error_message
FROM logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

**Event Types:**

| Event | Описание |
|-------|----------|
| `lead_received` | Лид принят |
| `lead_classified` | Классификация завершена |
| `crm_sync` | Синхронизация с CRM |
| `crm_task_created` | Задача создана в CRM |
| `error` | Ошибка |

### 7.2 Metrics (Dashboard)

| Метрика | SQL |
|---------|-----|
| Leads today | `COUNT(*) WHERE created_at::date = CURRENT_DATE` |
| By type | `GROUP BY lead_type` |
| Avg confidence | `AVG(confidence)` |
| CRM sync rate | `COUNT(*) WHERE crm_synced_at IS NOT NULL / COUNT(*)` |

---

## 8. Ограничения MVP (as-is)

| Ограничение | Причина | Влияние |
|-------------|---------|---------|
| **Polling (5 min)** | Упрощение MVP | До 5 мин задержка классификации |
| **Single CRM (Kommo)** | Фокус | Bitrix24 не реализован |
| **Single Language (RU)** | Фокус | Нет мультиязычности |
| **Keyword Fallback** | Простота | Нет semantic similarity |
| **No Event Chaining** | Упрощение | Workflows не связаны напрямую |

---

## 9. Roadmap / Future Work

| Направление | Статус | Описание |
|-------------|--------|----------|
| Event Chaining | Planned | Мгновенная классификация после ingestion |
| Bitrix24 Integration | Planned | Вторая CRM-интеграция |
| Multi-language | Planned | Поддержка ES, EN |
| Semantic Fallback | Planned | Embeddings для fallback |
| Real-time Dashboard | Planned | WebSocket updates |

---

## 10. Architectural Decisions

| Решение | Варианты | Выбрано | Обоснование |
|---------|----------|---------|-------------|
| **AI Provider** | OpenAI, Claude, GigaChat | OpenAI | Лучшее соотношение цена/качество |
| **CRM** | Kommo, Bitrix24 | Kommo | Востребован в 50% заказов |
| **Database** | PostgreSQL, MySQL | PostgreSQL | Надёжность, JSONB |
| **Workflow Engine** | n8n, Zapier | n8n | Self-hosted, гибкость |
| **Polling vs Event** | Polling, Event Chain | Polling | Простота MVP |
| **Admin UI** | Custom, n8n built-in | Custom | Специализированный UX |

---

## 11. Технологический стек

| Слой | Технология | Версия | Назначение |
|------|------------|--------|------------|
| **Workflow Engine** | n8n (self-hosted) | Latest | Оркестрация всех workflows |
| **AI Provider** | OpenAI API | gpt-4o-mini | AI-классификация лидов |
| **CRM** | Kommo | API v4 | Интеграция с CRM |
| **Database** | PostgreSQL | 14+ | Хранение бизнес-данных |
| **Admin Backend** | FastAPI, Python | 3.12 | API для Admin Console |
| **Admin Frontend** | Vanilla JS | — | Dashboard и Lead Queue |
| **Client Frontend** | Nginx + Static HTML | — | Landing и форма заявки |
| **Telegram** | Telegram Bot API | — | Приём лидов из Telegram |
| **Reverse Proxy** | Traefik | — | SSL termination, routing |
| **Deploy** | Docker Compose | — | Контейнеризация |

---

## 12. Структура проекта

```
n8n-lead-qualification/
├── README.md                    # Главное введение в проект
├── docs/                        # Документация
│   ├── BUSINESS_VALUE.md        # Ценность для бизнеса
│   ├── SYSTEM_DEMO.md           # Демонстрация системы
│   ├── ARCHITECTURE.md          # Архитектура системы (этот файл)
│   ├── USER_GUIDE.md            # Руководство пользователя
│   ├── DEPLOYMENT_GUIDE.md      # Руководство по развёртыванию
│   ├── E2E_SCENARIOS.md         # Сквозные сценарии
│   ├── AI_QUALIFICATION.md      # AI-классификация
│   ├── PROJECT_STATE.md         # Текущее состояние
│   ├── PROJECT_HISTORY.md       # История развития
│   ├── IMPLEMENTATION_PLAN.md   # План реализации
│   ├── SCREENSHOTS.md           # Галерея экранов
│   └── TZ_COMPLIANCE_REPORT.md   # Соответствие ТЗ
├── infra/                       # Инфраструктура
│   ├── docker-compose.yml       # Сервисы Docker
│   ├── sql/                      # Схема БД
│   │   └── init-db.sql          # Инициализация БД
│   └── docker/                   # Конфигурации Docker
├── admin-ui/                    # Admin Console Frontend
│   ├── index.html               # Dashboard
│   ├── leads.html              # Lead Queue
│   ├── lead.html                # Lead Details
│   └── js/                      # JavaScript модули
├── admin-backend/               # Admin Console Backend
│   ├── main.py                  # FastAPI entry point
│   ├── routers/                 # API routes
│   └── models/                  # Pydantic models
├── client-ui/                   # Клиентский UI
│   ├── index.html               # Landing page
│   ├── success.html             # Страница успеха
│   └── js/                      # JavaScript модули
├── workflow/                     # n8n workflows
│   └── n8n/workflows/           # JSON экспорт workflows
│       ├── lead-ingestion-v2.json
│       ├── lead-classification-mvp.json
│       ├── kommo-writer-mvp.json
│       └── crm-status-sync-mvp.json
├── task_history/                # История задач
└── docs/screenshots/            # Скриншоты
```

### Ключевые директории

| Директория | Назначение |
|------------|------------|
| `infra/` | Docker Compose, SQL-схемы, конфигурации |
| `admin-ui/` | Dashboard, Lead Queue, Lead Details |
| `admin-backend/` | FastAPI API для Admin Console |
| `client-ui/` | Landing page и форма заявки |
| `workflow/n8n/workflows/` | Экспортированные n8n workflows |
| `docs/` | Вся документация проекта |
| `task_history/` | История задач по разработке |