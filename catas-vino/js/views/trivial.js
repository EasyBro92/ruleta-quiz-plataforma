/* Trivial de vins: estilo Preguntados, en solitario. Las reglas viven en ../trivial.js; aquí solo se pinta y se escucha.
   Va a PANTALLA COMPLETA (ruta sin barra inferior): con la barra de la app, en un móvil normal el botón de girar y el
   de «Següent» quedaban justo debajo de ella y al pulsar se tocaba la barra. Aquí el botón principal vive en un
   «dock» fijo abajo y lo que sobra de contenido se desplaza por encima, así que siempre se alcanza. */
import { t } from '../i18n.js';
import { go, S } from '../state.js';
import { html, raw, setHtml, on, sfx, celebrate, confetti, confirmBox, toast } from '../util.js';
import { icon } from '../icons.js';
import { LETTERS } from '../ui-game.js';
import { CATS } from '../trivial-data.js';
import { catIcon, catInWheel, CAT_PATHS } from '../trivial-icons.js';
import * as T from '../trivial.js';

const CAT = Object.fromEntries(CATS.map((c) => [c.key, c]));
const catName = (k) => t('trivial.cat.' + k);
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* nada */ } };

// color del texto sobre el color de una categoría (los dorados y naranjas piden letra oscura)
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
const onColor = (hex) => (lum(hex) > 0.2 ? '#2b1118' : '#ffffff');
const catVars = (c) => `--cc:${c.color};--on:${onColor(c.color)}`;

const TICK = raw('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.6 4.6L19 7.5"/></svg>');
const CROSS = raw('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>');

// ---------- ruleta (SVG): seis sectores con su dibujo, aro de bombillas y puntero fijo arriba ----------
const R = 94;
const pt = (deg, r) => { const a = (deg * Math.PI) / 180; return [+(r * Math.sin(a)).toFixed(2), +(-r * Math.cos(a)).toFixed(2)]; };
const sector = (i) => { const [x1, y1] = pt(i * 60, R), [x2, y2] = pt(i * 60 + 60, R); return `M0 0 L${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} Z`; };
const wheelSvg = (won, angle) => {
  let sec = '';
  CATS.forEach((c, i) => {
    const dim = won.includes(c.key), mid = i * 60 + 30, [tx, ty] = pt(mid, 62);
    sec += `<path d="${sector(i)}" fill="${c.color}" opacity="${dim ? 0.3 : 1}"/>`;
    // el dibujo va siempre derecho: gira al revés que la ruleta (ver `spin`), así se lee igual parada que girando
    sec += `<g transform="translate(${tx} ${ty})"><g class="ico" style="transform:rotate(${-angle}deg)"><circle r="16" fill="none"/>${dim ? catInWheel('corona', 32, 0, '#e6bd5c', 1.8) : catInWheel(c.key, 32, 0, onColor(c.color), 1.9)}</g></g>`;
  });
  let bulbs = '';
  for (let i = 0; i < 24; i++) { const [x, y] = pt(i * 15, 100); bulbs += `<circle class="bulb-${i % 2 ? 'b' : 'a'}" cx="${x}" cy="${y}" r="2.4" fill="#ffe3a0"/>`; }
  return raw(`<svg viewBox="-112 -122 224 232" class="trg-wheel-svg" aria-hidden="true" focusable="false">
    <defs><radialGradient id="trShade" cx="0" cy="0" r="94" gradientUnits="userSpaceOnUse"><stop offset=".32" stop-color="#fff" stop-opacity=".16"/><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient></defs>
    <circle r="107" fill="#e6bd5c"/><circle r="104.5" fill="#2a0f1c"/>
    <g id="trWheel" style="transform:rotate(${angle}deg)">${sec}
      ${[0, 1, 2, 3, 4, 5].map((i) => { const [x, y] = pt(i * 60, R); return `<path d="M0 0L${x} ${y}" stroke="#f8efe6" stroke-width="2.2" stroke-linecap="round"/>`; }).join('')}</g>
    <circle r="${R}" fill="url(#trShade)"/><circle r="${R}" fill="none" stroke="#f8efe6" stroke-width="2.4"/>
    ${bulbs}
    <circle r="22" fill="#2a0f1c" stroke="#e6bd5c" stroke-width="3.5"/>
    <svg x="-11" y="-11" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f8efe6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CAT_PATHS.copa}</svg>
    <path d="M0 -80 L-11 -107 Q0 -119 11 -107 Z" fill="#e6bd5c" stroke="#2a0f1c" stroke-width="2.6" stroke-linejoin="round"/><circle cy="-104" r="3" fill="#2a0f1c"/>
  </svg>`);
};

