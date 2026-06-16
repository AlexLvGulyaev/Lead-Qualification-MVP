# Infrastructure

Инфраструктурный фундамент проекта n8n Lead Qualification Assistant.

## Архитектура баз данных

Проект использует **две отдельные базы данных** на одном PostgreSQL сервере:

```
PostgreSQL Container
├── Database: n8n                    # n8n internal tables (107 tables)
│   ├── workflow_entity
│   ├── execution_entity
│   ├── credentials_entity
│   └── ... (n8n platform tables)
│
└── Database: lead_qualification      # Business data (6 tables)
    ├── leads
    ├── messages
    ├── qualifications
    ├── crm_sync
    ├── follow_ups
    └── logs
```

**Разделение обеспечивает:**
- Изоляцию бизнес-данных от внутренних таблиц n8n
- Независимое резервное копирование
- Чистую миграцию бизнес-схемы

## Структура

```
infra/
├── docker/
│   ├── postgres/          # PostgreSQL конфигурация (расширения)
│   └── n8n/               # n8n конфигурация (расширения)
├── sql/
│   ├── 00-init-databases.sh   # Создание баз данных n8n и lead_qualification
│   └── 01-schema.sql          # Бизнес-схема (таблицы leads, messages, etc.)
├── docker-compose.yml     # Docker Compose конфигурация
├── .env.example           # Шаблон переменных окружения
└── README.md              # Этот файл
```

## Сервисы

| Сервис | Порт | Описание |
|--------|------|-----------|
| **PostgreSQL** | 15432 (внешний) → 5432 (внутренний) | Основное хранилище данных |
| **n8n** | 5678 | Платформа автоматизации |

## Быстрый старт

### 1. Подготовка переменных окружения

```bash
cd infra/
cp .env.example .env
```

Отредактируйте `.env` и заполните обязательные переменные:

```bash
# Обязательные переменные
POSTGRES_PASSWORD=your_secure_password
N8N_BASIC_AUTH_PASSWORD=your_admin_password
OPENAI_API_KEY=sk-your-openai-api-key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# CRM (минимум один)
KOMMO_ACCESS_TOKEN=your_kommo_token
# ИЛИ
BITRIX24_WEBHOOK_URL=https://yourcompany.bitrix24.ru/rest/1/code/
```

### 2. Запуск сервисов

```bash
docker compose up -d
```

### 3. Проверка работоспособности

```bash
# Проверка PostgreSQL (должен вернуть "accepting connections")
docker compose exec postgres pg_isready -U n8n -d n8n

# Проверка n8n (должен вернуть HTTP 200)
curl -s http://localhost:5678/health
```

### 4. Доступ к интерфейсам

- **n8n UI**: http://localhost:5678
- **PostgreSQL**: localhost:15432

## Базы данных

### Автоматическое создание

При первом запуске скрипты инициализации создают:

1. **База `n8n`** — для внутренних таблиц n8n (workflows, executions, credentials)
2. **База `lead_qualification`** — для бизнес-данных (leads, messages, qualifications)

### Бизнес-таблицы (lead_qualification)

| Таблица | Назначение |
|----------|------------|
| `leads` | Входящие лиды |
| `messages` | Сообщения по лидам |
| `qualifications` | Результаты AI-классификации |
| `crm_sync` | Статус синхронизации с CRM |
| `follow_ups` | Запланированные follow-up действия |
| `logs` | Системные логи |

### Подключение к БД

```bash
# Бизнес-база (lead_qualification)
docker compose exec postgres psql -U n8n -d lead_qualification

# База n8n (внутренние таблицы)
docker compose exec postgres psql -U n8n -d n8n

# Список всех баз
docker compose exec postgres psql -U n8n -d postgres -c "\l"
```

### Проверка разделения баз

```bash
# Бизнес-таблицы (должно быть 6 таблиц)
docker compose exec postgres psql -U n8n -d lead_qualification -c "\dt"

# n8n таблицы (должно быть ~107 таблиц)
docker compose exec postgres psql -U n8n -d n8n -c "\dt"
```

## Переменные окружения

### PostgreSQL

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `POSTGRES_USER` | `n8n` | Пользователь БД |
| `POSTGRES_PASSWORD` | — | **Обязательно**. Пароль БД |
| `POSTGRES_PORT` | `15432` | Внешний порт PostgreSQL |

> **Примечание:** `POSTGRES_DB` не используется. Базы данных создаются автоматически скриптами инициализации.

