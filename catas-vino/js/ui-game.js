/* Piezas visuales compartidas por el juego (participante, pantalla grande y presentador) */
import { html, modal, fmtDate } from './util.js';
import { t } from './i18n.js';
import { CONFIG } from './config.js';

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const ring = (remaining, total) => {
  const C = 2 * Math.PI * 32, k = Math.max(0, Math.min(1, total ? remaining / total : 0));
  return html`<div class="ring ${remaining <= 5 ? 'low' : ''}"><svg viewBox="0 0 76 76"><circle class="bg" cx="38" cy="38" r="32"/><circle class="fg" cx="38" cy="38" r="32" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - k)}"/></svg><b>${Math.ceil(Math.max(0, remaining))}</b></div>`;
};
export const updateRing = (root, remaining, total) => {
  const r = root.querySelector('.ring'); if (!r) return;
  const C = 2 * Math.PI * 32, k = Math.max(0, Math.min(1, total ? remaining / total : 0));
  r.querySelector('.fg').setAttribute('stroke-dashoffset', String(C * (1 - k)));
  r.querySelector('b').textContent = String(Math.ceil(Math.max(0, remaining)));
  r.classList.toggle('low', remaining <= 5);
};

export const mediaBlock = (cur) => {
  const parts = [];
  if (cur.image) parts.push(html`<img class="img-q" alt="" src="${cur.image}">`);
  if (cur.lat != null && cur.lon != null) {
    const b = [cur.lon - 1.2, cur.lat - 0.8, cur.lon + 1.2, cur.lat + 0.8].join(',');
    parts.push(html`<iframe class="map" loading="lazy" title="map" src="https://www.openstreetmap.org/export/embed.html?bbox=${b}&layer=mapnik&marker=${cur.lat},${cur.lon}"></iframe>`);
  }
  return parts.length ? html`<div class="stack mt">${parts}</div>` : '';
};

/** Opciones de respuesta. picked = elegida por mí; correct/counts solo al revelar. */
export function optionsView(cur, { picked = -1, correct = null, counts = null, interactive = true, dim = false } = {}) {
  const many = cur.options.length > 2;
  return html`<div class="opts ${many ? 'two' : ''}">${cur.options.map((o, i) => {
    const cls = ['opt', 'c' + (i % 4)];
    if (picked === i) cls.push('picked');
    if (correct != null) cls.push(i === correct ? 'right' : 'wrong');
    else if (dim && picked !== i) cls.push('dim');
    return interactive
      ? html`<button class="${cls.join(' ')}" data-choice="${i}"><span class="ltr">${LETTERS[i]}</span><span>${o}</span></button>`
      : html`<div class="${cls.join(' ')}"><span class="ltr">${LETTERS[i]}</span><span>${o}</span>${counts ? html`<span class="cnt">${counts[i] || 0}</span>` : ''}</div>`;
  })}</div>`;
}

export const lbList = (items, meId = '', { limit = 99, colorOf } = {}) => html`<ol class="lb">${items.slice(0, limit).map((p, i) => html`<li class="${p.id === meId || p.uid === meId ? 'me' : ''}" style="animation-delay:${i * 60}ms"><span class="pos">${i + 1}</span><span class="nm">${colorOf && colorOf(p) ? html`<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorOf(p)};margin-right:6px"></span>` : ''}${p.nick || p.name}</span><span class="sc">${p.score ?? p.points ?? 0}</span></li>`)}</ol>`;

export function podium(top) {
  const [a, b, c] = [top[0], top[1], top[2]];
  const step = (p, cls, n) => p ? html`<div class="step ${cls}">${n === 1 ? html`<div class="crown" aria-hidden="true">👑</div>` : ''}<div class="who">${p.nick || p.name}</div><div class="sc">${p.score ?? p.points} pts</div><div class="bar">${n}</div></div>` : html`<div class="step ${cls}"></div>`;
  return html`<div class="podium">${step(b, 'p2', 2)}${step(a, 'p1', 1)}${step(c, 'p3', 3)}</div>`;
}

// ---------- reacciones con emojis (el público las envía y salen flotando en la pantalla grande) ----------
export const REACTIONS = ['🍷', '👏', '🔥', '😂', '🤩'];
export const reactBar = () => html`<div class="react-bar" role="group" aria-label="${t('game.react')}">${REACTIONS.map((e) => html`<button type="button" data-react="${e}" aria-label="${e}">${e}</button>`)}</div>`;

