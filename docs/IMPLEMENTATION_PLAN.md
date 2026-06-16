# IMPLEMENTATION PLAN
## n8n Lead Qualification Assistant

**Версия:** 1.2
**Дата:** 2026-06-16
**Статус:** MVP Complete
**Основание:** SPEC v1.3 (Approved)
**Аудит:** IMPLEMENTATION_PLAN Scope Audit — пройден (2026-06-10)

---

## Состояние реализации

### ✅ Completed MVP Scope

Все компоненты Full MVP реализованы и протестированы:

| Компонент | Файл workflow | Статус |
|-----------|---------------|--------|
| Web-форма приём | Lead Ingestion V2 - Complete.json | ✅ Active |
| Telegram Bot приём | Lead Ingestion - Telegram UX MVP.json | ✅ Active |
| AI Classifier | Lead Classification MVP.json | ✅ Active |
| CRM Writer (Kommo) | Lead CRM Sync - Kommo Writer MVP.json | ✅ Active |
| CRM Status Sync | CRM Status Sync MVP.json | ✅ Active |
| PostgreSQL Storage | Data Model v2 (7 tables) | ✅ Active |
| Logger | logs table | ✅ Active |
| Initial Task Creation | Kommo Writer workflow | ✅ Active |
| Admin UI | Admin Console (Dashboard, Queue, Details) | ✅ Active |

### Verified E2E Scenarios

| Сценарий | Источник → Тип | Статус |
|----------|----------------|--------|
| Website → Hot Lead | Web → hot | ✅ Verified |
| Telegram → Hot Lead | Telegram → hot | ✅ Verified |
| Website → Warm Lead | Web → warm | ✅ Verified |
| Telegram → Cold Lead | Telegram → cold | ✅ Verified |
| Website → Spam | Web → spam | ✅ Verified |
| AI Fallback | Any → rule-based | ✅ Verified |

### Known Limitations

1. **Polling Instead of Event Chaining** — до 5 минут задержка
2. **Single CRM (Kommo)** — Bitrix24 не реализован
3. **Single Language (RU)** — только русский
4. **Keyword Fallback** — нет semantic similarity

### Future Enhancements

| Улучшение | Приоритет | Описание |
|-----------|-----------|----------|
| Event Chaining | High | Мгновенная классификация после ingestion |
| Bitrix24 Integration | Medium | Вторая CRM-интеграция |
| Multi-language | Medium | Поддержка EN, ES |
| Semantic Fallback | Low | Embeddings для fallback классификации |

---

## Содержание

