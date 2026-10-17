/* Botones de contacto de la marca (solo se muestran los que tengan dato en config.js) */
import { CONFIG } from './config.js';
import { t } from './i18n.js';
import { html } from './util.js';
import { icon } from './icons.js';

export const waLink = (text = '') => { const n = CONFIG.brand.whatsapp; return n ? `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}` : ''; };

export const hasContact = () => { const b = CONFIG.brand; return !!(b.whatsapp || b.email || b.instagram); };

export const contactBlock = (msg = '') => {
  const b = CONFIG.brand; if (!hasContact()) return '';
  return html`<div class="row wrap">${b.whatsapp ? html`<a class="btn sm" target="_blank" rel="noopener" href="${waLink(msg)}">${icon('chat', 16)}WhatsApp</a>` : ''}${b.email ? html`<a class="btn sm" href="mailto:${b.email}">${icon('mail', 16)}${t('contact.email')}</a>` : ''}${b.instagram ? html`<a class="btn sm" target="_blank" rel="noopener" href="https://www.instagram.com/${b.instagram}/">${icon('insta', 16)}Instagram</a>` : ''}</div>`;
};
