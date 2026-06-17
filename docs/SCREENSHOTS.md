# Галерея экранов Lead Qualification MVP

Все изображения — реальные скриншоты из каталога [`docs/screenshots/`](screenshots/).

---

## Инвентаризация скриншотов

### Основные скриншоты (используются в README и документах)

| Файл | Назначение | Где используется |
|------|------------|------------------|
| `dashboard-overview.png` | Главный экран системы | README.md, SYSTEM_DEMO.md |
| `optimus-bp.png` | Визуализация бизнес-процесса | README.md, SYSTEM_DEMO.md |
| `landing-LQ-console.png` | Продуктовый экран | BUSINESS_VALUE.md |
| `landing-problems.png` | Проблемы бизнеса | BUSINESS_VALUE.md |
| `landing-solution.png` | Решение и ценность | BUSINESS_VALUE.md |
| `website-form-success.png` | Успешная отправка Website | README.md, SYSTEM_DEMO.md |
| `telegram-lead-hot.png` | Telegram горячий лид | README.md, SYSTEM_DEMO.md |
| `workflow-lead-ingestion-v2.png` | Workflow приёма лидов | README.md, SYSTEM_DEMO.md |
| `workflow-lead-classification-mvp.png` | Workflow AI-классификации | README.md, SYSTEM_DEMO.md |
| `workflow-kommo-writer-mvp.png` | Workflow CRM-интеграции | README.md, SYSTEM_DEMO.md |
| `commo-deal-list.png` | Список сделок в CRM | README.md, SYSTEM_DEMO.md |
| `commo-deal-hot.png` | Горячий лид в CRM | README.md, SYSTEM_DEMO.md |
| `lead-queue-hot.png` | Очередь горячих лидов | README.md, SYSTEM_DEMO.md |

### Резервные скриншоты

| Файл | Статус | Примечание |
|------|--------|------------|
| `website-form-filled.png` | Резерв | Форма с данными |
| `website-form-request.png` | Резерв | Обработка запроса |
| `workflow-crm-status-sync-mvp.png` | Резерв | Архитектурные документы |
| `workflow-telegram-lead-ingestion.png` | Резерв | Архитектурные документы |
| `landing-integration.png` | Резерв | Лендинг |
| `landing-manager.png` | Резерв | Лендинг |
| `landing-features.png` | Резерв | Лендинг |
| `landing-STA.png` | Резерв | Лендинг |
| `landing-hero.png` | Резерв | Лендинг |

### Не использовать без обоснования

| Файл | Причина |
|------|---------|
| `website-form-empty.png` | Пустая форма не показывает ценность |
| `lead-queue-cold.png` | Дублирует структуру hot/warm |
| `lead-queue-spam.png` | Дублирует структуру hot/warm |
| `lead-queue-warm.png` | Дублирует структуру hot/warm |
| `commo-deal-warm.png` | Дублирует структуру hot |
| `commo-deal-cold.png` | Дублирует структуру hot |
| `commo-deal-change-status.png` | Операционный скриншот |
| `lead-queue-hot-change-crm-status.png` | Операционный скриншот |

---

## 1) Клиентский контур — Website (Landing)

### Landing: Hero

![Landing: Hero](screenshots/landing-hero.png)

- **Что показано**: главная секция лендинга с заголовком и CTA
- **Роль в системе**: входная точка для клиентов
- **Статус**: Резерв

### Landing: LQ Console

![Landing: LQ Console](screenshots/landing-LQ-console.png)

- **Что показано**: продуктовый экран Lead Qualification
- **Роль в системе**: объяснение ценности решения
- **Статус**: Основной (BUSINESS_VALUE.md)

### Landing: Problems

![Landing: Problems](screenshots/landing-problems.png)

- **Что показано**: секция с описанием проблем клиентов
- **Роль в системе**: объяснение болей целевой аудитории
- **Статус**: Основной (BUSINESS_VALUE.md)

### Landing: Solution

![Landing: Solution](screenshots/landing-solution.png)

- **Что показано**: секция с описанием решения
- **Роль в системе**: презентация ценности
- **Статус**: Основной (BUSINESS_VALUE.md)

---

## 2) Клиентский контур — Website (Form)

### Website: Success

![Website: Success](screenshots/website-form-success.png)

- **Что показано**: подтверждение успешной отправки
- **Роль в системе**: финал клиентского сценария
- **Статус**: Основной (README.md, SYSTEM_DEMO.md)

### Website: Filled Form

![Website: Filled Form](screenshots/website-form-filled.png)

- **Что показано**: форма заявки с заполненными данными
- **Статус**: Резерв

### Website: Request Processing

![Website: Request](screenshots/website-form-request.png)

- **Что показано**: состояние обработки запроса
- **Статус**: Резерв

### Website: Empty Form

![Website: Empty Form](screenshots/website-form-empty.png)

- **Статус**: Не использовать без обоснования

---

## 3) Клиентский контур — Telegram

### Telegram: Hot Lead

![Telegram: Hot Lead](screenshots/telegram-lead-hot.png)

- **Что показано**: Telegram-бот, классификация как Hot Lead
- **Роль в системе**: альтернативный канал входа лидов
- **Статус**: Основной (README.md, SYSTEM_DEMO.md)

---

## 4) Admin Console — Dashboard

### Dashboard: Overview

![Admin: Dashboard](screenshots/dashboard-overview.png)

