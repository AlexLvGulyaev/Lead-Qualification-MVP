# Руководство администратора

Это руководство для администраторов системы Lead Qualification.

---

## Роли в системе

| Роль | Где работает | Назначение |
|------|-------------|------------|
| **Клиент** | Website, Telegram | Оставляет заявки |
| **Менеджер** | Kommo CRM | Обрабатывает лиды |
| **Администратор** | Admin Console | Мониторит систему |

Администратор контролирует систему через **Admin Console** и **n8n UI**.

---

## Admin Console

### Доступ

**URL:** https://lead-qual-admin.alex-n8n.site/

---

### Dashboard

![Dashboard: Обзор](screenshots/dashboard-overview.png)

**Метрики:**

| Блок | Показатели |
|------|------------|
| **Всего лидов** | Общее количество |
| **По типам** | Hot, Warm, Cold, Spam (pie chart) |
| **По источникам** | Website, Telegram |
| **CRM Sync** | Статус последней синхронизации |

---

### Lead Queue

![Lead Queue: Горячие лиды](screenshots/lead-queue-hot.png)

**URL:** `/leads`

**Фильтры:**

| Фильтр | Значения |
|--------|----------|
| **Тип** | hot, warm, cold, spam, all |
| **Источник** | web, telegram, all |
| **Статус** | received, qualified, processed |

**Колонки:**

| Колонка | Описание |
|---------|----------|
| **Номер** | LQ-XXXXXX |
| **Имя** | Имя клиента |
| **Тип** | Hot/Warm/Cold/Spam |
| **Приоритет** | High/Medium/Low |
| **Confidence** | 0.00–1.00 |
| **Источник** | Web/Telegram |
| **Создан** | Дата и время |
| **CRM Status** | Статус в Kommo |

---

### Lead Details

**URL:** `/leads/:id`

**Разделы:**

1. **Контакт** — имя, телефон, email
2. **Обращение** — текст сообщения, источник, дата
3. **Квалификация** — тип, приоритет, confidence, summary
4. **CRM Sync** — Kommo ID, pipeline, status, task info
5. **Ссылка на Kommo** — открыть сделку в CRM

---

## Архитектура обработки лидов

### Общий путь

```
Website / Telegram
       ↓
   Lead Ingestion
       ↓
  AI Classification
       ↓
     Kommo CRM
       ↓
   CRM Status Sync
       ↓
   Admin Console
```

---

### Workflow 1: Lead Ingestion

![Workflow: Lead Ingestion](screenshots/workflow-lead-ingestion-v2.png)

**Триггер:** Webhook POST `/webhook/lead`

**Назначение:** Приём лидов с Website

**Поток:**

1. Webhook получает данные
2. Validate — проверка обязательных полей
3. Find/Create Contact — поиск или создание контакта
4. Create Lead — создание лида с номером (LQ-XXXXXX)
5. Insert Message — сохранение сообщения
6. Insert Log — логирование
7. Response — возврат номера заявки

**Валидация:**

| Поле | Правило |
|------|---------|
| **Сообщение** | Минимум 10 символов |
| **Телефон или Email** | Хотя бы одно поле |

---

### Workflow 2: AI Classification

![Workflow: AI Classification](screenshots/workflow-lead-classification-mvp.png)

**Триггер:** Schedule (каждые 5 минут)

**Назначение:** Классификация лидов

**Поток:**

1. Query — получить лиды со статусом `received`
2. For Each — обработка каждого лида
3. Build Prompt — формирование промпта
4. Call OpenAI — запрос к GPT-4o-mini
5. Parse Response — парсинг JSON
6. Save Qualification — сохранение результата
7. Update Lead Status — статус `qualified`
8. Trigger CRM Writer — webhook для CRM

**Fallback:** При ошибке AI — классификация по ключевым словам

---

### Workflow 3: Kommo Writer

![Workflow: Kommo Writer](screenshots/workflow-kommo-writer-mvp.png)

**Триггер:** Webhook от Classification

**Назначение:** Создание сделок и задач в Kommo

**Поток:**

1. Receive Lead Data — получение данных
2. Prepare Payload — формирование запроса
3. Create Kommo Lead — создание сделки
4. Create Kommo Contact — создание контакта
5. Create Task — создание задачи менеджеру
6. Save CRM Sync — сохранение ID в PostgreSQL

**Маппинг воронок:**

| Lead Type | Pipeline | Status |
|-----------|----------|--------|
| Hot | Входящие лиды | Hot Lead |
| Warm | Входящие лиды | Warm Lead |
| Cold | Входящие лиды | Cold Lead |
| Spam | Closed | Spam |

---

### Workflow 4: CRM Status Sync

**Триггер:** Schedule (каждые 15 минут)

**Назначение:** Синхронизация snapshot из Kommo

**Поток:**

