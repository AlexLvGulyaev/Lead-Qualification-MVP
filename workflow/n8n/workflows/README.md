# n8n Workflows

## Workflow Files

| File | Workflow Name in n8n | ID | Status |
|------|---------------------|-----|--------|
| `Lead Ingestion V2 - Complete.json` | Lead Ingestion V2 - Complete | `lAVEAbQXCYdjYUsQ` | Active |
| `Lead Ingestion - Telegram.json` | Lead Ingestion - Telegram | `hYTIvECmjIAfTKJq` | Active |
| `Lead Classification MVP.json` | Lead Classification MVP | `nKuSxX2XgAt0XccM` | Active |
| `Lead CRM Sync - Kommo Writer MVP.json` | Lead CRM Sync - Kommo Writer MVP | `kommo-writer-mvp-v2` | Active |
| `CRM Status Sync MVP.json` | CRM Status Sync MVP | `crm-status-sync-mvp` | Active |

---

## Lead Ingestion V2 - Complete

**Purpose:** Приём лидов из web-формы через HTTP webhook.

**Trigger:** HTTP POST `/webhook/lead`

**Flow:**
1. Webhook приём POST запроса
2. Валидация данных (message ≥10 chars, source required, phone OR email)
3. Find/Create Contact по email/phone (Target Lead Identity Model)
4. Создание Lead с привязкой к Contact
5. Создание Message
6. Логирование в Logs
7. Ответ клиенту (success/error)

**Required fields:**
- `message` (string, min 10 chars)
- `source` (string)
- `phone` OR `email` (at least one)

**Optional fields:**
- `name` (string)
- `utm_source` (string)
- `utm_campaign` (string)

**Response:**
```json
{
  "success": true,
  "lead_id": "uuid",
  "message": "Lead received successfully",
  "created_at": "2026-06-12T11:11:05.343Z"
}
```

---

## Lead Ingestion - Telegram

**Purpose:** Приём лидов из Telegram Bot.

**Trigger:** Telegram message (via Telegram Trigger node)

**Bot:** OptimusLeadQualificationBot

**Flow:**
1. Telegram Trigger получает сообщение
2. Парсинг и валидация (message ≥10 chars)
3. Обработка `/start` — отправка приветствия
4. Find/Create Contact по telegram_id
5. Создание Lead с привязкой к Contact
6. Создание Message (channel='telegram')
7. Логирование в Logs
8. Отправка подтверждения пользователю

**Required:**
- Telegram Bot Token (в `.env`: `TELEGRAM_BOT_TOKEN`)
- Telegram Credential в n8n

---

## Lead Classification MVP

**Purpose:** AI-классификация лидов по расписанию.

**Trigger:** Schedule (every 5 minutes)

**Flow:**
1. Выбор необработанных лидов (status='received')
2. Загрузка данных лида и сообщения
3. AI классификация через OpenAI
4. Fallback при ошибке (rule-based classification)
5. Сохранение в `qualifications`
6. Обновление статуса лида ('qualified' или 'processed')

---

## Lead CRM Sync - Kommo Writer MVP

**Purpose:** Синхронизация квалифицированных лидов с Kommo CRM.

**Trigger:** Schedule (каждую минуту)

**Flow:**
1. Выбор квалифицированных лидов (status='qualified')
2. Формирование payload для Kommo API
3. Создание сделки и контакта в Kommo (`POST /api/v4/leads/complex`)
4. Определение типа лида (hot/warm/cold/spam)
5. Для hot/warm/cold — создание задачи в Kommo (`POST /api/v4/tasks`)
   - Hot: +15 минут
   - Warm: +24 часа
   - Cold: +7 дней
6. Для spam — закрытие сделки (статус LOST)
7. Добавление note с AI summary
8. Обновление crm_sync с полным snapshot
9. Обновление статуса лида на 'processed'

**Типы лидов:**
- `hot` → статус: Initial Contact, задача: +15 мин
- `warm` → статус: Discussions, задача: +24 часа
- `cold` → статус: Decision Making, задача: +7 дней
- `spam` → статус: Lost, без задачи

**Required env:**
- `KOMMO_ACCESS_TOKEN`
- `KOMMO_BASE_URL`
- `KOMMO_SUBDOMAIN`
- `KOMMO_PIPELINE_ID`
- `KOMMO_STATUS_*` (все статусы)
- `KOMMO_*_FIELD_ID` (custom fields)
- `KOMMO_RESPONSIBLE_USER_ID`

**Updates:**
- crm_sync: kommo_lead_id, kommo_contact_id, kommo_pipeline_*, kommo_status_*, kommo_responsible_user_id, crm_has_active_task, crm_closest_task_at, crm_closed_at, initial_task_created, crm_synced_at

---

## CRM Status Sync MVP

**Purpose:** Периодическая синхронизация статусов сделок из Kommo.

**Trigger:** Schedule (каждые 15 минут)

