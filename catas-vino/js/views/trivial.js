/* Trivial de vins: estilo Preguntados, en solitario. Las reglas viven en ../trivial.js; aquí solo se pinta y se escucha. */
import { t } from '../i18n.js';
import { go } from '../state.js';
import { html, setHtml, on, sfx, celebrate, confetti, confirmBox } from '../util.js';
import { icon } from '../icons.js';
import { ring, updateRing, LETTERS } from '../ui-game.js';
import { CATS } from '../trivial-data.js';
import * as T from '../trivial.js';

const CAT = Object.fromEntries(CATS.map((c) => [c.key, c]));
const catName = (k) => t('trivial.cat.' + k);
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// ---------- ruleta (SVG): seis sectores, el puntero fijo arriba ----------
const R = 100;
const pt = (deg, r) => { const a = (deg * Math.PI) / 180; return [(r * Math.sin(a)).toFixed(2), (-r * Math.cos(a)).toFixed(2)]; };
const sector = (i) => { const [x1, y1] = pt(i * 60, R), [x2, y2] = pt(i * 60 + 60, R); return `M0 0 L${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} Z`; };
const wheelSvg = (st, angle) => html`<svg viewBox="-108 -108 216 216" class="tr-wheel-svg" aria-hidden="true">
  <g id="trWheel" style="transform:rotate(${angle}deg)">
    ${CATS.map((c, i) => { const won = st.corones.includes(c.key); const [tx, ty] = pt(i * 60 + 30, 66);
      return html`<path d="${sector(i)}" fill="${c.color}" stroke="#fff" stroke-width="2.5" opacity="${won ? 0.38 : 1}"/><text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" font-size="${won ? 20 : 26}" transform="rotate(${i * 60 + 30} ${tx} ${ty})">${won ? '👑' : c.emoji}</text>`; })}
    <circle r="${R}" fill="none" stroke="#fff" stroke-width="5"/>
  </g>
  <circle r="19" fill="#fff" stroke="var(--line-strong)" stroke-width="2"/>
  <path d="M-7 -9h14l-1.8 8.2a5.2 5.2 0 0 1-10.4 0z M0 4v9 M-5 13h10" fill="none" stroke="var(--wine)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="scale(.9)"/>
  <path d="M-11 -112 11 -112 0 -92z" fill="var(--ink)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;

