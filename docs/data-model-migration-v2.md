# Data Model v2 Reference

## Target Model v2.0

**Дата:** 2026-06-12
**Статус:** ✅ Implemented
**Дата реализации:** 2026-06-12

---

## Обзор

Целевая модель данных v2 реализована и используется в production. Модель разделяет следующие сущности:

---

## Обзор изменений

Целевая модель данных разделяет следующие сущности:

| Сущность | Назначение | Пример |
|----------|------------|--------|
| **contacts** | Человек/организация (WHO) | Иван Петров, +79991234567 |
| **channel_identities** | Идентификаторы в каналах | telegram_user_id: 123456789 |
| **leads** | Обращение/запрос (WHAT) | Статус: received, source: telegram |
| **messages** | Сообщения в рамках обращения | "Хочу узнать о ваших услугах" |
| **qualifications** | Результаты классификации | lead_type: hot, confidence: 0.92 |

---

## Диаграмма связей

```
┌─────────────────┐       ┌─────────────────────┐
│    contacts     │       │ channel_identities  │
├─────────────────┤       ├─────────────────────┤
│ id (PK)         │───┐   │ id (PK)             │
│ name            │   │   │ contact_id (FK)     │───┐
│ phone           │   │   │ channel             │   │
│ email           │   │   │ external_id         │   │
│ company         │   │   │ channel_data (JSONB)│   │
│ notes           │   │   └─────────────────────┘   │
│ created_at      │   │                             │
│ updated_at      │   │   UNIQUE(channel, external_id)
└─────────────────┘   │
        │             │
        │ 1:N         │
        ▼             │
┌─────────────────┐   │
│     leads       │   │
├─────────────────┤   │
│ id (PK)         │   │
│ contact_id (FK) │───┘
│ source          │
│ status          │
│ utm_source      │
│ utm_campaign    │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌─────────────────┐
│    messages     │       │ qualifications  │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ lead_id (FK)    │───┐   │ lead_id (FK)    │───┐
│ channel         │   │   │ lead_type       │   │
│ direction       │   │   │ interest        │   │
│ content         │   │   │ priority        │   │
│ created_at      │   │   │ confidence      │   │
└─────────────────┘   │   │ ...             │   │
                      │   └─────────────────┘   │
                      │                         │
                      └─────────────────────────┘
```

---

## Реализация

Модель v2 развернута в production 2026-06-12. Все workflows обновлены для работы с contact-centric архитектурой.

**Статус:**
- ✅ Таблицы `contacts` и `channel_identities` созданы
- ✅ Workflows обновлены для работы с контактами
- ✅ Дедупликация контактов по email/phone/telegram_id реализована
- ✅ Helper functions развёрнуты

**Проверка:**

```sql
-- Проверить реализацию
SELECT
    (SELECT COUNT(*) FROM contacts) AS total_contacts,
    (SELECT COUNT(*) FROM channel_identities) AS total_identities,
    (SELECT COUNT(*) FROM leads WHERE contact_id IS NOT NULL) AS leads_with_contacts,
    (SELECT COUNT(*) FROM leads WHERE contact_id IS NULL) AS leads_without_contacts;
```

**Ожидаемый результат:**
- `leads_without_contacts` = 0 (все leads связаны с contacts)
- `total_contacts` > 0
- `total_identities` > 0

---

## Workflow изменения

### Telegram Workflow

**Старая логика:**
```
Telegram message → INSERT lead with external_id = telegram_user_id
```

**Новая логика:**
```
Telegram message
↓
find_or_create_contact_by_telegram(telegram_id, name, username)
↓
Create new lead for this contact
↓
Create message
↓
Send confirmation
```

### Web Form Workflow

**Старая логика:**
```
Web form → INSERT lead without deduplication
```

**Новая логика:**
```
Web form
↓
find_or_create_contact_by_email_phone(email, phone, name)
↓
Create new lead for this contact
↓
Create message
↓
Return success
```

### Classification Workflow

**Изменения:**
- JOIN с contacts для получения contact_name, contact_phone, contact_email
- Остальная логика без изменений

---

## Helper Functions

### find_or_create_contact_by_telegram

Находит или создаёт контакт по Telegram ID.

```sql
SELECT find_or_create_contact_by_telegram(
  '123456789'::VARCHAR,  -- telegram_user_id
  'Иван Петров'::VARCHAR, -- name
  'ivan_petrov'::VARCHAR  -- username
);
-- Returns: UUID (contact_id)
```

### find_or_create_contact_by_email_phone

Находит или создаёт контакт по email или телефону.

```sql
SELECT find_or_create_contact_by_email_phone(
  'ivan@mail.ru'::VARCHAR, -- email
  '+79991234567'::VARCHAR, -- phone
  'Иван Петров'::VARCHAR   -- name
);
-- Returns: UUID (contact_id)
```

---

## Обратная совместимость

Для обратной совместимости создано представление:

```sql
SELECT * FROM leads_with_contacts;
```

Это представление объединяет leads и contacts для совместимости с существующими запросами.

---

## Валидация сценариев

### Сценарий 1: Telegram first message

1. Отправить сообщение в Telegram-бота
2. Проверить:
   - [ ] contact создан
   - [ ] channel_identity создан (channel=telegram, external_id=telegram_user_id)
   - [ ] lead создан с contact_id
   - [ ] message создан
   - [ ] log создан
   - [ ] confirmation отправлен

### Сценарий 2: Telegram repeated message

1. Отправить второе сообщение от того же пользователя
2. Проверить:
   - [ ] новый contact НЕ создаётся (COUNT(*) не изменился)
   - [ ] channel_identity НЕ дублируется
   - [ ] новый lead создаётся
   - [ ] новое message создаётся

### Сценарий 3: Web Form first submission

1. Отправить форму с email/phone
2. Проверить:
   - [ ] contact создан
   - [ ] lead создан с contact_id
   - [ ] message создан

### Сценарий 4: Web Form repeated submission

1. Отправить форму с тем же email/phone
2. Проверить:
   - [ ] новый contact НЕ создаётся
   - [ ] новый lead создаётся для существующего contact

### Сценарий 5: AI Classification

1. Запустить Classification workflow
2. Проверить:
   - [ ] leads переходят из received в qualified
   - [ ] qualifications создаются с корректными FK
   - [ ] нет ошибок FK constraint

---

## Откат

При необходимости отката:

```sql
-- Удалить новые таблицы
DROP TABLE IF EXISTS channel_identities CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;

-- Удалить contact_id из leads
ALTER TABLE leads DROP COLUMN IF EXISTS contact_id;
```

**Внимание:** Откат приведёт к потере данных, мигрированных в новые таблицы.

---

## Примечания

- UNIQUE constraint на `channel_identities(channel, external_id)` гарантирует отсутствие дубликатов идентификаторов
- Helper functions упрощают логику workflow
- Представление `leads_with_contacts` обеспечивает обратную совместимость
- Миграция данных опциональна — можно запустить на пустой БД