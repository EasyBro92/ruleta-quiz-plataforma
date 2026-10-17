/* Acciones de negocio: reservas, lista de espera, avisos, catas privadas y ranking */
import { db } from './store.js';
import { CONFIG } from './config.js';

export const nowMs = () => Date.now();

// ---------- avisos dentro de la app ----------
export async function sendNotice(uid, type, data = {}, link = '') {
  try { await db.add(`users/${uid}/notices`, { type, data, link, read: false, createdAt: db.ts() }); } catch (e) { console.warn('aviso no enviado', e); }
}

// ---------- reservas ----------
export const bookingPath = (cid, uid) => `catas/${cid}/bookings/${uid}`;
export const isPast = (cata) => cata.startsAt + (cata.durationMin || 120) * 60000 < Date.now();
export const seatsLeft = (c) => Math.max(0, (c.capacity || 0) - (c.seatsTaken || 0));
export const isFull = (c) => seatsLeft(c) <= 0;
export const cancelDeadline = (c) => c.startsAt - (c.cancelHours ?? CONFIG.cancelHours) * 3600000;
export const canCancel = (c) => Date.now() < cancelDeadline(c);

/** Reserva plazas. Si no caben (o ya hay cola), entra en lista de espera. Devuelve 'confirmed' | 'waitlist'. */
export async function bookSeats(cata, user, form) {
  const cp = `catas/${cata.id}`;
  let status = 'confirmed';
  await db.tx(async (tx) => {
    const c = await tx.get(cp);
    if (!c || c.published === false) throw new Error('gone');
    const ex = await tx.get(bookingPath(cata.id, user.uid));
    if (ex && ex.status !== 'cancelled') throw new Error('already');
    const free = (c.capacity || 0) - (c.seatsTaken || 0);
    status = (c.waitCount || 0) === 0 && form.seats <= free ? 'confirmed' : 'waitlist';
    tx.set(bookingPath(cata.id, user.uid), { uid: user.uid, seats: form.seats, status, createdAt: db.ts() });
    tx.set(`${cp}/contacts/${user.uid}`, { name: form.name, phone: form.phone || '', email: user.email || '', allergies: form.allergies || '' });
    tx.set(`users/${user.uid}/bookings/${cata.id}`, { cataId: cata.id, title: c.title, startsAt: c.startsAt, address: c.address || '', cancelHours: c.cancelHours ?? CONFIG.cancelHours, seats: form.seats, status, createdAt: db.ts() });
    tx.update(cp, status === 'confirmed' ? { seatsTaken: db.inc(form.seats) } : { waitCount: db.inc(1) });
  });
  await sendNotice(user.uid, status === 'confirmed' ? 'booking_ok' : 'booking_wait', { title: cata.title, date: cata.startsAt }, `/cata/${cata.id}`);
  return status;
}

/** Cancela una reserva y, si liberaba plazas, avanza la lista de espera. */
export async function cancelBooking(cataId, uid) {
  const cp = `catas/${cataId}`;
  let wasConfirmed = false;
  await db.tx(async (tx) => {
    const b = await tx.get(bookingPath(cataId, uid));
    if (!b || b.status === 'cancelled') return;
    wasConfirmed = b.status === 'confirmed';
    tx.update(bookingPath(cataId, uid), { status: 'cancelled', cancelledAt: db.ts() });
    tx.set(`users/${uid}/bookings/${cataId}`, { status: 'cancelled' }, { merge: true });
    tx.update(cp, wasConfirmed ? { seatsTaken: db.inc(-b.seats) } : { waitCount: db.inc(-1) });
  });
  if (wasConfirmed) await promoteWaitlist(cataId);
}