export default function view({ el }) {
  let st = T.carregar();
  const estats = T.llegirEstats();
  let phase = 'inici', cur = null, res = null, closed = false;
  let timer = null, endAt = 0, lastTick = 99, spinTimer = null, alive = true, angle = 0, spinning = false;
  const pending = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { pending.delete(id); if (alive) fn(); }, ms); pending.add(id); return id; };

  // ---------- piezas ----------
  const livesView = () => html`<div class="tr-lives" id="trLives" role="img" aria-label="${t('trivial.lives', { n: st.vides })}">${Array.from({ length: T.VIDES_MAX }, (_, i) => html`<span class="tr-life ${i < st.vides ? 'on' : ''}">${icon('glass', 21, 1.7)}</span>`)}</div>`;
  const hud = () => html`<div class="tr-hud">
    <button class="icon-btn" data-act="quit" aria-label="${t('trivial.quit')}">${icon('left', 19)}</button>
    ${livesView()}
    <div class="tr-score"><b id="trScore">${st.punts}</b><span>${t('trivial.points')}</span></div></div>`;

  const strip = () => html`<div class="tr-cats">${CATS.map((c) => {
    const won = st.corones.includes(c.key), p = st.progres[c.key];
    return html`<div class="tr-cat ${won ? 'won' : ''} ${!won && p >= T.ENCERTS_CORONA ? 'ready' : ''}" style="--cc:${c.color}">
      <span class="tr-cat-ic"><i>${c.emoji}</i>${won ? html`<em>${icon('crown', 15, 2)}</em>` : ''}</span>
      <span class="tr-pips" aria-hidden="true">${[0, 1, 2].map((i) => html`<b class="${i < p ? 'on' : ''}"></b>`)}</span>
      <span class="tr-cat-nm">${catName(c.key)}</span></div>`;
  })}</div>`;

  const optsView = (v, { picked = -1, done = false } = {}) => html`<div class="opts two" id="trOpts">${v.opcions.map((o, i) => {
    const cls = ['opt', 'c' + i];
    if (v.ocults.includes(i)) cls.push('gone');
    if (done) { if (i === v.correcta) cls.push('right'); else if (i === picked) cls.push('wrong', 'miss'); else cls.push('dim'); }
    return html`<button class="${cls.join(' ')}" data-choice="${i}" ${done || v.ocults.includes(i) ? 'disabled' : ''}><span class="ltr">${LETTERS[i]}</span><span>${o}</span></button>`;
  })}</div>`;

  const tools = () => html`<div class="tr-tools" id="trTools">
    <button class="btn sm" data-act="half" ${st.comodins.meitat < 1 || cur.ocults.length ? 'disabled' : ''}><b>50:50</b></button>
    <button class="btn sm" data-act="swap" ${st.comodins.canvia < 1 ? 'disabled' : ''}>${icon('dice', 17)}${t('trivial.swap')}</button></div>`;

  // ---------- pantallas ----------
  const renderStart = () => {
    phase = 'inici';
    const pct = estats.preguntes ? Math.round((estats.encerts / estats.preguntes) * 100) : 0;
    setHtml(el, html`<div class="tr">
      <div class="center mb"><span class="big-ic">${icon('glass', 34, 1.3)}</span><h1>${t('trivial.title')}</h1><p class="muted">${t('trivial.intro')}</p></div>
      <div class="card stack">
        ${st ? html`<button class="btn primary block" data-act="resume">${t('trivial.resume')}<span class="tr-sub">${t('trivial.resumeInfo', { n: st.corones.length, p: st.punts })}</span></button>
          <button class="btn block" data-act="new">${t('trivial.start')}</button>` : html`<button class="btn primary block" data-act="new">${t('trivial.start')}</button>`}
      </div>
      ${estats.partides ? html`<div class="tr-stats card">
        <div><b>${estats.millor}</b><span>${t('trivial.best')}</span></div>
        <div><b>${estats.victories}<small>/${estats.partides}</small></b><span>${t('trivial.wins')}</span></div>
        <div><b>${pct}%</b><span>${t('trivial.hits')}</span></div>
        <div><b>${estats.millorRatxa}</b><span>${t('trivial.streak')}</span></div></div>` : ''}
      <div class="card"><h3>${t('trivial.rulesTitle')}</h3>
        <ul class="tr-rules"><li>${t('trivial.rule1', { s: T.TEMPS })}</li><li>${t('trivial.rule2')}</li><li>${t('trivial.rule3', { n: T.VIDES_INICIALS, m: T.VIDES_MAX })}</li><li>${t('trivial.rule4')}</li></ul>
        <div class="tr-topics">${CATS.map((c) => html`<span class="pill" style="--cc:${c.color}"><i>${c.emoji}</i>${catName(c.key)}</span>`)}</div></div>
    </div>`);
  };

  const renderWheel = () => {
    phase = 'ruleta';
    const repte = T.repteCorona(st);
    setHtml(el, html`<div class="tr">${hud()}${strip()}
      ${repte ? html`<div class="card tr-crown" style="--cc:${CAT[repte].color}">
          <span class="big-ic">${icon('crown', 34, 1.4)}</span><h2>${t('trivial.crownTitle')}</h2>
          <p><b>${CAT[repte].emoji} ${catName(repte)}</b></p><p class="muted">${t('trivial.crownText', { cat: catName(repte) })}</p>
          <p class="hint">${t('trivial.crownRisk')}</p>
          <button class="btn gold block" data-act="crown">${icon('crown', 18)}${t('trivial.crownGo')}</button></div>`
        : html`<div class="tr-wheel"><p class="center muted mb">${t('trivial.which')}</p>${wheelSvg(st, angle)}
          <button class="btn primary block mt" data-act="spin" ${spinning ? 'disabled' : ''}>${t('trivial.spin')}</button></div>`}
    </div>`);
  };

  const renderQ = () => {
    phase = 'pregunta';
    const c = CAT[cur.cat];
    setHtml(el, html`<div class="tr tr-q" style="--cc:${c.color}">${hud()}
      <div class="tr-qhead"><span class="tr-badge"><i>${c.emoji}</i>${catName(cur.cat)}</span>${cur.corona ? html`<span class="pill gold">${icon('crown', 14, 2)}${t('trivial.crownTag')}</span>` : ''}</div>
      <div class="card tr-qcard">${ring(T.TEMPS, T.TEMPS)}<h2 class="tr-qtext">${cur.prompt}</h2></div>
      ${optsView(cur)}${tools()}<div id="trFb" aria-live="polite"></div></div>`);
    startTimer();
  };

  const renderFb = () => {
    const v = cur;
    const head = res.ok ? t('trivial.right') : res.triada < 0 ? t('trivial.timeout') : t('trivial.wrong');
    const fb = el.querySelector('#trFb'); if (!fb) return;
    setHtml(fb, html`<div class="card tr-fb ${res.ok ? 'ok' : 'bad'}">
      <div class="tr-fbhead"><b>${head}</b>${res.punts ? html`<span class="pill gold">+${res.punts}</span>` : ''}</div>
      ${res.ok ? '' : html`<p class="tr-was">${t('trivial.answerWas', { a: v.opcions[v.correcta] })}</p>`}
      <p class="muted">${v.explicacio}</p>
      ${res.coronaGuanyada ? html`<p class="tr-note ok">${icon('crown', 16, 2)} ${t('trivial.crownWon', { cat: catName(v.cat) })}${res.vidaExtra ? ' · ' + t('trivial.lifeUp') : ''}</p>` : ''}
      ${res.coronaPerduda ? html`<p class="tr-note bad">${t('trivial.crownLost', { cat: catName(v.cat) })}</p>` : ''}
      ${res.repteObert ? html`<p class="tr-note ok">${icon('crown', 16, 2)} ${t('trivial.crownOpen', { cat: catName(v.cat) })}</p>` : ''}
      <button class="btn primary block" data-act="next">${res.fi ? t('trivial.result') : t('trivial.next')}</button></div>`);
    const tl = el.querySelector('#trTools'); if (tl) tl.remove();
    fb.scrollIntoView?.({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    el.querySelector('[data-act="next"]')?.focus({ preventScroll: true });
    const sc = el.querySelector('#trScore'); if (sc) sc.textContent = String(st.punts);
    const lv = el.querySelector('#trLives'); if (lv) lv.outerHTML = livesView().s;
  };

  const renderEnd = () => {
    phase = 'fi';
    let record = false;
    if (!closed) { closed = true; record = T.tancaPartida(st, estats); }
    const win = st.fi === 'guanyada';
    setHtml(el, html`<div class="tr">
      <div class="card center tr-end ${win ? 'win' : ''}">
        <span class="big-ic">${icon(win ? 'trophy' : 'glass', 34, 1.4)}</span>
        <h1>${win ? t('trivial.win') : t('trivial.lose')}</h1><p class="muted">${win ? t('trivial.winText') : t('trivial.loseText')}</p>
        <div class="tr-final"><b>${st.punts}</b><span>${t('trivial.points')}</span>${record ? html`<em class="pill gold">${t('trivial.newRecord')}</em>` : ''}</div>
        <div class="tr-cats mt">${CATS.map((c) => html`<div class="tr-cat ${st.corones.includes(c.key) ? 'won' : ''}" style="--cc:${c.color}"><span class="tr-cat-ic"><i>${c.emoji}</i>${st.corones.includes(c.key) ? html`<em>${icon('crown', 15, 2)}</em>` : ''}</span><span class="tr-cat-nm">${catName(c.key)}</span></div>`)}</div>
        <ul class="tr-sum"><li>${t('trivial.crownsOf', { n: st.corones.length })}</li><li>${t('trivial.correct', { a: st.encerts, b: st.preguntes })}</li><li>${t('trivial.streakLbl', { n: st.millorRatxa })}</li></ul>
        <button class="btn primary block" data-act="new">${t('trivial.again')}</button>
        <a class="btn ghost block mt" href="#/play">${t('trivial.back')}</a></div></div>`);
    if (win) { celebrate(); } else sfx.bad();
  };

  // ---------- flujo ----------
  const stopTimer = () => { clearInterval(timer); timer = null; };
  const startTimer = () => {
    stopTimer(); endAt = performance.now() + T.TEMPS * 1000; lastTick = 99;
    timer = setInterval(() => {
      const left = (endAt - performance.now()) / 1000;
      updateRing(el, left, T.TEMPS);
      const whole = Math.ceil(left);
      if (left <= 5 && whole !== lastTick && left > 0) { lastTick = whole; sfx.tick(); }
      if (left <= 0) answer(-1);
    }, 100);
  };

  const askQuestion = (key, corona) => {
    cur = T.pregunta(st, estats, key, corona);
    T.guardar(st); T.desarEstats(estats);
    renderQ();
  };

  const answer = (i) => {
    if (phase !== 'pregunta') return;
    stopTimer();
    const left = Math.max(0, (endAt - performance.now()) / 1000);
    res = T.respon(st, i, left);
    T.guardar(st);
    phase = 'resposta';
    const o = el.querySelector('#trOpts'); if (o) o.outerHTML = optsView(cur, { picked: i, done: true }).s;
    if (res.ok) { sfx.good(); if (res.coronaGuanyada) { confetti(70); later(() => sfx.fanfare(), 350); } } else sfx.bad();
    renderFb();
  };

  const spin = () => {
    if (spinning || phase !== 'ruleta') return;
    const key = T.triaCategoria(st); const k = KEYS_IDX(key);
    const wheel = el.querySelector('#trWheel'); const btn = el.querySelector('[data-act="spin"]');
    if (!wheel) return;
    spinning = true; if (btn) btn.disabled = true;
    const jitter = (Math.random() - 0.5) * 36;
    const target = (((360 - (k * 60 + 30) + jitter) % 360) + 360) % 360;
    const dur = reduced() ? 400 : 3400;
    angle = angle - (angle % 360) + 360 * (reduced() ? 1 : 4) + target;
    wheel.style.transition = `transform ${dur}ms cubic-bezier(.12,.7,.1,1)`;
    wheel.getBoundingClientRect();
    wheel.style.transform = `rotate(${angle}deg)`;
    let n = 0; spinTimer = setInterval(() => { if (n++ < 14) sfx.pop(); else clearInterval(spinTimer); }, Math.max(60, dur / 16));
    later(() => { clearInterval(spinTimer); spinning = false; sfx.start(); askQuestion(key, false); }, dur + 350);
  };
  const KEYS_IDX = (key) => CATS.findIndex((c) => c.key === key);

  const nueva = () => {
    st = T.novaPartida(); closed = false; res = null; cur = null; angle = 0;
    T.guardar(st); renderWheel();
  };
  const continuar = () => {
    if (st.actual) { cur = T.visio(st); renderQ(); } else renderWheel();
  };
  const salir = async () => {
    if (phase === 'inici' || phase === 'fi') { go('/play'); return; }
    if (spinning) return;
    if (st.fi) { renderEnd(); return; }
    stopTimer();
    const ok = await confirmBox(t('trivial.quitTitle'), t('trivial.quitText'), t('trivial.quitOk'), t('trivial.quitNo'));
    if (!alive) return;
    if (ok) { T.guardar(st); st = T.carregar(); renderStart(); }
    else if (phase === 'pregunta') { startTimer(); }       // vuelve el reloj (con el tiempo entero: no se castiga la duda)
  };

  const offs = [
    on(el, 'click', '[data-act]', (e, b) => {
      const a = b.dataset.act;
      if (a === 'new') nueva();
      else if (a === 'resume') continuar();
      else if (a === 'spin') spin();
      else if (a === 'crown') askQuestion(T.repteCorona(st), true);
      else if (a === 'next') { if (st.fi) renderEnd(); else renderWheel(); }
      else if (a === 'quit') salir();
      else if (a === 'half') { if (phase === 'pregunta' && T.meitat(st)) { cur = T.visio(st); T.guardar(st); sfx.pop(); const o = el.querySelector('#trOpts'); if (o) o.outerHTML = optsView(cur).s; const tl = el.querySelector('#trTools'); if (tl) tl.outerHTML = tools().s; } }
      else if (a === 'swap') { if (phase === 'pregunta') { const q = T.canvia(st, estats); if (q) { cur = q; T.guardar(st); T.desarEstats(estats); sfx.pop(); renderQ(); } } }
    }),
    on(el, 'click', '[data-choice]', (e, b) => answer(Number(b.dataset.choice))),
  ];
  // la pestaña oculta no debe correr el reloj en silencio: al volver se retoma con el tiempo que quedaba
  let hiddenAt = 0;
  const vis = () => { if (document.hidden) hiddenAt = performance.now(); else if (hiddenAt && phase === 'pregunta') { endAt += performance.now() - hiddenAt; hiddenAt = 0; } };
  document.addEventListener('visibilitychange', vis);

  renderStart();
  return () => { alive = false; stopTimer(); clearInterval(spinTimer); pending.forEach(clearTimeout); offs.forEach((f) => f()); document.removeEventListener('visibilitychange', vis); };
}
