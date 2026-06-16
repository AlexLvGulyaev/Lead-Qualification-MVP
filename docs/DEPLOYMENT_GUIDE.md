# Руководство по развёртыванию Lead Qualification MVP

Полное руководство по развёртыванию системы Lead Qualification MVP. Документ позволяет развернуть проект без изучения исходного кода.

---

## 1. Обзор инфраструктуры

### 1.1. Архитектура развёртывания

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VPS SERVER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         TRAEFIK (Reverse Proxy)                     │   │
│   │                    SSL termination, routing                        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                  │                                          │
│         ┌────────────────────────┼────────────────────────┐                │
│         │                        │                        │                │
│         ▼                        ▼                        ▼                │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│   │   Client UI     │    │   Admin UI      │    │      n8n        │        │
│   │   (nginx)       │    │   (nginx)       │    │   (workflows)   │        │
│   │   Port 5180     │    │   Port 8080     │    │   Port 5678     │        │
│   └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│                                  │                        │                │
│                                  ▼                        │                │
│                          ┌─────────────────┐              │                │
│                          │   Admin Backend │              │                │
│                          │   (FastAPI)     │              │                │
│                          │   Port 8000     │              │                │
│                          └─────────────────┘              │                │
│                                  │                        │                │
│                                  └────────────────────────┘                │
│                                              │                              │
│                                              ▼                              │
│                                   ┌─────────────────┐                       │
│                                   │   PostgreSQL   │                       │
│                                   │   Port 5432    │                       │
│                                   └─────────────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2. Компоненты

| Компонент | Технология | Порт | Назначение |
|-----------|------------|------|------------|
| **PostgreSQL** | PostgreSQL 14+ | 5432 (int), 15432 (ext) | Хранение данных |
| **n8n** | n8n self-hosted | 5678 | Оркестрация workflows |
| **Admin Backend** | FastAPI, Python 3.12 | 8000 | API для Admin UI |
| **Admin UI** | Nginx + Static JS | 8080 | Admin Console |
| **Client UI** | Nginx + Static HTML | 5180 | Клиентская форма |
| **Traefik** | Traefik | 80, 443 | Reverse proxy, SSL |

### 1.3. Требования к серверу

| Параметр | Минимум | Рекомендуется |
|----------|---------|---------------|
| **CPU** | 2 cores | 4 cores |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 40 GB SSD | 80 GB SSD |
| **OS** | Ubuntu 20.04+ | Ubuntu 22.04 |
| **Docker** | 24.0+ | Latest |
| **Docker Compose** | 2.20+ | Latest |

---

## 2. Предварительные требования

### 2.1. Установить Docker

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавить пользователя в группу docker
sudo usermod -aG docker $USER

# Выйти и войти заново
```

### 2.2. Установить Docker Compose

```bash
# Docker Compose уже включён в Docker (plugin)
docker compose version
```

### 2.3. Получить API ключи

| Сервис | Как получить |
|--------|--------------|
| **OpenAI API** | https://platform.openai.com/api-keys |
| **Telegram Bot** | BotFather → /newbot |
| **Kommo CRM** | Settings → API → Access Token |

---

## 3. Переменные окружения

### 3.1. Создать .env файл

```bash
cd /path/to/n8n-lead-qualification/infra
cp .env.example .env
nano .env
```

### 3.2. Обязательные переменные

```bash
# PostgreSQL
POSTGRES_USER=n8n
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_PORT=15432

# n8n
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_admin_password_here

# OpenAI API (REQUIRED)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Telegram Bot (REQUIRED for Telegram channel)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Kommo CRM (REQUIRED for CRM integration)
KOMMO_ACCESS_TOKEN=your_kommo_access_token
KOMMO_SUBDOMAIN=yourcompany
```

### 3.3. Опциональные переменные

```bash
# Bitrix24 (альтернатива Kommo)
BITRIX24_WEBHOOK_URL=https://yourcompany.bitrix24.ru/rest/1/code/

# Logging
N8N_LOG_LEVEL=info
APP_ENV=production

