// Configuration
const API_BASE = '';
const PAGE_SIZE = 7; // Канон RF/AIC: 7 айтемов на странице
const KOMMO_SUBDOMAIN = 'sbsgulyaeval';
const KOMMO_BASE_URL = 'https://sbsgulyaeval.kommo.com';

// Авторизация по токену (канон RF companyAuth / AIC Login): сессия
// {token, role} в localStorage; все обращения к админ-API — с Bearer.
const SESSION_KEY = 'lq-admin-session';
let authToken = null;

function getStoredSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data && data.token ? data : null;
    } catch { return null; }
}
function saveSession(token, role = 'admin') {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ token, role })); } catch { /* нет доступа */ }
}
function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* нет доступа */ }
}

/* Экран входа / рабочая область. */
function showLogin(message) {
    document.getElementById('login-page').hidden = false;
    document.querySelector('.app').hidden = true;
    const badge = document.getElementById('demo-badge');
    if (badge) badge.hidden = true;
    const err = document.getElementById('login-error');
    if (err) {
        err.textContent = message || '';
        err.hidden = !message;
    }
    const input = document.getElementById('login-token');
    if (input) input.value = '';
}

/* Демо-бейдж (канон RF/AIC/MAB): виден только в сессии с ролью demo. */
function updateDemoBadge() {
    const session = getStoredSession();
    const badge = document.getElementById('demo-badge');
    if (badge) badge.hidden = !(session && session.role === 'demo');
}

function showApp() {
    document.getElementById('login-page').hidden = true;
    document.querySelector('.app').hidden = false;
    updateDemoBadge();
}

/* Все обращения к защищённому админ-API — с Bearer-токеном; 401/403
   (просроченный/отозванный токен) → сброс сессии и экран входа. */
async function authFetch(url, opts = {}) {
    opts.headers = Object.assign({}, opts.headers || {});
    if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(url, opts);
    if ((res.status === 401 || res.status === 403) && authToken) {
        clearSession();
        authToken = null;
        showLogin('Сессия недействительна. Войдите заново.');
    }
    return res;
}

// State
let currentPage = 'dashboard';
let currentFilters = { type: '', source: '' };
let currentSearch = '';
let currentPageNum = 0;
let totalLeads = 0;
let selectedLeadId = null;
let selectedEventId = null;
/* Индекс айтема для выбора после перелистывания страницы стрелками
   (канон перебора списка ↑/↓: на границе страницы — переход на соседнюю). */
let leadsPendingIndex = null;
let monitoringPendingIndex = null;

// DOM Elements (global for showPage access)
let navItems = null;
let pages = null;

// Workspace titles (меню-канон APL: названия страниц = названия пунктов)
const workspaceTitles = {
    dashboard: { title: 'Дашборд', subtitle: 'Обзор показателей системы' },
    leads: { title: 'Очередь лидов', subtitle: 'Журнал квалифицированных лидов' },
    monitoring: { title: 'Логи', subtitle: 'Журнал системных событий' },
    system: { title: 'Панель состояния', subtitle: 'Мониторинг компонентов' },
    audit: { title: 'Журнал аудита', subtitle: 'Активность консоли: обращения к админ-API с IP' },
    legend: { title: 'Обозначения', subtitle: 'Единый значковый контракт консоли' }
};

