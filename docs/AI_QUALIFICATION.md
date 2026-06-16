# AI-классификация в Lead Qualification MVP

Документ описывает логику работы AI-классификатора в системе Lead Qualification MVP: категории лидов, приоритеты, рекомендации, confidence, SLA и роль AI в системе.

---

## 1. Роль AI-классификации в системе

### 1.1. Назначение

AI-классификация выполняет функцию **автоматической квалификации входящих лидов** без участия человека. Система определяет:

- **Тип лида** (hot/warm/cold/spam)
- **Уровень интереса** (high/medium/low)
- **Приоритет обработки** (high/medium/low)
- **Рекомендуемое действие** (call/email/archive/reject)
- **Уверенность классификации** (0.00–1.00)

### 1.2. Место в архитектуре

```
Lead Ingestion (Web/Telegram)
         ↓
   PostgreSQL (lead created)
         ↓
   AI Classification ←── OpenAI API
         ↓
   Fallback (rule-based) ←── при ошибке AI
         ↓
   PostgreSQL (qualification saved)
         ↓
   CRM Writer (Kommo)
```

### 1.3. Ключевой принцип

**AI не принимает бизнес-решения произвольно.** AI работает в рамках:

- Заданной JSON Schema
- Определённых категорий (hot/warm/cold/spam)
- Ключевых слов и паттернов

Результат AI предсказуем и аудируем.

---

## 2. Категории лидов

### 2.1. Hot Lead (Горячий)

**Определение:** Клиент готов к покупке немедленно или в ближайшее время.

**Признаки:**
- Упоминает конкретные сроки ("завтра", "сегодня", "срочно")
- Готов оплатить ("готов оплатить", "хочу купить")
- Явное намерение ("хочу заказать", "оформите")

**Ключевые слова:**
```
срочно, хочу купить, готов оплатить, завтра, сегодня,
закажу, оформите, немедленно, прямо сейчас,急需
```

**AI Confidence:** Обычно 0.85–0.98

**CRM Status:** Hot Lead

**Задача менеджеру:** +15 минут

**Действие менеджера:** Немедленный звонок

---

### 2.2. Warm Lead (Тёплый)

**Определение:** Клиент заинтересован, задаёт вопросы, но не готов к немедленной покупке.

**Признаки:**
- Интерес к услуге ("интересует", "хочу узнать")
- Вопросы ("сколько стоит", "как работает", "расскажите")
- Сравнение ("сравниваю", "думаю")

**Ключевые слова:**
```
интересует, хочу узнать, расскажите подробнее,
сколько стоит, как работает, какие условия,
сравниваю, изучаю, рассматриваю
```

**AI Confidence:** Обычно 0.70–0.90

**CRM Status:** Warm Lead

**Задача менеджеру:** +24 часа

**Действие менеджера:** Звонок или email для уточнения

---

### 2.3. Cold Lead (Холодный)

**Определение:** Клиент сомневается, не готов к решению, откладывает.

**Признаки:**
- Неопределённость ("может быть", "подумаю")
- Откладывание ("позже", "через месяц")
- Низкий интерес ("просто смотрю", "любопытно")

**Ключевые слова:**
```
подумаю, может быть, позже, не сейчас,
через месяц, пока не готов, сомневаюсь,
просто смотрю, любопытно
```

**AI Confidence:** Обычно 0.60–0.80

**CRM Status:** Cold Lead

**Задача менеджеру:** +7 дней

**Действие менеджера:** Follow-up через неделю

---

### 2.4. Spam (Спам)

**Определение:** Нецелевое обращение, реклама, предложение услуг.

**Признаки:**
- Реклама ("предлагаю", "купите")
- Нецелевое ("база контактов", "партнёрство")
- Автоматическое ("откройте файл")

**Ключевые слова:**
```
предлагаю, купить базу, партнёрство,
рекламное предложение, откройте файл,
зарабатывайте, инвестиции
```

**AI Confidence:** Обычно 0.90–0.99

**CRM Status:** Closed (Spam)

**Задача менеджеру:** Не создаётся

**Действие:** Отклонить

---

## 3. Приоритеты обработки

### 3.1. High Priority

**Условия:**
- lead_type = hot
- ИЛИ confidence > 0.9

**SLA:** Обработка в течение 15 минут

**Действие:** Немедленный звонок менеджера

---

### 3.2. Medium Priority

**Условия:**
- lead_type = warm
- ИЛИ confidence 0.7–0.9

**SLA:** Обработка в течение 24 часов