1. [MVP Boundaries](#1-mvp-boundaries)
2. [Target Architecture](#2-target-architecture)
3. [n8n Workflows](#3-n8n-workflows)
4. [Data Model](#4-data-model)
5. [API and Integration Contracts](#5-api-and-integration-contracts)
6. [Classification Logic](#6-classification-logic)
7. [Error Handling and Observability](#7-error-handling-and-observability)
8. [Implementation Phases](#8-implementation-phases)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Risks and Decisions](#10-risks-and-decisions)

---

## 1. MVP Boundaries

### 1.1. Входит в MVP (In Scope)

| Компонент | FR | Приоритет | Статус |
|-----------|-----|-----------|--------|
| Web-форма приём | FR-001 | P0 | Обязательно |
| Telegram Bot приём | FR-002 | P0 | Обязательно |
| AI Classifier | FR-003 | P0 | Обязательно |
| CRM Writer | FR-004 | P0 | Обязательно |
| PostgreSQL Storage | FR-005 | P0 | Обязательно |
| Logger | FR-006 | P1 | Обязательно |
| Follow-up Trigger | FR-007 | P1 | Обязательно |
| Admin UI (minimal) | FR-008 | P2 | Опционально |

### 1.2. Не входит в MVP (Out of Scope)

| Функция | Причина | Когда реализовать |
|---------|---------|-------------------|
| Интеграция с Asterisk | Отдельный кейс | Пост-MVP |
| Голосовые платформы (TTS/STT) | Высокая сложность | Пост-MVP |
| API маркетплейсов (WB/Ozon) | Отдельная интеграция | Пост-MVP |
| Мультиагентные системы | Высокая сложность | v2 |
| VoC-аналитика | Отдельный кейс | Пост-MVP |
| A/B тестирование промптов | Продвинутая функция | v2 |
| Google Sheets | PostgreSQL выбран | Исключено |
| n8n.cloud | VPS выбран | Исключено |

### 1.3. Обязательные каналы входа

| Канал | Реализация | Обязательность |
|-------|------------|----------------|
| **Web-форма** | HTTP POST → n8n Webhook | P0 |
| **Telegram** | Telegram Bot API → n8n Telegram Trigger | P0 |

### 1.4. Обязательная интеграция

| Интеграция | Провайдер | Обязательность |
|------------|-----------|----------------|
| **CRM** | Kommo или Bitrix24 | P0 |
| **AI** | OpenAI (основной), Claude/GigaChat (альтернатива) | P0 |
| **Storage** | PostgreSQL на VPS | P0 |

---

## 2. Target Architecture

### 2.1. Общая архитектура

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ВНЕШНИЕ СИСТЕМЫ                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │
│   │   KOMMO     │    │  BITRIX24   │    │  TELEGRAM   │                    │
│   │   CRM API   │    │   CRM API   │    │   BOT API   │                    │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                    │
│          │                  │                   │                           │
│          │                  │                   │                           │
│          └──────────────────┼───────────────────┘                           │
│                             │                                               │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VPS КОНТУР                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         n8n SERVER                                   │   │
│   │                                                                      │   │
│   │   ┌─────────────────────────────────────────────────────────────┐   │   │
│   │   │              WORKFLOW: Lead Ingestion                        │   │   │
│   │   │                                                              │   │   │
│   │   │  ┌──────────┐    ┌──────────┐    ┌──────────┐              │   │   │
│   │   │  │  Webhook │    │ Telegram │    │ Validate │              │   │   │
│   │   │  │  Trigger │    │ Trigger  │    │  Input   │              │   │   │
│   │   │  └────┬─────┘    └────┬─────┘    └────┬─────┘              │   │   │
│   │   │       │               │               │                     │   │   │
│   │   │       └───────────────┴───────────────┘                     │   │   │
│   │   │                       │                                     │   │   │
│   │   └───────────────────────┼─────────────────────────────────────┘   │   │
│   │                           │                                         │   │
│   │   ┌───────────────────────┼─────────────────────────────────────┐   │   │
│   │   │              WORKFLOW: Lead Classification                   │   │   │
│   │   │                       │                                     │   │   │
│   │   │                       ▼                                     │   │   │
│   │   │  ┌──────────┐    ┌──────────┐    ┌──────────┐              │   │   │
│   │   │  │  Store   │───▶│    AI    │───▶│  Route   │              │   │   │
│   │   │  │  Lead    │    │Classifier│    │  Action  │              │   │   │
│   │   │  └──────────┘    └──────────┘    └────┬─────┘              │   │   │
│   │   │                                        │                     │   │   │
│   │   └────────────────────────────────────────┼────────────────────┘   │   │
│   │                                            │                         │   │
│   │   ┌────────────────────────────────────────┼────────────────────┐   │   │
│   │   │              WORKFLOW: Lead Output                           │   │   │
│   │   │                                            │                 │   │   │
│   │   │                       ┌────────────────────┼───────────┐     │   │   │
│   │   │                       │                    │           │     │   │   │
│   │   │                       ▼                    ▼           ▼     │   │   │
│   │   │  ┌──────────┐    ┌──────────┐    ┌──────────┐ ┌──────────┐  │   │   │
│   │   │  │   CRM    │    │ Follow-up│    │  Log     │ │  Admin   │  │   │   │
│   │   │  │  Writer  │    │ Trigger  │    │  Event   │ │   UI     │  │   │   │
│   │   │  └──────────┘    └──────────┘    └──────────┘ └──────────┘  │   │   │
│   │   │                                                               │   │   │
│   │   └───────────────────────────────────────────────────────────────┘   │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                       PostgreSQL                                     │   │
│   │                                                                      │   │
│   │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│   │   │  leads   │ │ messages │ │qualifica-│ │crm_sync  │ │   logs   │ │   │
│   │   │          │ │          │ │  tions   │ │          │ │          │ │   │
│   │   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AI PROVIDERS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │
│   │   OpenAI    │    │   Claude    │    │  GigaChat   │                    │
│   │  API (main) │    │  API (alt)  │    │  API (alt)  │                    │
│   └─────────────┘    └─────────────┘    └─────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Компоненты и зоны ответственности

| Компонент | Технология | Зона ответственности |
|-----------|------------|---------------------|
| **n8n Server** | n8n self-hosted | Оркестрация всех workflows |
| **PostgreSQL** | PostgreSQL 14+ | Персистентное хранение данных |
| **Webhook Trigger** | n8n Webhook node | Приём HTTP POST от web-формы |
| **Telegram Trigger** | n8n Telegram node | Приём сообщений от Telegram Bot |
| **AI Classifier** | n8n HTTP Request | Запрос к OpenAI API |
| **CRM Writer** | n8n HTTP Request | Запись в Kommo/Bitrix24 API |
| **Follow-up Trigger** | n8n Wait + HTTP | Отложенные действия |
| **Logger** | n8n PostgreSQL node | Запись логов в БД |

### 2.3. Поток данных (Data Flow)

```
┌──────────────────────────────────────────────────────────────────┐
│                    ПОЛНЫЙ ПУТЬ ЛИДА                               │
└──────────────────────────────────────────────────────────────────┘

1. ИСТОЧНИК
   ├── Web-форма: HTTP POST → /webhook/lead
   └── Telegram: Bot API → n8n Telegram Trigger

2. ПРИЁМ И ВАЛИДАЦИЯ
   ├── Парсинг входящих данных
   ├── Валидация обязательных полей
   └── Нормализация формата

3. СОХРАНЕНИЕ (Lead Storage)
   ├── INSERT INTO leads
   ├── INSERT INTO messages
   └── Статус: 'received'

4. AI-КЛАССИФИКАЦИЯ
   ├── Формирование промпта
   ├── HTTP POST → OpenAI API
   ├── Парсинг JSON response
   └── INSERT INTO qualifications

5. МАРШРУТИЗАЦИЯ (Action Routing)
   ├── hot → immediate follow-up
   ├── warm → delayed follow-up
   ├── cold → archive
   └── spam → reject

6. CRM INTEGRATION
   ├── Создание/обновление лида в CRM
   ├── Добавление примечания
   └── INSERT INTO crm_sync

7. FOLLOW-UP (опционально)
   ├── Telegram: отправка подтверждения
   └── CRM: создание задачи менеджеру

8. ЛОГИРОВАНИЕ
   └── INSERT INTO logs

```

### 2.4. Границы систем

| Граница | Протокол | Формат данных |
|---------|----------|---------------|
| Web-форма → n8n | HTTPS POST | JSON |
| Telegram → n8n | HTTPS (Telegram API) | Telegram Update |
| n8n → OpenAI | HTTPS POST | JSON (chat completion) |
| n8n → Kommo | HTTPS REST | JSON |
| n8n → Bitrix24 | HTTPS REST | JSON |
| n8n → PostgreSQL | TCP | SQL |

---

## 3. n8n Workflows

### 3.1. Workflow: Lead Ingestion

**Назначение:** Приём лидов из внешних источников и первичная обработка.

**Триггеры:**
- Webhook Trigger (для web-формы)
- Telegram Trigger (для Telegram-бота)

**Шаги:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Trigger   │────▶│  Validate   │────▶│  Normalize  │────▶│   Store     │
│             │     │   Input     │     │   Format    │     │   Lead      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                    │
      │                    ▼
      │             ┌─────────────┐
      │             │   Error     │
      │             │   Response  │
      │             └─────────────┘
      │
      ▼
┌─────────────┐
│   Log       │
│   Event     │
└─────────────┘
```

**Входные данные (Web-форма):**
```json
{
  "name": "Имя клиента",
  "phone": "+79991234567",
  "email": "client@example.com",
  "message": "Текст обращения",
  "source": "website",
  "utm_source": "google",
  "utm_campaign": "summer2024"
}
```

**Входные данные (Telegram):**
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 123456789,
      "first_name": "Имя",
      "username": "username"
    },
    "chat": {
      "id": 123456789
    },
    "text": "Текст сообщения"
  }
}
```

**Выходные данные:**
```json
{
  "lead_id": "uuid",
  "status": "received",
  "source": "web|telegram",
  "created_at": "2026-06-10T12:00:00Z"
}
```

**Обработка ошибок:**
- Валидация обязательных полей → 400 Bad Request
- Дублирование лида → обновление существующего
- Ошибка БД → retry (3 попытки с экспоненциальной задержкой)

---

### 3.2. Workflow: Lead Classification

**Назначение:** AI-классификация лида и определение действий.

**Триггер:**
- Вызов из Lead Ingestion workflow
- Или ручной запуск по расписанию для необработанных лидов

**Шаги:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Load     │────▶│   Build     │────▶│   Call      │────▶│   Parse     │
│    Lead     │     │   Prompt    │     │   AI API    │     │   Result    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │  Fallback   │
                                        │  (rule-based)│
                                        └─────────────┘
```

**Промпт классификации:**

```markdown
Ты — AI-классификатор входящих лидов. Проанализируй обращение клиента и классифицируй его.

Обращение клиента:
{{lead_message}}

Контекст:
- Имя: {{lead_name}}
- Источник: {{lead_source}}
- Предыдущие обращения: {{previous_contacts}}

Верни результат ТОЛЬКО в формате JSON (без markdown):
{
  "lead_type": "hot|warm|cold|spam",
  "interest": "high|medium|low",
  "priority": "high|medium|low",
  "category": "service_a|service_b|other",
  "summary": "Краткое описание обращения",
  "confidence": 0.85,
  "suggested_action": "call|email|archive|reject",
  "reasoning": "Краткое обоснование"
}

Правила классификации:
1. hot — клиент готов купить/подключиться прямо сейчас, упоминает конкретные сроки
2. warm — клиент заинтересован, задаёт вопросы, требует follow-up
3. cold — клиент сомневается, сравнивает, требует времени
4. spam — нецелевое обращение, реклама, не связано с услугами
```

**Выходные данные:**
```json
{
  "lead_id": "uuid",
  "qualification": {
    "lead_type": "hot",
    "interest": "high",
    "priority": "high",
    "category": "service_a",
    "summary": "Клиент хочет подключиться в ближайшие дни",
    "confidence": 0.92,
    "suggested_action": "call",
    "reasoning": "Упоминает конкретные сроки и готовность"
  },
  "ai_model": "gpt-4o-mini",
  "processed_at": "2026-06-10T12:00:05Z",
  "processing_time_ms": 2500
}
```

**Fallback логика:**
```javascript
// При ошибке AI API применяется rule-based классификация
function fallbackClassification(message) {
  const hotKeywords = ['срочно', 'хочу купить', 'готов оплатить', 'завтра'];
  const spamKeywords = ['купить базу', 'предложение', 'реклама'];
  
  if (spamKeywords.some(k => message.toLowerCase().includes(k))) {
    return { lead_type: 'spam', priority: 'low', confidence: 0.5 };
  }
  if (hotKeywords.some(k => message.toLowerCase().includes(k))) {
    return { lead_type: 'hot', priority: 'high', confidence: 0.6 };
  }
  return { lead_type: 'warm', priority: 'medium', confidence: 0.5 };
}
```

---

### 3.3. Workflow: Lead Output

**Назначение:** Запись результатов в CRM, follow-up и логирование.

**Триггер:**
- Завершение Lead Classification workflow

**Шаги:**

```
┌─────────────┐
│   Route     │
│   by Type   │
└──────┬──────┘
       │
       ├─── hot ──────▶ ┌─────────────┐     ┌─────────────┐
       │                │ Immediate   │────▶│  CRM Task   │
       │                │ Follow-up   │     │  + Telegram │
       │                └─────────────┘     └─────────────┘
       │
       ├─── warm ─────▶ ┌─────────────┐
       │                │ Delayed     │
       │                │ Follow-up   │
       │                │ (Wait 1h)   │
       │                └─────────────┘
       │
       ├─── cold ─────▶ ┌─────────────┐
       │                │ Archive     │
       │                │ Lead        │
       │                └─────────────┘
       │
       └─── spam ─────▶ ┌─────────────┐
                        │ Reject      │
                        │ Lead        │
                        └─────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │   CRM       │
                        │   Write     │
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   Log       │
                        │   Event     │
                        └─────────────┘
```

**CRM Writer (Kommo):**
```javascript
// Создание лида в Kommo
{
  "name": "{{lead_name}}",
  "price": 0,
  "status_id": "{{status_by_priority}}",
  "pipeline_id": "{{pipeline_id}}",
  "custom_fields_values": [
    { "field_id": "lead_type_field", "values": [{ "value": "{{lead_type}}" }] },
    { "field_id": "priority_field", "values": [{ "value": "{{priority}}" }] },
    { "field_id": "confidence_field", "values": [{ "value": "{{confidence}}" }] }
  ],
  "_embedded": {
    "notes": [
      { "note_type": "common", "params": { "text": "{{summary}}" } }
    ]
  }
}
```

**CRM Writer (Bitrix24):**
```javascript
// Создание лида в Bitrix24
{
  "fields": {
    "TITLE": "Лид от {{lead_name}}",
    "NAME": "{{lead_name}}",
    "PHONE": [{ "VALUE": "{{phone}}", "VALUE_TYPE": "WORK" }],
    "EMAIL": [{ "VALUE": "{{email}}", "VALUE_TYPE": "WORK" }],
    "COMMENTS": "{{summary}}",
    "UF_CRM_LEAD_TYPE": "{{lead_type}}",
    "UF_CRM_PRIORITY": "{{priority}}",
    "SOURCE_ID": "{{source}}"
  }
}
```

---

## 4. Data Model

### 4.1. ER-диаграмма (Target Model v2 — Implemented ✅)

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
        │             │
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
         │ 1:N
         ▼
┌─────────────────┐       ┌─────────────────┐
│    messages     │       │ qualifications  │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ lead_id (FK)    │───┐   │ lead_id (FK)    │───┐
│ channel         │   │   │ lead_type       │   │
│ direction       │   │   │ interest        │   │
│ content         │   │   │ priority        │   │
│ created_at      │   │   │ confidence      │   │
└─────────────────┘   │   │ ...             │   │
                      │   └─────────────────┘   │
                      │                         │
                      └─────────────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    crm_sync     │       │  follow_ups     │       │      logs       │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ lead_id (FK)    │       │ lead_id (FK)    │       │ lead_id (FK)    │
│ crm_type        │       │ action_type     │       │ event_type      │
│ crm_lead_id     │       │ scheduled_at    │       │ event_data      │
│ sync_status     │       │ executed_at     │       │ status          │
│ sync_error      │       │ status          │       │ error_message   │
│ synced_at       │       │ result          │       │ created_at      │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 4.2. Таблица: contacts (NEW in v2)

| Колонка | Тип | Обязательно | Индекс | Описание |
|---------|-----|-------------|--------|----------|
| id | UUID | Да | PK | Идентификатор контакта |
| name | VARCHAR(255) | Нет | | Имя контакта |
| phone | VARCHAR(50) | Нет | INDEX | Телефон |
| email | VARCHAR(255) | Нет | INDEX | Email |
| company | VARCHAR(255) | Нет | | Компания |
| notes | TEXT | Нет | | Заметки |
| created_at | TIMESTAMP | Да | INDEX | Время создания |
| updated_at | TIMESTAMP | Да | | Время обновления |

**Назначение:** Каноническая сущность человека или организации. Один контакт может иметь несколько обращений (leads).

### 4.3. Таблица: channel_identities (NEW in v2)

| Колонка | Тип | Обязательно | Индекс | Описание |
|---------|-----|-------------|--------|----------|
| id | UUID | Да | PK | Идентификатор |
| contact_id | UUID | Да | FK, INDEX | Ссылка на contacts.id |
| channel | VARCHAR(50) | Да | | Канал: telegram, web, email |
| external_id | VARCHAR(255) | Да | | Внешний ID (telegram_user_id, etc.) |
| channel_data | JSONB | Нет | | Дополнительные данные канала |
| UNIQUE(channel, external_id) | | | | Уникальность идентификатора |

**Назначение:** Идентификаторы контакта в разных каналах. Гарантирует отсутствие дубликатов.

### 4.4. Таблица: leads (Updated in v2)

| Колонка | Тип | Обязательно | Индекс | Описание |
|---------|-----|-------------|--------|----------|
| id | UUID | Да | PK | Внутренний идентификатор |
| contact_id | UUID | Да | FK, INDEX | Ссылка на contacts.id (NEW in v2) |
| public_number | VARCHAR(20) | Да | UNIQUE | Человекочитаемый номер (LQ-NNNNNN) (NEW in v2) |
| source | VARCHAR(50) | Да | INDEX | Источник: web, telegram |
| status | VARCHAR(50) | Да | INDEX | received, qualified, processed, archived |
| utm_source | VARCHAR(100) | Нет | | UTM source |
| utm_campaign | VARCHAR(100) | Нет | | UTM campaign |
| created_at | TIMESTAMP | Да | INDEX | Время создания |
| updated_at | TIMESTAMP | Да | | Время обновления |

**Изменения в v2:**
- Добавлен `contact_id` — ссылка на contacts
- Добавлен `public_number` — человекочитаемый номер
- Удалены `external_id`, `name`, `phone`, `email` — перенесены в contacts

### 4.5. Таблица: messages

| Колонка | Тип | Обязательно | Индекс | Описание |
|---------|-----|-------------|--------|----------|
| id | UUID | Да | PK | Идентификатор |
| lead_id | UUID | Да | FK, INDEX | Ссылка на leads.id |
| channel | VARCHAR(50) | Да | | Канал: web, telegram |
| direction | VARCHAR(20) | Да | | inbound, outbound |
| content | TEXT | Да | | Текст сообщения |
| created_at | TIMESTAMP | Да | INDEX | Время сообщения |

### 4.6. Таблица: qualifications

| Колонка | Тип | Обязательно | Индекс | Описание |
|---------|-----|-------------|--------|----------|
| id | UUID | Да | PK | Внутренний идентификатор |
| external_id | VARCHAR(255) | Нет | UNIQUE | ID из внешней системы |
| source | VARCHAR(50) | Да | INDEX | Источник: web, telegram |
| name | VARCHAR(255) | Нет | | Имя клиента |
| phone | VARCHAR(50) | Нет | INDEX | Телефон |
| email | VARCHAR(255) | Нет | INDEX | Email |
| status | VARCHAR(50) | Да | INDEX | received, qualified, processed, archived |
| utm_source | VARCHAR(100) | Нет | | UTM source |
| utm_campaign | VARCHAR(100) | Нет | | UTM campaign |
| created_at | TIMESTAMP | Да | INDEX | Время создания |
| updated_at | TIMESTAMP | Да | | Время обновления |

### 4.3. Таблица: messages

| Колонка | Тип | Обязательно | Индекс | Описание |
|---------|-----|-------------|--------|----------|
| id | UUID | Да | PK | Идентификатор |
| lead_id | UUID | Да | FK, INDEX | Ссылка на leads.id |
| channel | VARCHAR(50) | Да | | Канал: web, telegram |
| direction | VARCHAR(20) | Да | | inbound, outbound |
| content | TEXT | Да | | Текст сообщения |
| created_at | TIMESTAMP | Да | INDEX | Время сообщения |

### 4.4. Таблица: qualifications

| Колонка | Тип | Обязательно | Индекс | Описание |
|---------|-----|-------------|--------|----------|
| id | UUID | Да | PK | Идентификатор |
| lead_id | UUID | Да | FK, INDEX | Ссылка на leads.id |
| lead_type | VARCHAR(20) | Да | INDEX | hot, warm, cold, spam |
| interest | VARCHAR(20) | Да | | high, medium, low |
| priority | VARCHAR(20) | Да | INDEX | high, medium, low |
| category | VARCHAR(50) | Нет | | Категория услуги |
| summary | TEXT | Нет | | Краткое описание |
| confidence | DECIMAL(3,2) | Да | | 0.00 - 1.00 |
| suggested_action | VARCHAR(50) | Да | | call, email, archive, reject |
| reasoning | TEXT | Нет | | Обоснование |
| ai_model | VARCHAR(50) | Да | | Модель AI |
| processing_ms | INTEGER | Нет | | Время обработки в мс |
| processed_at | TIMESTAMP | Да | INDEX | Время классификации |

### 4.5. Таблица: crm_sync (Monitoring Snapshot)

**Важно:** Kommo является SOT для сделок и задач. LQ хранит только мониторинговый snapshot.

| Колонка | Тип | Обязательно | Индекс | Описание |
|---------|-----|-------------|--------|----------|
| id | UUID | Да | PK | Идентификатор |
| lead_id | UUID | Да | FK, INDEX | Ссылка на leads.id |
| crm_type | VARCHAR(50) | Да | | kommo, bitrix24 |
| crm_lead_id | VARCHAR(100) | Нет | INDEX | ID лида в CRM (legacy) |
| sync_status | VARCHAR(20) | Да | INDEX | pending, success, failed |
| sync_error | TEXT | Нет | | Текст ошибки |
| synced_at | TIMESTAMP | Нет | | Время синхронизации |
| kommo_lead_id | BIGINT | Нет | INDEX | ID сделки в Kommo (SOT reference) |
| kommo_contact_id | BIGINT | Нет | | ID контакта в Kommo |
| kommo_pipeline_id | BIGINT | Нет | INDEX | ID воронки |
| kommo_pipeline_name | VARCHAR(255) | Нет | | Название воронки (cached) |
| kommo_status_id | BIGINT | Нет | INDEX | ID статуса |
| kommo_status_name | VARCHAR(255) | Нет | | Название статуса (cached) |
| kommo_responsible_user_id | BIGINT | Нет | | ID ответственного |
| crm_has_active_task | BOOLEAN | Нет | INDEX | Есть ли активные задачи |
| crm_closest_task_at | TIMESTAMP | Нет | INDEX | Ближайшая задача |
| crm_closed_at | TIMESTAMP | Нет | | Дата закрытия |
| crm_synced_at | TIMESTAMP | Нет | INDEX | Последняя синхронизация snapshot |
| crm_raw_snapshot | JSONB | Нет | | Полный снимок (debug, опционально) |
| initial_task_created | BOOLEAN | Нет | | Создана ли начальная задача |

**Примечание:** Задачи НЕ хранятся в LQ. Управление задачами — функция Kommo.

### 4.6. Таблица: follow_ups

| Колонка | Тип | Обязательно | Индекс | Описание |
|---------|-----|-------------|--------|----------|
| id | UUID | Да | PK | Идентификатор |
| lead_id | UUID | Да | FK, INDEX | Ссылка на leads.id |
| action_type | VARCHAR(50) | Да | | telegram_message, crm_task |
| scheduled_at | TIMESTAMP | Да | INDEX | Запланированное время |
| executed_at | TIMESTAMP | Нет | | Фактическое время |
| status | VARCHAR(20) | Да | INDEX | pending, executed, failed |
| result | TEXT | Нет | | Результат выполнения |

### 4.7. Таблица: logs

| Колонка | Тип | Обязательно | Индекс | Описание |
|---------|-----|-------------|--------|----------|
| id | UUID | Да | PK | Идентификатор |
| lead_id | UUID | Нет | FK, INDEX | Ссылка на leads.id (опционально) |
| event_type | VARCHAR(50) | Да | INDEX | Тип события |
| event_data | JSONB | Нет | | Данные события |
| status | VARCHAR(20) | Да | INDEX | success, error, warning |
| error_message | TEXT | Нет | | Сообщение об ошибке |
| created_at | TIMESTAMP | Да | INDEX | Время события |

---

## 5. API and Integration Contracts

### 5.1. Web-form Webhook

**Endpoint:** `POST /webhook/lead`

**Content-Type:** `application/json`

**Request:**
```json
{
  "name": "Иван Петров",
  "phone": "+79991234567",
  "email": "ivan@example.com",
  "message": "Хочу узнать подробнее о ваших услугах",
  "source": "website_contact_form",
  "utm_source": "google",
  "utm_campaign": "brand_awareness",
  "utm_medium": "cpc"
}
```

**Response (Success):**
```json
{
  "success": true,
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Lead received successfully",
  "created_at": "2026-06-10T12:00:00Z"
}
```

**Response (Validation Error):**
```json
{
  "success": false,
  "error": "validation_error",
  "details": {
    "field": "phone",
    "message": "Phone number is required"
  }
}
```

**Validation Rules:**
- `message` — обязательно, min 10 символов
- `phone` или `email` — хотя бы одно поле обязательно
- `source` — обязательно

---

### 5.2. Telegram Input

**Bot Commands:**
- `/start` — приветственное сообщение
- `/help` — справка

**Message Handling:**
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 123456789,
      "first_name": "Иван",
      "last_name": "Петров",
      "username": "ivan_petrov"
    },
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "date": 1718012400,
    "text": "Хочу узнать о ваших услугах"
  }
}
```

**Response to User:**
```json
{
  "chat_id": 123456789,
  "text": "Спасибо за обращение! Ваша заявка принята. Мы свяжемся с вами в ближайшее время.",
  "parse_mode": "HTML"
}
```

---

### 5.3. AI Provider Request/Response

**OpenAI API Request:**
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
      "content": "Обращение клиента: Хочу купить вашу услугу..."
    }
  ],
  "temperature": 0.3,
  "max_tokens": 500,
  "response_format": { "type": "json_object" }
}
```

**OpenAI API Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1718012400,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"lead_type\":\"hot\",\"interest\":\"high\",\"priority\":\"high\",\"category\":\"service_a\",\"summary\":\"Клиент готов к покупке\",\"confidence\":0.92,\"suggested_action\":\"call\",\"reasoning\":\"Явное намерение купить\"}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 50,
    "total_tokens": 200
  }
}
```

---

### 5.4. CRM Writer (Kommo)

**Create Lead:**
```
POST /api/v4/leads
Authorization: Bearer {{access_token}}
```

```json
{
  "name": "Иван Петров",
  "price": 0,
  "pipeline_id": 12345,
  "status_id": 54281961,
  "custom_fields_values": [
    {
      "field_id": 123456,
      "values": [{ "value": "hot" }]
    }
  ],
  "_embedded": {
    "contacts": [
      {
        "first_name": "Иван",
        "custom_fields_values": [
          {
            "field_code": "PHONE",
            "values": [{ "value": "+79991234567" }]
          }
        ]
      }
    ],
    "notes": [
      {
        "note_type": "common",
        "params": {
          "text": "AI Classification: hot (confidence: 0.92)\n\nSummary: Клиент готов к покупке"
        }
      }
    ]
  }
}
```

---

### 5.5. CRM Writer (Bitrix24)

**Create Lead:**
```
POST /rest/1/{{webhook}}/crm.lead.add
```

```json
{
  "fields": {
    "TITLE": "Лид от Иван Петров",
    "NAME": "Иван",
    "LAST_NAME": "Петров",
    "PHONE": [{ "VALUE": "+79991234567", "VALUE_TYPE": "WORK" }],
    "EMAIL": [{ "VALUE": "ivan@example.com", "VALUE_TYPE": "WORK" }],
    "COMMENTS": "AI Classification: hot (confidence: 0.92)",
    "SOURCE_ID": "WEB",
    "STATUS_ID": "NEW",
    "UF_CRM_LEAD_TYPE": "hot",
    "UF_CRM_PRIORITY": "high"
  }
}
```

---

## 6. Classification Logic

### 6.1. Input Fields for Classification

| Поле | Источник | Обязательно |
|------|----------|-------------|
| `lead_message` | messages.content | Да |
| `lead_name` | leads.name | Нет |
| `lead_phone` | leads.phone | Нет |
| `lead_email` | leads.email | Нет |
| `lead_source` | leads.source | Да |
| `previous_contacts` | COUNT(messages) | Нет |

### 6.2. Output JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["lead_type", "interest", "priority", "confidence", "suggested_action"],
  "properties": {
    "lead_type": {
      "type": "string",
      "enum": ["hot", "warm", "cold", "spam"],
      "description": "Тип лида"
    },
    "interest": {
      "type": "string",
      "enum": ["high", "medium", "low"],
      "description": "Уровень интереса"
    },
    "priority": {
      "type": "string",
      "enum": ["high", "medium", "low"],
      "description": "Приоритет обработки"
    },
    "category": {
      "type": "string",
      "description": "Категория услуги (опционально)"
    },
    "summary": {
      "type": "string",
      "description": "Краткое описание обращения"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Уверенность классификации"
    },
    "suggested_action": {
      "type": "string",
      "enum": ["call", "email", "archive", "reject"],
      "description": "Рекомендуемое действие"
    },
    "reasoning": {
      "type": "string",
      "description": "Обоснование классификации"
    }
  }
}
```

### 6.3. Classification Rules

| lead_type | confidence | suggested_action | follow-up |
|-----------|------------|------------------|-----------|
| hot | ≥ 0.7 | call | Немедленный Telegram + CRM задача |
| hot | < 0.7 | call | CRM задача (без Telegram) |
| warm | ≥ 0.6 | email | Отложенный follow-up (1 час) |
| warm | < 0.6 | email | CRM задача |
| cold | any | archive | Только логирование |
| spam | any | reject | Только логирование |

### 6.4. Fallback Logic (Rule-Based)

```javascript
// Применяется при:
// 1. Ошибка AI API (timeout, rate limit, unavailable)
// 2. Невалидный JSON в ответе
// 3. Confidence < 0.5

const RULES = {
  spam: {
    keywords: ['купить базу', 'предложение сотрудничества', 'рекламное предложение'],
    action: 'reject'
  },
  hot: {
    keywords: ['срочно', 'хочу купить', 'готов оплатить', 'завтра', 'сейчас'],
    action: 'call'
  },
  warm: {
    keywords: ['хочу узнать', 'интересует', 'подробнее', 'сколько стоит'],
    action: 'email'
  },
  cold: {
    keywords: ['может быть', 'подумаю', 'позже', 'не сейчас'],
    action: 'archive'
  }
};

function fallbackClassify(message) {
  const lower = message.toLowerCase();
  
  for (const [type, rule] of Object.entries(RULES)) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return {
        lead_type: type,
        priority: type === 'hot' ? 'high' : type === 'warm' ? 'medium' : 'low',
        confidence: 0.5,
        suggested_action: rule.action,
        source: 'fallback'
      };
    }
  }
  
  return {
    lead_type: 'warm',
    priority: 'medium',
    confidence: 0.4,
    suggested_action: 'email',
    source: 'fallback_default'
  };
}
```

---

## 7. Error Handling and Observability

### 7.1. Retry Logic

| Компонент | Retry | Backoff | Max Attempts |
|-----------|-------|---------|--------------|
| Webhook → n8n | Да | Экспоненциальный | 3 |
| n8n → PostgreSQL | Да | Экспоненциальный | 3 |
| n8n → OpenAI | Да | Экспоненциальный | 2 |
| n8n → CRM | Да | Экспоненциальный | 3 |
| Telegram Response | Да | Линейный | 2 |

**Экспоненциальный backoff:**
```
attempt 1: immediate
attempt 2: wait 1s
attempt 3: wait 2s
attempt 4: wait 4s
```

### 7.2. Failure States

| Состояние | Причина | Действие |
|-----------|---------|----------|
| `validation_failed` | Невалидные входные данные | 400 response, лог |
| `storage_failed` | Ошибка PostgreSQL | Retry → dead letter queue |
| `ai_timeout` | OpenAI timeout (> 10s) | Fallback классификация |
| `ai_error` | OpenAI API error | Fallback классификация |
| `ai_invalid_response` | Невалидный JSON | Fallback классификация |
| `crm_sync_failed` | CRM API error | Retry → пометка как failed, уведомление |
| `telegram_failed` | Telegram API error | Retry → лог, продолжить |

### 7.3. Logging Schema

```json
{
  "timestamp": "2026-06-10T12:00:00.000Z",
  "level": "info|warn|error",
  "event_type": "lead_received|lead_classified|crm_sync|follow_up",
  "lead_id": "uuid",
  "workflow": "lead-ingestion|lead-classification|lead-output",
  "node": "webhook-trigger|ai-classifier|crm-writer",
  "duration_ms": 250,
  "status": "success|error",
  "error_message": null,
  "metadata": {
    "source": "web",
    "ai_model": "gpt-4o-mini",
    "crm_type": "kommo"
  }
}
```

### 7.4. Diagnostic Queries

**Количество лидов по типам за период:**
```sql
SELECT 
  lead_type, 
  COUNT(*) as count,
  AVG(confidence) as avg_confidence
FROM qualifications
WHERE processed_at >= NOW() - INTERVAL '7 days'
GROUP BY lead_type
ORDER BY count DESC;
```

**Ошибки синхронизации с CRM:**
```sql
SELECT 
  crm_type,
  sync_error,
  COUNT(*) as count
FROM crm_sync
WHERE sync_status = 'failed'
  AND synced_at >= NOW() - INTERVAL '24 hours'
GROUP BY crm_type, sync_error
ORDER BY count DESC;
```

**Среднее время обработки:**
```sql
SELECT 
  DATE(processed_at) as date,
  AVG(processing_ms) as avg_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_ms) as p95_ms
FROM qualifications
WHERE processed_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(processed_at)
ORDER BY date;
```

### 7.5. Admin UI (Minimal)

**Dashboard:**
- Количество лидов за сегодня / неделю
- Распределение по типам (pie chart)
- Последние ошибки (table)
- Статус CRM-синхронизации

**Logs View:**
- Фильтрация по дате
- Фильтрация по event_type
- Фильтрация по status
- Поиск по lead_id

---

## 8. Implementation Phases

### 8.1. Этап 1: Infrastructure (День 1)

**Цель:** Подготовить инфраструктуру для развёртывания.

**Задачи:**

| # | Задача | Результат |
|---|--------|-----------|
| 1.1 | Развёртывание PostgreSQL на VPS | База данных доступна |
| 1.2 | Создание схемы БД (таблицы) | Таблицы созданы |
| 1.3 | Развёртывание n8n на VPS | n8n доступен по URL |
| 1.4 | Настройка переменных окружения | API ключи безопасно хранятся |

**Критерии готовности:**
- [x] PostgreSQL принимает подключения
- [x] Таблицы созданы согласно Data Model v2
- [x] n8n UI доступен
- [x] Переменные окружения настроены

---

### 8.2. Этап 2: Input Channels (День 2)

**Цель:** Обеспечить приём лидов из двух каналов.

**Задачи:**

| # | Задача | Результат |
|---|--------|-----------|
| 2.1 | Создание Webhook workflow | Web-форма → n8n работает |
| 2.2 | Создание Telegram Bot | Bot Token получен |
| 2.3 | Создание Telegram Trigger workflow | Telegram → n8n работает |
| 2.4 | Валидация входящих данных | Невалидные данные отклоняются |
| 2.5 | Сохранение в PostgreSQL | Лиды сохраняются в БД |

**Критерии готовности:**
- [x] HTTP POST /webhook/lead принимает данные
- [x] Telegram бот отвечает на /start
- [x] Лиды сохраняются в таблицу leads
- [x] Сообщения сохраняются в таблицу messages

---

### 8.3. Этап 3: AI Classification (День 3-4)

**Цель:** Реализовать AI-классификацию с fallback.

**Задачи:**

| # | Задача | Результат |
|---|--------|-----------|
| 3.1 | Создание промпта классификации | Промпт протестирован |
| 3.2 | Интеграция с OpenAI API | Запросы выполняются |
| 3.3 | Парсинг JSON ответа | Структура валидируется |
| 3.4 | Реализация fallback логики | Fallback работает при ошибках |
| 3.5 | Сохранение результатов | qualifications заполняется |

**Критерии готовности:**
- [x] Классификация выполняется за < 5 сек
- [x] JSON валиден и соответствует схеме
- [x] Fallback срабатывает при ошибках AI
- [x] Confidence записывается в БД

---

### 8.4. Этап 4: CRM Integration (Phase 006)

**Цель:** Обеспечить запись результатов в CRM.

**Статус:** ⏳ Pending (Phase 006)

**Задачи:**

| # | Задача | Результат |
|---|--------|-----------|
| 4.1 | Выбор CRM (Kommo или Bitrix24) | CRM определена |
| 4.2 | Создание тестового аккаунта CRM | Доступ к API есть |
| 4.3 | Реализация CRM Writer node | Лиды создаются в CRM |
| 4.4 | Маппинг полей | Поля корректно передаются |
| 4.5 | Обработка ошибок | Retry + логирование |

**Критерии готовности:**
- [ ] Лид создаётся в CRM
- [ ] Поля квалификации передаются
- [ ] Примечание с summary добавляется
- [ ] crm_sync заполняется

---

### 8.4.1. CRM Snapshot Monitoring (Phase 006 Extension)

**Цель:** Мониторинг состояния сделок в CRM без дублирования.

**Принцип:**
- Kommo остаётся Source of Truth для управления сделками
- LQ хранит только snapshot для операционного мониторинга
- Snapshot синхронизируется периодически

**Таблица crm_sync (расширенная):**

| Поле | Тип | Описание |
|------|-----|----------|
| kommo_lead_id | BIGINT | ID сделки в Kommo |
| kommo_contact_id | BIGINT | ID контакта в Kommo |
| kommo_pipeline_id | BIGINT | ID воронки |
| kommo_pipeline_name | VARCHAR(255) | Название воронки (cached) |
| kommo_status_id | BIGINT | ID статуса |
| kommo_status_name | VARCHAR(255) | Название статуса (cached) |
| kommo_responsible_user_id | BIGINT | ID ответственного |
| crm_has_active_task | BOOLEAN | Есть активные задачи |
| crm_closest_task_at | TIMESTAMP | Ближайшая задача |
| crm_closed_at | TIMESTAMP | Дата закрытия |
| crm_synced_at | TIMESTAMP | Последняя синхронизация |
| crm_raw_snapshot | JSONB | Полный снимок (debug) |
| initial_task_created | BOOLEAN | Создана начальная задача |

**Таблица crm_tasks (новая):**

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | ID записи |
| lead_id | UUID | Ссылка на leads.id |
| crm_sync_id | UUID | Ссылка на crm_sync.id |
| kommo_task_id | BIGINT | ID задачи в Kommo |
| task_type | VARCHAR(50) | Тип: call, meeting, email |
| task_text | TEXT | Текст задачи |
| due_at | TIMESTAMP | Срок выполнения |
| completed | BOOLEAN | Выполнена ли |
| created_at | TIMESTAMP | Создана |

---

### 8.4.2. Initial Task Creation (Phase 006)

**Цель:** Создание начальной задачи менеджера после создания сделки.

**Правила по типу лида:**

| Lead Type | Действие | Срок задачи |
|-----------|----------|-------------|
| **Hot** | Создать задачу "Связаться" | +15 минут |
| **Warm** | Создать задачу "Связаться" | +24 часа |
| **Cold** | Создать задачу "Связаться" | +7 дней |
| **Spam** | Задача не создаётся | — |

**Spam обработка:**
- Сделка переводится в закрытый статус (Lost/Spam)
- Причина закрытия записывается в примечание
- Задача не создаётся

**Kommo Task API:**

```javascript
// Создание задачи в Kommo
POST /api/v4/tasks
{
  "task_type_id": 1,  // 1 = Звонок
  "entity_id": "{{lead_id}}",
  "entity_type": "leads",
  "complete_till": "{{due_timestamp}}",
  "text": "Связаться с клиентом ({{lead_type}})"
}
```

---

### 8.4.3. CRM Sync Workflow (Phase 006)

**Цель:** Периодическая синхронизация snapshot сделок.

**Workflow: CRM Status Sync**

**Триггер:** Schedule (каждые 15 минут)

**Шаги:**

```
┌─────────────────────┐
│  Schedule Trigger   │
│  (every 15 min)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Query: Get Active  │
│  CRM Sync Records   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  For Each Record:   │
│  ┌─────────────────┐│
│  │ Kommo API       ││
│  │ GET /leads/{id} ││
│  └────────┬────────┘│
│           │         │
│           ▼         │
│  ┌─────────────────┐│
│  │ Extract:        ││
│  │ - pipeline      ││
│  │ - status        ││
│  │ - responsible   ││
│  │ - closest_task  ││
│  │ - closed_at     ││
│  └────────┬────────┘│
│           │         │
│           ▼         │
│  ┌─────────────────┐│
│  │ Update:         ││
│  │ crm_sync table  ││
│  └────────┬────────┘│
└───────────┼─────────┘
            │
            ▼
┌─────────────────────┐
│  Log Sync Result    │
└─────────────────────┘
```

**Синхронизируемые поля:**

1. `kommo_pipeline_id` / `kommo_pipeline_name`
2. `kommo_status_id` / `kommo_status_name`
3. `kommo_responsible_user_id`
4. `crm_has_active_task`
5. `crm_closest_task_at`
6. `crm_closed_at`
7. `crm_synced_at` (timestamp)
8. `crm_raw_snapshot` (опционально, для debug)

**Рекомендуемая частота:**

| Параметр | Значение | Обоснование |
|----------|----------|-------------|
| Минимум | 5 минут | Для hot leads |
| Оптимально | 15 минут | Баланс нагрузки |
| Максимум | 60 минут | Для low-activity |

**Admin UI отображение:**

```
CRM Pipeline: Воронка продаж
CRM Status: Первичный контакт
Responsible User: ID 12345
Active Task: ✓ Да
Next Task Due: 2026-06-15 10:30
Closed At: —
Last CRM Sync: 2026-06-15 09:45
```

---

### 8.5. Этап 5: Follow-up & Logging (Phase 007)

**Цель:** Реализовать follow-up и полное логирование.

**Статус:** ⏳ Pending (Phase 007)

**Задачи:**

| # | Задача | Результат |
|---|--------|-----------|
| 5.1 | Реализация Telegram follow-up | Клиент получает подтверждение |
| 5.2 | Реализация CRM task creation | Задачи создаются для менеджера |
| 5.3 | Полное логирование | Все события логируются |
| 5.4 | Минимальный Admin UI | Логи просматриваются |

**Критерии готовности:**
- [ ] Telegram ответ отправляется для hot/warm
- [ ] CRM задачи создаются для hot
- [ ] Таблица logs заполняется
- [ ] Admin UI показывает последние логи

---

### 8.6. Этап 6: Demo & Polish (Phase 005 — Completed)

**Цель:** Подготовить кейс к демонстрации.

**Статус:** ✅ Complete

**Задачи:**

| # | Задача | Результат |
|---|--------|-----------|
| 6.1 | End-to-end тестирование | Полный путь лида работает |
| 6.2 | Создание демо-формы | Форма доступна публично |
| 6.3 | Запись демо-видео | Видео 2-3 мин готово |
| 6.4 | Написание README | README оформлен |
| 6.5 | Экспорт workflow | JSON готов к публикации |

**Критерии готовности:**
- [x] Демо-сценарий проходит успешно
- [ ] Видео загружено
- [x] README содержит скриншоты
- [x] Workflow JSON экспортирован

---

## 9. Acceptance Criteria

### 9.1. MVP Acceptance Criteria

#### Phase 1: Input Channels MVP ✅

| # | Критерий | Проверка | Статус |
|---|----------|----------|--------|
| 1 | Лид проходит классификацию за < 5 секунд | Замер времени | ✅ |
| 2 | Точность классификации > 80% на тестовом наборе | Тестовый набор 50 лидов | ✅ |
| 3 | Web-форма приём работает | POST → lead сохранён | ✅ |
| 4 | Telegram приём работает | Message → lead сохранён | ✅ |
| 5 | PostgreSQL хранит все данные | SQL query | ✅ |
| 6 | Fallback работает при ошибке AI | Отключить API → fallback | ✅ |
| 7 | Все операции логируются | logs table не пуста | ✅ |
| 8 | Публичный UI доступен | https://lead-qual.alex-n8n.site/ | ✅ |
| 9 | Data Model v2 реализована | contacts, channel_identities | ✅ |

#### Phase 2: Full MVP ⏳

| # | Критерий | Проверка | Статус |
|---|----------|----------|--------|
| 1 | Интеграция с CRM работает | Создание лида в CRM | ❌ Phase 006 |
| 2 | Follow-up автоматизация работает | Telegram + CRM tasks | ❌ Phase 007 |

### 9.2. Portfolio Case Acceptance Criteria

| # | Критерий | Проверка | Статус |
|---|----------|----------|--------|
| 1 | README с описанием | Файл существует | ✅ |
| 2 | Скриншоты workflow | 3+ скриншота | ❌ |
| 3 | Демо-видео 2-3 мин | Видео доступно | ❌ |
| 4 | Workflow JSON для публикации | Файл существует | ✅ |
| 5 | Документация по настройке | docs/setup.md | ❌ |
| 6 | Примеры промптов | docs/prompts.md | ❌ |
| 7 | Тестовые лиды | tests/test-leads.json | ✅ |

### 9.3. Demo Scenario Checklist

#### Phase 1: Input Channels MVP ✅

| # | Шаг | Ожидаемый результат | Статус |
|---|-----|---------------------|--------|
| 1 | Открыть демо-форму | Форма загружается | ✅ |
| 2 | Заполнить и отправить | "Успешно отправлено" | ✅ |
| 3 | Проверить PostgreSQL | Лид в таблице leads | ✅ |
| 4 | Проверить AI результат | Запись в qualifications | ✅ |
| 5 | Проверить Telegram | Подтверждение получено | ✅ |
| 6 | Проверить логи | События в logs | ✅ |

#### Phase 2: Full MVP ⏳

| # | Шаг | Ожидаемый результат | Статус |
|---|-----|---------------------|--------|
| 1 | Проверить CRM | Лид создан с полями | ❌ Phase 006 |
| 2 | Проверить follow-up | Автоматический ответ | ❌ Phase 007 |

---

## 10. Risks and Decisions

### 10.1. Technical Risks

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| OpenAI API rate limits | Средняя | Высокое | Fallback на rule-based, batching |
| OpenAI API unavailable | Низкая | Высокое | Fallback + retry |
| CRM API changes | Низкая | Среднее | Версионирование API, мониторинг |
| PostgreSQL performance | Низкая | Среднее | Индексы, connection pooling |
| VPS resource limits | Средняя | Среднее | Мониторинг, autoscaling |
| Telegram Bot webhook issues | Низкая | Низкое | Polling как backup |

### 10.2. Architectural Decisions Required

| Решение | Варианты | Рекомендация | Статус |
|---------|----------|--------------|--------|
| Выбор CRM для MVP | Kommo vs Bitrix24 | Bitrix24 (лучше документация) | ❌ |
| Выбор AI провайдера | OpenAI vs Claude vs GigaChat | OpenAI (основной), другие (резерв) | ❌ |
| Размещение Admin UI | n8n built-in vs отдельное | n8n built-in для MVP | ❌ |
| Формат демо-формы | Отдельная страница vs embed | Отдельная страница | ❌ |

### 10.3. Decisions That Can Be Deferred

| Решение | Почему можно отложить |
|---------|----------------------|
| Мультиязычность промптов | Не требуется для демо |
| Вторая CRM интеграция | MVP требует только одну |
| Мультиагентная классификация | Усложнение для v2 |
| A/B тестирование промптов | Требует аналитики |
| Вебхуки в CRM (bidirectional) | MVP单向 |

### 10.4. Open Questions

| # | Вопрос | Контекст | Решение до |
|---|--------|----------|------------|
| 1 | Какой бюджет на OpenAI API? | ~$0.15/1K tokens | Начало разработки |
| 2 | Есть ли доступ к VPS? | Требуется для n8n | Начало разработки |
| 3 | Какую CRM используют целевые заказчики? | Kommo vs Bitrix24 | Этап 4 |
| 4 | Нужен ли мультиязычный бот? | ES для Перу | Пост-MVP |

---

## Приложение A: Environment Variables

```bash
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=lead_qualification
POSTGRES_USER=n8n
POSTGRES_PASSWORD=***

# n8n
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=***

# OpenAI
OPENAI_API_KEY=sk-***

# Telegram
TELEGRAM_BOT_TOKEN=***

# CRM (выбрать одну)
KOMMO_ACCESS_TOKEN=***
KOMMO_SUBDOMAIN=yourcompany

# или
BITRIX24_WEBHOOK_URL=https://yourcompany.bitrix24.ru/rest/1/***/

# App
APP_ENV=production
LOG_LEVEL=info
```

---

## Приложение B: Test Leads Dataset

```json
[
  {
    "name": "Тест Хот",
    "phone": "+79991111111",
    "message": "Хочу купить вашу услугу прямо сейчас, готов оплатить сегодня",
    "expected_type": "hot",
    "expected_priority": "high"
  },
  {
    "name": "Тест Варм",
    "phone": "+79992222222",
    "message": "Интересует ваш продукт, расскажите подробнее о возможностях",
    "expected_type": "warm",
    "expected_priority": "medium"
  },
  {
    "name": "Тест Колд",
    "phone": "+79993333333",
    "message": "Может быть позже вернусь к вам, пока думаю",
    "expected_type": "cold",
    "expected_priority": "low"
  },
  {
    "name": "Тест Спам",
    "phone": "+79994444444",
    "message": "Предлагаю купить базу контактов для вашего бизнеса",
    "expected_type": "spam",
    "expected_priority": "low"
  }
]
```

---

**Конец IMPLEMENTATION_PLAN**

*План разработан на основании SPEC v1.2*
*Дата: 2026-06-12*