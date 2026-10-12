/* Utilidades: HTML seguro, fechas, aleatorios, sonido y confeti */

// ---------- HTML seguro por defecto ----------
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Safe(String(s ?? ''));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toS = (v) => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(toS).join('') : v == null || v === false ? '' : esc(v));
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += toS(vals[i]); });
  return new Safe(out);
}
export const setHtml = (el, safe) => { el.innerHTML = safe instanceof Safe ? safe.s : esc(safe); };

// ---------- DOM ----------
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
/** Delegación de eventos: on(root,'click','[data-act]', (e, el) => ...) */
export function on(root, type, sel, fn) {
  const h = (e) => { const el = e.target.closest(sel); if (el && root.contains(el)) fn(e, el); };
  root.addEventListener(type, h);
  return () => root.removeEventListener(type, h);
}
/** Lee un formulario en un objeto. */
export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else if (el.type === 'number') o[el.name] = el.value === '' ? null : Number(el.value);
    else o[el.name] = el.value.trim();
  }
  return o;
}

// ---------- Identificadores y números ----------
export const rid = (n = 12) => { const a = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = ''; const r = crypto.getRandomValues(new Uint8Array(n)); r.forEach((b) => (s += a[b % a.length])); return s; };
export const joinCode = (n = 4) => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; const r = crypto.getRandomValues(new Uint8Array(n)); r.forEach((b) => (s += a[b % a.length])); return s; };
export const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || rid(6);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- Fechas (todo se guarda en milisegundos) ----------
let LOCALE = 'es';
export const setLocale = (l) => { LOCALE = l === 'ca' ? 'ca' : l; };
const lc = () => LOCALE;
const okDate = (ms) => { const d = new Date(ms); return Number.isNaN(d.getTime()) ? null : d; };   // fechas incompletas no deben romper la pantalla
export const fmtDate = (ms, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => { const d = okDate(ms); return d ? new Intl.DateTimeFormat(lc(), opts).format(d) : ''; };
export const fmtTime = (ms) => { const d = okDate(ms); return d ? new Intl.DateTimeFormat(lc(), { hour: '2-digit', minute: '2-digit' }).format(d) : ''; };
export const fmtDateTime = (ms) => (okDate(ms) ? `${fmtDate(ms, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(ms)}` : '');
export const fmtShortDate = (ms) => { const d = okDate(ms); return d ? new Intl.DateTimeFormat(lc(), { day: 'numeric', month: 'short', year: 'numeric' }).format(d) : ''; };
export const dayNum = (ms) => new Date(ms).getDate();
export const monthShort = (ms) => new Intl.DateTimeFormat(lc(), { month: 'short' }).format(new Date(ms));
export const isoDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const fromIsoDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0).getTime(); };
export const toLocalInput = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
export const fromLocalInput = (s) => new Date(s).getTime();
export const money = (n) => (n == null || n === '' ? '—' : new Intl.NumberFormat(lc(), { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n));
export const num = (n) => new Intl.NumberFormat(lc()).format(n);

// ---------- Imágenes: se reducen en el navegador y se guardan dentro del documento ----------
export function resizeImage(file, max = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen')); };
    img.src = url;
  });
}

// ---------- Toast y modal ----------
export function toast(msg, type = '') {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, type === 'err' ? 4200 : 2400);
}
export function modal(content, { onClose } = {}) {
  const root = document.getElementById('modal-root');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  const box = document.createElement('div');
  box.className = 'modal';
  setHtml(box, content);
  bg.appendChild(box); root.appendChild(bg);
  const close = () => { bg.remove(); onClose && onClose(); };
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  box.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  return { el: box, close };
}
export function confirmBox(title, text, okLabel, cancelLabel, danger = false) {
  return new Promise((resolve) => {
    const m = modal(html`<h3>${title}</h3><p class="muted">${text}</p><div class="row mt" style="justify-content:flex-end">
      <button class="btn ghost" data-r="0">${cancelLabel}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${okLabel}</button></div>`, { onClose: () => resolve(false) });
    // primero se resuelve con la respuesta y después se cierra (cerrar sin más equivale a «Volver»)
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { resolve(b.dataset.r === '1'); m.close(); } });
  });
}

// ---------- Sonido (WebAudio, sin archivos) ----------
let actx = null; let muted = false;
try { muted = localStorage.getItem('catas_mute') === '1'; } catch { /* sin almacenamiento */ }
export const isMuted = () => muted;
export const setMuted = (m) => { muted = m; try { localStorage.setItem('catas_mute', m ? '1' : '0'); } catch { /* nada */ } };
function tone(freq, start, dur, type = 'sine', vol = 0.12) {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(); const g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    const t = actx.currentTime + start;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
  } catch { /* el navegador puede bloquear el audio hasta el primer toque */ }
}
export const sfx = {
  unlock() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume && actx.resume(); } catch { /* nada */ } },
  tick() { tone(880, 0, 0.07, 'square', 0.05); },
  start() { tone(523, 0, 0.12, 'triangle'); tone(784, 0.12, 0.2, 'triangle'); },
  good() { tone(659, 0, 0.12, 'triangle'); tone(880, 0.12, 0.12, 'triangle'); tone(1175, 0.24, 0.25, 'triangle'); },
  bad() { tone(220, 0, 0.25, 'sawtooth', 0.07); tone(165, 0.2, 0.3, 'sawtooth', 0.07); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.22, 'triangle', 0.14)); },
};

// ---------- Confeti ----------
export function confetti(n = 90) {
  const box = document.createElement('div'); box.className = 'confetti';
  const colors = ['#d6af5c', '#f0cf84', '#b32a4d', '#f6efe4', '#4fb58a', '#5b82c9'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = 2.2 + Math.random() * 2.2 + 's';
    p.style.animationDelay = Math.random() * 0.8 + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 5500);
}

// ---------- Contador animado ----------
export function countUp(el, to, ms = 900) {
  const from = 0; const t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / ms); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// ---------- Mapas y archivos ----------
/** Busca coordenadas de una dirección (OpenStreetMap/Nominatim). Devuelve {lat, lon} o null. */
export async function geocode(q) {
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } });
    const j = await r.json();
    return j[0] ? { lat: Number(j[0].lat), lon: Number(j[0].lon) } : null;
  } catch { return null; }
}
export function downloadCsv(name, rows) {
  const csv = rows.map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
