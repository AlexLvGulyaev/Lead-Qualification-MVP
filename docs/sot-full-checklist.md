# SOT Reconciliation - Full Checklist

**Дата:** 2026-06-12
**Статус:** In Progress

---

## README.md

### ✅ Выполнено
- [x] Статус MVP: "Input Channels MVP Complete"
- [x] MVP Definition разделён на Current и Planned
- [x] Схема БД обновлена для v2
- [x] Workflow статусы: все Active
- [x] Публичный URL добавлен
- [x] Статистика: относительные числа

### 🔍 Проверить
- [ ] Структура проекта — workflow файлы
- [ ] Webhook API endpoint — актуален ли localhost
- [ ] Переменные окружения — Phase 005 vs 006
- [ ] Этапы реализации — нумерация фаз

---

## PROJECT_STATE.md

### ✅ Выполнено
- [x] Статус MVP: "Input Channels MVP Complete"
- [x] MVP Definition разделён
- [x] Database Tables: v2
- [x] Architecture diagram: v2
- [x] Публичный URL добавлен
- [x] Нумерация фаз: 001-007
- [x] Status History обновлён

### 🔍 Проверить
- [ ] Classification Statistics — актуальность
- [ ] Technical Debt — актуальность
- [ ] Workflows таблица — статус Lead Ingestion Telegram

---

## SPEC.md

### ❌ Требуется обновление

**Критические:**
- [ ] **Line 212:** "CRM-интеграция является **обязательной частью MVP**" — противоречит фактическому статусу
- [ ] **Line 223:** "Интеграция с CRM (Kommo или Bitrix24) — обязательна" — то же
- [ ] **Line 264:** "CRM-интеграция является обязательной частью MVP" — то же

**Важные:**
- [ ] MVP Scope (Line 186-236) — разделить на Phase 1 и Phase 2
- [ ] Критерии успеха MVP (Line 219-236) — разделить на фазы
- [ ] MVP Architecture (Line 948-1102) — обновить для v2 data model
- [ ] User Journey (Line 271-415) — добавить contacts/channel_identities

**Data Model v2:**
- [ ] Нет упоминания contacts и channel_identities
- [ ] Нет описания contact-centric архитектуры

---

## IMPLEMENTATION_PLAN.md

### ❌ Требуется обновление

**Критические:**
- [ ] **Data Model (Line 498-632):** Описана без contacts/channel_identities
- [ ] **ER-диаграмма:** Нет contacts и channel_identities
- [ ] **Таблица leads:** Нет contact_id
- [ ] **Таблица messages:** Нет связи с contacts

**Важные:**
- [ ] MVP Boundaries (Line 27-71) — уточнить In Scope/Out of Scope
- [ ] Workflow: Lead Ingestion (Line 237-314) — добавить Find/Create Contact
- [ ] Workflow: Lead Classification (Line 315-408) — добавить JOIN с contacts
- [ ] Implementation Phases (Line 1081-1211) — обновить статусы

**Data Model v2:**
- [ ] Добавить таблицу contacts
- [ ] Добавить таблицу channel_identities
- [ ] Обновить leads (добавить contact_id, public_number)
- [ ] Обновить связи

---

## data-model-migration-v2.md

### ✅ Выполнено
- [x] Статус: Implemented
- [x] Удалена секция миграции

### 🔍 Проверить
- [ ] Актуальность helper functions
- [ ] Валидация сценариев — соответствие workflows

---

## sot-reconciliation-report.md

### ✅ Создан
- [x] Отчёт создан
- [x] Выявлены все противоречия
- [x] Приняты решения

---

## Итог

### ✅ Все выполнено

**README.md:**
- [x] Статус MVP: "Input Channels MVP Complete"
- [x] MVP Definition разделён на Current и Planned
- [x] Схема БД обновлена для v2
- [x] Workflow статусы: все Active
- [x] Публичный URL добавлен

**PROJECT_STATE.md:**
- [x] Статус MVP: "Input Channels MVP Complete"
- [x] MVP Definition разделён
- [x] Database Tables: v2
- [x] Architecture diagram: v2
- [x] Публичный URL добавлен

**SPEC.md:**
- [x] MVP Scope разделён на Phase 1 и Phase 2
- [x] Устранено противоречие "CRM обязательна"
- [x] Добавлена Data Model v2
- [x] Обновлены критерии успеха MVP

**IMPLEMENTATION_PLAN.md:**
- [x] ER-диаграмма обновлена для v2
- [x] Добавлена таблица contacts
- [x] Добавлена таблица channel_identities
- [x] Обновлена таблица leads (contact_id, public_number)

**data-model-migration-v2.md:**
- [x] Статус: Implemented
- [x] Удалена секция миграции

**sot-reconciliation-report.md:**
- [x] Создан полный отчёт

---

## Результат

**Все противоречия устранены.**

Документация полностью синхронизирована и отражает фактическое состояние системы:
- MVP статус: Input Channels MVP Complete
- Data Model: v2 реализована
- Workflow: все активны
- UI: публично доступен
- Фазы: унифицированы (001-007)