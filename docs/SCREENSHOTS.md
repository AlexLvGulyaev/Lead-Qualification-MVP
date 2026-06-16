# Галерея экранов Lead Qualification MVP

Все изображения — реальные скриншоты из каталога [`docs/screenshots/`](screenshots/).
Цель галереи — показать проект как законченный демонстрационный MVP: каналы входа, AI-классификация, CRM-интеграция и мониторинг.

---

## 1) Клиентский контур — Website (Landing)

### Landing: Hero

![Landing: Hero](screenshots/landing-hero.png)

- **Что показано**: главная секция лендинга с заголовком и CTA
- **Роль в системе**: входная точка для клиентов
- **Почему важно**: первое впечатление клиента о системе

### Landing: Problems

![Landing: Problems](screenshots/landing-problems.png)

- **Что показано**: секция с описанием проблем клиентов
- **Роль в системе**: объяснение ценности решения
- **Почему важно**: демонстрирует понимание болей клиента

### Landing: Solution

![Landing: Solution](screenshots/landing-solution.png)

- **Что показано**: секция с описанием решения
- **Роль в системе**: презентация системы
- **Почему важно**: объясняет как система решает проблемы

### Landing: Features

![Landing: Features](screenshots/landing-features.png)

- **Что показано**: ключевые возможности системы
- **Роль в системе**: демонстрация функциональности
- **Почему важно**: показывает что клиент получает

### Landing: Manager

![Landing: Manager](screenshots/landing-manager.png)

- **Что показано**: секция для менеджеров
- **Роль в системе**: объяснение пользы для менеджеров
- **Почему важно**: показывает интеграцию с работой менеджера

### Landing: Integration

![Landing: Integration](screenshots/landing-integration.png)

- **Что показано**: секция интеграций
- **Роль в системе**: связь с CRM
- **Почему важно**: демонстрирует интеграцию с Kommo

---

## 2) Клиентский контур — Website (Form)

### Website: Empty Form

![Website: Empty Form](screenshots/website-form-empty.png)

- **Что показано**: форма заявки до заполнения
- **Роль в системе**: точка входа Website-лидов
- **Почему важно**: демонстрирует клиентский интерфейс

### Website: Filled Form

![Website: Filled Form](screenshots/website-form-filled.png)

- **Что показано**: форма заявки с заполненными данными
- **Роль в системе**: сбор данных клиента
- **Почему важно**: показывает требуемые поля

### Website: Request Processing

![Website: Request](screenshots/website-form-request.png)

- **Что показано**: состояние обработки запроса
- **Роль в системе**: обратная связь клиенту
- **Почему важно**: показывает процесс обработки

### Website: Success

![Website: Success](screenshots/website-form-success.png)

- **Что показано**: подтверждение успешной отправки
- **Роль в системе**: финал клиентского сценария
- **Почему важно**: показывает номер заявки LQ-XXXXXX

---

## 3) Клиентский контур — Telegram

### Telegram: Hot Lead

![Telegram: Hot Lead](screenshots/telegram-lead-hot.png)

- **Что показано**: Telegram-бот, классификация как Hot Lead
- **Роль в системе**: альтернативный канал входа лидов
- **Почему важно**: демонстрирует мультиканальность системы
- **Особенности**: inline-кнопки, confirmation, LQ-номер

---

## 4) Admin Console — Dashboard

### Dashboard: Overview

![Admin: Dashboard](screenshots/dashboard-overview.png)

- **Что показано**: главная страница Admin Console с метриками
- **Роль в системе**: оперативный мониторинг системы
- **Почему важно**: ключевые метрики на одном экране
- **Метрики**: всего лидов, распределение по типам, CRM sync

---

## 5) Admin Console — Lead Queue

### Lead Queue: Hot

![Admin: Lead Queue Hot](screenshots/lead-queue-hot.png)

- **Что показано**: список лидов с фильтром по Hot
- **Роль в системе**: рабочее место администратора
- **Почему важно**: показывает результат AI-классификации
- **Поля**: номер, имя, тип, приоритет, уверенность, источник

### Lead Queue: Warm

![Admin: Lead Queue Warm](screenshots/lead-queue-warm.png)

- **Что показано**: список лидов с фильтром по Warm
- **Роль в системе**: просмотр теплых лидов
- **Почему важно**: демонстрирует фильтрацию по типам

### Lead Queue: Cold

![Admin: Lead Queue Cold](screenshots/lead-queue-cold.png)

- **Что показано**: список лидов с фильтром по Cold
- **Роль в системе**: просмотр холодных лидов
- **Почему важно**: показывает разные типы классификации

### Lead Queue: Spam

![Admin: Lead Queue Spam](screenshots/lead-queue-spam.png)

