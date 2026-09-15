# 📂 PROJECT_STRUCTURE.md — Lead Qualification

**Проект:** Lead Qualification MVP
**Дата:** 2026-09-15
**Статус:** Карта репозитория — структура и назначение каждого элемента кодовой базы.

---

## 📁 1. Дерево репозитория

```text
n8n-lead-qualification/
├── README.md                              # Точка входа: описание кейса, возможности, карта документации
├── .gitignore                             # Исключения git (секреты, внутренние файлы, runtime-артефакты)
│
├── admin-ui/                              # Admin Console Frontend (static, без сборки)
│   ├── index.html                         # SPA-оболочка консоли (Dashboard / Leads / Details)
│   ├── app.js                             # Логика консоли: маршрутизация, токен-авторизация, демо-вход
│   ├── styles.css                         # Стили канона AIC/RF (темы light/dark, чипы, таймлайн)
│   ├── README.md                          # Описание модуля
│   └── e2e/                               # E2E-проверки канона (canon-check-v5.js, canon-check-v6.js)
│
├── backend/                               # Admin Console Backend (FastAPI)
│   ├── main.py                            # Точка входа FastAPI
│   ├── config.py                          # Конфигурация (env: токены, БД, CORS)
│   ├── database.py                        # Подключение к PostgreSQL
│   ├── requirements.txt                   # Зависимости backend
│   ├── Dockerfile                         # Образ backend
│   ├── test_api.py                        # API-тесты
│   └── app/
│       └── api/                           # Маршруты: health, auth, dashboard, leads, logs, audit
│
├── client-ui/                             # Клиентский UI (web-форма заявки)
│   ├── index.html                         # Форма отправки обращения + подтверждение приёма (номер LQ-XXXXXX)
│   ├── app.js                             # Отправка на webhook, обработка ответа
│   ├── config.js                          # Конфигурация endpoint'а
│   └── styles.css                         # Стили формы
│
├── landing/                               # Демо-лендинг кейса (lead-qual-demo)
│   ├── index.html                         # Лендинг: вход в Web-форму и Telegram-бота
│   ├── styles.css / script.js             # Оформление и поведение
│   └── favicon.svg / sitemap.xml / robots.txt
│
├── infra/                                 # Инфраструктура развёртывания
│   ├── docker-compose.yml                 # postgres + n8n + admin-backend + admin-ui + client-ui + landing
│   ├── .env.example                       # Шаблон переменных окружения
│   ├── README.md                          # Обзор инфраструктуры
│   ├── docker/
│   │   ├── nginx/                         # Конфигурации nginx: admin, landing, общий
│   │   └── n8n/ · postgres/               # Каталоги конфигураций сервисов
│   └── sql/                               # Инициализация БД (применяются по порядку)
│       ├── 00-init-databases.sh           # Создание двух БД (n8n + lead_qualification)
│       ├── 01-schema.sql                  # Базовая схема
│       ├── 02-target-model.sql            # Data Model v2 (contacts, channel_identities, leads)
│       ├── 03-runtime-objects.sql         # SEQUENCE public_number, generate_public_number()
│       ├── 04-crm-snapshot.sql            # crm_sync (snapshot из Kommo)
│       ├── 05-telegram-sessions.sql       # telegram_sessions
│       ├── 06-audit.sql                   # audit_logs
│       └── schema-backup-20260612-130651.sql  # Снимок схемы эпохи миграции v2 (исторический)
│
├── workflow/n8n/workflows/                # Экспортированные n8n workflows
│   ├── Lead Ingestion V2 - Complete.json  # Приём лидов с Website (webhook)
│   ├── Lead Ingestion - Telegram UX MVP.json  # Приём лидов из Telegram (бот)
│   ├── Lead Classification MVP.json       # AI-классификация (schedule 5 мин)
│   ├── Lead CRM Sync - Kommo Writer MVP.json  # Создание сделок/задач в Kommo
│   ├── CRM Status Sync MVP.json           # Snapshot статусов из Kommo (schedule 15 мин)
│   └── README.md                          # Описание набора workflow
│
├── tests/                                 # Тестовые материалы
│   ├── test-payloads.json                 # Пейлоады для проверки webhook
│   └── test-commands.sh                   # Команды smoke-проверки
│
└── docs/                                  # Документация (карта — в README.md)
    ├── ARCHITECTURE.md                    # Архитектура системы
    ├── SPEC.md / IMPLEMENTATION_PLAN.md   # Спецификация и план реализации
    ├── PROJECT_STRUCTURE.md               # Этот файл
    ├── PROJECT_HISTORY.md                 # История развития кейса
    ├── MEDIA_INDEX.md                     # Реестр скриншотов
    ├── USER_GUIDE / MANAGER_GUIDE / ADMIN_GUIDE  # Руководства по ролям
    ├── BUSINESS_VALUE / SYSTEM_DEMO / E2E_SCENARIOS / DEMO_ROUTE
    ├── AI_QUALIFICATION.md                # Логика AI-классификации
    ├── crm-integration-design.md / crm-field-mapping.md  # Дизайн и маппинг CRM-интеграции
    ├── kommo-custom-fields-setup-guide.md # Настройка полей Kommo
    ├── webhook-setup.md                   # Настройка webhook
    ├── telegram-ux-scenario.md / telegram-input-preparation.md
    ├── data-model-migration-v2.md         # Миграция Data Model v2
    └── screenshots/                       # Скриншоты (реестр — MEDIA_INDEX.md)
```

---

## 🔗 2. Связанные документы

- [ARCHITECTURE.md](ARCHITECTURE.md) — архитектура, контуры, компоненты, потоки
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) — развёртывание (Source of Truth воспроизводимости)
- [README.md](../README.md) — точка входа и карта документации