# Сквозные сценарии Lead Qualification MVP

Документ описывает основные E2E (End-to-End) сценарии работы системы Lead Qualification MVP. Каждый сценарий показывает полный путь лида от источника до результата в CRM.

---

## Визуальная демонстрация системы

### Путь Website-лида

```
Website Form → Lead Ingestion → AI Classification → Kommo CRM → Dashboard
```

**Шаг 1: Форма заявки**

![Website: Empty Form](screenshots/website-form-empty.png)

**Шаг 2: Заполнение**

![Website: Filled Form](screenshots/website-form-filled.png)

**Шаг 3: Обработка**

![Website: Request](screenshots/website-form-request.png)

**Шаг 4: Успех**

![Website: Success](screenshots/website-form-success.png)

---

### Путь Telegram-лида

```
Telegram Bot → Lead Ingestion → AI Classification → Kommo CRM → Dashboard
```

**Диалог с ботом**

![Telegram: Hot Lead](screenshots/telegram-lead-hot.png)

---

### AI Classification

```
Lead Ingestion → Classification Workflow → Qualification Table
```

**Workflow в n8n**

![n8n: Classification](screenshots/workflow-lead-classification-mvp.png)

---

### CRM Integration

```
Qualified Lead → Kommo Writer Workflow → Kommo Deal + Task
```

**Workflow в n8n**

![n8n: Kommo Writer](screenshots/workflow-kommo-writer-mvp.png)

**Результат в Kommo**

![Kommo: Hot Deal](screenshots/commo-deal-hot.png)

---

### Мониторинг через Admin Console

**Dashboard**

![Dashboard: Overview](screenshots/dashboard-overview.png)

**Lead Queue: Горячие лиды**

![Lead Queue: Hot](screenshots/lead-queue-hot.png)

**Lead Queue: Тёплые лиды**

![Lead Queue: Warm](screenshots/lead-queue-warm.png)

**Lead Queue: Холодные лиды**

![Lead Queue: Cold](screenshots/lead-queue-cold.png)

---

## Общая схема пути лида

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           ИСТОЧНИК                                        │
│   Website (HTTP POST)  или  Telegram Bot (Message)                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        LEAD INGESTION                                     │
│   n8n: Lead Ingestion V2 (webhook) или Lead Ingestion Telegram            │
│   - Валидация данных                                                      │
│   - Find/Create Contact                                                   │
│   - Create Lead (LQ-NNNNNN)                                               │
│   - Create Message                                                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        AI CLASSIFICATION                                  │
│   n8n: Lead Classification MVP (Schedule 5 min)                          │
│   - Query leads (status=received)                                        │
│   - Build prompt                                                          │
│   - Call OpenAI API                                                       │
│   - Fallback (rule-based) если нужно                                      │
│   - Save qualification                                                     │
│   - Update lead status                                                    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        CRM INTEGRATION                                     │
│   n8n: Lead CRM Sync - Kommo Writer MVP                                   │
│   - Create Kommo Lead (deal)                                              │
│   - Create Kommo Contact                                                  │
│   - Add Note (summary, confidence)                                        │
│   - Create Initial Task                                                   │
│   - Save to crm_sync                                                      │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        MANAGER TASK                                        │
│   Kommo: Task for manager                                                 │
│   - Hot: +15 минут                                                        │
│   - Warm: +24 часа                                                        │
│   - Cold: +7 дней                                                         │
│   - Spam: сделка закрыта                                                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        MONITORING                                          │
│   n8n: CRM Status Sync MVP (Schedule 15 min)                              │
│   - Update crm_sync snapshot                                              │
│   - Admin Console displays status                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Сценарий 1: Website → Hot Lead

### Описание

Клиент оставляет заявку через Website форму с текстом, указывающим на готовность купить немедленно.

### Входные данные

```json
{
  "name": "Иван Петров",
  "phone": "+79991234567",
  "email": "ivan@example.com",
  "message": "Хочу купить вашу услугу прямо сейчас, готов оплатить сегодня. Перезвоните мне срочно!"
}
```

### Шаги

| Шаг | Компонент | Действие | Результат |
|-----|-----------|----------|----------|
| 1 | Client UI | Клиент заполняет форму и отправляет | POST /webhook/lead |
| 2 | Lead Ingestion V2 | Приём webhook, валидация | Lead создан: LQ-000123 |
| 3 | PostgreSQL | Сохранение | leads, messages заполнены |
| 4 | Lead Classification | AI-классификация (до 5 мин) | lead_type=hot, confidence=0.94 |
| 5 | PostgreSQL | Сохранение квалификации | qualifications заполнена |
| 6 | Kommo Writer | Создание сделки | Kommo Lead ID: 12345678 |
| 7 | Kommo Writer | Создание задачи | Task: +15 минут |
| 8 | PostgreSQL | Сохранение crm_sync | crm_sync заполнена |
| 9 | Admin Console | Отображение | Dashboard показывает Hot Lead |