### n8n

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `N8N_HOST` | `0.0.0.0` | Хост для прослушивания |
| `N8N_PORT` | `5678` | Порт n8n |
| `N8N_BASIC_AUTH_USER` | `admin` | Имя пользователя |
| `N8N_BASIC_AUTH_PASSWORD` | — | **Обязательно**. Пароль |
| `N8N_LOG_LEVEL` | `info` | Уровень логирования |

### AI Provider

| Переменная | Описание |
|------------|----------|
| `OPENAI_API_KEY` | **Обязательно**. API ключ OpenAI |

### Telegram

| Переменная | Описание |
|------------|----------|
| `TELEGRAM_BOT_TOKEN` | **Обязательно**. Токен Telegram бота |

### CRM

| Переменная | Описание |
|------------|----------|
| `KOMMO_ACCESS_TOKEN` | Токен доступа Kommo |
| `KOMMO_SUBDOMAIN` | Поддомен Kommo |
| `BITRIX24_WEBHOOK_URL` | URL вебхука Bitrix24 |

## Порты

| Сервис | Внешний порт | Внутренний порт | Примечание |
|--------|--------------|-----------------|------------|
| PostgreSQL | 15432 | 5432 | Избегает конфликта с локальным PostgreSQL |
| n8n | 5678 | 5678 | Стандартный порт n8n |

## Volumes

| Volume | Точка монтирования | Назначение |
|--------|-------------------|------------|
| `lead-qualification-postgres-data` | `/var/lib/postgresql/data` | Данные PostgreSQL (обе базы) |
| `lead-qualification-n8n-data` | `/home/node/.n8n` | Данные n8n (workflows, credentials) |

## Остановка сервисов

```bash
# Остановить с сохранением данных
docker compose down

# Остановить и удалить данные
docker compose down -v
```

## Полезные команды

```bash
# Просмотр логов PostgreSQL
docker compose logs postgres

# Просмотр логов n8n
docker compose logs n8n

# Перезапуск n8n
docker compose restart n8n

# Перезапуск всех сервисов
docker compose restart

# Проверка статуса контейнеров
docker compose ps
```

## Устранение неполадок

### PostgreSQL не запускается

```bash
# Проверить логи
docker compose logs postgres

# Убедиться, что порт 15432 не занят
lsof -i :15432
```

### n8n не подключается к PostgreSQL

1. Убедитесь, что PostgreSQL запущен и здоров:
   ```bash
   docker compose exec postgres pg_isready -U n8n -d n8n
   ```

2. Проверьте переменные окружения в `.env`

3. Проверьте сеть Docker:
   ```bash
   docker network ls
   docker network inspect lead-qualification-network
   ```

### Схема БД не применяется

```bash
# Применить схему вручную
docker compose exec postgres psql -U n8n -d lead_qualification -f /docker-entrypoint-initdb.d/01-schema.sql
```

### Полный сброс

```bash
# Остановить и удалить все данные
docker compose down -v

# Удалить volumes
docker volume rm lead-qualification-postgres-data
docker volume rm lead-qualification-n8n-data

# Запустить заново
docker compose up -d
```

## Разработка

### Локальный запуск без Docker

Требуется установленный PostgreSQL и n8n.

```bash
# Создать базы данных
psql -U postgres -c "CREATE DATABASE n8n;"
psql -U postgres -c "CREATE DATABASE lead_qualification;"

# Применить бизнес-схему
psql -U n8n -d lead_qualification -f sql/01-schema.sql

# Запустить n8n с переменными из .env
source .env
n8n start
```

## Security Notes

1. **Не коммитьте `.env` файл** — добавьте его в `.gitignore`
2. **Используйте сильные пароли** для `POSTGRES_PASSWORD` и `N8N_BASIC_AUTH_PASSWORD`
3. **Ограничьте доступ к портам** в production (firewall, VPN)
4. **Регулярно обновляйте образы** Docker: `docker compose pull && docker compose up -d`

## Deployment Configuration

### Source of Truth

Проект использует два уровня конфигурации:

**1. Docker Compose** (`docker-compose.yml`) — SOT для сервисов LQ

Определяет:
- PostgreSQL (база данных)
- n8n (workflow automation)
- admin-backend (FastAPI backend)
- admin-ui (Admin UI)
- client-ui (Client UI)

**2. Traefik Dynamic Config** (`/opt/n8n/dynamic.yml`) — SOT для публичных маршрутов