# Admin Backend
ADMIN_BACKEND_PORT=8000
ADMIN_UI_PORT=8080
CLIENT_UI_PORT=5180
```

### 3.4. Описание переменных

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `POSTGRES_PASSWORD` | Да | Пароль PostgreSQL |
| `N8N_BASIC_AUTH_PASSWORD` | Да | Пароль для n8n UI |
| `OPENAI_API_KEY` | Да | API ключ OpenAI |
| `TELEGRAM_BOT_TOKEN` | Да* | Токен Telegram бота |
| `KOMMO_ACCESS_TOKEN` | Да* | Токен Kommo CRM |
| `KOMMO_SUBDOMAIN` | Да* | Поддомен Kommo |

\* Обязательно для соответствующей интеграции

---

## 4. PostgreSQL

### 4.1. Автоматическое создание баз

При первом запуске скрипты инициализации создают:

1. **База `n8n`** — для внутренних таблиц n8n (~107 tables)
2. **База `lead_qualification`** — для бизнес-данных (6 tables)

**Скрипты:**
- `infra/sql/00-init-databases.sh` — создание баз
- `infra/sql/01-schema.sql` — бизнес-схема

### 4.2. Проверка PostgreSQL

```bash
# Запуск PostgreSQL
docker compose up -d postgres

# Проверка статуса
docker compose ps postgres

# Проверка подключения
docker compose exec postgres pg_isready -U n8n -d n8n

# Проверка бизнес-базы
docker compose exec postgres psql -U n8n -d lead_qualification -c "\dt"
```

**Ожидаемый результат:**

```
              List of relations
 Schema |       Name        | Type  | Owner
--------+-------------------+-------+-------
 public | channel_identities| table | n8n
 public | contacts          | table | n8n
 public | crm_sync          | table | n8n
 public | leads             | table | n8n
 public | logs              | table | n8n
 public | messages          | table | n8n
 public | qualifications    | table | n8n
```

### 4.3. Резервное копирование

```bash
# Backup бизнес-базы
docker compose exec postgres pg_dump -U n8n lead_qualification > backup_$(date +%Y%m%d).sql

# Восстановление
cat backup_20260616.sql | docker compose exec -T postgres psql -U n8n lead_qualification
```

---

## 5. n8n

### 5.1. Запуск n8n

```bash
# Запуск всех сервисов (включая n8n)
docker compose up -d

# Проверка статуса
docker compose ps n8n