### AI Response

```json
{
  "lead_type": "hot",
  "interest": "high",
  "priority": "high",
  "category": "service_a",
  "summary": "Клиент готов к покупке, упоминает срочность и готовность оплатить сегодня",
  "confidence": 0.94,
  "suggested_action": "call",
  "reasoning": "Ключевые слова 'прямо сейчас', 'готов оплатить', 'срочно' указывают на высокую готовность к покупке"
}
```

### Kommo Result

- **Pipeline:** Входящие лиды
- **Status:** Hot Lead
- **Task:** Звонок клиенту, срок +15 минут
- **Note:** "AI Classification: hot (confidence: 0.94). Клиент готов к покупке..."

### Ответ клиенту

> Спасибо! Ваша заявка принята. Номер обращения: **LQ-000123**
>
> Менеджер свяжется с вами в ближайшее время.

---

## Сценарий 2: Telegram → Hot Lead

### Описание

Клиент пишет в Telegram-бот с запросом, указывающим на высокую заинтересованность.

### Входные данные

```
Telegram Message:
User ID: 123456789
Name: Алексей
Text: "Здравствуйте! Хочу заказать ваши услуги, готов начать работу уже завтра"
```

### Шаги

| Шаг | Компонент | Действие | Результат |
|-----|-----------|----------|----------|
| 1 | Telegram Bot | Клиент отправляет сообщение | Telegram Trigger |
| 2 | Lead Ingestion Telegram | Парсинг, создание лида | Lead создан: LQ-000124 |
| 3 | PostgreSQL | Сохранение | leads, messages заполнены |
| 4 | Lead Classification | AI-классификация | lead_type=hot, confidence=0.88 |
| 5 | Kommo Writer | Создание сделки + задача | Task: +15 минут |
| 6 | Telegram Bot | Отправка подтверждения | "Заявка принята: LQ-000124" |

### Ответ в Telegram

> ✅ Заявка принята!
>
> Номер обращения: **LQ-000124**
>
> Менеджер свяжется с вами в ближайшее время.

---

## Сценарий 3: Website → Warm Lead

### Описание

Клиент оставляет заявку с вопросом, указывая заинтересованность, но не готовность купить немедленно.

### Входные данные

```json
{
  "name": "Мария Иванова",
  "phone": "+79998765432",
  "email": "maria@example.com",
  "message": "Добрый день! Интересуют ваши услуги, расскажите подробнее о возможностях и ценах"
}
```

### Шаги

| Шаг | Компонент | Действие | Результат |
|-----|-----------|----------|----------|
| 1 | Client UI | Отправка формы | POST /webhook/lead |
| 2 | Lead Ingestion V2 | Создание лида | LQ-000125 |
| 3 | Lead Classification | AI-классификация | lead_type=warm, confidence=0.82 |
| 4 | Kommo Writer | Создание сделки | Status: Warm Lead |
| 5 | Kommo Writer | Создание задачи | Task: +24 часа |

### AI Response

```json
{
  "lead_type": "warm",
  "interest": "high",
  "priority": "medium",
  "summary": "Клиент заинтересован, задаёт вопросы о возможностях и ценах, нужен follow-up",
  "confidence": 0.82,
  "suggested_action": "email",
  "reasoning": "Ключевые слова 'интересуют', 'расскажите подробнее' указывают на заинтересованность без срочности"
}
```

### Kommo Result

- **Pipeline:** Входящие лиды
- **Status:** Warm Lead
- **Task:** Звонок клиенту, срок +24 часа

---

## Сценарий 4: Telegram → Cold Lead

### Описание

Клиент пишет в Telegram с неопределённым интересом, возможно сравнивает варианты.

### Входные данные

```
Telegram Message:
User ID: 987654321
Name: Дмитрий
Text: "Привет, думаю насчёт вашей услуги, может быть закажу позже"
```

### Шаги

| Шаг | Компонент | Действие | Результат |
|-----|-----------|----------|----------|
| 1 | Telegram Bot | Приём сообщения | Telegram Trigger |
| 2 | Lead Ingestion Telegram | Создание лида | LQ-000126 |
| 3 | Lead Classification | AI-классификация | lead_type=cold, confidence=0.75 |
| 4 | Kommo Writer | Создание сделки | Status: Cold Lead |
| 5 | Kommo Writer | Создание задачи | Task: +7 дней |

### AI Response

```json
{
  "lead_type": "cold",
  "interest": "low",
  "priority": "low",
  "summary": "Клиент сомневается, откладывает решение, нужен длительный follow-up",
  "confidence": 0.75,
  "suggested_action": "archive",
  "reasoning": "Ключевые слова 'думаю', 'может быть', 'позже' указывают на низкую готовность"
}
```

### Kommo Result

