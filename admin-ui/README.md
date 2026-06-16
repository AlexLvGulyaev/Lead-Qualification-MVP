# Lead Qualification Admin UI

Административный интерфейс для системы квалификации лидов.

## Запуск

### Локальная разработка

1. Запустить backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

2. Открыть `admin-ui/index.html` в браузере.

### Docker Compose

```bash
cd infra
docker-compose up -d admin-backend admin-ui
```

## Функции

### Dashboard

Отображает метрики:
- Общее количество лидов
- Распределение по типам (горячие, теплые, холодные, спам)
- Средняя уверенность классификации
- CRM Sync статус
- Лиды за 24 часа

### Leads Queue

Список лидов с фильтрами:
- По типу (hot/warm/cold/spam)
- По источнику (web/telegram)
- По статусу (received/qualified/processed/archived)

Клик на строку открывает детали лида.

## API Endpoints

- `GET /api/admin/dashboard` - Метрики для dashboard
- `GET /api/admin/leads` - Список лидов с фильтрами
- `GET /api/admin/leads/:id` - Детали лида

## Технологии

- Backend: FastAPI (Python)
- Frontend: Vanilla JS (без сборки)
- Database: PostgreSQL