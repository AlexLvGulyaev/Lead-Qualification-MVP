# Dashboard Information Architecture Polish

**Дата:** 2026-06-16
**Проект:** APL/cases/n8n-lead-qualification
**Экран:** Admin UI → Dashboard

---

## Выполненные изменения

### 1. Перегруппировка показателей на три логические зоны

**Проблема:** Смешение смысловых групп — статистика лидов, источников и системные показатели находились в одной визуальной группе, что затрудняло восприятие.

**Решение:** Реорганизованы карточки метрик в три именованных блока:

#### Блок 1: Лиды
- Всего лидов
- Горячие
- Тёплые
- Холодные
- Спам

#### Блок 2: Источники
- Telegram
- Website
- Social

#### Блок 3: Система
- CRM Sync
- AI Уверенность
- Лидов за 24 часа
- Лидов за 7 дней

**Реализация:**

- Добавлен класс `.metrics-block` для группировки метрик
- Добавлен класс `.metrics-block__title` для заголовков блоков
- Каждый блок имеет визуальный заголовок (например, "Лиды", "Источники", "Система")

### 2. Унификация визуальной модели распределений

**Проблема:** Распределение по типам было оформлено как horizontal bar с цветными сегментами, а распределение по источникам — как простой список с легендой.

**Решение:** Оба блока приведены к единому визуальному стилю — horizontal bar charts с цветными сегментами и легендой.

**Реализация:**

- Добавлен элемент `#sources-bar` с тремя сегментами (`bar-telegram`, `bar-website`, `bar-social`)
- Добавлены CSS-стили для `.metric-card.telegram`, `.metric-card.website`, `.metric-card.social`
- Добавлены CSS-стили для `.bar-segment.telegram`, `.bar-segment.website`, `.bar-segment.social_media`
- Обновлена функция `renderDashboard()` для заполнения bar для источников

### 3. Улучшение подписей метрик

**Проблема:** Подписи "За 24 часа" и "За 7 дней" недостаточно информативны.

**Решение:** Изменены подписи без затрагивания API:
- "За 24 часа" → "Лидов за 24 часа"
- "За 7 дней" → "Лидов за 7 дней"

**Реализация:**
Изменены только текстовые метки в HTML, без изменений в API или бизнес-логике.

---

## Технические изменения

### HTML (`admin-ui/index.html`)

```html
<!-- До: Смешанные метрики -->
<div class="metrics-section">
    <div class="metrics-row">
        <!-- Всего лидов, Горячие, Тёплые, Холодные, Спам, AI Уверенность -->
    </div>
    <div class="metrics-row">
        <!-- CRM Sync, Telegram, Website, За 24 часа, За 7 дней -->
    </div>
</div>

<!-- После: Три логических блока -->
<div class="metrics-block">
    <div class="metrics-block__title">Лиды</div>
    <div class="metrics-row">
        <!-- Всего лидов, Горячие, Тёплые, Холодные, Спам -->
    </div>
</div>
<div class="metrics-block">
    <div class="metrics-block__title">Источники</div>
    <div class="metrics-row">
        <!-- Telegram, Website, Social -->
    </div>
</div>
<div class="metrics-block">
    <div class="metrics-block__title">Система</div>
    <div class="metrics-row">
        <!-- CRM Sync, AI Уверенность, Лидов за 24 часа, Лидов за 7 дней -->
    </div>
</div>
```

### CSS (`admin-ui/styles.css`)

Добавлены новые стили:

```css
/* Блоки метрик */
.metrics-block { display: grid; gap: var(--space-sm); }
.metrics-block__title {
    font-family: var(--font-display);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0 var(--space-xs);
}

/* Карточки источников */
.metric-card.telegram { border-left: 3px solid #0088cc; }
.metric-card.website { border-left: 3px solid var(--success); }
.metric-card.social { border-left: 3px solid #a855f7; }

/* Цвета значений источников */
.metric-card.telegram .metric-value { color: #0088cc; }
.metric-card.website .metric-value { color: var(--success); }
.metric-card.social .metric-value { color: #a855f7; }

/* Сегменты bar для источников */
.bar-segment.telegram { background: #0088cc; }
.bar-segment.website { background: var(--success); }
.bar-segment.social_media { background: #a855f7; }
```