// Аудит: состояние
let auditPageNum = 0;
let auditTotal = 0;
let auditSelectedId = null;
const AUDIT_PAGE_SIZE = 7; // Канон RF observabilityShared PAGE_SIZE = 7
const AUDIT_DEFAULT_WINDOW = '168'; // Канон RF AuditWorkspace: окно по умолчанию 7d
const auditItems = {}; // id → событие текущей выборки (навигация стрелками)
let auditPendingSelectIndex = null; // выбор после перезагрузки страницы (стрелки через страницы)

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
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

    // Логи: пагинация по канону RF + живые фильтр и поиск
    document.getElementById('monitoring-pagination-prev').addEventListener('click', () => {
        if (monitoringPageNum > 0) { monitoringPageNum--; loadMonitoring(); }
    });
    document.getElementById('monitoring-pagination-next').addEventListener('click', () => {
        if ((monitoringPageNum + 1) * PAGE_SIZE < monitoringTotal) { monitoringPageNum++; loadMonitoring(); }
    });
    document.getElementById('monitoring-type').addEventListener('change', () => {
        monitoringPageNum = 0; loadMonitoring();
    });
    document.getElementById('monitoring-window').addEventListener('change', () => {
        monitoringPageNum = 0; loadMonitoring();
    });
    let monitoringSearchTimer = null;
    document.getElementById('monitoring-search').addEventListener('input', () => {
        clearTimeout(monitoringSearchTimer);
        monitoringSearchTimer = setTimeout(() => { monitoringPageNum = 0; loadMonitoring(); }, 300);
    });

    // Журнал аудита: фильтры, пагинация, экспорт (канон RF AuditWorkspace)
    const auditReload = () => { auditPageNum = 0; loadAudit(); };
    ['audit-window', 'audit-role', 'audit-resource'].forEach(id => {
        document.getElementById(id).addEventListener('change', auditReload);
    });
    let auditSearchTimer = null;
    document.getElementById('audit-action').addEventListener('input', () => {
        clearTimeout(auditSearchTimer);
        auditSearchTimer = setTimeout(auditReload, 300);
    });
    document.getElementById('audit-reset').addEventListener('click', () => {
        document.getElementById('audit-window').value = AUDIT_DEFAULT_WINDOW;
        ['audit-role', 'audit-resource', 'audit-action'].forEach(id => { document.getElementById(id).value = ''; });
        updateAuditReset();
        auditReload();
    });
    document.getElementById('audit-prev').addEventListener('click', () => {
        if (auditPageNum > 0) { auditPageNum--; loadAudit(); }
    });
    document.getElementById('audit-next').addEventListener('click', () => {
        if ((auditPageNum + 1) * AUDIT_PAGE_SIZE < auditTotal) { auditPageNum++; loadAudit(); }
    });
    document.getElementById('audit-refresh')?.addEventListener('click', loadAudit);
    document.getElementById('audit-export')?.addEventListener('click', exportAuditCsv);
    /* Канон перебора списков: автофокус на первый айтем при входе
       + навигация ↑/↓ с переходом через страницы (аудит, лиды, логи). */
    document.addEventListener('keydown', workspaceKeyNav);

    // Форма входа (канон AIC Login / RF companyAuth): валидация токена
    // по /auth/whoami; успех — сессия + аудит console_login на сервере.
    const loginError = document.getElementById('login-error');
    async function signInWithToken(token) {
        const res = await authFetch(`${API_BASE}/api/admin/auth/whoami`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) throw new Error('Токен не принят. Проверьте, что токен указан верно.');
        if (res.status === 403) throw new Error('Недействительный токен.');
        if (!res.ok) throw new Error(`Ошибка авторизации (${res.status}).`);
        const data = await res.json();
        authToken = token;
        saveSession(token, data.role || 'admin');
        showApp();
        updateSystemStatus();
        showPage('dashboard');
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.hidden = true;
        const token = document.getElementById('login-token').value.trim();
        if (!token) {
            loginError.textContent = 'Введите токен.';
            loginError.hidden = false;
            return;
        }
        try {
            await signInWithToken(token);
        } catch (error) {
            loginError.textContent = /Failed to fetch|NetworkError/.test(error.message)
                ? 'Нет связи с сервером.' : error.message;
            loginError.hidden = false;
        }
    });

    /* Демо-вход (канон RF signInDemo): кнопка видна, только если демо-токен
       настроен на экземпляре (demo-config). Read-only просмотр. */
    const demoBtn = document.getElementById('login-demo');
    fetch(`${API_BASE}/api/admin/auth/demo-config`).then(r => r.json()).then(cfg => {
        if (cfg && cfg.enabled) demoBtn.hidden = false;
    }).catch(() => { /* демо-вход недоступен — кнопка остаётся скрыта */ });
    demoBtn.addEventListener('click', async () => {
        loginError.hidden = true;
        try {
            const cfgRes = await fetch(`${API_BASE}/api/admin/auth/demo-config`);
            const cfg = await cfgRes.json();
            if (!cfg || !cfg.enabled) throw new Error('Демо-вход не настроен на этом экземпляре.');
            await signInWithToken(cfg.token);
        } catch (error) {
            loginError.textContent = /Failed to fetch|NetworkError/.test(error.message)
                ? 'Нет связи с сервером.' : error.message;
            loginError.hidden = false;
        }
    });

    /* Выйти (канон AIC/RF footer): сброс сессии → форма входа. */
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearSession();
            authToken = null;
            showLogin();
        });
    }

    // Восстановление сессии (канон RF): валидный токен → консоль, иначе — вход.
    const session = getStoredSession();
    if (!session) {
        showLogin();
        return;
    }
    authToken = session.token;
    try {
        const res = await authFetch(`${API_BASE}/api/admin/auth/whoami`, {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
            showApp();
            updateSystemStatus();
            showPage('dashboard');
        } else {
            clearSession();
            authToken = null;
            showLogin();
        }
    } catch {
        showLogin('Нет связи с сервером.');
    }
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
    /* Действия воркспейса («Экспорт CSV», «Обновить») — только в «Журнале аудита» (канон RF). */
    document.getElementById('ws-actions').hidden = page !== 'audit';
    if (page === 'dashboard') loadDashboard();
    else if (page === 'leads') loadLeads();
    else if (page === 'monitoring') loadMonitoring();
    else if (page === 'system') loadSystem();
    else if (page === 'audit') loadAudit();
}

async function loadDashboard() {
    try {
        const response = await authFetch(`${API_BASE}/api/admin/dashboard`);
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
        ].map(t => `<div class="legend-item">${getTypeBadge(t.k)}<span class="legend-label">${t.l}</span><span class="legend-value">${t.v}</span></div>`).join('');
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
    ].map(s => `<div class="legend-item">${getSourceBadge(s.k)}<span class="legend-label">${s.l}</span><span class="legend-value">${s.v}</span></div>`).join('');
}

async function loadLeads() {
    const listContainer = document.getElementById('leads-list');
    listContainer.innerHTML = '<div class="loading-state"><p class="loading-text">Загрузка…</p></div>';
    try {
        const params = new URLSearchParams();
        params.append('page', currentPageNum);
        params.append('size', PAGE_SIZE);
        if (currentFilters.type) params.append('lead_type', currentFilters.type);
        if (currentFilters.source) params.append('source', currentFilters.source);
        if (currentSearch) params.append('search', currentSearch);

        const response = await authFetch(`${API_BASE}/api/admin/leads?${params}`);
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        totalLeads = data.total;

        // Канон RF: «Страница N из M» (N=0 при пустом списке) + «Всего N»
        document.getElementById('pagination-total').textContent = totalLeads;
        document.getElementById('pagination-page').textContent = totalLeads === 0 ? 0 : currentPageNum + 1;
        document.getElementById('pagination-pages').textContent = Math.ceil(totalLeads / PAGE_SIZE);
        document.getElementById('pagination-prev').disabled = currentPageNum === 0 || totalLeads === 0;
        document.getElementById('pagination-next').disabled = (currentPageNum + 1) * PAGE_SIZE >= totalLeads;

        renderLeads(data.items);
    } catch (error) {
        console.error('Error:', error);
        listContainer.innerHTML = '<div class="empty-state"><p class="empty-text">Ошибка: ' + error.message + '</p></div>';
    }
}

