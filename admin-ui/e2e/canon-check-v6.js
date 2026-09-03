/* Headless e2e v6: LQ admin — Дополнение 7 (pairwise-выравнивание + таймлайн-контракт, этапы = семья статуса лида), полный канон-прогон.
   Каждая проверка = строка карты свойств AIC/RF + регресс v4. */
const puppeteer = require('/tmp/node_modules/puppeteer-core');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* Токен входа читается из infra/.env (ключ LQ_ADMIN_TOKEN), значение не печатается. */
const TOKEN = (fs.readFileSync('/opt/ai-automation-portfolio-lab/cases/n8n-lead-qualification/infra/.env', 'utf8')
  .match(/^LQ_ADMIN_TOKEN=(.+)$/m) || [])[1] || '';
const ADMIN = 'https://lead-qual-admin.alex-n8n.site/';
const VITRINE = 'https://ai.alex-n8n.site/cases/lead-qualification.html';
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    protocolTimeout: 90000,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const jsErrors = [];
  const page = await browser.newPage();
  page.on('pageerror', e => jsErrors.push(String(e)));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(ADMIN + '?v=20', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);

  /* === M0. Авторизация по токену (канон RF companyAuth / AIC Login) === */
  const login0 = await page.evaluate(() => ({
    loginShown: !document.getElementById('login-page').hidden,
    appHidden: document.querySelector('.app').hidden,
    inputType: document.getElementById('login-token')?.type,
    btns: [...document.querySelectorAll('#login-form button')].map(b => b.textContent.trim()),
    returnBtn: !!document.getElementById('login-return'),
  }));
  check('M0. экран входа: форма видна, консоль скрыта, password-инпут, «Войти»+демо+«К проекту»',
    login0.loginShown && login0.appHidden && login0.inputType === 'password'
      && login0.btns.join('|') === 'Войти|Войти в демо-режим (только просмотр)|К проекту' && login0.returnBtn,
    JSON.stringify(login0));
  /* пустой сабмит → «Введите токен.» */
  await page.click('#login-form button[type="submit"]'); await sleep(400);
  const emptyErr = await page.evaluate(() => document.getElementById('login-error')?.textContent.trim());
  check('M0a. пустой токен → «Введите токен.»', emptyErr === 'Введите токен.', emptyErr);
  /* неверный токен → «Недействительный токен.» */
  await page.type('#login-token', 'wrong-token'); await sleep(200);
  await page.click('#login-form button[type="submit"]'); await sleep(1500);
  const wrongErr = await page.evaluate(() => document.getElementById('login-error')?.textContent.trim());
  check('M0b. неверный токен → «Недействительный токен.»', wrongErr === 'Недействительный токен.', wrongErr);
  /* верный токен → консоль открыта */
  await page.evaluate(t => { document.getElementById('login-token').value = ''; }, TOKEN);
  await page.type('#login-token', TOKEN); await sleep(200);
  await page.click('#login-form button[type="submit"]'); await sleep(2500);
  const afterLogin = await page.evaluate(() => ({
    loginHidden: document.getElementById('login-page')?.hidden,
    appShown: !document.querySelector('.app')?.hidden,
  }));
  check('M0c. верный токен → консоль открыта, вход скрыт',
    afterLogin.loginHidden && afterLogin.appShown, JSON.stringify(afterLogin));

  /* Сидирование событий аудита: экспорт журнала (явное действие, пишется
     в аудит самим эндпоинтом). Токен не печатается. */
  const seeded = await page.evaluate(async (token) => {
    let n = 0;
    for (let i = 0; i < 6; i++) {
      const r = await fetch('/api/admin/audit/export', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) n++;
    }
    return n;
  }, TOKEN);
  check('M0d. экспорт-эндпоинт отвечает (6 сид-событий аудита)', seeded === 6, String(seeded));

  /* === M1. Токены/шрифты (карта §0/§1) === */
  const fonts = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      mono: cs.getPropertyValue('--font-mono').trim(),
      bg: cs.getPropertyValue('--bg-primary').trim(),
      accent: cs.getPropertyValue('--accent-primary').trim(),
    };
  });
  check('M1. mono-канон ui-monospace-стек', /^ui-monospace,/.test(fonts.mono), fonts.mono);
  check('M1a. RF-палитра на месте', fonts.bg === '#0b0f19' && fonts.accent === '#2f7bff', JSON.stringify(fonts));

  /* === M2. Типографика ролей (карта §1) === */
  const typo = await page.evaluate(() => {
    const cs = s => { const el = document.querySelector(s); return el ? getComputedStyle(el) : null; };
    const wt = cs('.workspace-title'), ws = cs('.workspace-subtitle');
    const st = cs('.metrics-block__title'), ml = cs('.metric-label');
    const ct = cs('.chart-title'), mv = cs('.metric-value');
    return {
      wt: wt && `${wt.fontSize}/${wt.fontWeight}`,
      ws: ws && `${ws.fontSize}/${ws.color}`,
      st: st && `${st.fontSize}/${st.fontWeight}/${st.textTransform}`,
      ml: ml && `${ml.fontSize}/${ml.textTransform}`,
      ct: ct && `${ct.fontSize}/${ct.textTransform}`,
      mv: mv && `${mv.fontSize}/${mv.fontWeight}`,
    };
  });
  check('M2. page-title 1.375rem/600', typo.wt === '22px/600', typo.wt);
  check('M2a. page-subtitle 0.8125rem', typo.ws && typo.ws.startsWith('13px'), typo.ws);
  check('M2b. section-title 0.8125rem/600 uppercase', typo.st === '13px/600/uppercase', typo.st);
  check('M2c. metric-label 0.6875rem uppercase', typo.ml === '11px/uppercase', typo.ml);
  check('M2d. chart-title 0.8125rem uppercase', typo.ct === '13px/uppercase', typo.ct);
  check('M2e. metric-value 1.125rem/700', typo.mv === '18px/700', typo.mv);

  /* === M3. Чип-база (карта §2.5: pad 1px 6px, radius 5px, gap 5px) === */
  const chipBase = await page.evaluate(() => {
    const el = document.querySelector('.ai-status');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { pad: cs.padding, radius: cs.borderRadius, gap: cs.columnGap };
  });
  check('M3. чип-база 1px 6px / 5px / 5px',
    chipBase && chipBase.pad === '1px 6px' && chipBase.radius === '5px' && chipBase.gap === '5px',
    JSON.stringify(chipBase));

  /* === M4. Dashboard-легенды: чипы вместо цветных точек === */
  const dash = await page.evaluate(() => ({
    dots: document.querySelectorAll('.legend-dot').length,
    chips: document.querySelectorAll('#distribution-legend .ai-status, #sources-legend .ai-status').length,
    rows: document.querySelectorAll('.legend-item').length,
  }));
  check('M4. легенды dashboard: 0 точек, чипы на месте', dash.dots === 0 && dash.chips >= 7, JSON.stringify(dash));

  /* === M5. Айтем канона (карта §2.4) === */
  await page.evaluate(() => document.querySelector('.nav-item[data-page="leads"]').click());
  await sleep(2500);
  const item = await page.evaluate(() => {
    const el = document.querySelector('#leads-list .list-item');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      pad: getComputedStyle(el).padding,
      radius: getComputedStyle(el).borderRadius,
      rowGap: getComputedStyle(el).rowGap,
    };
  });
  check('M5. айтем pad 8px / radius 10px / gap 4px',
    item && item.pad === '8px' && item.radius === '10px' && item.rowGap === '4px',
    JSON.stringify(item));
  const itemParts = await page.evaluate(() => {
    const el = document.querySelector('#leads-list .list-item');
    if (!el) return null;
    const q = s => el.querySelector(s);
    const cs = s => { const e = el.querySelector(s); return e ? getComputedStyle(e) : null; };
    const ts = cs('.list-item__timestamp'), id = cs('.list-item__id'),
          prev = cs('.list-item__preview'), tel = cs('.list-item__telemetry'),
          row = cs('.list-item__row');
    return {
      rowCols: row ? row.gridTemplateColumns : null,
      ts: ts && `${ts.fontSize}/${ts.fontVariantNumeric}/${ts.fontFamily.includes('ui-monospace') ? 'mono' : 'sans'}`,
      id: id && `${id.fontSize}/${id.fontWeight}/${id.borderRadius}/${id.fontFamily.includes('ui-monospace') ? 'mono' : 'sans'}`,
      prev: prev && `${prev.fontSize}/${prev.fontWeight}`,
      tel: tel && `${tel.fontSize}/${tel.color}`,
    };
  });
  const rowCols3 = itemParts ? itemParts.rowCols.trim().split(/\s+/).length : 0;
  check('M5a. строка 1: 3 колонки grid канона', rowCols3 === 3, JSON.stringify(itemParts && itemParts.rowCols));
  check('M5b. ts 0.75rem tabular sans', itemParts && itemParts.ts === '12px/tabular-nums/sans', itemParts && itemParts.ts);
  check('M5c. id mono-пилюля 0.72rem/600/r4', itemParts && itemParts.id === '11.52px/600/4px/mono', itemParts && itemParts.id);
  check('M5d. preview 0.875rem/500', itemParts && itemParts.prev === '14px/500', itemParts && itemParts.prev);
  check('M5e. telemetry 0.75rem secondary sans',
    itemParts && itemParts.tel === '12px/rgb(203, 213, 225)', itemParts && itemParts.tel);

  /* hover/selected канона */
  const firstItem = await page.$('#leads-list .list-item');
  if (firstItem) {
    await firstItem.hover(); await sleep(300);
    const hoverB = await page.evaluate(() =>
      getComputedStyle(document.querySelector('#leads-list .list-item')).borderColor);
    check('M5f. hover: border primary, без тени', hoverB === 'rgb(47, 123, 255)', hoverB);
    await firstItem.click(); await sleep(1200);
    const selShadow = await page.evaluate(() => {
      const s = document.querySelector('#leads-list .list-item.selected');
      if (!s) return null;
      const cs = getComputedStyle(s);
      return { b: cs.borderColor, bg: cs.backgroundColor, sh: cs.boxShadow };
    });
    check('M5g. selected: бордер + тинт, без тени',
      selShadow && selShadow.b === 'rgb(47, 123, 255)' && selShadow.bg === 'rgba(47, 123, 255, 0.12)' && selShadow.sh === 'none',
      JSON.stringify(selShadow));
  }

  /* === M6. Паспорт: kv-канон (dt без uppercase, сетка auto 1fr) === */
  const kv = await page.evaluate(() => {
    const f = document.querySelector('#lead-detail .passport-field');
    const dt = document.querySelector('#lead-detail .passport-field__label');
    const pt = document.querySelector('#lead-detail .passport-panel__title');
    if (!f) return null;
    const cs = getComputedStyle(f), dts = getComputedStyle(dt), pts = getComputedStyle(pt);
    return {
      cols: cs.gridTemplateColumns, colGap: cs.columnGap, rowGap: cs.rowGap,
      dt: `${dts.fontSize}/${dts.fontWeight}/${dts.textTransform}`,
      pt: `${pts.fontSize}/${pts.textTransform}/${pts.color}`,
    };
  });
  const kvCols2 = kv ? kv.cols.trim().split(/\s+/).length : 0;
  check('M6. kv-сетка 2 колонки, gap 4px 10px',
    kvCols2 === 2 && kv.colGap === '10px' && kv.rowGap === '4px',
    JSON.stringify(kv));
  check('M6a. dt 0.6875rem/500 без uppercase', kv && kv.dt === '11px/500/none', kv && kv.dt);
  check('M6b. panel-title 0.75rem uppercase muted', kv && kv.pt.startsWith('12px/uppercase'), kv && kv.pt);
  const objSt = await page.evaluate(() => {
    const el = document.querySelector('#lead-detail .object-status');
    if (!el) return null;
    return getComputedStyle(el, '::before').display;
  });
  check('M6c. object-status: точка скрыта (эмодзи-канон)', objSt === 'none', String(objSt));

  /* === M7. Empty/loading — plain text, 0 SVG/спиннеров === */
  const emptyProbe = await page.evaluate(() => ({
    icons: document.querySelectorAll('.empty-icon').length,
    spinners: document.querySelectorAll('.spinner').length,
    titles: document.querySelectorAll('.empty-title').length,
    texts: document.querySelectorAll('.empty-text').length,
  }));
  check('M7. 0 empty-icon / 0 spinner / 0 empty-title',
    emptyProbe.icons === 0 && emptyProbe.spinners === 0 && emptyProbe.titles === 0,
    JSON.stringify(emptyProbe));

  /* === M8. System Status: HEALTH-чипы === */
  await page.evaluate(() => document.querySelector('.nav-item[data-page="system"]').click());
  await sleep(1500);
  const sys = await page.evaluate(() => ({
    chips: document.querySelectorAll('#system-metrics .ai-status').length,
    dots: document.querySelectorAll('#system-metrics .status-indicator').length,
    texts: Array.from(document.querySelectorAll('#system-metrics .metric-value')).map(e => e.textContent.trim()),
  }));
  check('M8. System Status: 6 HEALTH-чипов, 0 точек', sys.chips === 6 && sys.dots === 0, JSON.stringify(sys));
  check('M8a. подпись при значке («🟢 Online»)', sys.texts.some(t => /🟢 Online/.test(t)), sys.texts.join(' | '));

  /* === M9. Легенда (карта §2.10) === */
  await page.evaluate(() => document.querySelector('.nav-item[data-page="legend"]').click());
  await sleep(500);
  const legend = await page.evaluate(() => {
    const grid = document.querySelector('.legend-grid'), panel = document.querySelector('.legend-panel');
    const title = document.querySelector('.legend-panel__title');
    const note = document.querySelector('.legend-row__note');
    const pop = document.querySelector('.legend-help__pop');
    return {
      panels: document.querySelectorAll('.legend-panel').length,
      rows: document.querySelectorAll('.legend-row').length,
      gap: grid ? getComputedStyle(grid).columnGap : null,
      panelBorder: panel ? getComputedStyle(panel).borderColor : null,
      title: title ? `${getComputedStyle(title).fontSize}/${getComputedStyle(title).textTransform}` : null,
      note: note ? getComputedStyle(note).color : null,
      popShadow: pop ? getComputedStyle(pop).boxShadow : null,
      popFs: pop ? getComputedStyle(pop).fontSize : null,
    };
  });
  check('M9. легенда 3×17, gap 12px, panel border-subtle',
    legend.panels === 3 && legend.rows === 17 && legend.gap === '12px' && legend.panelBorder === 'rgb(30, 37, 56)',
    JSON.stringify(legend));
  check('M9a. panel-title 0.875rem uppercase', legend.title === '14px/uppercase', legend.title);
  check('M9b. note secondary', legend.note === 'rgb(203, 213, 225)', legend.note);
  check('M9c. help-поповер: снизу-слева, тень канона',
    legend.popShadow && legend.popShadow.includes('rgba(0, 0, 0, 0.25)') && legend.popFs === '11.52px',
    `${legend.popShadow} ${legend.popFs}`);

  /* === M10. Аудит (канон RF AuditWorkspace, полный прогон) === */
  await page.evaluate(() => document.querySelector('.nav-item[data-page="audit"]').click());
  await sleep(2500);
  const audit = await page.evaluate(() => {
    const card = document.querySelector('.audit-card'), detail = document.querySelector('.audit-detail');
    const layout = document.querySelector('.audit-layout');
    const wsActions = document.getElementById('ws-actions');
    const wa = document.querySelector('.ws-action-btn');
    const item = document.querySelector('#audit-list .list-item');
    const itemCs = item ? getComputedStyle(item) : null;
    const kvs = document.querySelector('.audit-detail__kv');
    const kvcs = kvs ? getComputedStyle(kvs) : null;
    const grid = document.querySelector('.audit-detail .trace-grid');
    const pre = document.querySelector('.audit-detail .trace-pre--mono');
    const preCs = pre ? getComputedStyle(pre) : null;
    const iddd = document.querySelector('.audit-detail__kv dd.audit-item__id');
    const idCs = iddd ? getComputedStyle(iddd) : null;
    const wins = [...document.querySelectorAll('#audit-window option')].map(o => `${o.value}:${o.textContent}:${o.selected ? '*' : ''}`);
    const roles = [...document.querySelectorAll('#audit-role option')].map(o => `${o.value}:${o.textContent}`);
    const ress = [...document.querySelectorAll('#audit-resource option')].map(o => `${o.value}:${o.textContent}`);
    const chipEl = document.querySelector('.audit-detail__head .ai-status');
    return {
      layoutGap: layout ? getComputedStyle(layout).columnGap : null,
      cardPad: card ? getComputedStyle(card).padding : null,
      detailPad: detail ? getComputedStyle(detail).padding : null,
      wsHidden: document.getElementById('ws-actions')?.hidden,
      wsOrder: [...document.querySelectorAll('.ws-action-btn')].map(b => b.textContent.trim()),
      btn: (() => { const b = document.querySelector('.ws-action-btn'); if (!b) return null; const c = getComputedStyle(b); return `${c.backgroundColor}/${c.borderWidth}/${c.padding}/${c.fontSize}/${c.borderRadius}`; })(),
      item: itemCs ? `${itemCs.padding}/${itemCs.borderRadius}` : null,
      itemRow1: item ? item.querySelector('.list-item__row')?.textContent.replace(/\s+/g, ' ').trim() : null,
      roleTitle: item?.querySelector('.list-item__status .ai-status')?.getAttribute('title'),
      preview: item?.querySelector('.list-item__preview')?.textContent.trim(),
      tsText: item?.querySelector('.list-item__timestamp')?.textContent.trim(),
      telemetry: item ? item.querySelectorAll('.list-item__telemetry-item').length : 0,
      kv: kvcs ? `${kvcs.fontSize}/${kvcs.gridTemplateColumns}` : null,
      dtW: (() => { const d = document.querySelector('.audit-detail__kv dt'); return d ? getComputedStyle(d).fontWeight : null; })(),
      dtText: document.querySelector('.audit-detail__kv dt')?.textContent,
      headChip: chipEl ? `${chipEl.className.includes('ai-status--primary')}/${chipEl.textContent.trim()}` : null,
      gridCols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
      secTitles: [...document.querySelectorAll('.audit-detail .trace-section__title')].map(t => t.textContent.trim()),
      preMono: preCs ? `${preCs.fontSize}/${preCs.fontFamily.includes('ui-monospace') ? 'mono' : 'sans'}` : null,
      idMono: idCs ? (idCs.fontFamily.includes('ui-monospace') ? 'mono' : 'sans') : null,
      snapshot: [...document.querySelectorAll('.audit-detail details summary')].map(s => s.textContent.trim()),
      wins, roles, ress,
      resetDisabled: document.getElementById('audit-reset')?.disabled,
      selectedFirst: document.querySelector('#audit-list .list-item')?.classList.contains('selected'),
    };
  });
  check('M10. audit-layout gap 8px, карточка 12px 12px 8px, детализация 8px',
    audit.layoutGap === '8px' && audit.cardPad === '12px 12px 8px' && audit.detailPad === '8px',
    JSON.stringify(audit));
  check('M10a. действия в шапке: Экспорт CSV → Обновить, форма RF (панель bg, radius 5px, 6px 12px, 0.875rem)',
    audit.wsHidden === false && audit.wsOrder[0] === 'Экспорт CSV' && audit.wsOrder[1] === 'Обновить'
      && audit.btn === 'rgb(21, 27, 43)/1px/6px 12px/14px/5px',
    JSON.stringify({ hidden: audit.wsHidden, order: audit.wsOrder, btn: audit.btn }));
  check('M10b. айтем = list-item pad 8px radius 10px, telemetry 3 спана',
    audit.item === '8px/10px' && audit.telemetry === 3, `${audit.item} tel=${audit.telemetry}`);
  check('M10c. строка 1: дата-время с секундами + чип роли «Роль: Администратор»',
    /\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}/.test(audit.tsText || '') && audit.roleTitle === 'Роль: Администратор',
    `${audit.tsText} | ${audit.roleTitle}`);
  check('M10c2. превью = человекочитаемая метка действия (не /api/...)',
    audit.preview && !audit.preview.startsWith('/api/'), audit.preview);
  check('M10d. kv obs: 0.75rem, grid 5.5rem 1fr, dt 400 с двоеточием',
    audit.kv.startsWith('12px/88px') && audit.dtW === '400' && /:$/.test(audit.dtText || ''),
    `${audit.kv} ${audit.dtW} "${audit.dtText}"`);
  check('M10e. head «Детализация события» + чип с сырым action, primary',
    audit.headChip && audit.headChip.startsWith('true/')
      && (/^true\/\/api\//.test(audit.headChip) || audit.headChip === 'true/console_login'),
    audit.headChip);
  check('M10f. сетка 2 колонки: «Параметры акции» + «Параметры пользователя»',
    audit.gridCols === 2 && audit.secTitles.includes('Параметры акции') && audit.secTitles.includes('Параметры пользователя'),
    JSON.stringify(audit.secTitles));
  check('M10g. «Детали / metadata» — mono pre 12px; id/IP mono',
    audit.preMono === '12px/mono' && audit.idMono === 'mono', `${audit.preMono} ${audit.idMono}`);
  check('M10h. «Технический снимок события (JSON)» — collapsible',
    audit.snapshot.includes('Технический снимок события (JSON)'), JSON.stringify(audit.snapshot));
  check('M10i. фильтры RF: окно 24h/7d*(дефолт)/30d/все, роль, ресурс',
    audit.wins.join('|') === '24:24h:|168:7d:*|720:30d:|:все:'
      && audit.roles.join('|') === ':все роли|admin:Администратор|demo:Демо'
      && audit.ress.join('|') === ':все ресурсы|dashboard:Дашборд|lead:Лиды|logs:Логи|system:Система|auth:Авторизация',
    JSON.stringify({ wins: audit.wins, roles: audit.roles, ress: audit.ress }));
  check('M10j. «Сброс» задизейблен на дефолтных фильтрах', audit.resetDisabled === true, String(audit.resetDisabled));
  check('M10k. первая строка выбрана автоматически', audit.selectedFirst === true, String(audit.selectedFirst));

  /* навигация стрелками (канон RF): ↓ перемещает выбор, ↑ возвращает */
  await page.keyboard.press('ArrowDown');
  await sleep(400);
  const selIdx = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('#audit-list .list-item')];
    return nodes.findIndex(n => n.classList.contains('selected'));
  });
  check('M10l. стрелка ↓ выбирает вторую строку', selIdx === 1, `selected index=${selIdx}`);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await sleep(600);

  /* регресс: пагинация аудита */
  const auditPag = await page.evaluate(() => ({
    info: document.querySelector('#audit-page .page-info')?.textContent.replace(/\s+/g, ' ').trim(),
    items: document.querySelectorAll('#audit-list .list-item').length,
    total: document.getElementById('audit-total')?.textContent,
  }));
  check('M10m. аудит: 7 айтемов + «Страница N из M» + «Всего N»',
    auditPag.items === 7 && /^Страница \d+ из \d+$/.test(auditPag.info || '') && /Всего \d+/.test(auditPag.total || ''),
    JSON.stringify(auditPag));

  /* События авторизации в журнале: «Вход в систему» (console_login) и
     «Экспорт журнала аудита» — читающие GET не пишутся (кроме экспорта). */
  const loginEvt = await page.evaluate(async (token) => {
    const r = await fetch('/api/admin/audit?limit=50', { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    const items = d.items || [];
    return {
      login: items.some(i => i.action === 'console_login'),
      export: items.some(i => i.action === '/api/admin/audit/export'),
      reads: items.filter(i => /^\/api\/admin\/(dashboard|leads|logs|health)/.test(String(i.action))).length,
      roles: items.every(i => i.user_role === 'admin'),
    };
  }, TOKEN);
  check('M10n. аудит: console_login + export пишутся, чтение — нет, роль admin',
    loginEvt.login && loginEvt.export && loginEvt.reads === 0 && loginEvt.roles,
    JSON.stringify(loginEvt));

  /* === M11. Регресс: палитра/пагинация/чипы/мониторинг === */
  await page.evaluate(() => document.querySelector('.nav-item[data-page="leads"]').click());
  await sleep(2000);
  const leadsPag = await page.evaluate(() => {
    const controls = document.querySelector('#leads-page .page-controls');
    const btn = controls ? getComputedStyle(controls.querySelector('.page-btn')) : null;
    return {
      btns: controls ? Array.from(controls.querySelectorAll('.page-btn')).map(b => b.textContent.trim()) : [],
      info: document.querySelector('#leads-page .page-info')?.textContent.replace(/\s+/g, ' ').trim(),
      items: document.querySelectorAll('#leads-list .list-item').length,
      btnStyle: btn ? `${btn.padding}/${btn.fontSize}/${btn.backgroundColor}` : null,
      bb: controls ? getComputedStyle(controls).borderBottomWidth : null,
    };
  });
  check('M11. пагинация канона жива (7 айтемов, кнопки 4px 8px transparent, черта)',
    leadsPag.items === 7 && leadsPag.btns.join('|') === '← Назад|Вперёд →' &&
      /^Страница \d+ из \d+$/.test(leadsPag.info || '') && leadsPag.btnStyle === '4px 8px/12px/rgba(0, 0, 0, 0)' && leadsPag.bb === '1px',
    JSON.stringify(leadsPag));
  const chips = await page.evaluate(() => {
    const first = document.querySelector('#leads-list .list-item');
    const tel = first ? first.querySelectorAll('.list-item__telemetry .ai-status') : [];
    const st = document.querySelector('#leads-list .list-item__status .ai-status');
    return {
      telCount: tel.length,
      telTitles: Array.from(tel).map(e => e.getAttribute('title')),
      emojiOnly: Array.from(tel).slice(0, 3).every(e => Array.from(e.textContent.trim()).length <= 2),
      stTitle: st?.getAttribute('title'),
    };
  });
  check('M11a. emojiOnly-чипы с tooltip «Семья: Значение» живы',
    chips.telCount === 4 && chips.emojiOnly && /Статус лида: /.test(chips.stTitle || ''),
    JSON.stringify(chips.telTitles));

  await page.evaluate(() => document.querySelector('.nav-item[data-page="monitoring"]').click());
  await sleep(1500);
  const mon = await page.evaluate(() => ({
    info: document.querySelector('#monitoring-page .page-info')?.textContent.replace(/\s+/g, ' ').trim(),
    items: document.querySelectorAll('#monitoring-list .list-item').length,
  }));
  check('M11b. мониторинг-пагинация жива (трейсы: 7 на страницу)',
    /^Страница \d+ из \d+$/.test(mon.info || '') && mon.items >= 1 && mon.items <= 7, JSON.stringify(mon));

  const selfCheck = await page.evaluate(async (token) => {
    const r = await fetch('/api/admin/audit?limit=50', { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    /* Просмотр списка/события аудита не пишется; экспорт — легитимное действие. */
    return (d.items || []).some(i => /^\/api\/admin\/audit(\/\d+)?$/.test(String(i.action)));
  }, TOKEN);
  check('M11c. audit не пишет сам себя', !selfCheck);

  /* === M12. Тема/возврат/ширины === */
  await page.click('#theme-toggle'); await sleep(300);
  const light = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { bg: cs.getPropertyValue('--bg-primary').trim(), accent: cs.getPropertyValue('--accent-primary').trim() };
  });
  check('M12. светлая RF-зеркало жива', light.bg === '#ffffff' && light.accent === '#2563eb', JSON.stringify(light));
  await page.click('#theme-toggle'); await sleep(300);

  await page.evaluate(() => document.querySelector('.nav-item[data-page="dashboard"]').click());
  await page.click('#return-to-portfolio'); await sleep(1500);
  check('M12a. прямой вход → vitrine', page.url().startsWith('https://ai.alex-n8n.site/cases/lead-qualification.html'), page.url());

  await page.evaluate(() => document.querySelector('a.btn[href*="lead-qual-admin"]').click());
  const t = await browser.waitForTarget(t2 => t2.url().startsWith(ADMIN), { timeout: 15000 });
  const ap = await t.page(); await ap.bringToFront(); await sleep(1000);
  await ap.click('#return-to-portfolio'); await sleep(1500);
  check('M12b. из витрины → вкладка закрыта', ap.isClosed());
  const pages2 = await browser.pages();
  const lPage = pages2.find(p => p.url().startsWith('https://ai.alex-n8n.site'));
  await lPage.evaluate(() => document.querySelector('a.btn[href*="lead-qual-admin"]').click());
  const t2 = await browser.waitForTarget(t3 => t3.url().startsWith(ADMIN), { timeout: 15000 });
  const ap2 = await t2.page(); await ap2.bringToFront(); await sleep(800);
  for (const w of [1280, 375]) {
    await ap2.setViewport({ width: w, height: 900 }); await sleep(400);
    const o = await ap2.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`M12c. ${w}px: без переполнения`, o <= 0, String(o));
  }


  /* === M13. Меню-канон APL (Система → Операции → Аналитика → Наблюдаемость → Справка) === */
  await page.goto(ADMIN + '?v=20', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);
  const menu = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.sidebar-nav .nav-section')).map(sec => ({
      g: sec.querySelector('.nav-section-title')?.textContent.trim(),
      items: Array.from(sec.querySelectorAll('.nav-item')).map(a => {
        // нормализация: срезаем ведущий эмодзи (до 2 кодпоинтов + пробел)
        let t = a.textContent.replace(/\s+/g, ' ').trim();
        const first = Array.from(t)[0] || '';
        if (Array.from(first).length >= 1 && /\p{Extended_Pictographic}/u.test(first)) {
          t = t.slice(first.length).replace(/^[\u200d\ufe0f ]+/, '');
        }
        return t;
      }),
    }))
  );
  const menuOrder = menu.map(m => m.g).join(' → ');
  console.log('      меню:', menuOrder, '|', menu.map(m => m.g + ': ' + m.items.join(', ')).join(' || '));
  check('M13. порядок групп: Система → Операции → Аналитика → Наблюдаемость → Справка',
    menuOrder === 'Система → Операции → Аналитика → Наблюдаемость → Справка', menuOrder);
  check('M13a. Панель состояния в Системе',
    menu[0] && menu[0].items.join(',') === 'Панель состояния', menu[0] && menu[0].items.join(','));
  check('M13b. Очередь лидов в Операциях, Дашборд в Аналитике',
    menu[1] && menu[1].items.join(',') === 'Очередь лидов' && menu[2] && menu[2].items.join(',') === 'Дашборд',
    menu.slice(0, 3).map(m => m.g + '=' + m.items.join(',')).join(' | '));
  check('M13c. Логи в Наблюдаемости (не Monitoring)',
    menu[3] && menu[3].g === 'Наблюдаемость' && menu[3].items.join(',') === 'Логи,Журнал аудита',
    menu[3] && menu[3].items.join(','));
  const wsTitles = await page.evaluate(() => {
    const out = {};
    for (const k of ['dashboard', 'monitoring', 'system']) {
      const nav = document.querySelector('.nav-item[data-page="' + k + '"]')?.textContent.replace(/\s+/g, ' ').trim() || '';
      out[k] = nav;
    }
    return out;
  });
  check('M13d. названия пунктов канона (Дашборд/Логи/Панель состояния)',
    /Дашборд/.test(wsTitles.dashboard) && /(^| )Логи$/.test(wsTitles.monitoring.trim()) && /Панель состояния/.test(wsTitles.system),
    JSON.stringify(wsTitles));

  /* === M14. Pairwise-выравнивание паспортных панелей + таймлайн-контракт (Дополнение 7) === */
  await page.evaluate(() => document.querySelector('.nav-item[data-page="leads"]').click());
  await sleep(1500);
  const m14 = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('#lead-detail .passport-panel'));
    const valX = panels.map(p => {
      const v = p.querySelector('.passport-field__value');
      return v ? Math.round(v.getBoundingClientRect().left) : null;
    });
    const labX = panels.map(p => {
      const l = p.querySelector('.passport-field__label');
      return l ? Math.round(l.getBoundingClientRect().left) : null;
    });
    const titles = panels.map(p => p.querySelector('.passport-panel__title')?.textContent.trim());
    const sum = document.querySelector('#lead-detail .collapsed-zone summary')?.textContent.trim();
    const stages = Array.from(document.querySelectorAll('#lead-detail .timeline-stage'));
    const chips = stages.map(st => Array.from(st.querySelectorAll('.timeline-stage__top .ai-status')).map(c => ({
      t: c.getAttribute('title'),
      e: c.textContent.trim(),
    })));
    const names = stages.map(st => st.querySelector('.timeline-stage__name')?.textContent.trim());
    const st0 = stages[0];
    const stCs = st0 ? getComputedStyle(st0) : null;
    const tm = st0 ? getComputedStyle(st0.querySelector('.timeline-stage__time')) : null;
    return {
      titles, valX, labX, sum, stageCount: stages.length, chips, names,
      stage: stCs ? `${stCs.borderRadius}/${stCs.paddingTop} ${stCs.paddingRight}/${stCs.borderColor}` : null,
      time: tm ? `${tm.fontSize}/${tm.fontVariantNumeric}/${tm.fontFamily.includes('ui-monospace') ? 'mono' : 'sans'}` : null,
    };
  });
  console.log('      M14:', JSON.stringify({ valX: m14.valX, labX: m14.labX, sum: m14.sum, stageCount: m14.stageCount, chips: m14.chips, names: m14.names, time: m14.time }));
  check('M14. 4 паспортные панели в детализации',
    m14.titles.join(',') === 'Паспорт лида,Квалификация лида,CRM Синхронизация,Состояние сделки',
    m14.titles.join(','));
  check('M14a. pairwise: названия в колонке на одном x (Паспорт↔CRM, Квалификация↔Сделка)',
    m14.labX.length === 4 && m14.labX[0] === m14.labX[2] && m14.labX[1] === m14.labX[3],
    JSON.stringify(m14.labX));
  check('M14b. pairwise: значения на одном x попарно',
    m14.valX.length === 4 && m14.valX[0] === m14.valX[2] && m14.valX[1] === m14.valX[3],
    JSON.stringify(m14.valX));
  check('M14c. таймлайн: «Таймлайн обработки»', m14.sum === 'Таймлайн обработки', m14.sum);
  check('M14d. названия этапов в строке сохранены (канон RF)',
    m14.stageCount >= 1 && m14.names[0] === 'Создан' && m14.names.every(n => Boolean(n)),
    JSON.stringify(m14.names));
  check('M14e. статус этапа = один значок, tooltip «Этап пайплайна: успешно»',
    m14.stageCount >= 1 && m14.chips.every(row => row.length === 1
      && row[0].t === 'Этап пайплайна: успешно' && row[0].e === '✔︎'),
    JSON.stringify(m14.chips));
  check('M14f. форма RF compact: radius 5px, pad 4px, время 11px tabular sans',
    m14.stage && m14.stage.startsWith('5px/4px') && m14.time === '11px/tabular-nums/sans',
    `${m14.stage} | ${m14.time}`);

  /* === M14g..M14k. Полная RF-форма: inline-details этапов + «Технические данные» (Дополнение 8) === */
  const m14b = await page.evaluate(() => {
    const stages = Array.from(document.querySelectorAll('#lead-detail .timeline-stage'));
    const dts = stages.map(st => {
      const d = st.querySelector('.timeline-stage__details');
      const s = d?.querySelector('.timeline-stage__details-summary');
      const cs = s ? getComputedStyle(s) : null;
      return {
        has: Boolean(d),
        preview: s ? s.textContent.trim() : null,
        sumStyle: cs ? `${cs.fontSize}/${cs.fontWeight}` : null,
      };
    });
    const first = stages[0]?.querySelector('.timeline-stage__details');
    if (first) first.open = true;
    const pre = stages[0]?.querySelector('.timeline-stage__json');
    let preOk = false;
    try { JSON.parse(pre?.textContent || ''); preOk = true; } catch (e) { preOk = false; }
    const preCs = pre ? getComputedStyle(pre) : null;
    const zones = Array.from(document.querySelectorAll('#lead-detail .collapsed-zone'));
    const tech = zones[1];
    const techSum = tech?.querySelector('summary')?.textContent.trim();
    const techCs = tech ? getComputedStyle(tech) : null;
    const techSumCs = tech ? getComputedStyle(tech.querySelector('summary')) : null;
    const idCode = tech?.querySelector('.tech-id');
    const plTitle = tech?.querySelector('.tech-payload__title')?.textContent.trim();
    const plBtn = tech?.querySelector('.tech-payload__btn');
    const plBtnText = plBtn ? plBtn.textContent.trim() : null;
    if (plBtn) plBtn.click();
    const plPre = tech?.querySelector('.tech-payload__pre');
    let plOk = false;
    try { const arr = JSON.parse(plPre?.textContent || 'x'); plOk = Array.isArray(arr) && arr.length > 0; } catch (e) { plOk = false; }
    return {
      dts, preOk,
      preStyle: preCs ? `${preCs.fontSize}/${preCs.maxHeight}/${preCs.fontFamily.includes('ui-monospace') ? 'mono' : 'sans'}` : null,
      zones: zones.map(z => z.querySelector('summary')?.textContent.trim()),
      techForm: techCs ? `${techCs.borderRadius}/${techCs.paddingTop} ${techCs.paddingRight}/${techCs.backgroundColor}` : null,
      techSumStyle: techSumCs ? `${techSumCs.fontSize}/${techSumCs.fontWeight}` : null,
      techSum, idTitle: idCode?.getAttribute('title') || null, idText: idCode?.textContent.trim() || null,
      plTitle, plBtnText, plVisible: plPre ? !plPre.hidden : false, plOk,
    };
  });
  console.log('      M14b:', JSON.stringify({ zones: m14b.zones, dts: m14b.dts, techForm: m14b.techForm, plBtn: m14b.plBtnText, plVisible: m14b.plVisible, plOk: m14b.plOk }));
  check('M14g. у каждого этапа inline-details с превью-summary (канон RF)',
    m14b.dts.length >= 1 && m14b.dts.every(d => d.has && d.preview && d.sumStyle === '11.84px/600'),
    JSON.stringify(m14b.dts.map(d => [d.preview, d.sumStyle])));
  check('M14h. открытие details показывает JSON-pre (0.72rem mono, max-h 120px)',
    m14b.preOk && m14b.preStyle === '11.52px/120px/mono', m14b.preStyle);
  check('M14i. второй блок — «Технические данные», каркас RF rf-oc-tech (radius 8px, pad 6px 8px)',
    m14b.zones.length === 2 && m14b.zones[1] === 'Технические данные'
      && m14b.techForm && m14b.techForm.startsWith('8px/6px 8px') && m14b.techSumStyle === '13.12px/650',
    `${m14b.zones.join(' | ')} | ${m14b.techForm} | ${m14b.techSumStyle}`);
  check('M14j. Внутренний ID: код с title = полному id',
    Boolean(m14b.idTitle) && m14b.idText === m14b.idTitle, `${m14b.idText} / ${m14b.idTitle}`);
  check('M14k. payload «Журнал событий (raw)»: Show → pre с непустым JSON-массивом',
    m14b.plTitle === 'Журнал событий (raw)' && m14b.plBtnText === 'Show'
      && m14b.plVisible === true && m14b.plOk === true,
    `${m14b.plTitle} | ${m14b.plBtnText} | visible=${m14b.plVisible} ok=${m14b.plOk}`);

  /* === M15. Логи: проекция по обращениям — канон RF LogsWorkspace (Дополнение 9) === */
  await page.evaluate(() => document.querySelector('.nav-item[data-page="monitoring"]').click());
  await sleep(1500);
  // Окно времени «все» (дефолт 24h канона RF отсекает старые обращения)
  await page.evaluate(() => {
    const sel = document.getElementById('monitoring-window');
    sel.value = '';
    sel.dispatchEvent(new Event('change'));
  });
  await sleep(1200);
  const m15a = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#monitoring-list .list-item'));
    const rows = items.slice(0, 3).map(it => ({
      ts: it.querySelector('.list-item__timestamp')?.textContent.trim(),
      idPill: it.querySelector('.list-item__id')?.textContent.trim() || null,
      status: (() => { const c = it.querySelector('.list-item__status .ai-status'); return c ? `${c.getAttribute('title')}/${c.textContent.trim()}` : null; })(),
      preview: it.querySelector('.list-item__preview')?.textContent.trim(),
      telemetry: Array.from(it.querySelectorAll('.list-item__telemetry-item')).map(s => s.textContent.trim()),
    }));
    return { count: items.length, total: document.getElementById('monitoring-pagination-total').textContent, rows };
  });
  console.log('      M15:', JSON.stringify(m15a));
  check('M15. список обращений (одна строка = один пайплайн лида)',
    m15a.count === 7 && Number(m15a.total) >= 14 && Number(m15a.total) <= 20,
    `count=${m15a.count} total=${m15a.total}`);
  check('M15a. айтем-трейс: время + статус-значок семьи «Статус обработки» без id-пилюли',
    m15a.rows.every(r => r.ts && !r.idPill && r.status && r.status.startsWith('Статус обработки:')),
    JSON.stringify(m15a.rows.map(r => [r.idPill, r.status])));
  check('M15a2. превью = номер обращения, telemetry = модель | #id8 | latency',
    m15a.rows.every(r => r.preview && r.telemetry.length === 3
      && r.telemetry[1].startsWith('#') && r.telemetry[1].length === 9),
    JSON.stringify(m15a.rows.map(r => [r.preview, r.telemetry])));

  // Фильтр статуса «успешно»: все айтемы ✔︎, авто-выбор первого ok-трейса
  await page.evaluate(() => {
    const sel = document.getElementById('monitoring-type');
    sel.value = 'ok';
    sel.dispatchEvent(new Event('change'));
  });
  await sleep(1500);
  const m15g = await page.evaluate(() => ({
    count: document.querySelectorAll('#monitoring-list .list-item').length,
    statuses: Array.from(document.querySelectorAll('#monitoring-list .list-item .list-item__status .ai-status')).map(c => `${c.getAttribute('title')}/${c.textContent.trim()}`),
    total: document.getElementById('monitoring-pagination-total').textContent,
  }));
  check('M15g. фильтр статуса «успешно» работает (живой фильтр, все ✔︎)',
    Number(m15g.total) >= 1 && Number(m15g.total) < 20 && m15g.count >= 1
      && m15g.statuses.every(s => s === 'Статус обработки: успешно/✔︎'),
    JSON.stringify({ total: m15g.total, statuses: m15g.statuses.slice(0, 3) }));

  // Детализация первого ok-обращения в правой макропанели
  const m15b = await page.evaluate(() => {
    const d = document.getElementById('event-detail');
    const grid = (() => { const g = d.querySelector('.trace-grid'); return g ? getComputedStyle(g).gridTemplateColumns.trim().split(/\s+/).length : 0; })();
    const box = (() => { const b = d.querySelector('.trace-section'); if (!b) return null; const s = getComputedStyle(b); return `${s.borderRadius}/${s.padding}/${s.borderStyle}`; })();
    const sections = Array.from(d.querySelectorAll('.trace-section__title')).map(s => s.textContent.trim());
    const dts = Array.from(d.querySelectorAll('.audit-detail__kv dt')).map(x => x.textContent.trim());
    const stages = Array.from(d.querySelectorAll('.timeline-stage')).map(st => ({
      name: st.querySelector('.timeline-stage__name')?.textContent.trim(),
      time: st.querySelector('.timeline-stage__time')?.textContent.trim() || '',
      chip: st.querySelector('.ai-status')?.getAttribute('title'),
      details: st.querySelector('.timeline-stage__details summary')?.textContent.trim() || null,
      offset: st.querySelector('.timeline-stage__offset')?.textContent.trim() || null,
      lat: st.querySelector('.timeline-stage__lat')?.textContent.trim() || null,
      offsetStyle: (() => { const o = st.querySelector('.timeline-stage__offset'); if (!o) return null; const c = getComputedStyle(o); return `${c.fontSize}/${c.fontFamily.includes('mono') ? 'mono' : 'sans'}`; })(),
      latRight: (() => { const n = st.querySelector('.timeline-stage__name'); const l = st.querySelector('.timeline-stage__lat'); if (!n || !l) return false; return (n.getBoundingClientRect().right + 8) <= l.getBoundingClientRect().left; })(),
    }));
    const tech = Array.from(d.querySelectorAll('.timeline-stage__details summary')).map(s => s.textContent.trim());
    return { title: d.querySelector('.audit-detail__title')?.textContent.trim(), grid, box, sections, dts: dts.slice(0, 5), stages, tech, stageCount: stages.length };
  });
  console.log('      M15b:', JSON.stringify(m15b));
  check('M15b. авто-выбор первого обращения: «Детализация запроса» + секции = RF SectionBox-карточки в 2-колоночной сетке',
    m15b.title === 'Детализация запроса' && m15b.sections.length >= 5 && m15b.grid === 2
      && m15b.box && m15b.box.startsWith('10px/8px/solid'), JSON.stringify(m15b));
  check('M15c. Параметры запроса (Номер/ID лида/Дата) + Параметры исполнения (Latency pipeline/Модель)',
    ['Номер:', 'ID лида:', 'Дата:', 'Latency pipeline:', 'Модель:'].every(x => m15b.dts.includes(x)),
    JSON.stringify(m15b.dts));
  check('M15d. секции канона: Цепочка обработки + Запрос клиента + Ответ системы',
    ['Цепочка обработки', 'Запрос клиента', 'Ответ системы'].every(x => m15b.sections.includes(x)),
    JSON.stringify(m15b.sections));
  check('M15e. Таймлайн pipeline: этапы = события лида, offset + latency + inline JSON payload',
    m15b.stageCount >= 3 && m15b.stages.every(s => s.name && s.time && s.chip === 'Статус обработки: успешно' && s.details === 'JSON payload'
      && s.offset && s.offset.startsWith('+') && s.lat
      && s.offsetStyle === '12px/mono' && s.lat && s.latRight),
    JSON.stringify(m15b.stages));
  check('M15f. Технический снимок (JSON) в конце детализации',
    m15b.tech.includes('Технический снимок (JSON)'), JSON.stringify(m15b.tech));

  // «Запрос клиента» заполнен реальным сообщением (не «—»)
  const m15msgDebug = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('#event-detail .trace-section__title')).map(t => t.textContent.trim());
    const idx = titles.indexOf('Запрос клиента');
    const box = document.querySelectorAll('#event-detail .trace-section')[idx];
    const pre = box?.querySelector('pre.trace-pre');
    const st = pre ? getComputedStyle(pre) : null;
    return { titles, idx, box: Boolean(box), pre: pre?.textContent.trim() || null,
      style: st ? `${st.fontSize}/${st.fontFamily.includes('mono') ? 'mono' : 'sans'}/${st.lineHeight}` : null };
  });
  const m15msg = m15msgDebug && m15msgDebug.pre;
    check('M15j. «Запрос клиента» = реальное сообщение (direction=inbound), sans 0.75rem/1.35 (RF rf-obs-pre--answer)',
    m15msg && m15msg !== '—' && m15msgDebug.style === '12px/sans/16.2px', JSON.stringify(m15msgDebug));

  // Окно времени: 4 варианта канона RF WINDOW_OPTIONS
  const m15h = await page.evaluate(() => {
    const sel = document.getElementById('monitoring-type');
    sel.value = '';
    sel.dispatchEvent(new Event('change'));
    const win = document.getElementById('monitoring-window');
    return Array.from(win.options).map(o => `${o.value}:${o.textContent.trim()}`);
  });
  await sleep(1200);
  check('M15h. окно времени: 24h/7d/30d/все (канон RF WINDOW_OPTIONS)',
    JSON.stringify(m15h) === JSON.stringify(['24:24h', '168:7d', '720:30d', ':все']),
    JSON.stringify(m15h));

  // Поиск по номеру обращения
  const m15i = await page.evaluate(() => {
    const inp = document.getElementById('monitoring-search');
    inp.value = document.querySelector('#monitoring-list .list-item__preview')?.textContent.trim().slice(0, 6) || '';
    inp.dispatchEvent(new Event('input'));
    return inp.value;
  });
  await sleep(1200);
  const m15j = await page.evaluate(() => ({
    previews: Array.from(document.querySelectorAll('#monitoring-list .list-item__preview')).map(i => i.textContent.trim()),
    total: document.getElementById('monitoring-pagination-total').textContent,
  }));
  check('M15i. поиск по номеру обращения фильтрует журнал',
    Number(m15j.total) >= 1 && Number(m15j.total) <= 20 && m15j.previews.every(p => p.startsWith(m15i)),
    JSON.stringify({ q: m15i, total: m15j.total, previews: m15j.previews }));

  /* === M16. Демо-вход (канон RF signInDemo, роль demo, чип 🎭) === */
  await page.evaluate(() => { try { localStorage.removeItem('lq-admin-session'); } catch {} });
  await page.goto(ADMIN + '?v=20', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);
  const demoBtnVisible = await page.evaluate(() =>
    !!document.getElementById('login-demo') && !document.getElementById('login-demo').hidden);
  check('M16. кнопка «Войти в демо-режим» видна (demo-config: enabled)', demoBtnVisible);
  await page.evaluate(() => document.getElementById('login-demo').click());
  await sleep(2500);
  const demoApp = await page.evaluate(() => ({
    loginHidden: document.getElementById('login-page')?.hidden,
    appShown: !document.querySelector('.app')?.hidden,
    role: (() => { try { return JSON.parse(localStorage.getItem('lq-admin-session')).role; } catch { return null; } })(),
  }));
  check('M16a. демо-вход открывает консоль, сессия с ролью demo',
    demoApp.loginHidden && demoApp.appShown && demoApp.role === 'demo', JSON.stringify(demoApp));
  /* Аудит: console_login с ролью demo; чип 🎭 «Роль: Демо» в списке */
  await page.evaluate(() => document.querySelector('.nav-item[data-page="audit"]').click());
  await sleep(2500);
  const demoChip = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#audit-list .list-item')];
    const chip = rows.map(r => r.querySelector('.list-item__status .ai-status'))
      .find(c => c && c.getAttribute('title') === 'Роль: Демо');
    if (!chip) return null;
    const cs = getComputedStyle(chip);
    return { title: chip.getAttribute('title'), emoji: chip.textContent.trim(), fs: cs.fontSize };
  });
  check('M16b. аудит: событие demo-входа с чипом 🎭 «Роль: Демо»',
    demoChip && demoChip.emoji === '🎭', JSON.stringify(demoChip));

  check('Z. 0 JS-ошибок', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));
  console.log(`\nИтого: ${pass} PASS / ${fail} FAIL`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH:', e); process.exit(2); });