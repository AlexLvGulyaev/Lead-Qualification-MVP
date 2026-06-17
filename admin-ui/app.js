// Configuration
const API_BASE = '';
const PAGE_SIZE = 10; // Количество айтемов на странице
const KOMMO_SUBDOMAIN = 'sbsgulyaeval';
const KOMMO_BASE_URL = 'https://sbsgulyaeval.kommo.com';

// State
let currentPage = 'dashboard';
let currentFilters = { type: '', source: '' };
let currentSearch = '';
let currentPageNum = 0;
let totalLeads = 0;
let selectedLeadId = null;
let selectedEventId = null;

// DOM Elements (global for showPage access)
let navItems = null;
let pages = null;

// Workspace titles
const workspaceTitles = {
    dashboard: { title: 'Dashboard', subtitle: 'Обзор показателей системы' },
    leads: { title: 'Очередь лидов', subtitle: 'Журнал квалифицированных лидов' },
    monitoring: { title: 'Мониторинг событий', subtitle: 'Журнал системных событий' },
    system: { title: 'Состояние системы', subtitle: 'Мониторинг компонентов' }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    navItems = document.querySelectorAll('.nav-item');
    pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(item.dataset.page);
        });
    });

    document.getElementById('filter-type').addEventListener('change', (e) => {
        currentFilters.type = e.target.value;
        currentPageNum = 0;
        loadLeads();
    });

    document.getElementById('filter-source').addEventListener('change', (e) => {
        currentFilters.source = e.target.value;
        currentPageNum = 0;
        loadLeads();
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
        currentSearch = e.target.value;
        currentPageNum = 0;
        loadLeads();
    });

    document.getElementById('pagination-prev').addEventListener('click', () => {
        if (currentPageNum > 0) { currentPageNum--; loadLeads(); }
    });

    document.getElementById('pagination-next').addEventListener('click', () => {
        if ((currentPageNum + 1) * PAGE_SIZE < totalLeads) { currentPageNum++; loadLeads(); }
    });

    showPage('dashboard');
    updateSystemStatus();
});

function showPage(page) {
    currentPage = page;
    // Сброс выбранного лида при переключении страницы (кроме страницы leads)
    if (page !== 'leads') {
        selectedLeadId = null;
    }
    navItems.forEach(item => item.classList.toggle('active', item.dataset.page === page));
    pages.forEach(p => p.classList.toggle('active', p.id === `${page}-page`));
    const ws = workspaceTitles[page] || workspaceTitles.dashboard;
    document.getElementById('workspace-title').textContent = ws.title;
    document.getElementById('workspace-subtitle').textContent = ws.subtitle;
    if (page === 'dashboard') loadDashboard();
    else if (page === 'leads') loadLeads();
    else if (page === 'monitoring') loadMonitoring();
    else if (page === 'system') loadSystem();
}

