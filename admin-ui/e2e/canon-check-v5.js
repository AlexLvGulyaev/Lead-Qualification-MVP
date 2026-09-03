/* Headless e2e v5: LQ admin — Дополнение 6, полный канон-прогон.
   Каждая проверка = строка карты свойств AIC/RF + регресс v4. */
const puppeteer = require('/tmp/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const jsErrors = [];
  const page = await browser.newPage();
  page.on('pageerror', e => jsErrors.push(String(e)));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(ADMIN + '?v=7', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);

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

  /* === M10. Аудит (карта §2.2/§2.6/obs) === */
  await page.evaluate(() => document.querySelector('.nav-item[data-page="audit"]').click());
  await sleep(2000);
  const firstAudit = await page.$('#audit-list .audit-item');
  if (firstAudit) { await firstAudit.click(); await sleep(1000); }
  const audit = await page.evaluate(() => {
    const card = document.querySelector('.audit-card'), detail = document.querySelector('.audit-detail');
    const layout = document.querySelector('.audit-layout');
    const btn = document.querySelector('.audit-actions button');
    const ai = document.querySelector('.audit-item');
    const kvs = document.querySelector('.audit-detail__kv');
    const pre = document.querySelector('.audit-detail__json');
    const kvcs = kvs ? getComputedStyle(kvs) : null;
    return {
      layoutGap: layout ? getComputedStyle(layout).columnGap : null,
      cardPad: card ? getComputedStyle(card).padding : null,
      detailPad: detail ? getComputedStyle(detail).padding : null,
      btn: (() => { const b = document.querySelector('.audit-actions button'); if (!b) return null; const c = getComputedStyle(b); return `${c.backgroundColor}/${c.borderWidth}/${c.padding}/${c.fontWeight}`; })(),
      item: ai ? `${getComputedStyle(ai).padding}/${getComputedStyle(ai).borderRadius}` : null,
      kv: kvcs ? `${kvcs.fontSize}/${kvcs.gridTemplateColumns}` : null,
      dtW: (() => { const d = document.querySelector('.audit-detail__kv dt'); return d ? getComputedStyle(d).fontWeight : null; })(),
      dtText: document.querySelector('.audit-detail__kv dt')?.textContent,
      pre: (() => { const p = document.querySelector('.audit-detail__json'); if (!p) return null; const c = getComputedStyle(p); return `${c.fontSize}/${c.backgroundColor}/${c.maxHeight}/${c.fontFamily.includes('ui-monospace') ? 'mono' : 'sans'}`; })(),
    };
  });
  check('M10. audit-layout gap 8px, карточка 12px 12px 8px, детализация 8px',
    audit.layoutGap === '8px' && audit.cardPad === '12px 12px 8px' && audit.detailPad === '8px',
    JSON.stringify(audit));
  check('M10a. кнопки obs: transparent + border + 6px 12px',
    audit.btn === 'rgba(0, 0, 0, 0)/1px/6px 12px/500', audit.btn);
  check('M10b. audit-item pad 8px radius 10px', audit.item === '8px/10px', audit.item);
  check('M10c. kv obs: 0.75rem, grid 5.5rem 1fr, dt 400 с двоеточием',
    audit.kv.startsWith('12px/88px') && audit.dtW === '400' && /:$/.test(audit.dtText || ''),
    `${audit.kv} ${audit.dtW} "${audit.dtText}"`);
  check('M10d. json-pre: 0.625rem mono на --ai-bg, max-h 200px',
    audit.pre === '10px/rgb(11, 15, 25)/200px/mono', audit.pre);

  /* регресс: пагинация аудита */
  const auditPag = await page.evaluate(() => ({
    info: document.querySelector('#audit-page .page-info')?.textContent.replace(/\s+/g, ' ').trim(),
    items: document.querySelectorAll('#audit-list .audit-item').length,
    total: document.getElementById('audit-total')?.textContent,
  }));
  check('M10e. аудит: 7 айтемов + «Страница N из M» + «Всего N»',
    auditPag.items === 7 && /^Страница \d+ из \d+$/.test(auditPag.info || '') && /Всего \d+/.test(auditPag.total || ''),
    JSON.stringify(auditPag));

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
  check('M11b. мониторинг-пагинация жива', /^Страница \d+ из \d+$/.test(mon.info || '') && mon.items === 7, JSON.stringify(mon));

  const selfCheck = await page.evaluate(async () => {
    const r = await fetch('/api/admin/audit?limit=50');
    const d = await r.json();
    return (d.items || []).some(i => String(i.action).startsWith('/api/admin/audit'));
  });
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
  await page.goto(ADMIN + '?v=7', { waitUntil: 'networkidle2', timeout: 30000 });
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

  check('Z. 0 JS-ошибок', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));
  console.log(`\nИтого: ${pass} PASS / ${fail} FAIL`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH:', e); process.exit(2); });