**Flow:**
1. Выбор сделок с kommo_lead_id
2. Запрос к Kommo API (`GET /api/v4/leads/{id}?with=contacts,tasks`)
3. Извлечение актуальных данных:
   - pipeline_id, pipeline_name
   - status_id, status_name
   - responsible_user_id
   - closed_at
   - has_active_task, closest_task_at
4. Обновление crm_sync
5. Логирование результатов

**Updates:**
- crm_sync: все поля мониторинга
- crm_synced_at обновляется при каждой синхронизации

**Важно:**
- Не подтягивает историю задач
- Хранит только флаги и ближайшую задачу
- crm_raw_snapshot опционально для debug

---

## Setup

### 1. Import Workflows

```bash
# Импорт всех workflow в n8n
cd workflow/n8n/workflows
n8n import:workflow --input="Lead Ingestion V2 - Complete.json"
n8n import:workflow --input="Lead Ingestion - Telegram.json"
n8n import:workflow --input="Lead Classification MVP.json"
```

### 2. Configure Credentials

**PostgreSQL:**
- Name: `Lead Qualification DB`
- Host: `postgres` (Docker) или `localhost`
- Database: `lead_qualification`
- User: `n8n`
- Password: из `.env`

**Telegram Bot:**
- Type: Telegram API
- Name: `Telegram Bot`
- Access Token: из `.env` (`TELEGRAM_BOT_TOKEN`)

**OpenAI:**
- Type: OpenAI
- Name: `OpenAI API`
- API Key: из `.env` (`OPENAI_API_KEY`)

### 3. Activate Workflows

После импорта и настройки credentials:
1. Открыть n8n UI
2. Активировать каждый workflow
3. Проверить webhook URL для Lead Ingestion V2

### 4. Update Client UI

Обновить `client-ui/config.js`:
```javascript
WEBHOOK_URL: 'https://your-domain/webhook/lead'
```

---

## Integration Diagram

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│   Web Form      │────▶│  Lead Ingestion V2 - Complete      │
│   (client-ui)   │     │  (webhook)                          │
└─────────────────┘     │  ┌─────────────────────────────────┐│
                        │  │ Find/Create Contact              ││
┌─────────────────┐     │  │ Create Lead + Message + Log      ││
│   Telegram Bot  │────▶│  └─────────────────────────────────┘│
│   (user msg)    │     └─────────────────┬───────────────────┘
└─────────────────┘                       │
                                          ▼
                        ┌─────────────────────────────────────┐
                        │  Lead Classification MVP            │
                        │  (schedule: every 5 min)            │
                        │  ┌─────────────────────────────────┐│
                        │  │ Query leads (status=received)    ││
                        │  │ AI Classify + Fallback          ││
                        │  │ Save qualifications              ││
                        │  └─────────────────────────────────┘│
                        └─────────────────────────────────────┘
```

---

## Database Tables (Target Lead Identity Model)

### contacts

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR | Email (unique or null) |
| phone | VARCHAR | Phone (unique or null) |
| name | VARCHAR | Contact name |
| created_at | TIMESTAMP | Creation time |

### leads

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| contact_id | UUID | FK → contacts.id |
| source | VARCHAR | 'web', 'telegram', etc. |
| status | VARCHAR | 'received', 'qualified', 'processed' |
| created_at | TIMESTAMP | Creation time |

### messages

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| lead_id | UUID | FK → leads.id |
| channel | VARCHAR | 'web', 'telegram' |
| direction | VARCHAR | 'inbound', 'outbound' |
| content | TEXT | Message text |
| created_at | TIMESTAMP | Creation time |

### logs

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| lead_id | UUID | FK → leads.id (optional) |
| event_type | VARCHAR | Event type |
| event_data | JSONB | Event data |
| status | VARCHAR | 'success', 'error' |
| created_at | TIMESTAMP | Event time |

---

## Testing

### Test Webhook

```bash
curl -X POST "https://your-domain/webhook/lead" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Тестовый лид",
    "phone": "+79991234567",
    "email": "test@example.com",
    "message": "Хочу узнать подробнее о ваших услугах и возможностях интеграции",
    "source": "website"
  }'
```

### Test Telegram

1. Найдите бота: @OptimusLeadQualificationBot
2. Отправьте `/start` — получите приветствие
3. Отправьте сообщение (≥10 символов) — лид будет создан

### Check Database

```sql
-- Последние лиды
SELECT l.id, l.source, l.status, c.email, c.phone
FROM leads l
JOIN contacts c ON l.contact_id = c.id
ORDER BY l.created_at DESC
LIMIT 10;

-- Последние события
SELECT * FROM logs ORDER BY created_at DESC LIMIT 20;
```

---

## Notes

- Target Lead Identity Model: один contact может иметь несколько leads
- Find/Create Contact находит существующий контакт по email или phone
- Дублирование контактов предотвращается на уровне БД-функции
- Classification обрабатывает все лиды независимо от источника