function renderLeads(leads) {
    const listContainer = document.getElementById('leads-list');
    if (!leads || leads.length === 0) {
        listContainer.innerHTML = '<div class="empty-state"><p class="empty-text">Нет лидов</p></div>';
        return;
    }

    listContainer.innerHTML = leads.map(lead => {
        const timestamp = formatDate(lead.created_at);
        const statusBadge = getStatusBadge(lead.status);
        const preview = lead.first_message ? truncate(lead.first_message, 80) : 'Нет сообщения';
        /* Телеметрия — классификация значками (канон RF: втроём, emojiOnly,
           пояснение в tooltip), прижаты влево после текста статуса. */
        const telemetry = [
            getSourceBadge(lead.source),
            getTypeBadge(lead.lead_type),
            getPriorityBadge(lead.priority),
            chip('muted', 'Уверенность классификации', `🎯 ${Math.round((lead.confidence||0)*100)}%`)
        ];
        return `
            <div class="list-item ${selectedLeadId === lead.id ? 'selected' : ''}" data-lead-id="${lead.id}" onclick="selectLead('${lead.id}', this)">
                <div class="list-item__row">
                    <span class="list-item__timestamp">${timestamp}</span>
                    <span class="list-item__id">${lead.public_number || 'LQ-?'}</span>
                    <span class="list-item__status">${statusBadge}</span>
                </div>
                <div class="list-item__preview">${preview}</div>
                <div class="list-item__telemetry">${telemetry.join('')}</div>
            </div>`;
    }).join('');

    // Выбор после перелистывания стрелками либо автофокус на первый айтем
    // (первая страница, нет выбранного лида)
    if (leadsPendingIndex != null) {
        const idx = leadsPendingIndex;
        leadsPendingIndex = null;
        const nodes = listContainer.querySelectorAll('.list-item');
        const target = nodes[idx] || nodes[0];
        if (target) selectLead(target.dataset.leadId, target);
    } else if (currentPageNum === 0 && selectedLeadId === null && leads.length > 0) {
        selectLead(leads[0].id);
    }
}

