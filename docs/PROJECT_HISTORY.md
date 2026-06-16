# История проекта Lead Qualification (кратко)

Этот документ объясняет эволюцию проекта Lead Qualification MVP как демонстрационного кейса. Он не является session log и не перечисляет все внутренние итерации разработки.

Нормативные источники: [SPEC.md](SPEC.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [PROJECT_STATE.md](PROJECT_STATE.md).

---

## 1. Исходная идея и рыночная валидация

Проект начинался как ответ на выявленный **критический дефицит портфолио** — отсутствие компетенций по n8n, который упоминается в 33% исследованных заказов на фриланс-бирже FL.ru.

**Подтверждающие заказы:**

| Заказ | Ключевые требования |
|-------|---------------------|
| FL.ru #5507855 | n8n + Claude API, 5 AI-агентов для маркетплейсов |
| FL.ru #5508101 | n8n + Asterisk, анализ звонков, интеграция с Битрикс24 |
| FL.ru #5506712 | Мессенджер + Kommo, квалификация водителей такси (Перу) |
| FL.ru #5507454 | Zapier + Kommo + OpenAI, два последовательных запроса |

**Цель:** Создать демонстрационный MVP, который закрывает дефицит и показывает полную цепочку: Lead Intake → AI Classification → CRM Integration → Monitoring.

---

## 2. Этап 1: Infrastructure Foundation

**Период:** Июнь 2026

**Цель:** Подготовить инфраструктуру для развёртывания.

**Ключевые решения:**

1. **PostgreSQL vs Google Sheets** — выбран PostgreSQL для надёжности и JSONB
2. **Две отдельные базы** — `n8n` для внутренних таблиц, `lead_qualification` для бизнес-данных
3. **Docker Compose** — для простоты развёртывания
4. **Self-hosted n8n** — для полного контроля и экономии

**Результат:**
- PostgreSQL развёрнут с двумя базами
- n8n доступен на порту 5678
- Базовая схема БД создана

---

## 3. Этап 2: Lead Ingestion (Webhook)

**Период:** Июнь 2026

**Цель:** Обеспечить приём лидов из web-формы.

**Ключевые решения:**

1. **Webhook Trigger** — n8n Webhook node для приёма HTTP POST
2. **Validation** — обязательные поля: message + (phone или email)
3. **Lead Storage** — сохранение в таблицы leads и messages

**Результат:**
- Webhook workflow работает
- Лиды сохраняются в PostgreSQL
- Базовый ответ клиенту

---

## 4. Этап 3: Data Model v2 (Contact-centric)

**Период:** Июнь 2026

**Проблема:** Первоначальная модель хранила все данные в одной таблице leads, что не позволяло отслеживать повторные обращения одного клиента.

**Ключевое архитектурное решение — Contact-centric Data Model:**

```
contacts (люди/организации)
    ↓ 1:N
leads (обращения)
    ↓ 1:N
messages (сообщения)
    ↓ 1:N
qualifications (результаты AI)
```

**Новые таблицы:**
- `contacts` — каноническая сущность человека
- `channel_identities` — идентификаторы в каналах (telegram_user_id, email, phone)
- `leads` ссылается на `contacts` через `contact_id`

**Результат:**
- Дедупликация контактов
- Один контакт → много обращений
- Человекочитаемые номера (LQ-NNNNNN)

---

## 5. Этап 4: AI Classification MVP

**Период:** Июнь 2026

**Цель:** Реализовать AI-классификацию с fallback.

**Ключевые решения:**

1. **OpenAI GPT-4o-mini** — основной AI провайдер
2. **JSON Schema enforcement** — гарантия структуры ответа
3. **Rule-based Fallback** — ключевые слова при недоступности AI
4. **Polling (5 min)** — упрощение вместо event chaining

**Fallback Logic:**
- Spam: «купить базу», «предложение сотрудничества»
- Hot: «срочно», «хочу купить», «готов оплатить»
- Warm: «интересует», «подробнее», «сколько стоит»
- Cold: «подумаю», «может быть», «позже»

**Результат:**
- Классификация работает за < 5 секунд
- Fallback обеспечивает отказоустойчивость
- Confidence записывается для каждого лида

---

## 6. Этап 5: Input Channels (Telegram + Client UI)

**Период:** Июнь 2026

**Цель:** Добавить Telegram как второй канал входа и публичный Client UI.

**Telegram Bot:**
- Приём сообщений через Telegram Trigger
- Inline-кнопки для UX
- Confirmation с номером заявки
- Menu для навигации

**Client UI:**
- Landing page с формой
- Публичный URL: https://lead-qual.alex-n8n.site/
- Footer с брендингом
- Простой success screen

**Результат:**
- Два канала входа: Web + Telegram
- Публичный UI доступен
- E2E сценарий Website → PostgreSQL работает

---

## 7. Этап 6: CRM Integration (Kommo)

**Период:** Июнь 2026

**Цель:** Интеграция с Kommo CRM для создания сделок и задач.

**Ключевые решения:**

1. **Kommo как Sales Execution SOT** — LQ не управляет сделками, только отправляет
2. **Initial Task Creation** — автоматические задачи по типу лида
3. **CRM Snapshot** — мониторинговый snapshot в LQ без дублирования задач

**Task Creation Rules:**
- Hot: задача +15 минут
- Warm: задача +24 часа
- Cold: задача +7 дней
- Spam: сделка закрывается

**Архитектурное разделение:**

| Система | Ответственность |
|---------|-----------------|
| **LQ** | Lead Intake, AI Qualification, CRM Routing, Initial Task, Monitoring |
| **Kommo** | Sales Process, Task Management, Deal Lifecycle |

**Результат:**
- Лиды попадают в Kommo с правильным статусом
- Задачи создаются автоматически
- Snapshot синхронизируется каждые 15 минут

---

## 8. Этап 7: Admin Console

**Период:** Июнь 2026

**Цель:** Создать операционный интерфейс для мониторинга системы.

**Компоненты:**

1. **Dashboard** — метрики, распределение по типам, CRM sync status
2. **Lead Queue** — список лидов с фильтрами
3. **Lead Details** — полная информация о лиде + ссылка на Kommo

**Технологии:**
- Backend: FastAPI (Python 3.12)
- Frontend: Vanilla JS (без сборки)
- Database: PostgreSQL

**Результат:**
- Admin UI доступен по адресу https://lead-qual-admin.alex-n8n.site/
- Dashboard показывает key metrics
- Lead Details показывает путь лида через систему

---

## 9. Текущее состояние

**MVP Definition:**

| Компонент | Статус |
|-----------|--------|
| **Website Lead Capture** | ✅ Active |
| **Telegram Lead Capture** | ✅ Active |
| **AI Classification** | ✅ Active |
| **PostgreSQL Storage** | ✅ Active |
| **Kommo CRM Integration** | ✅ Active |
| **Initial Task Creation** | ✅ Active |
| **CRM Status Sync** | ✅ Active |
| **Admin Console** | ✅ Active |
| **Public Client UI** | ✅ Active |

**Известные ограничения:**
- Polling вместо Event Chaining (до 5 минут задержка)
- Single Language (RU)
- Single CRM (Kommo)
- Keyword Fallback

**Следующие шаги:**
- Event Chaining для мгновенной классификации
- Bitrix24 Integration
- Multi-language support
- Semantic Fallback с embeddings

---

## 10. Ключевые уроки

### 10.1. Архитектурные решения

| Решение | Почему | Результат |
|---------|--------|-----------|
| Contact-centric Data Model | Повторные обращения | Дедупликация, история |
| Две отдельные базы | Изоляция | Чистая бизнес-схема |
| Kommo как SOT | Разделение ответственности | Чистая архитектура |
| Rule-based Fallback | Отказоустойчивость | AI не обязателен |

### 10.2. Инженерные паттерны

- **Fallback Pattern** — AI недоступен → keyword classification
- **Snapshot Pattern** — мониторинг без дублирования
- **Contact-centric Pattern** — один контакт → много обращений
- **Public Number Pattern** — LQ-NNNNNN для человекочитаемости

---

## 11. Переиспользование в будущих проектах

**Компоненты для переиспользования:**

| Компонент | Где применить |
|-----------|---------------|
| **AI Classification Pipeline** | Любые проекты с AI-классификацией |
| **Fallback Pattern** | AI-зависимые системы |
| **CRM Snapshot Pattern** | CRM-интеграции |
| **Contact-centric Data Model** | Lead management системы |
| **Telegram UX Pattern** | Telegram-боты |

**Knowledge Base:** Паттерны документированы в `shared/patterns/`.