async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/dashboard`);
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        renderDashboard(data);
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderDashboard(data) {
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
    const total = data.leads.total;
    if (total > 0) {
        ['hot', 'warm', 'cold', 'spam'].forEach(t => {
            const el = document.getElementById(`bar-${t}`);
            if (el) el.style.width = `${((data.leads.by_type[t] / total) * 100).toFixed(1)}%`;
        });
        document.getElementById('distribution-legend').innerHTML = [
            {k:'hot', v:data.leads.by_type.hot, l:'Горячие'},
            {k:'warm', v:data.leads.by_type.warm, l:'Тёплые'},
            {k:'cold', v:data.leads.by_type.cold, l:'Холодные'},
            {k:'spam', v:data.leads.by_type.spam, l:'Спам'}
        ].map(t => `<div class="legend-item"><div class="legend-dot ${t.k}"></div><span class="legend-label">${t.l}</span><span class="legend-value">${t.v}</span></div>`).join('');
    }

    // Распределение по источникам
    const totalSources = (data.leads.by_source.telegram || 0) + (data.leads.by_source.website || 0) + (data.leads.by_source.social_media || 0);
    if (totalSources > 0) {
        ['telegram', 'website', 'social_media'].forEach(s => {
            const el = document.getElementById(`bar-${s === 'social_media' ? 'social' : s}`);
            if (el) el.style.width = `${(((data.leads.by_source[s] || 0) / totalSources) * 100).toFixed(1)}%`;
        });
    }
    document.getElementById('sources-legend').innerHTML = [
        {k:'telegram', v:data.leads.by_source.telegram || 0, l:'Telegram'},
        {k:'website', v:data.leads.by_source.website || 0, l:'Website'},
        {k:'social_media', v:data.leads.by_source.social_media || 0, l:'Social'}
    ].map(s => `<div class="legend-item"><div class="legend-dot ${s.k}"></div><span class="legend-label">${s.l}</span><span class="legend-value">${s.v}</span></div>`).join('');
}

async function loadLeads() {
    const listContainer = document.getElementById('leads-list');
    listContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><div class="loading-text">Загрузка...</div></div>';
    try {
        const params = new URLSearchParams();
        params.append('page', currentPageNum);
        params.append('size', PAGE_SIZE);
        if (currentFilters.type) params.append('lead_type', currentFilters.type);
        if (currentFilters.source) params.append('source', currentFilters.source);
        if (currentSearch) params.append('search', currentSearch);

        const response = await fetch(`${API_BASE}/api/admin/leads?${params}`);
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        totalLeads = data.total;

        document.getElementById('pagination-shown').textContent = Math.min((currentPageNum + 1) * PAGE_SIZE, totalLeads);
        document.getElementById('pagination-total').textContent = totalLeads;
        document.getElementById('pagination-page').textContent = currentPageNum + 1;
        document.getElementById('pagination-prev').disabled = currentPageNum === 0;
        document.getElementById('pagination-next').disabled = (currentPageNum + 1) * PAGE_SIZE >= totalLeads;

        renderLeads(data.items);
    } catch (error) {
        console.error('Error:', error);
        listContainer.innerHTML = '<div class="empty-state"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg><h3 class="empty-title">Ошибка</h3><p class="empty-text">' + error.message + '</p></div>';
    }
}

function renderLeads(leads) {
    const listContainer = document.getElementById('leads-list');
    if (!leads || leads.length === 0) {
        listContainer.innerHTML = '<div class="empty-state"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg><h3 class="empty-title">Нет лидов</h3><p class="empty-text">Лиды не найдены</p></div>';
        return;
    }

    listContainer.innerHTML = leads.map(lead => {
        const timestamp = formatDate(lead.created_at);
        const statusBadge = getStatusBadge(lead.status);
        const preview = lead.first_message ? truncate(lead.first_message, 80) : 'Нет сообщения';
        const telemetry = [
            {icon:'📡', v:getSourceLabel(lead.source)},
            {icon:getTypeIcon(lead.lead_type), v:getTypeLabel(lead.lead_type)},
            {icon:getPriorityIcon(lead.priority), v:getPriorityLabel(lead.priority)},
            {icon:'🎯', v:`${Math.round((lead.confidence||0)*100)}%`}
        ];
        return `
            <div class="list-item ${selectedLeadId === lead.id ? 'selected' : ''}" onclick="selectLead('${lead.id}')">
                <div class="list-item__row">
                    <span class="list-item__timestamp">${timestamp}</span>
                    <span class="list-item__id">${lead.public_number || 'LQ-?'}</span>
                    <span class="list-item__status">${statusBadge}</span>
                </div>
                <div class="list-item__preview">${preview}</div>
                <div class="list-item__telemetry">${telemetry.map(t=>`<span class="list-item__telemetry-item">${t.icon} ${t.v}</span>`).join('')}</div>
            </div>`;
    }).join('');

    // Автофокус на первый лид при загрузке (только если это первая страница и нет выбранного лида)
    if (currentPageNum === 0 && selectedLeadId === null && leads.length > 0) {
        selectLead(leads[0].id);
    }
}

async function selectLead(leadId) {
    selectedLeadId = leadId;
    document.querySelectorAll('.list-item').forEach(item => item.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    const detailDiv = document.getElementById('lead-detail');
    detailDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><div class="loading-text">Загрузка...</div></div>';
    try {
        const response = await fetch(`${API_BASE}/api/admin/leads/${leadId}`);
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        renderLeadDetail(data);
    } catch (error) {
        console.error('Error:', error);
        detailDiv.innerHTML = '<div class="empty-state"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg><h3 class="empty-title">Ошибка</h3><p class="empty-text">' + error.message + '</p></div>';
    }
}

function renderLeadDetail(data) {
    const lead = data.lead || data;
    const qual = data.qualification;
    const crm = data.crm_sync;
    const messages = data.messages || [];
    const clientMessage = messages.length > 0 && messages[0].content ? messages[0].content : 'Нет сообщения';
    const detailDiv = document.getElementById('lead-detail');

    // Build CRM sync panels (after content-panels)
    const hasCrmData = crm && crm.kommo_lead_id;
    // Используем реальный URL из API, если он есть, иначе формируем из KOMMO_BASE_URL
    const kommoUrl = crm?.kommo_url || (hasCrmData ? `${KOMMO_BASE_URL}/leads/detail/${crm.kommo_lead_id}` : null);

    const crmSyncHtml = hasCrmData ? `
        <div class="passport-panel">
            <div class="passport-panel__title">CRM Синхронизация</div>
            <div class="passport-field">
                <span class="passport-field__label">Статус синхронизации</span>
                <span class="passport-field__value"><span class="badge success">${getCRMStatusLabel(crm?.sync_status)}</span></span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Создана запись</span>
                <span class="passport-field__value">${crm.created_at ? formatDate(crm.created_at) : '—'}</span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Последняя синхронизация</span>
                <span class="passport-field__value">${crm.crm_synced_at ? formatDate(crm.crm_synced_at) : '—'}</span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Начальная задача создана</span>
                <span class="passport-field__value">${crm.initial_task_created ? 'Да' : 'Нет'}</span>
            </div>
        </div>
        <div class="passport-panel">
            <div class="passport-panel__title">Состояние сделки</div>
            <div class="passport-field">
                <span class="passport-field__label">Воронка</span>
                <span class="passport-field__value">${crm.kommo_pipeline_name || '—'}</span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Статус сделки</span>
                <span class="passport-field__value"><span class="badge">${crm.kommo_status_name || '—'}</span></span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Активная задача</span>
                <span class="passport-field__value">${crm.crm_has_active_task ? 'Да' : 'Нет'}</span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Ближайшая задача</span>
                <span class="passport-field__value">${crm.crm_closest_task_at ? formatDate(crm.crm_closest_task_at) : '—'}</span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Дата закрытия</span>
                <span class="passport-field__value">${crm.crm_closed_at ? formatDate(crm.crm_closed_at) : '—'}</span>
            </div>
        </div>
    ` : `
        <div class="passport-panel">
            <div class="passport-panel__title">CRM Синхронизация</div>
            <div class="passport-field">
                <span class="passport-field__label">Статус синхронизации</span>
                <span class="passport-field__value"><span class="badge ${crm?.sync_status || 'pending'}">${getCRMStatusLabel(crm?.sync_status)}</span></span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Создана запись</span>
                <span class="passport-field__value">${crm?.created_at ? formatDate(crm.created_at) : '—'}</span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Последняя синхронизация</span>
                <span class="passport-field__value">${crm?.crm_synced_at ? formatDate(crm.crm_synced_at) : '—'}</span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Начальная задача создана</span>
                <span class="passport-field__value">${crm?.initial_task_created ? 'Да' : 'Нет'}</span>
            </div>
        </div>
        <div class="passport-panel">
            <div class="passport-panel__title">Состояние сделки</div>
            <div class="passport-field">
                <span class="passport-field__label">Воронка</span>
                <span class="passport-field__value">—</span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Статус сделки</span>
                <span class="passport-field__value">—</span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Активная задача</span>
                <span class="passport-field__value">—</span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Ближайшая задача</span>
                <span class="passport-field__value">—</span>
            </div>
            <div class="passport-field">
                <span class="passport-field__label">Дата закрытия</span>
                <span class="passport-field__value">—</span>
            </div>
        </div>
    `;

    detailDiv.innerHTML = `
        <div class="card-header">
            <div class="card-header__title">Лид ${lead.public_number || 'LQ-?'}</div>
            <div class="object-status object-status--${getStatusClass(lead.status)}">${getStatusLabel(lead.status)}</div>
        </div>
        <div class="card-body">
            <div class="passport-panels">
                <div class="passport-panel">
                    <div class="passport-panel__title">Паспорт лида</div>
                    <div class="passport-field"><span class="passport-field__label">Создан</span><span class="passport-field__value">${formatDate(lead.created_at)}</span></div>
                    <div class="passport-field"><span class="passport-field__label">Источник</span><span class="passport-field__value"><span class="badge ${lead.source}">${getSourceLabel(lead.source)}</span></span></div>
                    <div class="passport-field"><span class="passport-field__label">Клиент</span><span class="passport-field__value ${!lead.name?'missing':''}">${lead.name||'Не указан'}</span></div>
                    <div class="passport-field"><span class="passport-field__label">Телефон</span><span class="passport-field__value ${!lead.phone?'missing':''}">${lead.phone||'Не указан'}</span></div>
                    <div class="passport-field"><span class="passport-field__label">Email</span><span class="passport-field__value ${!lead.email?'missing':''}">${lead.email||'Не указан'}</span></div>
                </div>
                <div class="passport-panel">
                    <div class="passport-panel__title">Квалификация лида</div>
                    <div class="passport-field"><span class="passport-field__label">Квалифицирован</span><span class="passport-field__value">${qual?.processed_at?formatDate(qual.processed_at):'—'}</span></div>
                    <div class="passport-field"><span class="passport-field__label">Тип</span><span class="passport-field__value"><span class="badge ${qual?.lead_type}">${getTypeLabel(qual?.lead_type)}</span></span></div>
                    <div class="passport-field"><span class="passport-field__label">Приоритет</span><span class="passport-field__value"><span class="badge ${qual?.priority}">${getPriorityLabel(qual?.priority)}</span></span></div>
                    <div class="passport-field"><span class="passport-field__label">Уверенность</span><span class="passport-field__value">${qual?.confidence?Math.round(qual.confidence*100)+'%':'—'}</span></div>
                    <div class="passport-field"><span class="passport-field__label">Рекомендуемое действие</span><span class="passport-field__value">${getActionLabel(qual?.suggested_action)}</span></div>
                </div>
            </div>
            <div class="content-panels">
                <div class="content-panel">
                    <div class="content-panel__header">
                        <svg class="content-panel__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12v8H2z"/><path d="M2 8h12"/></svg>
                        <span class="content-panel__title">Обращение клиента</span>
                    </div>
                    <div class="content-panel__body"><div class="content-panel__text">${escapeHtml(clientMessage)}</div></div>
                </div>
                <div class="content-panel">
                    <div class="content-panel__header">
                        <svg class="content-panel__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1v14M1 8h14"/><circle cx="8" cy="8" r="6"/></svg>
                        <span class="content-panel__title">Решение системы</span>
                        <div class="content-panel__badges"><span class="badge ${qual?.lead_type}">${getTypeLabel(qual?.lead_type)}</span><span class="content-panel__confidence">${qual?.confidence?Math.round(qual.confidence*100)+'%':'—'}</span></div>
                    </div>
                    <div class="content-panel__body">
                        <div class="content-panel__text">${qual?.reasoning||'Квалификация выполнена'}</div>
                    </div>
                </div>
            </div>
            <div class="passport-panels">
                ${crmSyncHtml}
            </div>
            <details class="collapsed-zone">
                <summary>Timeline</summary>
                <div class="collapsed-zone__content">
                    <div class="timeline">
                        <div class="timeline-stage">
                            <div class="timeline-stage__top">
                                <div class="timeline-stage__left">
                                    <span class="timeline-stage__marker timeline-stage__marker--success"></span>
                                    <span class="timeline-stage__time">${formatDate(lead.created_at)}</span>
                                    <span class="timeline-stage__name">Создан</span>
                                </div>
                                <span class="timeline-stage__status">Успешно</span>
                            </div>
                            <div class="timeline-stage__bottom" onclick="showJson(this, {id:'${lead.id}', source:'${lead.source}', public_number:'${lead.public_number}'})">id: ${lead.public_number || lead.id.substring(0,8)} · source: ${lead.source}</div>
                        </div>
                        ${qual?`
                        <div class="timeline-stage">
                            <div class="timeline-stage__top">
                                <div class="timeline-stage__left">
                                    <span class="timeline-stage__marker timeline-stage__marker--success"></span>
                                    <span class="timeline-stage__time">${qual.processed_at?formatDate(qual.processed_at):'—'}</span>
                                    <span class="timeline-stage__name">Квалифицирован</span>
                                </div>
                                <span class="timeline-stage__status">Успешно</span>
                            </div>
                            <div class="timeline-stage__bottom" onclick="showJson(this, {lead_type:'${qual.lead_type}', priority:'${qual.priority}', confidence:${qual.confidence}, suggested_action:'${qual.suggested_action}'})">type: ${qual.lead_type} · confidence: ${Math.round((qual.confidence||0)*100)}%</div>
                        </div>
                        `:''}
                        ${lead.status==='processed'?`
                        <div class="timeline-stage">
                            <div class="timeline-stage__top">
                                <div class="timeline-stage__left">
                                    <span class="timeline-stage__marker timeline-stage__marker--success"></span>
                                    <span class="timeline-stage__time">${crm?.created_at?formatDate(crm.created_at):'—'}</span>
                                    <span class="timeline-stage__name">Передан в CRM</span>
                                </div>
                                <span class="timeline-stage__status">Успешно</span>
                            </div>
                            <div class="timeline-stage__bottom" onclick="showJson(this, {sync_status:'${crm?.sync_status||'pending'}', kommo_lead_id:'${crm?.kommo_lead_id||''}'})">sync_status: ${crm?.sync_status||'pending'} · kommo_lead_id: ${crm?.kommo_lead_id||'—'}</div>
                        </div>
                        `:''}
                    </div>
                </div>
            </details>
        </div>`;
}

async function loadMonitoring() {
    const listContainer = document.getElementById('monitoring-list');
    listContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><div class="loading-text">Загрузка...</div></div>';
    try {
        const response = await fetch(`${API_BASE}/api/admin/leads?page=0&size=50`);
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        renderMonitoring(data.items);
    } catch (error) {
        console.error('Error:', error);
        listContainer.innerHTML = '<div class="empty-state"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg><h3 class="empty-title">Ошибка</h3><p class="empty-text">' + error.message + '</p></div>';
    }
}

function renderMonitoring(events) {
    const listContainer = document.getElementById('monitoring-list');
    if (!events || events.length === 0) {
        listContainer.innerHTML = '<div class="empty-state"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg><h3 class="empty-title">Нет событий</h3><p class="empty-text">События отсутствуют</p></div>';
        return;
    }
    listContainer.innerHTML = events.map(event => {
        const timestamp = formatDate(event.created_at);
        const statusBadge = getCRMStatusBadge(event.crm_sync_status);
        const preview = `Тип: ${getTypeLabel(event.lead_type)} · Источник: ${getSourceLabel(event.source)}`;
        return `
            <div class="list-item ${selectedEventId === event.id ? 'selected' : ''}" onclick="selectEvent('${event.id}')">
                <div class="list-item__row">
                    <span class="list-item__timestamp">${timestamp}</span>
                    <span class="list-item__id">${event.public_number || 'LQ-?'}</span>
                    <span class="list-item__status">${statusBadge}</span>
                </div>
                <div class="list-item__preview">${preview}</div>
                <div class="list-item__telemetry"><span class="list-item__telemetry-item">${event.public_number || event.id.substring(0,8)}</span></div>
            </div>`;
    }).join('');
}

function selectEvent(eventId) {
    selectedEventId = eventId;
    document.querySelectorAll('.list-item').forEach(item => item.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    selectLead(eventId);
}

async function loadSystem() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/health/detailed`);
        if (!response.ok) throw new Error('Failed');
        const health = await response.json();
        const systems = [
            {name:'PostgreSQL', status:health.components?.postgresql?.status||'unknown', icon:'🗄️'},
            {name:'n8n', status:health.components?.n8n?.status||'unknown', icon:'🔄'},
            {name:'Admin Backend', status:health.components?.admin_backend?.status||'online', icon:'⚙️'},
            {name:'CRM Integration', status:health.components?.crm_integration?.status||'unknown', icon:'📊'},
            {name:'Telegram', status:health.components?.telegram_integration?.status||'unknown', icon:'✈️'},
            {name:'AI Classification', status:health.components?.ai_classification?.status||'unknown', icon:'🤖'}
        ];
        document.getElementById('system-metrics').innerHTML = systems.map(s=>`
            <div class="metric-card ${s.status==='online'?'success':''}">
                <div class="metric-header"><span class="metric-label">${s.icon} ${s.name}</span><div class="status-indicator ${s.status==='online'?'':s.status==='error'?'error':'pending'}"></div></div>
                <div class="metric-value">${s.status==='online'?'Online':s.status}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
}
function truncate(str, len) { return str ? (str.length > len ? str.substring(0,len)+'...':str) : ''; }
function escapeHtml(str) { return str ? str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
function getTypeLabel(t) { const l={hot:'Горячий',warm:'Тёплый',cold:'Холодный',spam:'Спам'}; return l[t]||t; }
function getTypeIcon(t) { const i={hot:'🔥',warm:'🌡️',cold:'❄️',spam:'🗑️'}; return i[t]||'📋'; }
function getSourceLabel(s) { const l={telegram:'Telegram',website:'Website',social_media:'Social'}; return l[s]||s; }
function getPriorityLabel(p) { const l={high:'Высокий',medium:'Средний',low:'Низкий'}; return l[p]||p; }
function getPriorityIcon(p) { const i={high:'⚡',medium:'➤',low:'○'}; return i[p]||'○'; }
function getActionLabel(a) { const l={call:'Звонок',email:'Email',archive:'В архив',reject:'Отклонить'}; return l[a]||a||'—'; }
function getStatusLabel(s) { const l={received:'Получен',qualified:'Квалифицирован',processed:'Передан в CRM',archived:'В архиве'}; return l[s]||s; }
function getStatusClass(s) { const c={received:'pending',qualified:'success',processed:'success',archived:'pending'}; return c[s]||'pending'; }
function getStatusBadge(s) { return `<span class="badge ${getStatusClass(s)}">${getStatusLabel(s)}</span>`; }
function getCRMStatusLabel(s) { const l={success:'Успешно',pending:'В очереди',failed:'Ошибка'}; return l[s]||s; }
function getCRMStatusBadge(s) { return `<span class="badge ${s==='success'?'success':s==='failed'?'error':'pending'}">${getCRMStatusLabel(s)}</span>`; }

function showJson(element, data) {
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('json-modal');
    if (existingModal) existingModal.remove();

    // Получаем позицию элемента
    const rect = element.getBoundingClientRect();

    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.id = 'json-modal';
    modal.style.cssText = `
        position: fixed;
        left: ${Math.min(rect.left, window.innerWidth - 420)}px;
        top: ${Math.min(rect.bottom + 5, window.innerHeight - 200)}px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: var(--space-md);
        font-family: var(--font-mono);
        font-size: 0.75rem;
        color: var(--text-secondary);
        max-width: 400px;
        max-height: 180px;
        overflow: auto;
        z-index: 1000;
        box-shadow: var(--shadow-lg);
    `;
    modal.textContent = JSON.stringify(data, null, 2);

    // Закрытие по клику вне модального окна
    modal.onclick = (e) => e.stopPropagation();
    document.body.appendChild(modal);

    // Закрытие по клику в любом месте
    setTimeout(() => {
        document.addEventListener('click', function closeModal() {
            modal.remove();
            document.removeEventListener('click', closeModal);
        }, {once: true});
    }, 100);
}

function updateSystemStatus() {
    fetch(`${API_BASE}/api/admin/health/detailed`)
        .then(res => res.json())
        .then(health => {
            const isHealthy = health.status === 'healthy';
            document.getElementById('system-status-indicator').className = `status-indicator ${isHealthy ? '' : 'error'}`;
            document.getElementById('system-status-text').textContent = isHealthy ? 'System Online' : 'System Issues';
        })
        .catch(() => {
            document.getElementById('system-status-indicator').className = 'status-indicator error';
            document.getElementById('system-status-text').textContent = 'System Offline';
        });
}

setInterval(() => {
    if (currentPage === 'dashboard') loadDashboard();
    if (currentPage === 'monitoring') loadMonitoring();
}, 30000);