async function selectLead(leadId, el) {
    selectedLeadId = leadId;
    document.querySelectorAll('#leads-list .list-item').forEach(item =>
        item.classList.toggle('selected', item.dataset.leadId === leadId));
    if (el) {
        el.classList.add('selected');
        el.scrollIntoView({ block: 'nearest' });
    }
    const detailDiv = document.getElementById('lead-detail');
    detailDiv.innerHTML = '<div class="loading-state"><p class="loading-text">Загрузка…</p></div>';
    try {
        const response = await authFetch(`${API_BASE}/api/admin/leads/${leadId}`);
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        renderLeadDetail(data);
    } catch (error) {
        console.error('Error:', error);
        detailDiv.innerHTML = '<div class="empty-state"><p class="empty-text">Ошибка: ' + error.message + '</p></div>';
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
                <span class="passport-field__value">${getCRMStatusBadge(crm?.sync_status)}</span>
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
                <span class="passport-field__value">${crm.kommo_status_name || '—'}</span>
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
                <span class="passport-field__value">${getCRMStatusBadge(crm?.sync_status)}</span>
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
            <div class="object-status object-status--${getStatusClass(lead.status)}">${getStatusIcon(lead.status)} ${getStatusLabel(lead.status)}</div>
        </div>
        <div class="card-body">
            <div class="passport-panels">
                <div class="passport-panel">
                    <div class="passport-panel__title">Паспорт лида</div>
                    <div class="passport-field"><span class="passport-field__label">Создан</span><span class="passport-field__value">${formatDate(lead.created_at)}</span></div>
                    <div class="passport-field"><span class="passport-field__label">Источник</span><span class="passport-field__value">${getSourceBadge(lead.source)}</span></div>
                    <div class="passport-field"><span class="passport-field__label">Клиент</span><span class="passport-field__value ${!lead.name?'missing':''}">${lead.name||'Не указан'}</span></div>
                    <div class="passport-field"><span class="passport-field__label">Телефон</span><span class="passport-field__value ${!lead.phone?'missing':''}">${lead.phone||'Не указан'}</span></div>
                    <div class="passport-field"><span class="passport-field__label">Email</span><span class="passport-field__value ${!lead.email?'missing':''}">${lead.email||'Не указан'}</span></div>
                </div>
                <div class="passport-panel">
                    <div class="passport-panel__title">Квалификация лида</div>
                    <div class="passport-field"><span class="passport-field__label">Квалифицирован</span><span class="passport-field__value">${qual?.processed_at?formatDate(qual.processed_at):'—'}</span></div>
                    <div class="passport-field"><span class="passport-field__label">Тип</span><span class="passport-field__value">${getTypeBadge(qual?.lead_type)}</span></div>
                    <div class="passport-field"><span class="passport-field__label">Приоритет</span><span class="passport-field__value">${getPriorityBadge(qual?.priority)}</span></div>
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
                        <div class="content-panel__badges">${getTypeBadgeFull(qual?.lead_type)}<span class="content-panel__confidence">${qual?.confidence?Math.round(qual.confidence*100)+'%':'—'}</span></div>
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
                <summary>Таймлайн обработки</summary>
                <div class="collapsed-zone__content">
                    <div class="timeline">
                        <div class="timeline-stage timeline-stage--done">
                            <div class="timeline-stage__top">
                                <div class="timeline-stage__left">
                                    <span class="timeline-stage__marker timeline-stage__marker--success"></span>
                                    <span class="timeline-stage__time">${formatDate(lead.created_at)}</span>
                                    <span class="timeline-stage__name">Создан</span>
                                </div>
                                ${stageStatusChip()}
                            </div>
                            ${stageDetails(`id: ${lead.public_number || lead.id.substring(0,8)} · source: ${lead.source}`, {id: lead.id, source: lead.source, public_number: lead.public_number})}
                        </div>
                        ${qual?`
                        <div class="timeline-stage timeline-stage--done">
                            <div class="timeline-stage__top">
                                <div class="timeline-stage__left">
                                    <span class="timeline-stage__marker timeline-stage__marker--success"></span>
                                    <span class="timeline-stage__time">${qual.processed_at?formatDate(qual.processed_at):'—'}</span>
                                    <span class="timeline-stage__name">Квалифицирован</span>
                                </div>
                                ${stageStatusChip()}
                            </div>
                            ${stageDetails(`type: ${qual.lead_type} · confidence: ${Math.round((qual.confidence||0)*100)}%`, {lead_type: qual.lead_type, priority: qual.priority, confidence: qual.confidence, suggested_action: qual.suggested_action})}
                        </div>
                        `:''}
                        ${lead.status==='processed'?`
                        <div class="timeline-stage timeline-stage--done">
                            <div class="timeline-stage__top">
                                <div class="timeline-stage__left">
                                    <span class="timeline-stage__marker timeline-stage__marker--success"></span>
                                    <span class="timeline-stage__time">${crm?.created_at?formatDate(crm.created_at):'—'}</span>
                                    <span class="timeline-stage__name">Передан в CRM</span>
                                </div>
                                ${stageStatusChip()}
                            </div>
                            ${stageDetails(`sync_status: ${crm?.sync_status||'pending'} · kommo_lead_id: ${crm?.kommo_lead_id||'—'}`, {sync_status: crm?.sync_status||'pending', kommo_lead_id: crm?.kommo_lead_id||null})}
                        </div>
                        `:''}
                    </div>
                </div>
            </details>
            <details class="collapsed-zone">
                <summary>Технические данные</summary>
                <div class="collapsed-zone__content">
                    <p class="tech-muted">Внутренний ID: <code class="tech-id" title="${lead.id}">${lead.id}</code></p>
                    <div class="tech-payload">
                        <div class="tech-payload__head">
                            <div class="tech-payload__title">Журнал событий (raw)</div>
                            <button class="tech-payload__btn" onclick="togglePayload(this)">Show</button>
                        </div>
                        ${data.operational_logs && data.operational_logs.length
                            ? `<pre class="tech-payload__pre" hidden>${escapeHtml(JSON.stringify(data.operational_logs, null, 2))}</pre>`
                            : `<div class="tech-payload__empty" hidden>Нет payload</div>`}
                    </div>
                </div>
            </details>
        </div>`;
}

/* Логи: проекция по обращениям (канон RF LogsWorkspace / AIC OperationalLogs).
   Одна строка списка = одно обращение — полный прогон пайплайна лида
   «Событие клиента → Обработка → Ответ системы»; этапы — в детализации
   («Цепочка обработки», «Таймлайн pipeline»). */
let monitoringPageNum = 0;
let monitoringTotal = 0;
const monitoringItems = {}; // lead_id → трейс текущей выборки (подсветка выбора)

/* Семья «Статус обработки» (канон RF LOG_STATUS): ✔︎ успешно / 🔄 ожидание / ❌ ошибка. */
function getTraceStatusChip(s, withText) {
    const m = { ok: ['success', '✔︎', 'успешно'], error: ['error', '❌', 'ошибка'], pending: ['warning', '🔄', 'ожидание'] };
    const [v, icon, label] = m[s] || m.pending;
    return chip(v, `Статус обработки: ${label}`, withText ? `${icon} ${label}` : icon);
}

/* Семья «Событие пайплайна» — типы этапов в таймлайне трейса. */
function getEventTypeIcon(t) { if (String(t).startsWith('crm_sync')) return '🤝'; const i = { lead_received: '📨', lead_classified: '🧠' }; return i[t] || '📄'; }
function getEventTypeLabel(t) { if (String(t).startsWith('crm_sync')) return 'CRM синхронизация'; const l = { lead_received: 'Приём лида', lead_classified: 'Квалификация' }; return l[t] || t || '—'; }

/* Окно времени (канон RF WINDOW_OPTIONS: 24h/7d/30d/все). */
function monitoringDateFrom() {
    const h = document.getElementById('monitoring-window').value;
    if (!h) return '';
    return new Date(Date.now() - Number(h) * 3600 * 1000).toISOString();
}

async function loadMonitoring() {
    const listContainer = document.getElementById('monitoring-list');
    listContainer.innerHTML = '<div class="loading-state"><p class="loading-text">Загрузка…</p></div>';
    try {
        const params = new URLSearchParams();
        const status = document.getElementById('monitoring-type').value;
        const lead = document.getElementById('monitoring-search').value.trim();
        const dateFrom = monitoringDateFrom();
        if (status) params.set('status', status);
        if (lead) params.set('lead', lead);
        if (dateFrom) params.set('date_from', dateFrom);
        params.set('limit', PAGE_SIZE);
        params.set('offset', monitoringPageNum * PAGE_SIZE);
        const response = await authFetch(`${API_BASE}/api/admin/logs?${params}`);
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        monitoringTotal = data.total || 0;
        document.getElementById('monitoring-pagination-total').textContent = monitoringTotal;
        document.getElementById('monitoring-pagination-page').textContent = monitoringTotal === 0 ? 0 : monitoringPageNum + 1;
        document.getElementById('monitoring-pagination-pages').textContent = Math.ceil(monitoringTotal / PAGE_SIZE);
        document.getElementById('monitoring-pagination-prev').disabled = monitoringPageNum === 0 || monitoringTotal === 0;
        document.getElementById('monitoring-pagination-next').disabled = (monitoringPageNum + 1) * PAGE_SIZE >= monitoringTotal;
        renderMonitoring(data.items);
        /* Выбор после перелистывания стрелками либо первая строка списка
           автоматически. */
        if (monitoringPendingIndex != null) {
            const idx = monitoringPendingIndex;
            monitoringPendingIndex = null;
            const nodes = listContainer.querySelectorAll('.list-item');
            const target = nodes[idx] || nodes[0];
            if (target) selectMonitoringEvent(target.dataset.eventId, target);
        } else {
            const first = data.items && data.items[0];
            if (first) selectMonitoringEvent(first.lead_id);
        }
    } catch (error) {
        console.error('Error:', error);
        listContainer.innerHTML = '<div class="empty-state"><p class="empty-text">Ошибка: ' + error.message + '</p></div>';
    }
}

function renderMonitoring(traces) {
    const listContainer = document.getElementById('monitoring-list');
    if (!traces || traces.length === 0) {
        listContainer.innerHTML = '<div class="empty-state"><p class="empty-text">Нет обращений</p></div>';
        return;
    }
    Object.keys(monitoringItems).forEach(k => delete monitoringItems[k]);
    listContainer.innerHTML = traces.map(t => {
        monitoringItems[t.lead_id] = t;
        return `
            <div class="list-item ${String(selectedEventId) === String(t.lead_id) ? 'selected' : ''}" data-event-id="${t.lead_id}">
                <div class="list-item__row">
                    <span class="list-item__timestamp">${formatDate(t.started_at)}</span>
                    <span class="list-item__status">${getTraceStatusChip(t.status)}</span>
                </div>
                <div class="list-item__preview">${escapeHtml(t.public_number || '—')}</div>
                <div class="list-item__telemetry"><span class="list-item__telemetry-item">${escapeHtml(t.ai_model || '—')}</span><span class="list-item__telemetry-item">#${escapeHtml(String(t.lead_id).substring(0, 8))}</span><span class="list-item__telemetry-item">${t.processing_ms != null ? `${t.processing_ms} мс` : '—'}</span></div>
            </div>`;
    }).join('');
    listContainer.querySelectorAll('.list-item').forEach(el => {
        el.addEventListener('click', () => selectMonitoringEvent(el.dataset.eventId, el));
    });
}

async function selectMonitoringEvent(leadId, el) {
    selectedEventId = String(leadId);
    document.querySelectorAll('#monitoring-list .list-item').forEach(item =>
        item.classList.toggle('selected', item.dataset.eventId === String(leadId)));
    if (el) {
        el.classList.add('selected');
        el.scrollIntoView({ block: 'nearest' });
    }
    const detail = document.getElementById('event-detail');
    detail.innerHTML = '<div class="audit-detail__empty">Загрузка…</div>';
    try {
        const response = await authFetch(`${API_BASE}/api/admin/logs/${leadId}`);
        if (!response.ok) throw new Error('Failed');
        renderTraceDetail(await response.json());
    } catch (error) {
        console.error('Error:', error);
        detail.innerHTML = '<div class="audit-detail__empty">Не удалось загрузить обращение.</div>';
    }
}

/* Детализация обращения (канон RF «ДЕТАЛИЗАЦИЯ ЗАПРОСА»): Параметры →
   Цепочка обработки → Запрос клиента / Ответ системы → Ошибка →
   Таймлайн pipeline (карточки этапов + JSON payload) → Технический снимок. */
function renderTraceDetail(d) {
    const detail = document.getElementById('event-detail');
    const lat = d.processing_ms != null ? `${d.processing_ms} мс` : '—';
    const respText = d.response
        ? `Сделка в CRM: ${d.response.kommo_lead_id ?? '—'} · ${d.response.kommo_pipeline_name || '—'} / ${d.response.kommo_status_name || '—'} · синхронизировано ${formatDate(d.response.synced_at)}`
        : (d.qualification ? `Не передано в CRM (квалификация: ${getTypeLabel(d.qualification.lead_type)})` : '—');
    const stageRows = d.stages || [];
    detail.innerHTML = `
        <div class="audit-detail__head">
            <div class="audit-detail__title">Детализация запроса</div>
            ${getTraceStatusChip(d.status, true)}
        </div>
        <div class="trace-grid">
            <div class="trace-section">
                <h4 class="trace-section__title">Параметры запроса</h4>
                <dl>
                    <div class="audit-detail__kv"><dt>Номер:</dt><dd>${escapeHtml(d.public_number || '—')}</dd></div>
                    <div class="audit-detail__kv"><dt>ID лида:</dt><dd class="audit-item__id">${escapeHtml(d.lead_id || '—')}</dd></div>
                    <div class="audit-detail__kv"><dt>Дата:</dt><dd>${formatDate(d.created_at)}</dd></div>
                </dl>
            </div>
            <div class="trace-section">
                <h4 class="trace-section__title">Параметры исполнения</h4>
                <dl>
                    <div class="audit-detail__kv"><dt>Latency pipeline:</dt><dd>${d.processing_ms != null ? `${d.processing_ms} мс` : '—'}</dd></div>
                    <div class="audit-detail__kv"><dt>Модель:</dt><dd>${escapeHtml(d.ai_model || '—')}</dd></div>
                    <div class="audit-detail__kv"><dt>CRM-синхронизация:</dt><dd>${d.response ? escapeHtml(getCRMStatusLabel(d.response.sync_status)) : '—'}</dd></div>
                </dl>
            </div>
        </div>
        <div class="trace-section">
            <h4 class="trace-section__title">Цепочка обработки</h4>
            <div class="trace-section__text">${escapeHtml(d.pipeline_summary || '—')}</div>
        </div>
        <div class="trace-grid">
            <div class="trace-section">
                <h4 class="trace-section__title">Запрос клиента</h4>
                <pre class="trace-pre">${escapeHtml(d.client_message || '—')}</pre>
            </div>
            <div class="trace-section">
                <h4 class="trace-section__title">Ответ системы</h4>
                <pre class="trace-pre">${escapeHtml(respText)}</pre>
            </div>
        </div>
        ${d.error ? `<div class="trace-section trace-section--error"><h4 class="trace-section__title">Ошибка</h4><pre class="trace-pre trace-pre--mono">${escapeHtml(d.error)}</pre></div>` : ''}
        ${stageRows.length ? `
        <div class="trace-section trace-section--timeline">
            <h4 class="trace-section__title">Таймлайн pipeline</h4>
            <div class="timeline">
                ${stageRows.map(s => `
                <div class="timeline-stage ${s.status === 'error' ? 'timeline-stage--failed' : 'timeline-stage--done'}">
                    <div class="timeline-stage__top">
                        <div class="timeline-stage__left">
                            <span class="timeline-stage__time">${formatDate(s.created_at)}</span>
                            <span class="timeline-stage__name">${escapeHtml(getEventTypeLabel(s.event_type))}</span>
                            <span class="timeline-stage__offset">+${s.offset_ms != null ? s.offset_ms : '—'} мс</span>
                            <span class="timeline-stage__lat">+${s.latency_ms != null ? s.latency_ms : '—'}</span>
                        </div>
                        ${getTraceStatusChip(s.status === 'success' ? 'ok' : s.status)}
                    </div>
                    ${stageDetails('JSON payload', s.metadata)}
                </div>`).join('')}
            </div>
        </div>` : ''}
        ${stageDetails('Технический снимок (JSON)', d)}`;
}

async function loadSystem() {
    try {
        const response = await authFetch(`${API_BASE}/api/admin/health/detailed`);
        if (!response.ok) throw new Error('Failed');
        const health = await response.json();
        /* HEALTH-семья (канон AIC chipContract): 🟢/❌/➖, подпись рядом */
        const healthChip = st => {
            const m = {online:['success','🟢','Online'], error:['error','❌','Ошибка'], unknown:['muted','➖','Неизвестно']};
            const [v, icon, label] = m[st] || m.unknown;
            return chip(v, `Состояние: ${label}`, `${icon} ${label}`);
        };
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
                <div class="metric-header"><span class="metric-label">${s.icon} ${s.name}</span></div>
                <div class="metric-value">${healthChip(s.status)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

/* Журнал аудита (канон RF AuditWorkspace): активность консоли —
   каждое обращение к админ-API, с IP и параметрами. Фильтры: окно
   времени / роль / тип ресурса / действие; пагинация над списком;
   «Всего N» + «Сброс»; первая строка выбирается автоматически;
   навигация стрелками ↑/↓ с переходом через страницы. */
function auditWindowFrom() {
    const h = document.getElementById('audit-window').value;
    if (!h) return '';
    return new Date(Date.now() - Number(h) * 3600 * 1000).toISOString();
}

function auditFiltersDirty() {
    return document.getElementById('audit-window').value !== AUDIT_DEFAULT_WINDOW
        || !!document.getElementById('audit-role').value
        || !!document.getElementById('audit-resource').value
        || !!document.getElementById('audit-action').value.trim();
}

function updateAuditReset() {
    document.getElementById('audit-reset').disabled = !auditFiltersDirty();
}

function auditQuery(prefix) {
    const p = new URLSearchParams();
    const from = auditWindowFrom();
    const action = document.getElementById('audit-action')?.value?.trim();
    const resource = document.getElementById('audit-resource')?.value;
    const role = document.getElementById('audit-role')?.value;
    if (from) p.append('date_from', from);
    if (action) p.append('action', action);
    if (resource) p.append('resource_type', resource);
    if (role) p.append('user_role', role);
    const q = p.toString();
    return q ? `${prefix}${q}` : '';
}

function exportAuditCsv() {
    const p = auditQuery('?');
    window.open(`${API_BASE}/api/admin/audit/export${p}`, '_blank');
}

async function loadAudit() {
    const list = document.getElementById('audit-list');
    updateAuditReset();
    list.innerHTML = '<div class="loading-state"><p class="loading-text">Загрузка…</p></div>';
    /* Канон RF: «Обновить» задизейблена и показывает «…», пока идёт загрузка. */
    const refreshBtn = document.getElementById('audit-refresh');
    const refreshLabel = refreshBtn.textContent;
    refreshBtn.disabled = true;
    refreshBtn.textContent = '…';
    try {
        const base = auditQuery('?');
        const offset = auditPageNum * AUDIT_PAGE_SIZE;
        const sep = base ? '&' : '?';
        const response = await authFetch(`${API_BASE}/api/admin/audit${base}${sep}limit=${AUDIT_PAGE_SIZE}&offset=${offset}`);
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        auditTotal = data.total || 0;
        document.getElementById('audit-total').textContent = `Всего ${auditTotal}`;
        document.getElementById('audit-page-num').textContent = auditTotal === 0 ? 0 : auditPageNum + 1;
        document.getElementById('audit-pages-num').textContent = Math.ceil(auditTotal / AUDIT_PAGE_SIZE);
        document.getElementById('audit-prev').disabled = auditPageNum === 0 || auditTotal === 0;
        document.getElementById('audit-next').disabled = (auditPageNum + 1) * AUDIT_PAGE_SIZE >= auditTotal;
        renderAuditList(data.items || []);
        /* Канон RF: выбор после перезагрузки страницы (стрелки) либо первая строка. */
        if (auditPendingSelectIndex != null) {
            const idx = auditPendingSelectIndex;
            auditPendingSelectIndex = null;
            const target = list.querySelector(`.list-item[data-index="${idx}"]`);
            if (target) selectAuditEvent(target.dataset.id, target);
            else if (list.querySelector('.list-item')) selectAuditEvent(list.querySelector('.list-item').dataset.id);
        } else {
            const first = list.querySelector('.list-item');
            if (first) selectAuditEvent(first.dataset.id, first);
        }
    } catch (error) {
        console.error('Error:', error);
        list.innerHTML = '<div class="empty-state"><p class="empty-text">Ошибка: ' + error.message + '</p></div>';
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = refreshLabel;
    }
}

function getAuditRoleChip(role) {
    const m = { admin: ['primary', '🛡️', 'Администратор'], operator: ['info', '🎧', 'Оператор'], client: ['muted', '👤', 'Клиент'], demo: ['warning', '🎭', 'Демо'] };
    const [v, icon, label] = m[role] || m.admin;
    return chip(v, `Роль: ${label}`, icon);
}

function getAuditRoleLabel(role) {
    return { admin: 'Администратор', operator: 'Оператор', client: 'Клиент', demo: 'Демо' }[role] || role || '—';
}

/* Действие = человекочитаемая метка endpoint'а (канон RF labelAuditAction:
   в превью — метка, сырой action — в чипе детализации). */
function getAuditActionLabel(action) {
    const a = String(action || '');
    if (a === 'console_login') return 'Вход в систему';
    if (/^\/api\/admin\/health\/detailed/.test(a)) return 'Проверка состояния (подробно)';
    if (/^\/api\/admin\/health/.test(a)) return 'Проверка состояния';
    if (/^\/api\/admin\/dashboard/.test(a)) return 'Просмотр дашборда';
    if (/^\/api\/admin\/leads\/[^/]+$/.test(a)) return 'Просмотр лида';
    if (/^\/api\/admin\/leads/.test(a)) return 'Просмотр очереди лидов';
    if (/^\/api\/admin\/logs\/[^/]+$/.test(a)) return 'Просмотр обращения';
    if (/^\/api\/admin\/logs/.test(a)) return 'Просмотр журнала логов';
    if (/^\/api\/admin\/audit\/export/.test(a)) return 'Экспорт журнала аудита';
    if (/^\/api\/admin\/audit\/[^/]+$/.test(a)) return 'Просмотр события аудита';
    if (/^\/api\/admin\/audit/.test(a)) return 'Просмотр журнала аудита';
    return a || '—';
}

function getAuditResourceLabel(t) {
    return { dashboard: 'Дашборд', lead: 'Лид', logs: 'Логи', system: 'Система', admin: 'Консоль', auth: 'Авторизация' }[t] || t || '—';
}

/* Полная дата-время с секундами (канон RF formatTs). */
function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU', { hour12: false });
}

function renderAuditList(items) {
    const list = document.getElementById('audit-list');
    Object.keys(auditItems).forEach(k => delete auditItems[k]);
    if (!items.length) {
        list.innerHTML = '<div class="empty-state"><p class="empty-text">Нет событий</p></div>';
        return;
    }
    list.innerHTML = items.map((ev, idx) => {
        auditItems[ev.id] = ev;
        const seq = ev.seq_number != null ? `#${ev.seq_number}` : '';
        return `
            <div class="list-item ${auditSelectedId === ev.id ? 'selected' : ''}" data-id="${ev.id}" data-index="${idx}">
                <div class="list-item__row">
                    <span class="list-item__timestamp">${formatDateTime(ev.created_at)}</span>
                    <span class="list-item__status">${getAuditRoleChip(ev.user_role)}</span>
                </div>
                <div class="list-item__preview">${escapeHtml(getAuditActionLabel(ev.action))}</div>
                <div class="list-item__telemetry"><span class="list-item__telemetry-item">${escapeHtml(getAuditResourceLabel(ev.resource_type))}</span><span class="list-item__telemetry-item">${escapeHtml(ev.ip_address || '—')}</span><span class="list-item__telemetry-item">${escapeHtml(seq)}</span></div>
            </div>`;
    }).join('');
    list.querySelectorAll('.list-item').forEach(el => {
        el.addEventListener('click', () => selectAuditEvent(el.dataset.id, el));
    });
}