# Проверка логов
docker compose logs n8n --tail 50
```

### 5.2. Доступ к n8n UI

**URL:** http://localhost:5678/

**Аутентификация:** Basic Auth (из `.env`)

### 5.3. Импорт workflows

**Вариант 1 — через UI:**

1. Откройте n8n UI
2. Перейдите в «Workflows»
3. Нажмите «Import from File»
4. Выберите файл из `workflow/n8n/workflows/`

**Импортировать по порядку:**

1. `Lead Ingestion V2 - Complete.json`
2. `Lead Ingestion - Telegram UX MVP.json`
3. `Lead Classification MVP.json`
4. `Lead CRM Sync - Kommo Writer MVP.json`
5. `CRM Status Sync MVP.json`

**Вариант 2 — через CLI:**

```bash
# Импорт всех workflows
for workflow in workflow/n8n/workflows/*.json; do
  docker compose exec n8n n8n import:workflow --input=$workflow
done
```

### 5.4. Настройка credentials

**В n8n UI:**

1. Перейдите в «Credentials»
2. Создайте credential:
   - **OpenAI API**: Type = OpenAI API, Key = из `.env`
   - **Telegram**: Type = Telegram API, Token = из `.env`
   - **Kommo**: Type = HTTP Header Auth, Name = Authorization, Value = Bearer {token}

### 5.5. Активация workflows

**Для каждого workflow:**

1. Откройте workflow
2. Нажмите переключатель «Active» в правом верхнем углу
3. Сохраните (Ctrl+S)

**Проверка:**

```bash
# Список активных workflows
docker compose exec n8n n8n list:workflow --active
```

---

## 6. Admin UI

### 6.1. Сборка Admin Backend

```bash
# Сборка Docker образа
docker compose build admin-backend

# Запуск
docker compose up -d admin-backend

# Проверка
docker compose ps admin-backend
```

### 6.2. Проверка Admin Backend API

```bash
# Health check
curl http://localhost:8000/health

# Dashboard endpoint
curl http://localhost:8000/api/admin/dashboard

# Leads endpoint
curl http://localhost:8000/api/admin/leads
```

### 6.3. Запуск Admin UI

```bash
# Admin UI — статический nginx
docker compose up -d admin-ui

# Проверка
docker compose ps admin-ui
```

### 6.4. Доступ к Admin Console

**URL:** http://localhost:8080/

---

## 7. Client UI

### 7.1. Запуск Client UI

```bash
# Client UI — статический nginx
docker compose up -d client-ui

# Проверка
docker compose ps client-ui
```

### 7.2. Доступ к Client UI

**URL:** http://localhost:5180/

---

## 8. Telegram

### 8.1. Создание Telegram бота

**Через BotFather:**

1. Откройте Telegram, найдите @BotFather
2. Отправьте `/newbot`
3. Укажите имя бота (например: Lead Qual Bot)
4. Укажите username (например: leadqual_bot)
5. Сохраните полученный token

**Формат token:** `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### 8.2. Настройка webhook (опционально)

Для production рекомендуется webhook:

```bash
# Установка webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://lead-qual.alex-n8n.site/webhook/telegram"

# Проверка webhook
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

### 8.3. Тестирование Telegram бота

1. Откройте Telegram
2. Найдите бота по username
3. Отправьте `/start`
4. Должно прийти приветственное сообщение

---

## 9. Kommo CRM

### 9.1. Получение Access Token

**В Kommo:**

1. Войдите в аккаунт Kommo
2. Перейдите в Settings → API
3. Создайте интеграцию
4. Скопируйте Access Token

### 9.2. Настройка Custom Fields

**Необходимые поля:**

| Название | Тип | ID (пример) |
|----------|-----|-------------|
| Lead Type | Dropdown | 123456 |
| Priority | Dropdown | 123457 |
| Confidence | Numeric | 123458 |
| Source | Text | 123459 |

**Создание полей:**

```bash
# Пример API вызова для создания поля
curl -X POST "https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4/leads/custom_fields" \
  -H "Authorization: Bearer ${KOMMO_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lead Type",
    "type": "select",
    "enums": ["hot", "warm", "cold", "spam"]
  }'
```

### 9.3. Проверка подключения

```bash
# Проверка API
curl "https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4/account" \
  -H "Authorization: Bearer ${KOMMO_ACCESS_TOKEN}"
```

---

## 10. Запуск всех сервисов

### 10.1. Полный запуск

```bash
# Перейти в директорию infra
cd /path/to/n8n-lead-qualification/infra

# Запустить все сервисы
docker compose up -d

# Проверить статус
docker compose ps
```

**Ожидаемый результат:**

```
NAME                    STATUS    PORTS
lead-qualification-postgres    running   0.0.0.0:15432->5432/tcp
lead-qualification-n8n         running   0.0.0.0:5678->5678/tcp
lead-qualification-admin-backend running 0.0.0.0:8000->8000/tcp
lead-qualification-admin-ui     running  0.0.0.0:8080->80/tcp
lead-qualification-client-ui    running 0.0.0.0:5180->80/tcp
```

### 10.2. Проверка работоспособности

```bash
# PostgreSQL
docker compose exec postgres pg_isready -U n8n -d lead_qualification

# n8n
curl -s http://localhost:5678/health

# Admin Backend
curl -s http://localhost:8000/health

# Client UI
curl -s http://localhost:5180/

# Admin UI
curl -s http://localhost:8080/
```

---

## 11. Traefik (Production)

### 11.1. Настройка Traefik

**Файл:** `/opt/n8n/dynamic.yml` (внешний)

```yaml
http:
  routers:
    client-ui:
      rule: "Host(`lead-qual.alex-n8n.site`)"
      service: client-ui
      tls:
        certResolver: letsencrypt

    admin-ui:
      rule: "Host(`lead-qual-admin.alex-n8n.site`)"
      service: admin-ui
      tls:
        certResolver: letsencrypt

    webhook:
      rule: "Host(`lead-qual.alex-n8n.site`) && PathPrefix(`/webhook`)"
      service: n8n
      tls:
        certResolver: letsencrypt

  services:
    client-ui:
      loadBalancer:
        servers:
          - url: "http://localhost:5180"
    admin-ui:
      loadBalancer:
        servers:
          - url: "http://localhost:8080"
    n8n:
      loadBalancer:
        servers:
          - url: "http://localhost:5678"
```

### 11.2. Перезапуск Traefik

```bash
# Перезапуск
docker restart n8n_traefik_1

# Проверка логов
docker logs n8n_traefik_1 --tail 50
```

---

## 12. Проверка работоспособности

### 12.1. E2E тест

**Шаг 1: Отправить тестовый лид через Website**

```bash
curl -X POST http://localhost:5678/webhook/lead \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Тестовый Лид",
    "phone": "+79991234567",
    "email": "test@example.com",
    "message": "Хочу купить вашу услугу прямо сейчас, готов оплатить сегодня"
  }'
```

**Ожидаемый ответ:**

```json
{
  "success": true,
  "lead_id": "uuid",
  "public_number": "LQ-XXXXXX",
  "message": "Lead received successfully"
}
```

**Шаг 2: Проверить сохранение**

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c \
  "SELECT id, public_number, source, status FROM leads ORDER BY created_at DESC LIMIT 1;"
```

**Шаг 3: Дождаться классификации (до 5 минут)**

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c \
  "SELECT lead_type, confidence, suggested_action FROM qualifications ORDER BY processed_at DESC LIMIT 1;"
```

**Ожидаемый результат:**

```
 lead_type | confidence | suggested_action
-----------+------------+-----------------
 hot       |       0.92 | call
```

**Шаг 4: Проверить Admin Console**

Откройте http://localhost:8080/ → должен появиться лид

**Шаг 5: Проверить Kommo**

Откройте Kommo CRM → должна появиться сделка

### 12.2. Telegram тест

1. Откройте Telegram
2. Найдите бота
3. Отправьте `/start`
4. Отправьте текст: «Хочу купить вашу услугу, перезвоните мне»
5. Должен прийти ответ с номером заявки

---

## 13. Устранение неполадок

### 13.1. PostgreSQL не запускается

```bash
# Проверить логи
docker compose logs postgres --tail 100

# Проверить порт
lsof -i :15432

# Удалить и пересоздать
docker compose down -v
docker compose up -d postgres
```

### 13.2. n8n не подключается к PostgreSQL

```bash
# Проверить сеть
docker network inspect lead-qualification-network

# Проверить переменные
docker compose exec n8n env | grep DB

# Перезапустить
docker compose restart n8n
```

### 13.3. OpenAI API ошибки

```bash
# Проверить ключ
docker compose exec n8n env | grep OPENAI

# Тестовый запрос
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### 13.4. Telegram не отвечает

```bash
# Проверить токен
docker compose exec n8n env | grep TELEGRAM

# Проверить webhook
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
```

### 13.5. Kommo интеграция не работает

```bash
# Проверить токен
docker compose exec n8n env | grep KOMMO

# Тестовый запрос
curl "https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4/account" \
  -H "Authorization: Bearer ${KOMMO_ACCESS_TOKEN}"
```

### 13.6. Admin UI не открывается

```bash
# Проверить backend
docker compose ps admin-backend
docker compose logs admin-backend --tail 50

# Перезапустить
docker compose restart admin-backend admin-ui
```

---

## 14. Полный сброс

```bash
# Остановить все сервисы
docker compose down

# Удалить volumes
docker compose down -v

# Удалить volumes вручную
docker volume rm lead-qualification-postgres-data
docker volume rm lead-qualification-n8n-data

# Запустить заново
docker compose up -d
```

---

## 15. Обновление

### 15.1. Обновление образов

```bash
# Pull новых образов
docker compose pull

# Пересоздать контейнеры
docker compose up -d
```

### 15.2. Обновление workflows

```bash
# Экспортировать текущие workflows (backup)
for workflow in $(docker compose exec n8n n8n list:workflow --json | jq -r '.[].id'); do
  docker compose exec n8n n8n export:workflow --id=$workflow --output=/tmp/backup_$workflow.json
done

# Импортировать новые
docker compose exec n8n n8n import:workflow --input=/path/to/new/workflow.json
```

---

## 16. Полезные команды

```bash
# Статус всех сервисов
docker compose ps

# Логи конкретного сервиса
docker compose logs n8n --tail 100 -f

# Перезапуск сервиса
docker compose restart n8n

# Shell в контейнере
docker compose exec postgres bash

# Размер volumes
docker system df -v

# Очистка
docker system prune -a
```