/* Piezas comunes del panel de gestión (catalán y castellano; en los demás idiomas se ve en catalán) */
import { html } from '../../util.js';
import { t } from '../../i18n.js';
import { isAdmin } from '../../state.js';

const TABS = [
  ['/admin', 'a.tab.catas'], ['/admin/private', 'a.tab.private'], ['/admin/wines', 'a.tab.wines'], ['/admin/questions', 'a.tab.questions'],
  ['/admin/games', 'a.tab.games'], ['/admin/rewards', 'a.tab.rewards'], ['/admin/team', 'a.tab.team', true],
];
export const adminTabs = (active) => html`<div class="tabs">${TABS.filter(([, , a]) => !a || isAdmin()).map(([h, k]) => html`<a href="#${h}" class="${h === active ? 'on' : ''}">${t(k)}</a>`)}</div>`;
/** Estado de una reserva o solicitud (confirmed, waitlist, cancelled, pending, accepted, rejected, counter). */
export const statusLabel = (s) => t('a.st.' + s);
export const pillFor = (s) => ({ confirmed: 'ok', accepted: 'ok', waitlist: 'warn', pending: 'warn', counter: 'warn', cancelled: 'bad', rejected: 'bad' }[s] || '');