/* Навигация стрелками (канон RF AuditWorkspace): ↑/↓ перемещают выбор,
   на границе страницы — переход на соседнюю страницу. */
/* Канон перебора списка стрелками ↑/↓ (общий для всех консолей с айтемами):
   вход — автофокус на первый айтем (в loadX/renderX), перебор — ↑/↓,
   на границе страницы — переход на соседнюю страницу (pendingSelectIndex). */
function workspaceKeyNav(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (currentPage === 'leads') return leadsKeyNav(e);
    if (currentPage === 'monitoring') return monitoringKeyNav(e);
    if (currentPage !== 'audit') return;
    const nodes = [...document.querySelectorAll('#audit-list .list-item')];
    if (!nodes.length) return;
    const cur = nodes.findIndex(n => n.dataset.id === auditSelectedId);
    let next = cur + (e.key === 'ArrowDown' ? 1 : -1);
    if (next >= nodes.length) {
        if ((auditPageNum + 1) * AUDIT_PAGE_SIZE >= auditTotal) return;
        auditPendingSelectIndex = 0;
        auditPageNum++;
        loadAudit();
        return;
    }
    if (next < 0) {
        if (auditPageNum === 0) return;
        auditPendingSelectIndex = AUDIT_PAGE_SIZE - 1;
        auditPageNum--;
        loadAudit();
        return;
    }
    selectAuditEvent(nodes[next].dataset.id, nodes[next]);
}

