/* Instalar la app: barra fija arriba del todo + guía para iPhone/iPad.
   Android y Chrome dejan instalar con un toque (evento beforeinstallprompt). iOS NO tiene esa
   función: Apple solo deja añadir la app desde el menú Compartir de Safari, así que allí el botón
   abre una guía con los tres pasos en vez de intentar instalar. */
import { CONFIG } from './config.js';
import { S, bus } from './state.js';
import { t } from './i18n.js';
import { html, modal } from './util.js';
import { icon } from './icons.js';

const OFF_KEY = 'catas_install_off';
const OFF_DIAS = 7;

// El evento llega una sola vez y puede llegar antes de que la app termine de arrancar:
// por eso se escucha aquí, al cargar el módulo, y no más tarde.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvent = e; bus.emit('install'); });
window.addEventListener('appinstalled', () => { S.installEvent = null; bus.emit('install'); });

export const isStandalone = () => {
  try { return matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch { return false; }
};
// iPadOS 13 o posterior se presenta como un Mac: se distingue por la pantalla táctil
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Ya instalada no se ofrece; en iOS siempre se puede ofrecer la guía, en el resto solo si el navegador deja. */
export const canInstall = () => !isStandalone() && (!!S.installEvent || isIOS());

const cerrada = () => {
  try { const v = Number(localStorage.getItem(OFF_KEY)); return !!v && Date.now() - v < OFF_DIAS * 864e5; } catch { return false; }
};
export function cerrarBarra() {
  try { localStorage.setItem(OFF_KEY, String(Date.now())); } catch { /* sin almacenamiento: se cierra hasta recargar */ }
  bus.emit('install');
}

/** La barra de arriba del todo. Si la cierras, vuelve a los 7 días; en Perfil siempre queda el aviso de abajo. */
export function installBar() {
  if (!canInstall() || cerrada()) return '';
  return html`<div class="install-bar"><img src="icons/icon-192.png" alt="" width="30" height="30"><span class="grow">${t('install.bar', { name: CONFIG.brand.name })}</span><button class="btn sm gold" type="button" data-act="install">${t('install.btn')}</button><button class="install-x" type="button" data-act="install-close" aria-label="${t('install.close')}">×</button></div>`;
}

/** El aviso de dentro de Perfil: no se puede cerrar. */
export function installBanner() {
  if (!canInstall()) return '';
  return html`<div class="install">${icon('download', 24)}<span class="grow">${t('install.text')}</span><button class="btn sm gold" type="button" data-act="install">${t('install.btn')}</button></div>`;
}

function guiaIOS() {
  const name = CONFIG.brand.name;
  modal(html`<h3>${t('install.iosTitle', { name })}</h3>
    <ol class="ios-steps">
      <li><span class="step-ic">${icon('share', 24)}</span><span>${t('install.iosStep1')}</span></li>
      <li><span class="step-ic">${icon('plus', 24)}</span><span>${t('install.iosStep2')}</span></li>
      <li><span class="step-ic">${icon('check', 24)}</span><span>${t('install.iosStep3', { name })}</span></li>
    </ol>
    <p class="muted small">${t('install.iosNote')}</p>
    <button class="btn primary block" type="button" data-close>${t('common.ok')}</button>`);
}

/** Pulsar «Instalar»: en Android/Chrome sale el cuadro del sistema; en iPhone y iPad, la guía. */
export async function instalar() {
  const ev = S.installEvent;
  if (ev) {
    try { await ev.prompt(); await ev.userChoice; } catch { /* lo cierra el propio navegador */ }
    S.installEvent = null;                    // el aviso solo vale para un intento
    bus.emit('install');
    return;
  }
  if (isIOS()) guiaIOS();
}
