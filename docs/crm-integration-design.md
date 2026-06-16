# CRM Integration Design
## Phase 006 — Architectural Design

**Версия:** 1.0
**Дата:** 2026-06-12
**Статус:** Design Phase
**Автор:** AI Automation Portfolio Lab

---

## Содержание

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [CRM Abstraction Layer](#3-crm-abstraction-layer)
4. [CRM Sync Model](#4-crm-sync-model)
5. [Workflow Integration](#5-workflow-integration)
6. [Data Flow](#6-data-flow)
7. [Error Handling](#7-error-handling)
8. [Idempotency & Retry](#8-idempotency--retry)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. Executive Summary

### 1.1. Цель

Спроектировать CRM Integration для Lead Qualification Assistant таким образом, чтобы после квалификации лида система могла создавать или обновлять сущность в CRM (Kommo или Bitrix24).

### 1.2. Область применения

**Входит:**
- Архитектурный дизайн CRM Abstraction Layer
- Определение единого контракта для CRM-провайдеров
- Структура таблицы crm_sync
- Workflow интеграции
- Маппинг полей (отдельный документ)
- Обработка ошибок

**Не входит:**
- Реализация провайдеров Kommo/Bitrix24
- Настройка тестовых аккаунтов CRM
- Реализация follow-up (Phase 007)

### 1.3. Ключевые решения

| Решение | Обоснование |
|---------|-------------|
| CRM Abstraction Layer | Поддержка нескольких CRM без изменения workflow |
| Unified Payload | Единый формат данных для всех CRM |
| Async Sync Pattern | Отложенная синхронизация с retry |
| crm_sync Table | Отслеживание статуса синхронизации |

---

## 2. Current State Analysis

### 2.1. Текущая архитектура (Input Channels MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Input Channels MVP                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │ Web Form     │────▶│ Lead         │────▶│ AI           │   │
│  │ (webhook)    │     │ Ingestion    │     │ Classifier   │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│                              │                     │             │
│                              ▼                     ▼             │
│                       ┌──────────────┐     ┌──────────────┐   │
│                       │ PostgreSQL   │     │ PostgreSQL   │   │
│                       │ (leads,      │     │ (qualific.)  │   │
│                       │  contacts)   │     │              │   │
│                       └──────────────┘     └──────────────┘   │
│                                                                  │
│                       ┌──────────────┐                          │
│                       │ logs         │                          │
│                       └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2. Data Model v2 (Implemented)

```
contacts (люди/организации)
    ├── channel_identities (идентификаторы в каналах)
    │       └── telegram_user_id, email, phone
    └── leads (обращения)
            ├── messages (сообщения)
            ├── qualifications (результаты AI)
            ├── crm_sync (синхронизация с CRM) ⏳
            └── logs (события)
```

### 2.3. Gap Analysis

| Компонент | Текущее состояние | Требуется |
|-----------|-------------------|-----------|
| Lead Storage | ✅ contacts + leads | — |
| AI Classification | ✅ qualifications | — |
| CRM Writer | ❌ Отсутствует | Создать |
| CRM Abstraction | ❌ Отсутствует | Создать |
| crm_sync Table | ⏳ Пустая | Наполнить |
| Error Handling | ⚠️ Частичный | Расширить |

---

## 3. CRM Abstraction Layer

### 3.1. Архитектурная концепция

CRM Abstraction Layer обеспечивает единый интерфейс для работы с несколькими CRM-системами без изменения бизнес-логики workflow.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CRM Abstraction Layer                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                      ┌──────────────┐                           │
│                      │ CRM Writer   │                           │
│                      │ (Workflow)   │                           │
│                      └──────┬───────┘                           │
│                             │                                    │
│                             ▼                                    │
│                     ┌───────────────┐                            │
│                     │ Unified       │                            │
│                     │ Payload       │                            │
│                     └───────┬───────┘                            │
│                             │                                    │
│              ┌──────────────┼──────────────┐                    │
│              │              │              │                     │
│              ▼              ▼              ▼                     │
│       ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│       │ Kommo    │  │ Bitrix24 │  │ [Future] │                 │
│       │ Provider │  │ Provider │  │ Provider │                 │
│       └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│            │              │              │                      │
│            ▼              ▼              ▼                      │
│       ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│       │ Kommo    │  │ Bitrix24 │  │ [Other]  │                 │
│       │ API      │  │ API      │  │ API      │                 │
│       └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2. Unified Payload

Единый формат данных для всех CRM-провайдеров:

```json
{
  "lead_id": "uuid",
  "public_number": "LQ-123456",
  "contact": {
    "name": "Иван Петров",
    "phone": "+79991234567",
    "email": "ivan@example.com",
    "company": "Компания",
    "notes": "Дополнительная информация"
  },
  "channel_identities": [
    {
      "channel": "telegram",
      "external_id": "123456789",
      "channel_data": {
        "username": "ivan_petrov",
        "first_name": "Иван",
        "last_name": "Петров"
      }
    },
    {
      "channel": "web",
      "external_id": "session_abc123"
    }
  ],
  "qualification": {
    "lead_type": "hot",
    "interest": "high",
    "priority": "high",
    "category": "service_a",
    "summary": "Клиент готов к покупке",
    "confidence": 0.92,
    "suggested_action": "call",
    "reasoning": "Явное намерение купить",
    "ai_model": "gpt-4o-mini",
    "processed_at": "2026-06-12T12:00:00Z"
  },
  "source": {
    "channel": "web",
    "utm_source": "google",
    "utm_campaign": "summer2024"
  },
  "metadata": {
    "created_at": "2026-06-12T12:00:00Z",
    "first_message": "Хочу купить вашу услугу..."
  }
}
```

### 3.3. Provider Contract

Каждый провайдер реализует единый контракт:

```typescript
interface CRMProvider {
  // Создание лида
  createLead(payload: UnifiedPayload): Promise<CRMResponse>;
  
  // Обновление лида
  updateLead(crmLeadId: string, payload: UnifiedPayload): Promise<CRMResponse>;
  
  // Поиск лида по внешнему ID
  findByExternalId(externalId: string): Promise<Lead | null>;
  
  // Добавление примечания
  addNote(crmLeadId: string, note: string): Promise<void>;
  
  // Проверка здоровья
  healthCheck(): Promise<boolean>;
}

interface CRMResponse {
  success: boolean;
  crmLeadId?: string;
  errorCode?: string;
  errorMessage?: string;
}
```

### 3.4. Provider Selection

Провайдер выбирается на основе конфигурации:

```javascript
// n8n Workflow Configuration
const CRM_PROVIDER = process.env.CRM_PROVIDER || 'kommo';

const providers = {
  kommo: new KommoProvider(config.kommo),
  bitrix24: new Bitrix24Provider(config.bitrix24)
};

const provider = providers[CRM_PROVIDER];
```

### 3.5. Provider Extension Points

Точки расширения для новых провайдеров:

| Точка расширения | Описание |
|------------------|----------|
| `createLead()` | Создание лида в новой CRM |
| `updateLead()` | Обновление лида |
| `fieldMapping` | Маппинг полей (отдельный документ) |
| `statusMapping` | Маппинг статусов |
| `apiClient` | HTTP-клиент для API CRM |

---

## 4. CRM Sync Model

### 4.1. Таблица crm_sync (Current Schema)

```sql
CREATE TABLE crm_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    crm_type VARCHAR(50) NOT NULL,
    crm_lead_id VARCHAR(100),
    sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sync_error TEXT,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 4.2. Расширенная модель (Proposed)

Добавим поля для retry и идемпотентности:

```sql
ALTER TABLE crm_sync ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE crm_sync ADD COLUMN retry_scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE crm_sync ADD COLUMN idempotency_key VARCHAR(255) UNIQUE;
ALTER TABLE crm_sync ADD COLUMN payload_sent JSONB;
ALTER TABLE crm_sync ADD COLUMN crm_response JSONB;
```

**Обновлённая структура:**

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | UUID | Идентификатор записи |
| lead_id | UUID | Ссылка на leads.id |
| crm_type | VARCHAR(50) | kommo, bitrix24 |
| crm_lead_id | VARCHAR(100) | ID лида в CRM |
| sync_status | VARCHAR(20) | pending, success, failed, retry |
| sync_error | TEXT | Текст ошибки |
| retry_count | INTEGER | Количество попыток |
| retry_scheduled_at | TIMESTAMP | Запланированное время retry |
| idempotency_key | VARCHAR(255) | Ключ идемпотентности |
| payload_sent | JSONB | Отправленные данные |
| crm_response | JSONB | Ответ от CRM |
| synced_at | TIMESTAMP | Время успешной синхронизации |
| created_at | TIMESTAMP | Время создания записи |

### 4.3. Статусы синхронизации

```
pending ──▶ in_progress ──▶ success
    │              │
    │              └──▶ failed ──▶ retry ──▶ in_progress
    │                              │
    │                              └──▶ failed (max retries)
    │
    └──▶ skipped (дубликат, лид уже синхронизирован)
```

| Статус | Описание | Действие |
|--------|----------|----------|
| `pending` | Ожидает синхронизации | Pickup по schedule |
| `in_progress` | Синхронизация в процессе | — |
| `success` | Успешная синхронизация | — |
| `failed` | Ошибка синхронизации | Retry или manual |
| `retry` | Запланирован retry | Ждать scheduled_at |
| `skipped` | Пропущен (дубликат) | — |

### 4.4. Retry Policy

```javascript
const RETRY_POLICY = {
  maxRetries: 3,
  backoff: 'exponential',
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  retryableErrors: [
    'TIMEOUT',
    'RATE_LIMIT',
    'SERVICE_UNAVAILABLE',
    'NETWORK_ERROR'
  ],
  nonRetryableErrors: [
    'VALIDATION_ERROR',
    'DUPLICATE_LEAD',
    'AUTHENTICATION_ERROR',
    'PERMISSION_DENIED'
  ]
};
```

**Exponential Backoff:**

```
Attempt 1: immediate
Attempt 2: wait 1s
Attempt 3: wait 2s
Attempt 4: wait 4s
Attempt 5: give up (max retries)
```

---

## 5. Workflow Integration

### 5.1. Integration Point

CRM Writer запускается **после** AI Classification:

```
Lead Ingestion (webhook/telegram)
    │
    ▼
Lead Classification (schedule or trigger)
    │
    ▼
CRM Writer (NEW)
    │
    ▼
Follow-up (Phase 007)
```

### 5.2. Workflow: CRM Writer

**Триггер:** Schedule (every 5 minutes) или Webhook trigger

**Шаги:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    CRM Writer Workflow                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │ Query Leads  │  SELECT * FROM leads                         │
│  │ (status=      │  WHERE status = 'qualified'                 │
│  │  'qualified') │  AND NOT EXISTS (                            │
│  │              │    SELECT 1 FROM crm_sync                     │
│  │              │    WHERE crm_sync.lead_id = leads.id          │
│  │              │    AND sync_status = 'success'                │
│  │              │  )                                            │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Load Full    │  JOIN contacts, channel_identities,           │
│  │ Lead Data    │  qualifications                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Build        │  Unified Payload                               │
│  │ Unified      │                                               │
│  │ Payload      │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Select       │  Based on CRM_PROVIDER env                    │
│  │ Provider     │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Create Lead  │  provider.createLead(payload)                 │
│  │ in CRM       │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ├─────────────────┬─────────────────┐                  │
│         │                 │                 │                    │
│         ▼                 ▼                 ▼                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Success      │ │ Retry        │ │ Failed       │           │
│  │              │ │              │ │              │           │
│  │ INSERT       │ │ Schedule     │ │ Log error    │           │
│  │ crm_sync     │ │ retry        │ │ Update       │           │
│  │ status=      │ │ retry_count  │ │ crm_sync     │           │
│  │ 'success'    │ │              │ │ status=      │           │
│  │              │ │              │ │ 'failed'     │           │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘           │
│         │                 │                 │                    │
│         └─────────────────┴─────────────────┘                  │
│                                   │                              │
│                                   ▼                              │
│                          ┌──────────────┐                        │
│                          │ Log Event    │                        │
│                          │ in logs      │                        │
│                          └──────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3. Workflow Nodes (n8n)

| Node | Type | Функция |
|------|------|---------|
| `Schedule Trigger` | Schedule | Каждые 5 минут |
| `PostgreSQL` | Query | Выборка qualified leads |
| `PostgreSQL` | Query | Загрузка связанных данных |
| `Function` | Code | Build Unified Payload |
| `Switch` | Switch | Выбор провайдера |
| `HTTP Request` | HTTP | Kommo API call |
| `HTTP Request` | HTTP | Bitrix24 API call |
| `PostgreSQL` | Insert | INSERT crm_sync |
| `PostgreSQL` | Insert | INSERT logs |

### 5.4. Trigger Options

**Option A: Schedule (Recommended for MVP)**

```
Schedule: Every 5 minutes
Query: SELECT leads WHERE status = 'qualified' AND NOT synced
Latency: Up to 5 minutes
Simplicity: High
```

**Option B: Webhook Trigger (Post-Classification)**

```
Trigger: After Lead Classification workflow
Latency: Immediate
Complexity: Higher (workflow chaining)
```

**Рекомендация:** Schedule для MVP, webhook для production.

---

## 6. Data Flow

### 6.1. End-to-End Flow

```
1. Lead Created (Lead Ingestion)
   ├── INSERT INTO leads (status = 'received')
   ├── INSERT INTO contacts
   ├── INSERT INTO channel_identities
   └── INSERT INTO messages

2. Lead Classified (Lead Classification)
   ├── Query leads WHERE status = 'received'
   ├── Call OpenAI API
   ├── INSERT INTO qualifications
   └── UPDATE leads SET status = 'qualified'

3. Lead Synced to CRM (CRM Writer) [NEW]
   ├── Query leads WHERE status = 'qualified' AND NOT synced
   ├── Build Unified Payload
   ├── SELECT CRM Provider
   ├── Call CRM API
   ├── INSERT INTO crm_sync
   ├── UPDATE leads SET status = 'processed'
   └── INSERT INTO logs

4. Follow-up (Phase 007) [FUTURE]
   └── Based on qualification + CRM status
```

### 6.2. Unified Payload Assembly

```sql
-- Query to assemble Unified Payload
SELECT
    l.id as lead_id,
    l.public_number,
    json_build_object(
        'name', c.name,
        'phone', c.phone,
        'email', c.email,
        'company', c.company,
        'notes', c.notes
    ) as contact,
    (
        SELECT json_agg(json_build_object(
            'channel', ci.channel,
            'external_id', ci.external_id,
            'channel_data', ci.channel_data
        ))
        FROM channel_identities ci
        WHERE ci.contact_id = c.id
    ) as channel_identities,
    json_build_object(
        'lead_type', q.lead_type,
        'interest', q.interest,
        'priority', q.priority,
        'category', q.category,
        'summary', q.summary,
        'confidence', q.confidence,
        'suggested_action', q.suggested_action,
        'reasoning', q.reasoning,
        'ai_model', q.ai_model,
        'processed_at', q.processed_at
    ) as qualification,
    json_build_object(
        'channel', l.source,
        'utm_source', l.utm_source,
        'utm_campaign', l.utm_campaign
    ) as source,
    json_build_object(
        'created_at', l.created_at,
        'first_message', m.content
    ) as metadata
FROM leads l
JOIN contacts c ON l.contact_id = c.id
JOIN qualifications q ON q.lead_id = l.id
JOIN messages m ON m.lead_id = l.id AND m.direction = 'inbound'
WHERE l.id = :lead_id
ORDER BY m.created_at ASC
LIMIT 1;
```

### 6.3. Status Transitions

```
received ──▶ qualified ──▶ processed ──▶ archived
    │            │              │
    │            │              └──▶ error (CRM sync failed)
    │            │
    └──▶ error (classification failed)
```

| Статус | Описание | Следующий шаг |
|--------|----------|---------------|
| `received` | Лид создан | Classification |
| `qualified` | AI классифицировал | CRM Writer |
| `processed` | Синхронизирован с CRM | Follow-up (Phase 007) |
| `archived` | Архивирован (cold lead) | — |
| `error` | Ошибка | Retry или manual |

---

## 7. Error Handling

### 7.1. Error Categories

| Категория | Описание | Retry | Action |
|-----------|----------|-------|--------|
| `TRANSIENT` | Временная ошибка | Да | Retry with backoff |
| `PERMANENT` | Постоянная ошибка | Нет | Log, notify, skip |
| `VALIDATION` | Ошибка валидации | Нет | Log, fix payload |
| `AUTHENTICATION` | Ошибка авторизации | Нет | Notify admin |
| `RATE_LIMIT` | Превышение лимита | Да | Wait, retry |

### 7.2. Error Handling Matrix

| Error Type | CRM | Retry | Status | Log Level | Notify |
|------------|-----|-------|--------|-----------|--------|
| Timeout | Kommo/Bitrix24 | ✅ Yes | `retry` | warning | No |
| Rate Limit | Kommo/Bitrix24 | ✅ Yes | `retry` | warning | No |
| Service Unavailable | Kommo/Bitrix24 | ✅ Yes | `retry` | warning | No |
| Network Error | Kommo/Bitrix24 | ✅ Yes | `retry` | warning | No |
| Validation Error | Kommo/Bitrix24 | ❌ No | `failed` | error | Yes |
| Authentication Error | Kommo/Bitrix24 | ❌ No | `failed` | error | Yes |
| Duplicate Lead | Kommo/Bitrix24 | ❌ No | `skipped` | info | No |
| Permission Denied | Kommo/Bitrix24 | ❌ No | `failed` | error | Yes |

### 7.3. Error Response Structure

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "category": "PERMANENT",
    "message": "Field 'phone' is required",
    "details": {
      "field": "phone",
      "constraint": "required"
    },
    "retryable": false,
    "suggestedAction": "Fix payload and retry"
  }
}
```

### 7.4. Logging

```sql
INSERT INTO logs (
    lead_id,
    event_type,
    event_data,
    status,
    error_message,
    created_at
) VALUES (
    :lead_id,
    'crm_sync',
    json_build_object(
        'crm_type', :crm_type,
        'crm_lead_id', :crm_lead_id,
        'retry_count', :retry_count,
        'payload', :payload
    ),
    :status, -- 'success', 'error', 'warning'
    :error_message,
    NOW()
);
```

### 7.5. Monitoring Queries

**Failed syncs за последние 24 часа:**

```sql
SELECT
    cs.id,
    cs.lead_id,
    l.public_number,
    cs.crm_type,
    cs.sync_status,
    cs.sync_error,
    cs.retry_count,
    cs.created_at
FROM crm_sync cs
JOIN leads l ON l.id = cs.lead_id
WHERE cs.sync_status = 'failed'
    AND cs.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY cs.created_at DESC;
```

**Retry queue:**

```sql
SELECT
    cs.id,
    cs.lead_id,
    l.public_number,
    cs.crm_type,
    cs.retry_count,
    cs.retry_scheduled_at
FROM crm_sync cs
JOIN leads l ON l.id = cs.lead_id
WHERE cs.sync_status = 'retry'
    AND cs.retry_scheduled_at <= NOW()
ORDER BY cs.retry_scheduled_at ASC;
```

---

## 8. Idempotency & Retry

### 8.1. Idempotency Key

Каждая попытка синхронизации использует уникальный idempotency key:

```javascript
// Format: {lead_id}:{timestamp}:{retry_count}
const idempotencyKey = `${leadId}:${Date.now()}:${retryCount}`;
```

### 8.2. Idempotency Strategy

**CRM API Level:**
- Kommo: Idempotency-Key header
- Bitrix24: Проверка дубликатов по телефону/email

**Application Level:**
- Проверка существования crm_sync с status='success'
- Проверка crm_lead_id в crm_sync
- Генерация idempotency_key

### 8.3. Deduplication Logic

```javascript
async function syncLeadToCRM(leadId) {
    // Проверка: уже синхронизирован?
    const existingSync = await db.query(
        'SELECT * FROM crm_sync WHERE lead_id = $1 AND sync_status = $2',
        [leadId, 'success']
    );
    
    if (existingSync.rows.length > 0) {
        return { status: 'skipped', reason: 'already_synced' };
    }
    
    // Создание записи синхронизации
    const syncRecord = await db.query(
        'INSERT INTO crm_sync (lead_id, crm_type, sync_status) VALUES ($1, $2, $3) RETURNING *',
        [leadId, CRM_PROVIDER, 'pending']
    );
    
    // Попытка синхронизации
    try {
        const payload = await buildUnifiedPayload(leadId);
        const result = await provider.createLead(payload);
        
        // Успех
        await db.query(
            'UPDATE crm_sync SET sync_status = $1, crm_lead_id = $2, synced_at = $3 WHERE id = $4',
            ['success', result.crmLeadId, NOW(), syncRecord.id]
        );
        
        return { status: 'success', crmLeadId: result.crmLeadId };
        
    } catch (error) {
        // Обработка ошибки
        const retryable = isRetryableError(error);
        
        if (retryable && retryCount < MAX_RETRIES) {
            // Retry
            await db.query(
                'UPDATE crm_sync SET sync_status = $1, sync_error = $2, retry_count = $3, retry_scheduled_at = $4 WHERE id = $5',
                ['retry', error.message, retryCount + 1, calculateRetryAt(retryCount), syncRecord.id]
            );
        } else {
            // Failed
            await db.query(
                'UPDATE crm_sync SET sync_status = $1, sync_error = $2 WHERE id = $3',
                ['failed', error.message, syncRecord.id]
            );
        }
        
        throw error;
    }
}
```

### 8.4. Retry Schedule

```
Retry 1: 1 second
Retry 2: 2 seconds
Retry 3: 4 seconds
Max: 3 retries, then manual intervention
```

---

## 9. Implementation Roadmap

### 9.1. Phase 006 Stages

| Stage | Description | Duration | Deliverable |
|-------|-------------|----------|-------------|
| **Design** | Архитектурный дизайн | 1 день | crm-integration-design.md |
| **Mapping** | Маппинг полей | 0.5 дня | crm-field-mapping.md |
| **Schema Update** | Расширение crm_sync | 0.5 дня | SQL migration |
| **Provider Implementation** | Kommo Provider | 2 дня | n8n workflow |
| **Provider Implementation** | Bitrix24 Provider | 2 дня | n8n workflow |
| **Testing** | End-to-end testing | 1 день | Test results |
| **Documentation** | README, SPEC update | 0.5 дня | Updated docs |

**Total:** 7-8 дней

### 9.2. Prerequisites

- [ ] Доступ к тестовому аккаунту Kommo
- [ ] Доступ к тестовому аккаунту Bitrix24
- [ ] API токены для CRM
- [ ] Понимание структуры полей в CRM

### 9.3. Success Criteria

| Критерий | Проверка |
|----------|----------|
| Лид создаётся в CRM | CREATE в Kommo/Bitrix24 |
| Поля корректно маппятся | Проверка в CRM UI |
| Статус синхронизации записывается | SELECT crm_sync |
| Retry работает при ошибке | Симуляция ошибки |
| Duplicate detection работает | Повторный sync |

### 9.4. Risks

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Нет доступа к CRM | Средняя | Начать с одной CRM |
| API ограничения | Средняя | Rate limiting, batching |
| Сложный маппинг полей | Средняя | Упрощённый маппинг для MVP |
| Дубликаты в CRM | Высокая | Deduplication logic |

---

## Приложение A: Environment Variables

```bash
# CRM Provider Selection
CRM_PROVIDER=kommo  # or bitrix24

# Kommo Configuration
KOMMO_ACCESS_TOKEN=***
KOMMO_SUBDOMAIN=yourcompany
KOMMO_PIPELINE_ID=12345

# Bitrix24 Configuration
BITRIX24_WEBHOOK_URL=https://yourcompany.bitrix24.ru/rest/1/***/
BITRIX24_LEAD_STATUS_NEW=NEW
```

---

## Приложение B: Related Documents

- `docs/crm-field-mapping.md` — Маппинг полей для Kommo и Bitrix24
- `docs/IMPLEMENTATION_PLAN.md` — Общий план реализации
- `docs/SPEC.md` — Продуктовая спецификация
- `infra/sql/01-schema.sql` — Схема базы данных

---

**Конец документа**

*Документ разработан в рамках Phase 006 CRM Integration Design*
*Дата: 2026-06-12*