/* «Очередь лидов»: перебор стрелками ↑/↓ с переходом через страницы. */
function leadsKeyNav(e) {
    const nodes = [...document.querySelectorAll('#leads-list .list-item')];
    if (!nodes.length) return;
    const cur = nodes.findIndex(n => n.dataset.leadId === selectedLeadId);
    let next = cur + (e.key === 'ArrowDown' ? 1 : -1);
    if (next >= nodes.length) {
        if ((currentPageNum + 1) * PAGE_SIZE >= totalLeads) return;
        leadsPendingIndex = 0;
        currentPageNum++;
        loadLeads();
        return;
    }
    if (next < 0) {
        if (currentPageNum === 0) return;
        leadsPendingIndex = PAGE_SIZE - 1;
        currentPageNum--;
        loadLeads();
        return;
    }
    selectLead(nodes[next].dataset.leadId, nodes[next]);
}

/* «Логи»: перебор стрелками ↑/↓ с переходом через страницы. */
function monitoringKeyNav(e) {
    const nodes = [...document.querySelectorAll('#monitoring-list .list-item')];
    if (!nodes.length) return;
    const cur = nodes.findIndex(n => n.dataset.eventId === String(selectedEventId));
    let next = cur + (e.key === 'ArrowDown' ? 1 : -1);
    if (next >= nodes.length) {
        if ((monitoringPageNum + 1) * PAGE_SIZE >= monitoringTotal) return;
        monitoringPendingIndex = 0;
        monitoringPageNum++;
        loadMonitoring();
        return;
    }
    if (next < 0) {
        if (monitoringPageNum === 0) return;
        monitoringPendingIndex = PAGE_SIZE - 1;
        monitoringPageNum--;
        loadMonitoring();
        return;
    }
    selectMonitoringEvent(nodes[next].dataset.eventId, nodes[next]);
}