- **Pipeline:** Входящие лиды
- **Status:** Cold Lead
- **Task:** Звонок клиенту, срок +7 дней

---

## Сценарий 5: Website → Spam

### Описание

Обращение, не связанное с целевой деятельностью (рекламное предложение, продажа базы и т.п.).

### Входные данные

```json
{
  "name": "Реклама",
  "phone": "+79000000000",
  "email": "spam@example.com",
  "message": "Предлагаю купить базу контактов для вашего бизнеса, отличные цены!"
}
```

### Шаги

| Шаг | Компонент | Действие | Результат |
|-----|-----------|----------|----------|
| 1 | Client UI | Отправка формы | POST /webhook/lead |
| 2 | Lead Ingestion V2 | Создание лида | LQ-000127 |
| 3 | Lead Classification | AI-классификация | lead_type=spam, confidence=0.96 |
| 4 | Kommo Writer | Создание сделки | Status: Closed (Spam) |
| 5 | Kommo Writer | Задача НЕ создаётся | — |

### AI Response

```json
{
  "lead_type": "spam",
  "interest": "none",
  "priority": "low",
  "summary": "Рекламное предложение, нецелевое обращение",
  "confidence": 0.96,
  "suggested_action": "reject",
  "reasoning": "Ключевые слова 'купить базу', 'предлагаю' указывают на спам/рекламу"
}
```

### Kommo Result

- **Pipeline:** Closed
- **Status:** Spam
- **Task:** Не создаётся

---

## Сценарий 6: AI Fallback (OpenAI недоступен)

### Описание

Сценарий, когда OpenAI API недоступен или возвращает ошибку. Система использует rule-based fallback.

### Триггер

- OpenAI API timeout (> 10s)
- OpenAI API rate limit
- OpenAI API error (500, 502, 503)
- Invalid JSON в ответе

### Fallback Logic

```javascript
function fallbackClassify(message) {
  const lower = message.toLowerCase();

  // Spam keywords
  if (['купить базу', 'предложение', 'реклама'].some(k => lower.includes(k))) {
    return { lead_type: 'spam', confidence: 0.5, source: 'fallback' };
  }

  // Hot keywords
  if (['срочно', 'хочу купить', 'готов оплатить', 'завтра'].some(k => lower.includes(k))) {
    return { lead_type: 'hot', confidence: 0.6, source: 'fallback' };
  }

  // Warm keywords
  if (['интересует', 'подробнее', 'сколько стоит'].some(k => lower.includes(k))) {
    return { lead_type: 'warm', confidence: 0.6, source: 'fallback' };
  }

  // Cold keywords
  if (['подумаю', 'может быть', 'позже'].some(k => lower.includes(k))) {
    return { lead_type: 'cold', confidence: 0.6, source: 'fallback' };
  }

  // Default
  return { lead_type: 'warm', confidence: 0.4, source: 'fallback_default' };
}
```

### Результат

- Квалификация сохраняется с пометкой `source: 'fallback'`
- Confidence обычно ниже (0.4–0.6)
- Менеджер может проверить вручную

---

## Сценарий 7: CRM Status Sync

### Описание

Периодическая синхронизация snapshot из Kommo для мониторинга.

### Триггер

Schedule: каждые 15 минут

### Шаги

| Шаг | Компонент | Действие | Результат |
|-----|-----------|----------|----------|
| 1 | CRM Status Sync | Query crm_sync | Список активных записей |
| 2 | CRM Status Sync | For each: GET /leads/{id} | Kommo API вызов |
| 3 | CRM Status Sync | Extract: pipeline, status, tasks | Данные сделки |
| 4 | PostgreSQL | Update crm_sync | Snapshot обновлён |
| 5 | Admin Console | Display | Актуальные данные |

### Обновляемые поля

| Поле | Источник |
|------|----------|
| kommo_pipeline_id | Kommo lead.pipeline_id |
| kommo_pipeline_name | Kommo pipeline.name |
| kommo_status_id | Kommo lead.status_id |
| kommo_status_name | Kommo status.name |
| kommo_responsible_user_id | Kommo lead.responsible_user_id |
| crm_has_active_task | Kommo lead.closest_task_at |
| crm_closest_task_at | Kommo lead.closest_task_at |
| crm_closed_at | Kommo lead.closed_at |
| crm_synced_at | NOW() |

---

## Сводная таблица сценариев

| Сценарий | Источник | Тип | Confidence | Задача |
|----------|----------|-----|------------|--------|
| 1 | Website | Hot | 0.94 | +15 мин |
| 2 | Telegram | Hot | 0.88 | +15 мин |
| 3 | Website | Warm | 0.82 | +24 часа |
| 4 | Telegram | Cold | 0.75 | +7 дней |
| 5 | Website | Spam | 0.96 | Не создаётся |
| 6 | Any | Fallback | 0.4–0.6 | По типу |
| 7 | — | Sync | — | — |