export default function view({ el }) {
  let st = T.carregar();
  const estats = T.llegirEstats();
  let phase = 'inici', cur = null, res = null, closed = false, record = false, dockAt = 0, pausa = null;
  let timer = null, endAt = 0, lastTick = 99, spinTimer = null, alive = true, angle = 0, spinning = false;
  const pending = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { pending.delete(id); if (alive) fn(); }, ms); pending.add(id); return id; };
  document.documentElement.classList.add('trg-on');

  // ---------- piezas ----------
  const livesView = () => html`<div class="trg-lives" id="trLives" role="img" aria-label="${t('trivial.lives', { n: st.vides })}">${Array.from({ length: T.VIDES_MAX }, (_, i) => html`<span class="trg-life ${i < st.vides ? 'on' : ''}">${icon('glass', 22, 1.7)}</span>`)}</div>`;
  const hud = () => html`<div class="trg-top">
    <button class="trg-round" data-act="quit" aria-label="${t('trivial.quit')}">${icon('left', 20, 2)}</button>
    ${livesView()}
    <div class="trg-score"><b id="trScore">${st.punts}</b><span>${t('trivial.points')}</span></div></div>`;
  const backTop = () => html`<div class="trg-top"><button class="trg-round" data-act="quit" aria-label="${t('trivial.back')}">${icon('left', 20, 2)}</button></div>`;

  const rail = (s, pips = true) => html`<div class="trg-rail">${CATS.map((c) => {
    const won = s.corones.includes(c.key), p = s.progres[c.key] ?? 0;
    return html`<div class="trg-med ${won ? 'won' : ''} ${!won && p >= T.ENCERTS_CORONA ? 'ready' : ''}" style="${catVars(c)}" role="img" aria-label="${catName(c.key)} ${won ? '✓' : p + '/' + T.ENCERTS_CORONA}">
      <span class="trg-med-ic">${catIcon(c.key, 23, 1.8)}${won ? html`<em>${icon('crown', 12, 2.4)}</em>` : ''}</span>
      ${pips ? html`<span class="trg-pips" aria-hidden="true">${[0, 1, 2].map((i) => html`<b class="${won || i < p ? 'on' : ''}"></b>`)}</span>` : ''}</div>`;
  })}</div>`;

  const chip = (key) => { const c = CAT[key]; return html`<span class="trg-chip" style="${catVars(c)}"><span class="trg-chip-ic">${catIcon(key, 18, 2)}</span>${catName(key)}</span>`; };

  const optsView = (v, { picked = -1, done = false, enter = false } = {}) => html`<div class="trg-opts ${enter ? 'enter' : ''}" id="trOpts">${v.opcions.map((o, i) => {
    const cls = [];
    if (v.ocults.includes(i)) cls.push('gone');
    let mark = '';
    if (done) { if (i === v.correcta) { cls.push('right'); mark = TICK; } else if (i === picked) { cls.push('wrong'); mark = CROSS; } else cls.push('dim'); }
    return html`<button class="trg-opt ${cls.join(' ')}" data-choice="${i}" style="--i:${i}" ${done || v.ocults.includes(i) ? 'disabled' : ''}><span class="trg-ltr">${LETTERS[i]}</span><span class="trg-txt">${o}</span><span class="trg-mark">${mark}</span></button>`;
  })}</div>`;

  // los comodines van junto al reloj (iconos pequeños): en el dock, en pantallas bajas se comían las dos últimas respuestas
  const toolsView = () => html`<div class="trg-tools" id="trTools">
    <button class="trg-tool" data-act="half" aria-label="50:50" title="50:50" ${st.comodins.meitat < 1 || cur.ocults.length ? 'disabled' : ''}><b>50:50</b></button>
    <button class="trg-tool" data-act="swap" aria-label="${t('trivial.swap')}" title="${t('trivial.swap')}" ${st.comodins.canvia < 1 ? 'disabled' : ''}>${icon('dice', 19, 1.8)}</button></div>`;

  // «dock»: lo único fijo abajo (botón principal); el resto del contenido se desplaza por encima
  const screen = (top, main, dock, cls = '') => { dockAt = performance.now(); return setHtml(el, html`<div class="trg"><div class="trg-in ${cls}">${top}<div class="trg-main" id="trMain">${main}</div><div class="trg-dock" id="trDock">${dock}</div></div></div>`); };
  const dockSet = (d) => { dockAt = performance.now(); const x = el.querySelector('#trDock'); if (x) setHtml(x, d); };

  // ---------- pantallas ----------
  const renderStart = () => {
    phase = 'inici';
    const pct = estats.preguntes ? Math.round((estats.encerts / estats.preguntes) * 100) : 0;
    screen(backTop(), html`<div class="trg-hero"><div class="trg-wheel static">${wheelSvg([], -14)}</div></div>
      <h1 class="trg-title">${t('trivial.title')}</h1><p class="trg-sub">${t('trivial.intro')}</p>
      ${estats.partides ? html`<div class="trg-stats"><div><b>${estats.millor}</b><span>${t('trivial.best')}</span></div><div><b>${estats.victories}<small>/${estats.partides}</small></b><span>${t('trivial.wins')}</span></div><div><b>${pct}%</b><span>${t('trivial.hits')}</span></div><div><b>${estats.millorRatxa}</b><span>${t('trivial.streak')}</span></div></div>` : ''}
      <ul class="trg-rules">
        <li>${icon('clock', 20, 1.7)}<span>${t('trivial.rule1', { s: T.TEMPS })}</span></li>
        <li>${icon('crown', 20, 1.7)}<span>${t('trivial.rule2')}</span></li>
        <li>${icon('glass', 20, 1.7)}<span>${t('trivial.rule3', { n: T.VIDES_INICIALS, m: T.VIDES_MAX })}</span></li>
        <li>${icon('trophy', 20, 1.7)}<span>${t('trivial.rule4')}</span></li>
        <li>${icon('dice', 20, 1.7)}<span>${t('trivial.rule5')}</span></li></ul>
      ${S.lang && S.lang !== 'ca' ? html`<p class="trg-langnote">${t('trivial.catsNote')}</p>` : ''}
      <div class="trg-topics">${CATS.map((c) => chip(c.key))}</div>`,
    st ? html`<button class="trg-btn" data-act="resume"><span>${t('trivial.resume')}<small>${t('trivial.resumeInfo', { n: st.corones.length, p: st.punts })}</small></span></button>
        <button class="trg-btn alt" data-act="new">${t('trivial.start')}</button>`
      : html`<button class="trg-btn" data-act="new">${t('trivial.start')}</button>`, 'start');
  };

  const renderWheel = () => {
    phase = 'ruleta';
    const repte = T.repteCorona(st);
    screen(hud(), html`${rail(st)}${repte
      ? html`<div class="trg-crown" style="${catVars(CAT[repte])}"><span class="trg-crown-ic">${icon('crown', 40, 1.4)}</span><h2>${t('trivial.crownTitle')}</h2>${chip(repte)}
          <p>${t('trivial.crownText', { cat: catName(repte) })}</p><p class="trg-hint">${t('trivial.crownRisk')}</p></div>`
      : html`<div class="trg-wheelbox"><p class="trg-prompt" id="trPrompt">${t('trivial.which')}</p><div class="trg-wheel tap" id="trWheelBox" data-act="spin">${wheelSvg(st.corones, angle)}</div></div>`}`,
    repte ? html`<button class="trg-btn" data-act="crown">${icon('crown', 20, 2)}${t('trivial.crownGo')}</button>`
      : html`<button class="trg-btn" data-act="spin" ${spinning ? 'disabled' : ''}>${t('trivial.spin')}</button>`);
  };

  const renderQ = (secs = T.TEMPS) => {
    phase = 'pregunta';
    const c = CAT[cur.cat];
    screen(hud(), html`<div class="trg-qmeta" style="${catVars(c)}">${chip(cur.cat)}${cur.corona ? html`<span class="trg-ribbon">${icon('crown', 14, 2.2)}${t('trivial.crownTag')}</span>` : ''}</div>
      <div class="trg-timerow"><span class="trg-sec" id="trSec">${T.TEMPS}</span><div class="trg-time" aria-hidden="true"><i id="trBar"></i></div>${toolsView()}</div>
      <div class="trg-q ${cur.corona ? 'gold' : ''}" style="${catVars(c)}"><h2 tabindex="-1">${cur.prompt}</h2></div>
      ${optsView(cur, { enter: true })}<div id="trFb" aria-live="polite"></div>`, '', 'q');
    el.querySelector('.trg-q h2')?.focus({ preventScroll: true });     // los lectores de pantalla leen la pregunta nueva
    startTimer(secs);
  };

  const showFb = () => {
    const v = cur;
    const head = res.ok ? t('trivial.right') : res.triada < 0 ? t('trivial.timeout') : t('trivial.wrong');
    const fb = el.querySelector('#trFb'); if (!fb) return;
    setHtml(fb, html`<div class="trg-fb ${res.ok ? 'is-ok' : 'is-ko'}">
      <div class="trg-fbhead"><span class="trg-fbic">${res.ok ? TICK : CROSS}</span><b>${head}</b>${res.punts ? html`<span class="trg-pts">+${res.punts}</span>` : ''}</div>
      ${res.ok ? '' : html`<p class="trg-was">${t('trivial.answerWas', { a: v.opcions[v.correcta] })}</p>`}
      <p class="trg-why">${v.explicacio}</p>
      ${res.coronaGuanyada ? html`<p class="trg-note is-ok">${icon('crown', 16, 2)}<span>${t('trivial.crownWon', { cat: catName(v.cat) })}${res.vidaExtra ? ' · ' + t('trivial.lifeUp') : ''}</span></p>` : ''}
      ${res.coronaPerduda && !res.fi ? html`<p class="trg-note is-ko"><span>${t('trivial.crownLost', { cat: catName(v.cat) })}</span></p>` : ''}
      ${res.fi === 'perduda' ? html`<p class="trg-note is-ko"><span>${t('trivial.lastLife')}</span></p>` : ''}
      ${res.repteObert ? html`<p class="trg-note is-ok">${icon('crown', 16, 2)}<span>${t('trivial.crownOpen', { cat: catName(v.cat) })}</span></p>` : ''}</div>`);
    dockSet(html`<button class="trg-btn" data-act="next">${res.fi ? t('trivial.result') : t('trivial.next')}</button>`);
    el.querySelectorAll('#trTools button').forEach((b) => { b.disabled = true; });
    fb.scrollIntoView?.({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    const sc = el.querySelector('#trScore'); if (sc) { sc.textContent = String(st.punts); sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump'); }
    const lv = el.querySelector('#trLives'); if (lv) lv.outerHTML = livesView().s;
  };

  const renderEnd = () => {
    phase = 'fi';
    if (!closed) { closed = true; record = T.tancaPartida(st, estats); }     // (normalmente ya se cerró al responder)
    const win = st.fi === 'guanyada';
    screen(backTop(), html`<div class="trg-endhead ${win ? 'win' : ''}"><span class="trg-crown-ic big">${icon(win ? 'trophy' : 'glass', 44, 1.3)}</span>
        <h1 class="trg-title">${win ? t('trivial.win') : t('trivial.lose')}</h1><p class="trg-sub">${win ? t('trivial.winText') : t('trivial.loseText')}</p></div>
      <div class="trg-final"><b>${st.punts}</b><span>${t('trivial.points')}</span>${record ? html`<em class="trg-newrec">${t('trivial.newRecord')}</em>` : ''}</div>
      ${rail(st, false)}
      <ul class="trg-sum"><li>${t('trivial.crownsOf', { n: st.corones.length })}</li><li>${t('trivial.correct', { a: st.encerts, b: st.preguntes })}</li><li>${t('trivial.streakLbl', { n: st.millorRatxa })}</li></ul>`,
    html`<button class="trg-btn" data-act="new">${t('trivial.again')}</button><a class="trg-btn ghost" href="#/play">${t('trivial.back')}</a>`, 'end');
    if (win) celebrate(); else sfx.bad();
  };

  // ---------- flujo ----------
  const stopTimer = () => { clearInterval(timer); timer = null; };
  const remaining = () => Math.max(0, (endAt - performance.now()) / 1000);
  const paintTime = (left) => {
    const bar = el.querySelector('#trBar'), sec = el.querySelector('#trSec');
    if (bar) { bar.style.transform = `scaleX(${Math.max(0, Math.min(1, left / T.TEMPS))})`; bar.parentElement.classList.toggle('low', left <= 5); }
    if (sec) { sec.textContent = String(Math.max(0, Math.ceil(left))); sec.classList.toggle('low', left <= 5); }
  };
  // `secs` permite retomar lo que quedaba (al cancelar «Surt» o al continuar), en vez de regalar 20 s cada vez
  const startTimer = (secs = T.TEMPS) => {
    stopTimer(); lastTick = 99; pausa = null; secs = Math.max(1, Math.min(T.TEMPS, secs)); paintTime(secs);
    if (document.hidden) { pausa = secs; return; }                      // la pregunta salió con la app en segundo plano: el reloj espera
    endAt = performance.now() + secs * 1000;
    timer = setInterval(() => {
      const left = remaining();
      paintTime(left);
      const whole = Math.ceil(left);
      if (left <= 5 && whole !== lastTick && left > 0) { lastTick = whole; sfx.tick(); }
      if (left <= 0) answer(-1);
    }, 100);
  };

  const askQuestion = (key, corona) => {
    st.girada = null;
    cur = T.pregunta(st, estats, key, corona);
    T.guardar(st); T.desarEstats(estats);
    renderQ();
  };

  const answer = (i) => {
    if (phase !== 'pregunta') return;
    stopTimer(); pausa = null;
    const left = remaining();
    res = T.respon(st, i, left);
    phase = 'resposta';
    // la partida se cierra (estadísticas y borrado del guardado) en el momento de acabar: si se cierra la app antes de «Veure el resultat» no se pierde
    if (res.fi && !closed) { closed = true; record = T.tancaPartida(st, estats); } else if (!res.fi) T.guardar(st);
    const o = el.querySelector('#trOpts'); if (o) o.outerHTML = optsView(cur, { picked: i, done: true }).s;
    if (res.ok) { sfx.good(); buzz(25); if (res.coronaGuanyada) { confetti(70); later(() => sfx.fanfare(), 350); } } else { sfx.bad(); buzz([60, 40, 60]); }
    showFb();
  };

  const spin = () => {
    if (spinning || phase !== 'ruleta') return;
    const key = T.triaCategoria(st); const k = CATS.findIndex((c) => c.key === key);
    const wheel = el.querySelector('#trWheel'); const box = el.querySelector('#trWheelBox'); const btn = el.querySelector('#trDock [data-act="spin"]');
    if (!wheel) return;
    st.girada = key; T.guardar(st);                                      // la categoría se decide al girar: si se sale a medias, no se puede «volver a tirar»
    spinning = true; if (btn) btn.disabled = true; box?.classList.add('spin');
    const jitter = (Math.random() - 0.5) * 36;
    const target = (((360 - (k * 60 + 30) + jitter) % 360) + 360) % 360;
    const dur = reduced() ? 400 : 3400;
    angle = angle - (angle % 360) + 360 * (reduced() ? 1 : 4) + target;
    wheel.style.transition = `transform ${dur}ms cubic-bezier(.12,.7,.1,1)`;
    wheel.getBoundingClientRect();
    wheel.style.transform = `rotate(${angle}deg)`;
    el.querySelectorAll('#trWheel .ico').forEach((g) => { g.style.transition = wheel.style.transition; g.style.transform = `rotate(${-angle}deg)`; });
    let n = 0; spinTimer = setInterval(() => { if (n++ < 14) sfx.pop(); else clearInterval(spinTimer); }, Math.max(60, dur / 16));
    later(() => {
      clearInterval(spinTimer); box?.classList.remove('spin'); sfx.start(); buzz(30);
      const pr = el.querySelector('#trPrompt'); if (pr) { pr.className = 'trg-landed'; setHtml(pr, chip(key)); }
      dockSet(html`<button class="trg-btn" disabled>${catName(key)}…</button>`);
      later(() => { spinning = false; askQuestion(key, false); }, reduced() ? 300 : 1000);
    }, dur + 250);
  };

  const nueva = async () => {
    if (st && !st.fi) {                                                  // hay una partida guardada: no se tira sin avisar
      const ok = await confirmBox(t('trivial.newTitle'), t('trivial.newText'), t('trivial.newOk'), t('common.cancel'), true);
      if (!ok || !alive) return;
    }
    st = T.novaPartida(); closed = false; record = false; res = null; cur = null; angle = 0; T.guardar(st); renderWheel();
  };
  const continuar = () => {
    if (st.actual) { cur = T.visio(st); renderQ(st.actual.resta ?? T.TEMPS); }
    else if (st.girada) askQuestion(st.girada, false);
    else renderWheel();
  };
  const salir = async () => {
    if (phase === 'inici' || phase === 'fi') { go('/play'); return; }
    if (st.fi) { renderEnd(); return; }
    // si se sale girando, la ruleta se para: la categoría ya está decidida y se guarda (st.girada)
    const girada = spinning ? st.girada : null;
    if (spinning) { clearInterval(spinTimer); pending.forEach(clearTimeout); pending.clear(); spinning = false; }
    const left = timer ? remaining() : (pausa ?? T.TEMPS);
    stopTimer();
    const ok = await confirmBox(t('trivial.quitTitle'), t('trivial.quitText'), t('trivial.quitOk'), t('trivial.quitNo'));
    if (!alive) return;
    if (ok) { if (st.actual) st.actual.resta = left; T.guardar(st); st = T.carregar(); renderStart(); }
    else if (phase === 'pregunta') startTimer(left);                     // vuelve el reloj con lo que quedaba
    else if (girada) askQuestion(girada, false);
  };

  // si algo falla (un guardado raro, etc.) no se deja la pantalla muerta: se vuelve al inicio con lo último bueno guardado
  const fallo = (err) => { console.error(err); try { toast(t('err.generic'), 'err'); } catch { /* nada */ } st = T.carregar(); stopTimer(); if (alive) renderStart(); };
  const seguro = (fn) => (e, b) => { try { const r = fn(e, b); if (r && r.catch) r.catch(fallo); } catch (err) { fallo(err); } };
  // los botones de abajo comparten sitio (Següent / Gira / Accepta…): un doble toque no se salta la pantalla siguiente
  const DOBLE = ['next', 'spin', 'crown', 'new', 'resume'];

  const offs = [
    on(el, 'click', '[data-act]', seguro((e, b) => {
      const a = b.dataset.act;
      if (DOBLE.includes(a) && performance.now() - dockAt < 300) return;
      if (a === 'new') return nueva();
      else if (a === 'resume') continuar();
      else if (a === 'spin') spin();
      else if (a === 'crown') askQuestion(T.repteCorona(st), true);
      else if (a === 'next') { if (st.fi) renderEnd(); else renderWheel(); }
      else if (a === 'quit') return salir();
      else if (a === 'half') { if (phase === 'pregunta' && T.meitat(st)) { cur = T.visio(st); T.guardar(st); sfx.pop(); const o = el.querySelector('#trOpts'); if (o) o.outerHTML = optsView(cur).s; const tl = el.querySelector('#trTools'); if (tl) tl.outerHTML = toolsView().s; } }
      else if (a === 'swap') { if (phase === 'pregunta') { const q = T.canvia(st, estats); if (q) { cur = q; T.guardar(st); T.desarEstats(estats); sfx.pop(); renderQ(); } } }
    })),
    on(el, 'click', '[data-choice]', seguro((e, b) => answer(Number(b.dataset.choice)))),
  ];
  // la app en segundo plano no debe gastar el tiempo de la pregunta (Chrome sigue ejecutando temporizadores): se congela y se retoma
  const vis = () => {
    if (document.hidden) { if (phase === 'pregunta' && timer) { pausa = remaining(); stopTimer(); } }
    else if (pausa != null && phase === 'pregunta') { const q = pausa; pausa = null; startTimer(q); }
  };
  // y si se cierra la app a media pregunta, se guarda lo que quedaba
  const guardaResta = () => { if (phase === 'pregunta' && st && st.actual) { st.actual.resta = timer ? remaining() : (pausa ?? T.TEMPS); T.guardar(st); } };
  document.addEventListener('visibilitychange', vis);
  window.addEventListener('pagehide', guardaResta);

  renderStart();
  return () => { alive = false; stopTimer(); clearInterval(spinTimer); pending.forEach(clearTimeout); offs.forEach((f) => f()); document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', guardaResta); document.documentElement.classList.remove('trg-on'); };
}
