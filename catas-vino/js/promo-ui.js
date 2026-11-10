// Finestra emergent del cartell d'un esdeveniment i la targeta de la portada que la torna a obrir.
import { t } from './i18n.js';
import { html, setHtml, fmtDateTime } from './util.js';
import { icon } from './icons.js';
import { contactBlock, hasContact } from './contact.js';
import { countdown } from './countdown.js';
import { marcarFet } from './promos.js';

const quan = (p) => `${fmtDateTime(p.start)}${p.price ? ' · ' + p.price : ''}`;

/** Targeta fixa de la portada: toca-la per veure el cartell. */
export function promoCard(p) {
  const cd = countdown(p.start, 0);
  return html`<button type="button" class="promo-card" data-promo="${p.id}" aria-label="${p.title}">
    <img src="${p.images[0].src}" alt="" loading="lazy">
    <span class="pc-txt"><span class="pc-kicker">${t('promo.badge')}${cd ? ' · ' + cd : ''}</span><b>${p.title}</b><span class="pc-when">${quan(p)}</span></span>
    <span class="pc-go" aria-hidden="true">${icon('right', 20)}</span></button>`;
}

/** Obre el cartell a pantalla gairebé completa. Es pot lliscar entre imatges (cartell i menú, per exemple). */
export function obrirPromo(p, { onClose } = {}) {
  const root = document.getElementById('modal-root');
  const abans = document.activeElement;
  const bg = document.createElement('div');
  bg.className = 'promo-bg';
  bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', p.title);
  const n = p.images.length;
  const demanar = p.cata
    ? html`<a class="btn primary block" href="#/cata/${p.cata}" data-fet>${t('promo.book')}</a>`
    : hasContact() ? html`<div class="promo-ask"><p>${t('promo.ask')}</p><div data-fet>${contactBlock(p.msg)}</div></div>` : '';
  setHtml(bg, html`<div class="promo" style="--n:${n}">
    <span class="promo-badge">${icon('glass', 14)}${t('promo.badge')}</span>
    <div class="promo-frame">
      <div class="promo-track" data-track tabindex="-1">${p.images.map((im, i) => html`<div class="promo-slide"><img src="${im.src}" alt="${im.alt}" fetchpriority="${i ? 'auto' : 'high'}"></div>`)}</div>
      <button type="button" class="promo-x" data-close aria-label="${t('promo.close')}"><svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      ${n > 1 ? html`<button type="button" class="promo-nav prev" data-go="-1" aria-label="${t('promo.prev')}">${icon('left', 20)}</button><button type="button" class="promo-nav next" data-go="1" aria-label="${t('promo.next')}">${icon('right', 20)}</button>` : ''}
    </div>
    ${n > 1 ? html`<div class="promo-dots">${p.images.map((im, i) => html`<button type="button" data-dot="${i}" aria-label="${i + 1} / ${n}" aria-current="${i === 0}"></button>`)}</div>` : ''}
    <div class="promo-actions">${demanar}<button type="button" class="promo-later" data-close>${t('promo.later')}</button></div>
  </div>`);
  root.appendChild(bg);

  const track = bg.querySelector('[data-track]');
  const pos = () => (track.clientWidth ? Math.round(track.scrollLeft / track.clientWidth) : 0);
  const ir = (i) => track.scrollTo({ left: Math.max(0, Math.min(n - 1, i)) * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const sync = () => {
    const i = pos();
    bg.dataset.pos = String(i);
    bg.querySelectorAll('[data-dot]').forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
    bg.querySelector('.promo-nav.prev')?.classList.toggle('off', i <= 0);
    bg.querySelector('.promo-nav.next')?.classList.toggle('off', i >= n - 1);
  };
  track.addEventListener('scroll', () => { cancelAnimationFrame(sync.raf); sync.raf = requestAnimationFrame(sync); }, { passive: true });
  sync();

  const antic = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  let obert = true;
  const tanca = () => {
    if (!obert) return; obert = false;
    document.removeEventListener('keydown', tecla); removeEventListener('hashchange', tanca);
    document.documentElement.style.overflow = antic;
    bg.classList.add('out');
    setTimeout(() => bg.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
    if (abans && document.contains(abans) && abans.focus) abans.focus({ preventScroll: true });
    onClose && onClose();
  };
  const tecla = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); tanca(); return; }
    if (e.key === 'ArrowRight' && n > 1) { ir(pos() + 1); return; }
    if (e.key === 'ArrowLeft' && n > 1) { ir(pos() - 1); return; }
    if (e.key !== 'Tab') return;
    const f = [...bg.querySelectorAll('button, a[href]')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  };
  document.addEventListener('keydown', tecla);
  addEventListener('hashchange', tanca);                       // si es navega a una altra pantalla, el cartell es tanca
  bg.addEventListener('click', (e) => {
    const tgt = e.target;
    if (tgt.closest('[data-fet]')) { marcarFet(p.id); if (tgt.closest('a[href^="#"]')) tanca(); return; }
    const go = tgt.closest('[data-go]'); if (go) { ir(pos() + Number(go.dataset.go)); return; }
    const dot = tgt.closest('[data-dot]'); if (dot) { ir(Number(dot.dataset.dot)); return; }
    if (tgt.closest('[data-close]') || tgt === bg) tanca();
  });
  bg.tabIndex = -1; bg.focus({ preventScroll: true });          // el foco empieza en el cuadro de diálogo, sin marcar ningún botón
  return { close: tanca };
}
