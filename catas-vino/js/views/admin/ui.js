/* Piezas comunes del panel de gestión (en castellano) */
import { html } from '../../util.js';
import { isAdmin } from '../../state.js';

const TABS = [
  ['/admin', 'Catas'], ['/admin/private', 'Privadas'], ['/admin/wines', 'Vinos'], ['/admin/questions', 'Preguntas'],
  ['/admin/games', 'Partidas'], ['/admin/rewards', 'Premios'], ['/admin/team', 'Equipo', true],
];
export const adminTabs = (active) => html`<div class="tabs">${TABS.filter(([, , a]) => !a || isAdmin()).map(([h, l]) => html`<a href="#${h}" class="${h === active ? 'on' : ''}">${l}</a>`)}</div>`;
export const STATUS_ES = { confirmed: 'Confirmada', waitlist: 'En espera', cancelled: 'Cancelada', pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada', counter: 'Otra fecha propuesta' };
export const pillFor = (s) => ({ confirmed: 'ok', accepted: 'ok', waitlist: 'warn', pending: 'warn', counter: 'warn', cancelled: 'bad', rejected: 'bad' }[s] || '');