- **Что показано**: список лидов с фильтром по Spam
- **Роль в системе**: просмотр спама
- **Почему важно**: демонстрирует фильтрацию нецелевых обращений

### Lead Queue: Change CRM Status

![Admin: Lead Queue CRM Status](screenshots/lead-queue-hot-change-crm-status.png)

- **Что показано**: детальный просмотр лида со ссылкой на CRM
- **Роль в системе**: связь LQ ↔ Kommo
- **Почему важно**: показывает интеграцию без входа в CRM

---

## 6) n8n Workflows

### Workflow: Lead Ingestion V2

![n8n: Lead Ingestion V2](screenshots/workflow-lead-ingestion-v2.png)

- **Что показано**: workflow приёма лидов из Website
- **Роль в системе**: точка входа данных
- **Почему важно**: демонстрирует n8n-оркестрацию
- **Ноды**: Webhook, Validate, Find/Create Contact, Create Lead

### Workflow: Telegram Lead Ingestion

![n8n: Telegram Ingestion](screenshots/workflow-telegram-lead-ingestion.png)

- **Что показано**: workflow приёма лидов из Telegram
- **Роль в системе**: Telegram-канал
- **Почему важно**: показывает мультиканальность на уровне n8n
- **Ноды**: Telegram Trigger, Parse, UX, Find/Create Contact

### Workflow: Lead Classification MVP

![n8n: Classification](screenshots/workflow-lead-classification-mvp.png)

- **Что показано**: AI-классификация с OpenAI и fallback
- **Роль в системе**: ядро квалификации
- **Почему важно**: демонстрирует AI-интеграцию и отказоустойчивость
- **Ноды**: Schedule, Query, OpenAI, Fallback, Save

### Workflow: Kommo Writer MVP

![n8n: CRM Writer](screenshots/workflow-kommo-writer-mvp.png)

- **Что показано**: создание сделок и задач в Kommo
- **Роль в системе**: CRM-интеграция
- **Почему важно**: демонстрирует end-to-end интеграцию
- **Ноды**: Webhook, Prepare Payload, Kommo API, Create Task

### Workflow: CRM Status Sync MVP

![n8n: CRM Sync](screenshots/workflow-crm-status-sync-mvp.png)

- **Что показано**: периодическая синхронизация snapshot
- **Роль в системе**: мониторинг CRM-состояния
- **Почему важно**: показывает polling-подход
- **Ноды**: Schedule, Query, Kommo API, Update DB

---

## 7) Kommo CRM

### Kommo: Deal List

![Kommo: Deal List](screenshots/commo-deal-list.png)

- **Что показано**: список сделок в Kommo
- **Роль в системе**: результат CRM Writer
- **Почему важно**: подтверждает работу интеграции
- **Поля**: Name, Pipeline, Status, Custom Fields

### Kommo: Deal Hot

![Kommo: Deal Hot](screenshots/commo-deal-hot.png)

- **Что показано**: сделка типа Hot в Kanban
- **Роль в системе**: классификация Hot Lead
- **Почему важно**: демонстрирует маппинг lead_type → status

### Kommo: Deal Warm

![Kommo: Deal Warm](screenshots/commo-deal-warm.png)

- **Что показано**: сделка типа Warm в Kanban
- **Роль в системе**: классификация Warm Lead
- **Почему важно**: показывает разные колонки воронки

### Kommo: Deal Cold

![Kommo: Deal Cold](screenshots/commo-deal-cold.png)

- **Что показано**: сделка типа Cold в Kanban
- **Роль в системе**: классификация Cold Lead
- **Почему важно**: демонстрирует низкоприоритетную воронку

### Kommo: Change Status

![Kommo: Change Status](screenshots/commo-deal-change-status.png)

- **Что показано**: изменение статуса сделки в Kommo
- **Роль в системе**: менеджер работает с сделкой
- **Почему важно**: показывает Sales Execution SOT

---

## Сводная таблица скриншотов

| Категория | Количество | Файлы |
|-----------|------------|-------|
| Landing | 8 | landing-*.png |
| Website Form | 4 | website-form-*.png |
| Telegram | 1 | telegram-*.png |
| Dashboard | 1 | dashboard-*.png |
| Lead Queue | 5 | lead-queue-*.png |
| Workflows | 5 | workflow-*.png |
| Kommo CRM | 5 | commo-*.png |
| **Итого** | **29** | |

---

## Использование в документации

Скриншоты используются в:
- [README.md](../README.md) — обзор проекта
- [USER_GUIDE.md](USER_GUIDE.md) — руководство пользователя
- [E2E_SCENARIOS.md](E2E_SCENARIOS.md) — сквозные сценарии
- [ARCHITECTURE.md](ARCHITECTURE.md) — архитектура системы