**Действие:** Звонок или email в течение дня

---

### 3.3. Low Priority

**Условия:**
- lead_type = cold
- ИЛИ confidence < 0.7

**SLA:** Обработка в течение 7 дней

**Действие:** Follow-up через неделю

---

## 4. Confidence (Уверенность)

### 4.1. Значения

| Уровень | Диапазон | Интерпретация |
|---------|----------|---------------|
| **Высокая** | 0.80–1.00 | Классификация надёжна, можно действовать автоматически |
| **Средняя** | 0.60–0.80 | Классификация вероятна, рекомендуется проверка |
| **Низкая** | 0.40–0.60 | Классификация неуверенная, нужен manual review |
| **Fallback** | 0.00–0.40 | AI не использовался, rule-based классификация |

### 4.2. Факторы, влияющие на confidence

| Фактор | Влияние |
|--------|---------|
| **Чёткие ключевые слова** | Повышает confidence |
| **Длина сообщения** | Длинные сообщения → выше confidence |
| **Неоднозначность** | Понижает confidence |
| **Смешанные сигналы** | Понижает confidence |

### 4.3. Использование confidence

**В системе:**
- Confidence > 0.8 → автоматическое создание задачи с правильным сроком
- Confidence 0.6–0.8 → задача создаётся, менеджер проверяет
- Confidence < 0.6 → пометка "needs review"

**В Admin Console:**
- Confidence отображается цветом (зелёный/жёлтый/красный)
- Фильтр по confidence позволяет найти сомнительные лиды

---

## 5. Рекомендации менеджеру

### 5.1. suggested_action

| Действие | Тип лида | Confidence | Что делать |
|----------|----------|------------|------------|
| `call` | Hot, Warm | > 0.7 | Позвонить клиенту |
| `email` | Warm | 0.5–0.7 | Отправить письмо |
| `archive` | Cold | любой | Сохранить, не обрабатывать сейчас |
| `reject` | Spam | любой | Отклонить, не связываться |

### 5.2. reasoning (Обоснование)

AI предоставляет краткое обоснование классификации:

**Примеры:**

```
"Ключевые слова 'прямо сейчас', 'готов оплатить' указывают на высокую готовность"

"Клиент задаёт вопросы о ценах, но не упоминает сроки — заинтересован, но не готов"

"Сообщение содержит признаки рекламы — нецелевое обращение"
```

**Использование:**
- Менеджер видит reasoning в Kommo (примечание)
- Admin Console показывает reasoning в Lead Details
- Помогает понять логику AI

---

## 6. Промпт для классификации

### 6.1. Системный промпт

```markdown
Ты — AI-классификатор входящих лидов для B2B/B2C компании.
Проанализируй обращение клиента и классифицируй его.

Правила классификации:
1. hot — клиент готов купить/заказать прямо сейчас, упоминает конкретные сроки, срочность
2. warm — клиент заинтересован, задаёт вопросы, требует follow-up
3. cold — клиент сомневается, сравнивает, откладывает решение
4. spam — нецелевое обращение, реклама, не связано с услугами компании

Верни результат ТОЛЬКО в формате JSON (без markdown).
```

### 6.2. Формат запроса

```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "{{system_prompt}}"
    },
    {
      "role": "user",
      "content": "Обращение клиента: {{lead_message}}\n\nИмя: {{lead_name}}\nИсточник: {{lead_source}}"
    }
  ],
  "temperature": 0.3,
  "response_format": { "type": "json_object" }
}
```

### 6.3. Формат ответа (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["lead_type", "interest", "priority", "confidence", "suggested_action"],
  "properties": {
    "lead_type": {
      "type": "string",
      "enum": ["hot", "warm", "cold", "spam"]
    },
    "interest": {
      "type": "string",
      "enum": ["high", "medium", "low", "none"]
    },
    "priority": {
      "type": "string",
      "enum": ["high", "medium", "low"]
    },
    "category": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "suggested_action": {
      "type": "string",
      "enum": ["call", "email", "archive", "reject"]
    },
    "reasoning": {
      "type": "string"
    }
  }
}
```

---

## 7. Fallback-механизм

### 7.1. Когда срабатывает

| Условие | Действие |
|---------|----------|
| OpenAI timeout (> 10s) | Fallback |
| OpenAI rate limit (429) | Fallback |
| OpenAI error (500, 502, 503) | Fallback |
| Invalid JSON в ответе | Fallback |
| Confidence < 0.4 | Fallback |

### 7.2. Rule-based классификация

```javascript
const SPAM_KEYWORDS = [
  'купить базу', 'предложение сотрудничества',
  'рекламное предложение', 'зарабатывайте'
];