### JavaScript (`admin-ui/app.js`)

Обновлена функция `renderDashboard()`:

```javascript
// Блок 1: Лиды
document.getElementById('metric-total').textContent = data.leads.total.toLocaleString();
document.getElementById('metric-hot').textContent = data.leads.by_type.hot;
document.getElementById('metric-warm').textContent = data.leads.by_type.warm;
document.getElementById('metric-cold').textContent = data.leads.by_type.cold;
document.getElementById('metric-spam').textContent = data.leads.by_type.spam;

// Блок 2: Источники
document.getElementById('metric-telegram').textContent = data.leads.by_source.telegram || 0;
document.getElementById('metric-website').textContent = data.leads.by_source.website || 0;
document.getElementById('metric-social').textContent = data.leads.by_source.social_media || 0;

// Блок 3: Система
document.getElementById('metric-crm-success').textContent = data.crm_sync.success;
document.getElementById('metric-confidence').textContent = `${(data.qualifications.avg_confidence * 100).toFixed(0)}%`;
document.getElementById('metric-24h').textContent = data.leads.last_24h;
document.getElementById('metric-7d').textContent = data.leads.last_7d;

// Распределение по типам
// ... (без изменений)

// Распределение по источникам (новое)
const totalSources = (data.leads.by_source.telegram || 0) +
                      (data.leads.by_source.website || 0) +
                      (data.leads.by_source.social_media || 0);
if (totalSources > 0) {
    ['telegram', 'website', 'social_media'].forEach(s => {
        const el = document.getElementById(`bar-${s === 'social_media' ? 'social' : s}`);
        if (el) el.style.width = `${(((data.leads.by_source[s] || 0) / totalSources) * 100).toFixed(1)}%`;
    });
}
```

---

## Решения по информационной архитектуре

### 1. Логическая группировка показателей

**Принцип:** Разделение на три смысловые зоны (Лиды, Источники, Система) вместо смешанной группы.

**Обоснование:**
- **Лиды** — основная бизнес-сущность, требует отдельного фокуса
- **Источники** — каналы поступления, отдельная аналитическая проекция
- **Система** — технические и операционные показатели

### 2. Визуальная консистентность

**Принцип:** Одинаковые сущности (распределения) должны иметь одинаковое визуальное представление.

**Обоснование:**
- Оба распределения (по типам и по источникам) показывают одну и ту же сущность: распределение элементов по категориям
- Единый визуальный язык улучшает восприятие и снижает когнитивную нагрузку
- Horizontal bar charts с цветными сегментами — интуитивно понятный способ отображения распределений

### 3. Улучшение подписей

**Принцип:** Подписи должны быть самодостаточными и понятными без контекста.

**Обоснование:**
- "За 24 часа" → неоднозначно: за 24 часа что?
- "Лидов за 24 часа" → однозначно и понятно

---

## Ограничения

Выполнено строго в рамках ограничений:

- ✅ Backend не изменён
- ✅ API не изменён
- ✅ БД не изменена
- ✅ Бизнес-логика не изменена
- ✅ Расчёт метрик не изменён
- ✅ Работа только на уровне фронтенда и визуальной организации информации

---

## Результат

Dashboard теперь имеет:

1. **Логичную структуру:** Три именованных блока с чётким разделением по смыслу
2. **Визуальную консистентность:** Оба распределения отображаются одинаково
3. **Понятные подписи:** Метрики самодостаточны и не требуют дополнительного контекста

---

## Изменённые файлы

1. `admin-ui/index.html` — перегруппировка метрик в три блока, добавление заголовков блоков
2. `admin-ui/styles.css` — стили для новых элементов и унификация распределений
3. `admin-ui/app.js` — обновление логики отображения распределения по источникам