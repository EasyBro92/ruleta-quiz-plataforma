/* Piezas visuales compartidas por el juego (participante, pantalla grande y presentador) */
import { html } from './util.js';
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
  const step = (p, cls, n) => p ? html`<div class="step ${cls}"><div class="who">${p.nick || p.name}</div><div class="sc">${p.score ?? p.points} pts</div><div class="bar">${n}</div></div>` : html`<div class="step ${cls}"></div>`;
  return html`<div class="podium">${step(b, 'p2', 2)}${step(a, 'p1', 1)}${step(c, 'p3', 3)}</div>`;
}

/** Imagen para compartir el resultado (Web Share si existe; si no, descarga). */
export async function shareResult({ title, nick, rank, players, score, correct, total }) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#3a1020'); bg.addColorStop(1, '#14080c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(214,175,92,.55)'; g.lineWidth = 6; g.strokeRect(40, 40, W - 80, H - 80);
  g.textAlign = 'center'; g.fillStyle = '#f6efe4';
  g.font = '120px serif'; g.fillText('🍷', W / 2, 250);
  g.font = 'bold 54px Georgia, serif'; g.fillStyle = '#d6af5c'; g.fillText(CONFIG.brand.name, W / 2, 340);
  g.fillStyle = '#f6efe4'; g.font = '40px Georgia, serif'; wrap(g, title, W / 2, 420, W - 200, 52);
  g.font = 'bold 280px Georgia, serif'; g.fillStyle = rank <= 3 ? '#f0cf84' : '#f6efe4'; g.fillText('#' + rank, W / 2, 780);
  g.font = '44px system-ui, sans-serif'; g.fillStyle = '#b8a8a6'; g.fillText(t('share.of', { n: players }), W / 2, 850);
  g.fillStyle = '#f6efe4'; g.font = 'bold 72px Georgia, serif'; g.fillText(nick, W / 2, 990);
  g.font = '52px system-ui, sans-serif'; g.fillStyle = '#d6af5c'; g.fillText(`${score} pts · ${correct}/${total} ✓`, W / 2, 1080);
  g.font = '34px system-ui, sans-serif'; g.fillStyle = '#b8a8a6'; g.fillText(CONFIG.brand.tagline, W / 2, 1230);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'cata.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: CONFIG.brand.name, text: t('share.text', { rank, title }) }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mi-resultado.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function wrap(g, text, x, y, maxW, lh) {
  const words = String(text).split(' '); let line = '', yy = y;
  for (const w of words) { const test = line + w + ' '; if (g.measureText(test).width > maxW && line) { g.fillText(line.trim(), x, yy); line = w + ' '; yy += lh; } else line = test; }
  g.fillText(line.trim(), x, yy);
}