Внешний файл, управляется вне репозитория LQ.

### Публичные URL

| Компонент | URL |
|-----------|-----|
| **Client UI** | https://lead-qual.alex-n8n.site/ |
| **Admin UI** | https://lead-qual-admin.alex-n8n.site/ |
| **Admin API** | https://lead-qual-admin.alex-n8n.site/api/admin/* |
| **Webhook** | https://lead-qual.alex-n8n.site/webhook/* |
| **n8n UI** | http://localhost:5678/ (только локально) |

### Запуск и перезапуск

```bash
# Запуск всех сервисов LQ
cd /opt/ai-automation-portfolio-lab/cases/n8n-lead-qualification/infra
docker compose up -d

# Проверка статуса
docker compose ps

# Перезапуск отдельных сервисов
docker compose restart postgres
docker compose restart n8n
docker compose restart admin-backend
docker compose restart admin-ui
docker compose restart client-ui
```

### Пересборка сервисов

```bash
# Admin Backend (Python/FastAPI)
docker compose build admin-backend
docker compose up -d admin-backend

# Admin UI (статика)
# Обновить файлы в ../admin-ui/
docker compose restart admin-ui

# Client UI (статика)
# Обновить файлы в ../client-ui/
docker compose restart client-ui

# n8n workflows
# Импортировать через n8n UI: http://localhost:5678
```

### Traefik Configuration

**Файл:** `/opt/n8n/dynamic.yml` (внешний)

**Проверка конфигурации:**
```bash
# Редактирование
sudo nano /opt/n8n/dynamic.yml

# Перезапуск для применения
docker restart n8n_traefik_1

# Проверка логов
docker logs n8n_traefik_1 --tail 50
```

**Текущие маршруты:**
- `lead-qual.alex-n8n.site/` → Client UI
- `lead-qual.alex-n8n.site/webhook/*` → n8n
- `lead-qual-admin.alex-n8n.site/` → Admin UI
- `lead-qual-admin.alex-n8n.site/api/admin/*` → Admin Backend

### Nginx Configuration

**Admin UI:** `docker/nginx/admin-nginx.conf`
- Проксирует `/api/` → `lead-qualification-admin-backend:8000`
- Раздаёт статику Admin UI

**Client UI:** `docker/nginx/nginx.conf`
- Раздаёт статику Client UI

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                      Traefik (n8n_traefik_1)                │
│                    /opt/n8n/dynamic.yml                     │
│                   (внешний, не в LQ repo)                   │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Client UI     │ │   Admin UI      │ │      n8n        │
│   (nginx)       │ │   (nginx)       │ │                 │
│                 │ │       │         │ │                 │
│                 │ │       ▼         │ │                 │
│                 │ │ Admin Backend   │ │                 │
│                 │ │  (FastAPI)      │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                   ┌─────────────────┐
                   │   PostgreSQL   │
                   │   (две базы)   │
                   └─────────────────┘
```

---

## Важные файлы

| Файл | Назначение | SOT |
|------|-----------|-----|
| `docker-compose.yml` | Сервисы LQ | ✅ |
| `.env` | Переменные окружения | ✅ |
| `docker/nginx/*.conf` | Nginx конфигурации | ✅ |
| `sql/*.sql` | Схема БД | ✅ |
| `/opt/n8n/dynamic.yml` | Traefik routing | ✅ (внешний) |
| `/opt/n8n/acme.json` | SSL сертификаты | ❌ (авто) |

---

## Recovery Commands

### Если проект не запущен

```bash
# 1. Проверить .env
cd /opt/ai-automation-portfolio-lab/cases/n8n-lead-qualification/infra
cat .env

# 2. Запустить сервисы
docker compose up -d

# 3. Проверить статус
docker compose ps

# 4. Проверить логи
docker compose logs --tail 100
```

### Если Traefik не работает

```bash
# Перезапуск Traefik
docker restart n8n_traefik_1

# Проверка логов
docker logs n8n_traefik_1 --tail 50
```

### Если PostgreSQL не работает

```bash
# Перезапуск PostgreSQL
docker compose restart postgres

# Проверка подключения
docker compose exec postgres psql -U n8n -d lead_qualification -c "\dt"
```

---

## Следующие шаги

После настройки инфраструктуры:

1. Открыть n8n UI: http://localhost:5678
2. Создать первый workflow (Development Phase 002)
3. Настроить Telegram Bot (Development Phase 002)
4. Интегрировать AI классификацию (Development Phase 003)