- **Что показано**: главная страница Admin Console с метриками
- **Роль в системе**: оперативный мониторинг системы
- **Статус**: Основной (README.md, SYSTEM_DEMO.md)

---

## 5) Admin Console — Lead Queue

### Lead Queue: Hot

![Admin: Lead Queue Hot](screenshots/lead-queue-hot.png)

- **Что показано**: список лидов с фильтром по Hot
- **Роль в системе**: рабочее место менеджера
- **Статус**: Основной (README.md, SYSTEM_DEMO.md)

### Lead Queue: Warm

![Admin: Lead Queue Warm](screenshots/lead-queue-warm.png)

- **Статус**: Резерв (дублирует структуру hot)

### Lead Queue: Cold

![Admin: Lead Queue Cold](screenshots/lead-queue-cold.png)

- **Статус**: Резерв (дублирует структуру hot)

### Lead Queue: Spam

![Admin: Lead Queue Spam](screenshots/lead-queue-spam.png)

- **Статус**: Резерв (дублирует структуру hot)

### Lead Queue: Change CRM Status

![Admin: Lead Queue CRM Status](screenshots/lead-queue-hot-change-crm-status.png)

- **Статус**: Резерв

---

## 6) n8n Workflows

### Workflow: Lead Ingestion V2

![n8n: Lead Ingestion V2](screenshots/workflow-lead-ingestion-v2.png)

- **Что показано**: workflow приёма лидов из Website
- **Роль в системе**: точка входа данных
- **Статус**: Основной (README.md, SYSTEM_DEMO.md)

### Workflow: Telegram Lead Ingestion

![n8n: Telegram Ingestion](screenshots/workflow-telegram-lead-ingestion.png)

- **Статус**: Резерв (архитектурные документы)

### Workflow: Lead Classification MVP

![n8n: Classification](screenshots/workflow-lead-classification-mvp.png)

- **Что показано**: AI-классификация с OpenAI и fallback
- **Роль в системе**: ядро квалификации
- **Статус**: Основной (README.md, SYSTEM_DEMO.md)

### Workflow: Kommo Writer MVP

![n8n: CRM Writer](screenshots/workflow-kommo-writer-mvp.png)

- **Что показано**: создание сделок и задач в Kommo
- **Роль в системе**: CRM-интеграция
- **Статус**: Основной (README.md, SYSTEM_DEMO.md)

### Workflow: CRM Status Sync MVP

![n8n: CRM Sync](screenshots/workflow-crm-status-sync-mvp.png)

- **Статус**: Резерв (архитектурные документы)

---

## 7) Kommo CRM

### Kommo: Deal List

![Kommo: Deal List](screenshots/commo-deal-list.png)

- **Что показано**: список сделок в Kommo
- **Роль в системе**: результат CRM Writer
- **Статус**: Основной (README.md, SYSTEM_DEMO.md)

### Kommo: Deal Hot

![Kommo: Deal Hot](screenshots/commo-deal-hot.png)

- **Что показано**: сделка типа Hot в Kanban
- **Статус**: Основной (README.md, SYSTEM_DEMO.md)

### Kommo: Deal Warm

![Kommo: Deal Warm](screenshots/commo-deal-warm.png)

- **Статус**: Резерв (дублирует структуру hot)

### Kommo: Deal Cold

![Kommo: Deal Cold](screenshots/commo-deal-cold.png)

- **Статус**: Резерв (дублирует структуру hot)

### Kommo: Change Status

![Kommo: Change Status](screenshots/commo-deal-change-status.png)

- **Статус**: Резерв

---

## 8) Бизнес-процесс

### Optimus BP

![Бизнес-процесс](screenshots/optimus-bp.png)

- **Что показано**: визуализация ключевого бизнес-процесса
- **Роль в системе**: объяснение потока лидов
- **Статус**: Основной (README.md, SYSTEM_DEMO.md)

---

## Сводная таблица скриншотов

| Категория | Основные | Резерв | Итого |
|-----------|----------|--------|-------|
| Landing | 3 | 5 | 8 |
| Website Form | 1 | 2 | 3 |
| Telegram | 1 | 0 | 1 |
| Dashboard | 1 | 0 | 1 |
| Lead Queue | 1 | 4 | 5 |
| Workflows | 3 | 2 | 5 |
| Kommo CRM | 2 | 3 | 5 |
| Бизнес-процесс | 1 | 0 | 1 |
| **Итого** | **13** | **16** | **29** |

---

## Использование в документации

| Документ | Скриншоты |
|----------|-----------|
| [README.md](../README.md) | dashboard-overview, optimus-bp, website-form-success, telegram-lead-hot, workflow-*, commo-deal-*, lead-queue-hot |
| [BUSINESS_VALUE.md](BUSINESS_VALUE.md) | landing-LQ-console, landing-problems, landing-solution |
| [SYSTEM_DEMO.md](SYSTEM_DEMO.md) | optimus-bp, website-form-success, telegram-lead-hot, workflow-*, commo-deal-*, lead-queue-hot, dashboard-overview |
| [USER_GUIDE.md](USER_GUIDE.md) | Все основные + резервные |
| [E2E_SCENARIOS.md](E2E_SCENARIOS.md) | Все основные + резервные |
| [ARCHITECTURE.md](ARCHITECTURE.md) | workflow-*, dashboard-overview |