async function selectAuditEvent(id, el) {
    auditSelectedId = id;
    document.querySelectorAll('#audit-list .list-item').forEach(item =>
        item.classList.toggle('selected', item.dataset.id === id));
    if (el) {
        el.classList.add('selected');
        el.scrollIntoView({ block: 'nearest' });
    }
    const detail = document.getElementById('audit-detail');
    detail.innerHTML = '<div class="loading-state"><p class="loading-text">Загрузка…</p></div>';
    try {
        const response = await authFetch(`${API_BASE}/api/admin/audit/${id}`);
        if (!response.ok) throw new Error('Failed');
        renderAuditDetail(await response.json());
    } catch (error) {
        console.error('Error:', error);
        detail.innerHTML = '<div class="audit-detail__empty">Не удалось загрузить событие.</div>';
    }
}

/* Детализация события (канон RF AuditWorkspace): head «ДЕТАЛИЗАЦИЯ СОБЫТИЯ»
   с чипом действия, пары секций в 2-колоночной сетке, «Детали / metadata»
   в pre, технический снимок в collapsible. */
function renderAuditDetail(ev) {
    const detail = document.getElementById('audit-detail');
    const params = ev.details && typeof ev.details === 'object' ? ev.details : {};
    detail.innerHTML = `
        <div class="audit-detail__head">
            <div class="audit-detail__title">Детализация события</div>
            ${chip('primary', getAuditActionLabel(ev.action), escapeHtml(ev.action || '—'))}
        </div>
        <div class="trace-grid">
            <div class="trace-section">
                <h4 class="trace-section__title">Параметры акции</h4>
                <dl>
                    <div class="audit-detail__kv"><dt>ID акции:</dt><dd class="audit-item__id">${ev.seq_number != null ? `#${ev.seq_number}` : '—'}</dd></div>
                    <div class="audit-detail__kv"><dt>Тип акции:</dt><dd>${escapeHtml(getAuditActionLabel(ev.action))}</dd></div>
                    <div class="audit-detail__kv"><dt>ID ресурса:</dt><dd class="audit-item__id">${escapeHtml(ev.resource_id || '—')}</dd></div>
                    <div class="audit-detail__kv"><dt>Тип ресурса:</dt><dd>${escapeHtml(getAuditResourceLabel(ev.resource_type))}</dd></div>
                </dl>
            </div>
            <div class="trace-section">
                <h4 class="trace-section__title">Параметры пользователя</h4>
                <dl>
                    <div class="audit-detail__kv"><dt>Роль:</dt><dd>${escapeHtml(getAuditRoleLabel(ev.user_role))}</dd></div>
                    <div class="audit-detail__kv"><dt>IP-адрес:</dt><dd class="audit-item__id">${escapeHtml(ev.ip_address || '—')}</dd></div>
                    <div class="audit-detail__kv"><dt>Дата события:</dt><dd>${formatDateTime(ev.created_at)}</dd></div>
                </dl>
            </div>
        </div>
        <div class="trace-section">
            <h4 class="trace-section__title">Детали / metadata</h4>
            <pre class="trace-pre trace-pre--mono">${escapeHtml(JSON.stringify(params, null, 2))}</pre>
        </div>
        ${stageDetails('Технический снимок события (JSON)', ev)}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
}
function truncate(str, len) { return str ? (str.length > len ? str.substring(0,len)+'...':str) : ''; }
function escapeHtml(str) { return str ? str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
function getTypeLabel(t) { const l={hot:'Горячий',warm:'Тёплый',cold:'Холодный',spam:'Спам'}; return l[t]||t||'—'; }
function getTypeIcon(t) { const i={hot:'🔥',warm:'🌡️',cold:'❄️',spam:'🗑️'}; return i[t]||'📋'; }
function getSourceLabel(s) { const l={telegram:'Telegram',website:'Website',social_media:'Social'}; return l[s]||s||'—'; }
function getPriorityLabel(p) { const l={high:'Высокий',medium:'Средний',low:'Низкий'}; return l[p]||p||'—'; }
function getPriorityIcon(p) { const i={high:'⚡',medium:'➤',low:'○'}; return i[p]||'○'; }
function getActionLabel(a) { const l={call:'Звонок',email:'Email',archive:'В архив',reject:'Отклонить'}; return l[a]||a||'—'; }
function getStatusLabel(s) { const l={received:'Получен',qualified:'Квалифицирован',processed:'Передан в CRM',archived:'В архиве'}; return l[s]||s||'—'; }
function getStatusClass(s) { const c={received:'pending',qualified:'success',processed:'success',archived:'pending'}; return c[s]||'pending'; }
function getStatusIcon(s) { const i={received:'⏳',qualified:'✅',processed:'🚀',archived:'📦'}; return i[s]||'📋'; }
/* Тихий чип-контракт AIC/RF: эмодзи вместо точки, цвет только для сигнала. */
function chip(variant, title, content) { return `<span class="ai-status ai-status--emoji ai-status--${variant}"${title?` title="${title}"`:''}>${content}</span>`; }
/* Канон RF OperatorQueueItem (emojiOnly): в списках и паспорте — только
   значок, пояснение «Семья: Значение» — в tooltip при наведении.
   Полный «эмодзи+текст» — там, где нет текстового контекста
   (панель «Решение системы» — аналог identity-чипа RF). */
function chipIcon(variant, family, label, icon) { return chip(variant, `${family}: ${label}`, icon); }
function getStatusBadge(s) { return chipIcon(getStatusClass(s), 'Статус лида', getStatusLabel(s), getStatusIcon(s)); }
function getCRMStatusLabel(s) { const l={success:'Успешно',pending:'В очереди',failed:'Ошибка'}; return l[s]||s||'—'; }
function getCRMStatusIcon(s) { const i={success:'✅',pending:'⏳',failed:'❌'}; return i[s]||'⏳'; }
function getCRMStatusBadge(s) { const cls = s==='success'?'success':s==='failed'?'error':'warning'; return chipIcon(cls, 'CRM-синхронизация', getCRMStatusLabel(s), getCRMStatusIcon(s)); }
function getTypeBadge(t) { return chipIcon(t||'muted', 'Тип лида', getTypeLabel(t), getTypeIcon(t)); }
function getPriorityBadge(p) { return chipIcon(p==='high'?'primary':'muted', 'Приоритет', getPriorityLabel(p), getPriorityIcon(p)); }
function getSourceBadge(s) { return chipIcon('info', 'Источник лида', getSourceLabel(s), getSourceIcon(s)); }
function getTypeBadgeFull(t) { return chip(t||'muted', 'Тип лида', `${getTypeIcon(t)} ${getTypeLabel(t)}`); }
function getSourceIcon(s) { const i={telegram:'✈️',website:'🌐',social_media:'👥'}; return i[s]||'📡'; }
/* Эмодзи-контракт статуса этапа таймлайна (канон RF OperatorLifecycleTimeline):
   у статуса — только значок; пояснение «Этап пайплайна: успешно» — во
   всплывающем комментарии. Название этапа в строке сохранено (как в RF). */
function stageStatusChip() { return chip('success', 'Этап пайплайна: успешно', '✔︎'); }

/* Инлайн-детали этапа (канон RF rf-oc-stage__details): превью в summary,
   JSON — в pre под ним (вместо legacy-модалки showJson). */
function stageDetails(preview, obj) {
    const json = escapeHtml(JSON.stringify(obj, null, 2));
    return `<details class="timeline-stage__details"><summary class="timeline-stage__details-summary">${preview}</summary><pre class="timeline-stage__json">${json}</pre></details>`;
}

/* Переключатель payload-блока (аналог RF OpPayloadBlock в «Технических данных»). */
function togglePayload(btn) {
    const box = btn.closest('.tech-payload');
    const pre = box.querySelector('.tech-payload__pre');
    const empty = box.querySelector('.tech-payload__empty');
    const show = pre ? pre.hidden : (empty ? empty.hidden : false);
    if (pre) pre.hidden = !show;
    if (empty) empty.hidden = !show;
    btn.textContent = show ? 'Hide' : 'Show';
}

function updateSystemStatus() {
    authFetch(`${API_BASE}/api/admin/health/detailed`)
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
    /* «Логи» — без автоперерисовки (канон RF: список не дёргается под
       смотрящим; данные обновляются фильтрами/пагинацией/выбором). */
}, 30000);