1. Query Active Leads — получить лиды с Kommo ID
2. For Each — обработка каждого
3. Get Kommo Lead — запрос к Kommo API
4. Extract Data — извлечение pipeline, status, tasks
5. Update crm_sync — сохранение snapshot

---

## Мониторинг

### Проверка работоспособности

**PostgreSQL:**

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c "\dt"
```

**n8n:**

```bash
curl -s http://localhost:5678/health
```

**Admin API:**

```bash
curl -s http://localhost:8000/health
```

---

### Логи

**Таблица logs:**

```sql
SELECT
  created_at,
  event_type,
  lead_id,
  status,
  error_message
FROM logs
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Типы событий:**

| Event | Описание |
|-------|----------|
| `lead_received` | Лид принят |
| `lead_classified` | Классификация завершена |
| `crm_sync` | Синхронизация с CRM |
| `crm_task_created` | Задача создана |
| `error` | Ошибка |

---

### Метрики Dashboard

| Метрика | SQL |
|---------|-----|
| Leads today | `COUNT(*) WHERE created_at::date = CURRENT_DATE` |
| By type | `GROUP BY lead_type` |
| Avg confidence | `AVG(confidence)` |
| CRM sync rate | `COUNT(*) WHERE crm_synced_at IS NOT NULL / COUNT(*)` |

---

## Troubleshooting

### Лид не классифицируется

**Симптом:** Статус `received` больше 5 минут

**Проверка:**

1. Workflow Lead Classification MVP активен?
2. OpenAI API key валиден?
3. Есть лимиты OpenAI?

**Решение:**

```bash
# Проверить workflow
curl http://localhost:5678/api/v1/workflows

# Проверить OpenAI API key
echo $OPENAI_API_KEY

# Перезапустить workflow
# В n8n UI: Deactivate → Activate
```

---

### Лид не в CRM

**Симптом:** `crm_sync` пуста для qualified лида

**Проверка:**

1. Workflow Kommo Writer активен?
2. Kommo Access Token валиден?
3. Есть права на создание сделок?

**Решение:**

```bash
# Проверить токен Kommo
curl -H "Authorization: Bearer $KOMMO_ACCESS_TOKEN" \
  https://yourcompany.kommo.com/api/v4/leads

# Проверить webhook
curl -X POST http://localhost:5678/webhook/crm-writer \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

### Telegram не отвечает

**Симптом:** Нет реакции на сообщения

**Проверка:**

1. Telegram Bot Token валиден?
2. Workflow Lead Ingestion Telegram активен?
3. Webhook установлен?

**Решение:**

```bash
# Проверить токен
curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe

# Установить webhook
curl -X POST \
  "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=http://your-server/webhook/telegram"
```

---

### Admin UI не открывается

**Симптом:** 502/503 ошибка

**Проверка:**

1. Admin-backend контейнер запущен?
2. PostgreSQL доступна?
3. Порт 8000 открыт?

**Решение:**

```bash
# Проверить контейнеры
docker compose ps

# Проверить логи
docker compose logs admin-backend

# Перезапустить
docker compose restart admin-backend
```

---

## n8n Workflows

### Активные workflows

| Workflow | Триггер | Статус |
|----------|---------|--------|
| Lead Ingestion V2 | Webhook | Active |
| Lead Ingestion Telegram | Telegram | Active |
| Lead Classification MVP | Schedule (5 min) | Active |
| Lead CRM Sync - Kommo Writer | Webhook | Active |
| CRM Status Sync MVP | Schedule (15 min) | Active |

---

### Проверка execution

1. Откройте n8n UI: http://localhost:5678/
2. Перейдите в «Executions»
3. Найдите нужный execution
4. Проверьте данные на каждом node

---

### Ручной запуск

Для тестирования можно запустить workflow вручную:

1. Откройте workflow
2. Нажмите «Execute Workflow»
3. Введите тестовые данные
4. Проверьте результат

---

## FAQ администратора

### Как изменить правила классификации?

Отредактируйте промпт в workflow **Lead Classification MVP**, node **OpenAI Request**.

---

### Как добавить новый источник лидов?

Создайте новый workflow с Webhook Trigger и повторите логику Lead Ingestion V2.

---

### Как изменить сроки задач?

Отредактируйте workflow **Kommo Writer**, node **Task Creation**. Измените формулу расчёта deadline.

---

### Как проверить состояние БД?

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c "SELECT COUNT(*) FROM leads;"
```

---

### Как перезапустить все сервисы?

```bash
docker compose restart
```

---

## Связанные документы

- [USER_GUIDE.md](USER_GUIDE.md) — руководство клиента
- [MANAGER_GUIDE.md](MANAGER_GUIDE.md) — руководство менеджера
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) — развёртывание
- [ARCHITECTURE.md](ARCHITECTURE.md) — архитектура системы
- [AI_QUALIFICATION.md](AI_QUALIFICATION.md) — логика классификации