/** Sube de la lista de espera a quien quepa, por orden de llegada, y le avisa. */
export async function promoteWaitlist(cataId) {
  const cp = `catas/${cataId}`;
  const waiting = await db.list(`${cp}/bookings`, { where: [['status', '==', 'waitlist']], orderBy: [['createdAt', 'asc']] });
  const cata = await db.get(cp);
  let n = 0;
  for (const w of waiting) {
    let promoted = false;
    try {
      await db.tx(async (tx) => {
        const c = await tx.get(cp);
        const b = await tx.get(bookingPath(cataId, w.uid));
        if (!c || !b || b.status !== 'waitlist') return;
        if ((c.capacity || 0) - (c.seatsTaken || 0) < b.seats) return;
        tx.update(bookingPath(cataId, w.uid), { status: 'confirmed', promotedAt: db.ts() });
        tx.set(`users/${w.uid}/bookings/${cataId}`, { status: 'confirmed' }, { merge: true });
        tx.update(cp, { seatsTaken: db.inc(b.seats), waitCount: db.inc(-1) });
        promoted = true;
      });
    } catch (e) { console.warn('no se pudo promover', e); }
    if (promoted) { n++; await sendNotice(w.uid, 'seat_freed', { title: cata?.title || '', date: cata?.startsAt || 0 }, `/cata/${cataId}`); }
  }
  return n;
}

// ---------- catas privadas ----------
export async function createPrivateRequest(user, f) {
  return db.add('privateRequests', { uid: user.uid, name: f.name, email: f.email || user.email || '', phone: f.phone, date: f.date, time: f.time, people: f.people, place: f.place, notes: f.notes || '', status: 'pending', createdAt: db.ts(), updatedAt: db.ts() });
}
export async function answerPrivateRequest(req, status, { counterDate = '', counterNote = '' } = {}) {
  await db.update(`privateRequests/${req.id}`, { status, counterDate, counterNote, updatedAt: db.ts() });
  if (status === 'accepted') {
    const av = await db.get('settings/availability');
    if (av?.dates?.includes(req.date)) await db.update('settings/availability', { dates: av.dates.filter((d) => d !== req.date) });
  }
  await sendNotice(req.uid, 'private_' + status, { date: req.date, counterDate, note: counterNote }, '/private');
}

// ---------- confianza: valoración media (la calcula el equipo; la portada solo lee el resultado) ----------
export async function updateTrustStats() {
  const sessions = await db.list('sessions', { orderBy: [['createdAt', 'desc']], limit: 100 });
  let sum = 0, n = 0;
  for (const s of sessions) { const rs = await db.list(`sessions/${s.id}/ratings`).catch(() => []); rs.forEach((r) => { if (r.stars >= 1 && r.stars <= 5) { sum += r.stars; n++; } }); }
  const out = { avg: n ? Math.round((sum / n) * 10) / 10 : 0, count: n };
  await db.set('settings/trust', { ...out, updatedAt: db.ts() });
  return out;
}

// ---------- ranking acumulado, títulos e insignias ----------
export const TITLE_STEPS = [0, 200, 600, 1500, 3000];
export const titleIndex = (pts) => { let i = 0; TITLE_STEPS.forEach((s, k) => { if (pts >= s) i = k; }); return i; };
export const nextStep = (pts) => TITLE_STEPS.find((s) => s > pts) ?? null;
export const BADGES = [
  { id: 'first_game', icon: '🍇' }, { id: 'podium', icon: '🥉' }, { id: 'champion', icon: '🏆' },
  { id: 'veteran', icon: '🍷' }, { id: 'perfect', icon: '🎯' }, { id: 'team_win', icon: '🤝' },
];
export const REWARD_ICON = { discount: '🏷️', free: '🥂', raffle: '🎟️' };

/** Puntos que el usuario puede gastar = ganados − canjeados. */
export function spendable(lbDoc, redemptions) {
  const earned = lbDoc?.points || 0;
  const spent = (redemptions || []).filter((r) => r.status !== 'void').reduce((a, r) => a + (r.cost || 0), 0);
  return Math.max(0, earned - spent);
}