/** Hace subir un emoji por la pantalla. big = pantalla grande. */
export function floatEmoji(emoji, { big = false } = {}) {
  let layer = document.querySelector('.react-layer');
  if (!layer) { layer = document.createElement('div'); layer.className = 'react-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer); }
  if (layer.childElementCount > 60) return;
  const e = document.createElement('span');
  e.className = 'fl' + (big ? ' big' : '');
  e.textContent = emoji;
  e.style.left = 6 + Math.random() * 88 + '%';
  e.style.setProperty('--dx', Math.round(Math.random() * 90 - 45) + 'px');
  e.style.animationDuration = 2.6 + Math.random() * 1.4 + 's';
  e.addEventListener('animationend', () => e.remove(), { once: true });
  layer.appendChild(e);
}
export const clearFloat = () => document.querySelector('.react-layer')?.remove();

/** Imagen para compartir el resultado, con los vinos del tast. Se enseña una vista previa para compartir o descargar. */
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
export async function shareResult({ title, nick, rank, players, score, correct, total, wines = '', date = 0 }) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const WINE = '#a24a79', PINK = '#ba6c96', INK = '#2b1118', MUTED = '#7b6a6f', GOLD = '#d6af5c';
  g.fillStyle = '#fbf8f7'; g.fillRect(0, 0, W, H);
  g.strokeStyle = PINK; g.lineWidth = 6; g.beginPath(); if (g.roundRect) g.roundRect(36, 36, W - 72, H - 72, 44); else g.rect(36, 36, W - 72, H - 72); g.stroke();
  g.textAlign = 'center';
  const logo = CONFIG.brand.logo ? await loadImg(CONFIG.brand.logo) : null;
  if (logo) { const h = 120, w = (logo.width / logo.height) * h; g.drawImage(logo, (W - w) / 2, 80, w, h); }
  else { g.fillStyle = INK; g.font = 'bold 96px Georgia, serif'; g.fillText(CONFIG.brand.name.toLowerCase(), W / 2, 170); }
  g.fillStyle = GOLD; g.fillRect(W / 2 - 60, 238, 120, 4);
  g.fillStyle = INK; g.font = 'italic 44px Georgia, serif'; const yT = wrap(g, title, W / 2, 312, W - 220, 54, 2);
  if (date) { g.fillStyle = MUTED; g.font = '32px system-ui, sans-serif'; g.fillText(fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, yT + 58); }
  g.font = 'bold 300px Georgia, serif'; g.fillStyle = rank <= 3 ? WINE : INK; g.fillText('#' + rank, W / 2, 690);
  g.font = '40px system-ui, sans-serif'; g.fillStyle = MUTED; g.fillText(t('share.of', { n: players }), W / 2, 760);
  g.fillStyle = INK; g.font = 'bold 72px Georgia, serif'; g.fillText(nick, W / 2, 870);
  g.font = '46px system-ui, sans-serif'; g.fillStyle = WINE; g.fillText(`${score} ${t('common.pts')} · ${correct}/${total} ✓`, W / 2, 944);
  if (wines) {
    g.fillStyle = PINK; g.fillRect(W / 2 - 40, 1000, 80, 3);
    g.fillStyle = PINK; g.font = 'bold 30px system-ui, sans-serif'; g.fillText(t('share.wines'), W / 2, 1056);
    g.fillStyle = INK; g.font = 'italic 38px Georgia, serif'; wrap(g, wines, W / 2, 1112, W - 260, 50, 3);
  }
  g.font = '30px system-ui, sans-serif'; g.fillStyle = MUTED; g.fillText(CONFIG.brand.web ? CONFIG.brand.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : t('brand.tagline'), W / 2, 1268);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'cata.png', { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const m = modal(html`<h3>${t('game.share')}</h3><img class="share-prev" src="${url}" alt="">
    <div class="row mt" style="justify-content:center">${canShare ? html`<button class="btn primary" data-sh="send">${t('share.send')}</button>` : ''}<button class="btn ${canShare ? '' : 'primary'}" data-sh="save">${t('share.save')}</button></div>
    <button class="btn ghost block mt" data-close>${t('common.back')}</button>`, { onClose: () => setTimeout(() => URL.revokeObjectURL(url), 500) });
  m.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-sh]'); if (!b) return;
    if (b.dataset.sh === 'send') { try { await navigator.share({ files: [file], title: CONFIG.brand.name, text: t('share.text', { rank, title }) }); } catch (ex) { if (ex.name !== 'AbortError') console.error(ex); } return; }
    const a = document.createElement('a'); a.href = url; a.download = 'catarsi-resultat.png'; a.click();
  });
}
/** Escribe texto en varias líneas (máx. `maxLines`, con «…» si no cabe). Devuelve la y de la última línea. */
function wrap(g, text, x, y, maxW, lh, maxLines = 99) {
  const words = String(text).split(/\s+/).filter(Boolean); const lines = []; let line = '';
  for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = shown[maxLines - 1].replace(/[\s,.;:]*$/, '') + '…';
  shown.forEach((l, i) => g.fillText(l, x, y + i * lh));
  return y + (shown.length - 1) * lh;
}
