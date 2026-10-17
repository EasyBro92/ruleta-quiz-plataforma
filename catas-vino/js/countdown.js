/* Cuenta atrás en texto: «Falten 3 dies», «Demà a les 20:00», «Avui a les 20:00» */
import { t } from './i18n.js';
import { fmtTime } from './util.js';

const day0 = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function countdown(ms, durMin = 120) {
  const now = Date.now();
  if (!Number.isFinite(ms)) return '';
  if (now >= ms && now < ms + durMin * 60000) return t('cd.now');
  if (ms < now) return '';
  const n = Math.round((day0(ms) - day0(now)) / 864e5);      // días naturales (aguanta el cambio de hora)
  if (n <= 0) return t('cd.today', { time: fmtTime(ms) });
  if (n === 1) return t('cd.tomorrow', { time: fmtTime(ms) });
  if (n <= 30) return t('cd.days', { n });
  return '';
}