const HOT_KEYWORDS = [
  'срочно', 'хочу купить', 'готов оплатить',
  'завтра', 'сейчас', 'закажу'
];

const WARM_KEYWORDS = [
  'интересует', 'хочу узнать', 'подробнее',
  'сколько стоит', 'расскажите'
];

const COLD_KEYWORDS = [
  'подумаю', 'может быть', 'позже',
  'не сейчас', 'сомневаюсь'
];

function fallbackClassify(message) {
  const lower = message.toLowerCase();

  if (SPAM_KEYWORDS.some(k => lower.includes(k))) {
    return {
      lead_type: 'spam',
      interest: 'none',
      priority: 'low',
      confidence: 0.50,
      suggested_action: 'reject',
      source: 'fallback'
    };
  }

  if (HOT_KEYWORDS.some(k => lower.includes(k))) {
    return {
      lead_type: 'hot',
      interest: 'high',
      priority: 'high',
      confidence: 0.60,
      suggested_action: 'call',
      source: 'fallback'
    };
  }

  if (WARM_KEYWORDS.some(k => lower.includes(k))) {
    return {
      lead_type: 'warm',
      interest: 'medium',
      priority: 'medium',
      confidence: 0.60,
      suggested_action: 'email',
      source: 'fallback'
    };
  }

  if (COLD_KEYWORDS.some(k => lower.includes(k))) {
    return {
      lead_type: 'cold',
      interest: 'low',
      priority: 'low',
      confidence: 0.60,
      suggested_action: 'archive',
      source: 'fallback'
    };
  }

  // Default: warm
  return {
    lead_type: 'warm',
    interest: 'medium',
    priority: 'medium',
    confidence: 0.40,
    suggested_action: 'email',
    source: 'fallback_default'
  };
}
```

### 7.3. Признаки fallback

В базе данных:
- `source: 'fallback'` или `source: 'fallback_default'`
- Confidence обычно 0.40–0.60

В Admin Console:
- Фильтр по source = fallback
- Confidence подсвечен жёлтым

---

## 8. SLA (Service Level Agreement)

### 8.1. Время классификации

| Параметр | Значение |
|----------|----------|
| **Polling interval** | 5 минут |
| **Максимальная задержка** | 5 минут + время AI |
| **OpenAI timeout** | 10 секунд |
| **Среднее время AI** | 1–3 секунды |
| **Fallback time** | < 100 мс |

### 8.2. Время обработки по типам

| Lead Type | SLA | Задача менеджеру |
|-----------|-----|------------------|
| **Hot** | 15 минут | +15 минут |
| **Warm** | 24 часа | +24 часа |
| **Cold** | 7 дней | +7 дней |
| **Spam** | — | Не обрабатывается |

---

## 9. Мониторинг качества

### 9.1. Метрики в Admin Console

| Метрика | SQL |
|---------|-----|
| Avg confidence | `AVG(confidence)` |
| Distribution by type | `GROUP BY lead_type` |
| Fallback rate | `COUNT(source='fallback') / COUNT(*)` |
| Hot lead rate | `COUNT(lead_type='hot') / COUNT(*)` |

### 9.2. Диагностические запросы

```sql
-- Лиды с низкой уверенностью
SELECT l.public_number, q.lead_type, q.confidence, q.reasoning
FROM leads l
JOIN qualifications q ON l.id = q.lead_id
WHERE q.confidence < 0.6
ORDER BY l.created_at DESC;

-- Fallback rate за неделю
SELECT
  DATE(created_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN source LIKE 'fallback%' THEN 1 ELSE 0 END) as fallback,
  ROUND(100.0 * SUM(CASE WHEN source LIKE 'fallback%' THEN 1 ELSE 0 END) / COUNT(*), 2) as fallback_rate
FROM qualifications
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date;
```

---

## 10. Настройка и кастомизация

### 10.1. Изменение категорий

Для добавления новой категории:

1. Обновить JSON Schema в workflow
2. Добавить ключевые слова в fallback
3. Обновить маппинг в Kommo Writer

### 10.2. Изменение промпта

Редактировать в n8n UI:
- Workflow: Lead Classification MVP
- Node: OpenAI Request
- Field: System Prompt

### 10.3. Изменение ключевых слов

Редактировать в n8n UI:
- Workflow: Lead Classification MVP
- Node: Fallback Classification
- Field: JavaScript Code