# Lead Qualification MVP

**Мгновенная квалификация входящих лидов. Автоматическая обработка 24/7. Готовый результат в CRM.**

Система автоматически принимает обращения из Website и Telegram, классифицирует с помощью AI, создаёт сделки в Kommo и ставит задачи менеджеру — горячие лиды через 15 минут, тёплые через 24 часа.

**Результат для бизнеса:**

- ⚡ **Мгновенная реакция** — AI-классификация за секунды, не часы
- 🔄 **24/7 режим** — ночные и выходные лиды не теряются
- 📊 **Автоматическая приоритизация** — hot/warm/cold/spam
- ✅ **CRM-интеграция** — сделки и задачи создаются автоматически
- 👁️ **Прозрачность** — единая консоль мониторинга для руководителя

---

![Dashboard: Overview](docs/screenshots/dashboard-overview.png)

---

## Быстрая навигация

### Для заказчика

- [Ценность для бизнеса](docs/BUSINESS_VALUE.md) — что получает бизнес после внедрения
- [Демонстрация системы](docs/SYSTEM_DEMO.md) — путь лида через систему
- [Сквозные сценарии](docs/E2E_SCENARIOS.md) — пошаговые сценарии работы
- [Руководство пользователя](docs/USER_GUIDE.md) — как работать с системой
- [Развёртывание](docs/DEPLOYMENT_GUIDE.md) — как запустить

### Для инженера

- [Архитектура](docs/ARCHITECTURE.md) — как устроена система, стек, структура проекта
- [AI-классификация](docs/AI_QUALIFICATION.md) — логика квалификации, категории лидов
- [План реализации](docs/IMPLEMENTATION_PLAN.md) — этапы разработки
- [Соответствие ТЗ](docs/TZ_COMPLIANCE_REPORT.md) — покрытие требований

---

## Ключевой бизнес-процесс

![Бизнес-процесс](docs/screenshots/optimus-bp.png)

**Полный путь лида:**

```
Клиент → Заявка → Автоматическая обработка → AI → CRM → Менеджер → Контроль
```

1. **Клиент** оставляет заявку через Website или Telegram
2. **n8n workflow** принимает и сохраняет в PostgreSQL
3. **AI классифицирует:** hot (готов купить), warm (интерес), cold (думает), spam (нецелевой)
4. **Создаётся сделка** в Kommo CRM с правильным статусом воронки
5. **Задача менеджеру** создаётся автоматически (Hot: +15 мин, Warm: +24 ч, Cold: +7 дней)
6. **Admin Console** показывает состояние всех лидов и CRM-синхронизацию

Подробно: [Демонстрация системы](docs/SYSTEM_DEMO.md)

---

## Демонстрация системы

### Шаг 1. Клиент оставляет заявку

**Вариант 1: Website**

![Website: Успешная отправка](docs/screenshots/website-form-success.png)

Клиент заполняет форму на сайте, получает подтверждение с номером заявки.

**Вариант 2: Telegram**

![Telegram: Hot Lead](docs/screenshots/telegram-lead-hot.png)

Клиент пишет боту, получает мгновенную классификацию.

---

### Шаг 2. Автоматическая обработка

Три workflow обрабатывают обращение как единый конвейер:

**Lead Ingestion** — приём из Website/Telegram, валидация, сохранение в БД

![Workflow: Lead Ingestion](docs/screenshots/workflow-lead-ingestion-v2.png)

**AI Classification** — классификация через OpenAI, fallback при ошибке

![Workflow: AI Classification](docs/screenshots/workflow-lead-classification-mvp.png)

**Kommo Writer** — создание сделки и задачи в CRM

![Workflow: Kommo Writer](docs/screenshots/workflow-kommo-writer-mvp.png)

---

### Шаг 3. Передача результата в CRM

**Список сделок в Kommo**

![Kommo: Deal List](docs/screenshots/commo-deal-list.png)

**Горячий лид в CRM**

![Kommo: Hot Deal](docs/screenshots/commo-deal-hot.png)

Сделка автоматически получает:
- Правильный статус воронки (Hot Lead / Warm Lead / Cold Lead)
- Задачу менеджеру с нужным сроком
- Все данные классификации в примечании

---

### Шаг 4. Контроль процесса

**Очередь лидов для менеджера**

![Lead Queue: Hot](docs/screenshots/lead-queue-hot.png)

**Dashboard для руководителя**

![Dashboard: Overview](docs/screenshots/dashboard-overview.png)

Результат полного цикла:
- **Менеджер** получает приоритизированную очередь с готовыми данными
- **Руководитель** видит метрики в реальном времени
- **Клиент** получает быстрый отклик

---

## Ценность для бизнеса

### Проблемы, которые решает система

| Проблема | Решение |
|----------|---------|
| **Потеря лидов** | Автоматический приём 24/7 |
| **Медленная реакция** | AI-классификация за секунды |
| **Нет приоритизации** | Автоматическая квалификация hot/warm/cold |
| **Неконсистентность** | Единые правила для всех лидов |
| **Нет контроля** | Централизованная консоль мониторинга |

Подробно: [Ценность для бизнеса](docs/BUSINESS_VALUE.md)

---

## Документация

### Для заказчика

| Документ | Назначение |
|----------|------------|
| [BUSINESS_VALUE.md](docs/BUSINESS_VALUE.md) | Ценность для бизнеса |
| [SYSTEM_DEMO.md](docs/SYSTEM_DEMO.md) | Демонстрация системы |
| [USER_GUIDE.md](docs/USER_GUIDE.md) | Руководство пользователя |
| [E2E_SCENARIOS.md](docs/E2E_SCENARIOS.md) | Сквозные сценарии |

### Для инженера

| Документ | Назначение |
|----------|------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Архитектура, стек, структура проекта |
| [AI_QUALIFICATION.md](docs/AI_QUALIFICATION.md) | Логика AI-классификации |
| [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | План реализации |
| [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | Развёртывание |

---

## Рыночное подтверждение

Система закрывает критический дефицит n8n-компетенций в портфолио (33% заказов упоминают n8n).

Подробности: [Состояние проекта](docs/PROJECT_STATE.md)

---

## Лицензия

MIT License — для демонстрационных целей.

---

## Контакты

- **Public Demo**: https://lead-qual.alex-n8n.site/
- **Admin Demo**: https://lead-qual-admin.alex-n8n.site/
- **Repository**: GitHub (публикация планируется)