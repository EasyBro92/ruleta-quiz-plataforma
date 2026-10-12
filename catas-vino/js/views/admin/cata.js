/* Panel: crear/editar una cata y gestionar sus reservas y lista de espera */
import { db } from '../../store.js';
import { go } from '../../state.js';
import { CONFIG } from '../../config.js';
import { html, setHtml, on, formData, toast, confirmBox, modal, toLocalInput, fromLocalInput, geocode, downloadCsv, rid } from '../../util.js';
import { adminTabs, STATUS_ES, pillFor } from './ui.js';
import { cancelBooking, promoteWaitlist, sendNotice } from '../../api.js';

export default function view({ el, params }) {
  const id = params.id, isNew = id === 'new';
  let c = isNew ? { title: '', startsAt: Date.now() + 7 * 86400000, durationMin: 120, address: '', price: 25, capacity: 12, cancelHours: CONFIG.cancelHours, showTheme: true, theme: '', wines: '', notes: '', published: true, seatsTaken: 0, waitCount: 0, lat: null, lon: null } : null;
  let books = [], contacts = {}, busy = false, geoMsg = '';

  const render = () => {
    if (!c) { setHtml(el, html`<div class="empty">…</div>`); return; }
    const active = books.filter((b) => b.status !== 'cancelled').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const cancelled = books.filter((b) => b.status === 'cancelled');
    const row = (b) => { const k = contacts[b.id] || {}; return html`<tr><td><b>${k.name || b.uid}</b>${b.manual ? html` <span class="tag">manual</span>` : ''}<div class="small muted">${k.phone || ''} ${k.email ? '· ' + k.email : ''}</div>${k.allergies ? html`<div class="small" style="color:#f6c978">⚠️ ${k.allergies}</div>` : ''}</td><td>${b.seats}</td><td><span class="pill ${pillFor(b.status)}">${STATUS_ES[b.status]}</span></td>
      <td class="right nowrap">${b.status === 'waitlist' ? html`<button class="btn sm" data-promote="${b.id}">Confirmar</button> ` : ''}${b.status !== 'cancelled' ? html`<button class="btn sm danger" data-cancel="${b.id}">Cancelar</button>` : ''}</td></tr>`; };
    setHtml(el, html`${adminTabs('/admin')}
      <a href="#/admin" class="muted small">← Catas</a>
      <h1 class="mt">${isNew ? 'Nueva cata' : c.title}</h1>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));align-items:start">
      <form class="card" id="cForm">
        <label class="field"><span>Título</span><input name="title" required value="${c.title}"></label>
        <div class="grid c2"><label class="field"><span>Fecha y hora</span><input type="datetime-local" name="startsAt" required value="${toLocalInput(c.startsAt)}"></label>
          <label class="field"><span>Duración (min)</span><input type="number" name="durationMin" min="30" step="15" value="${c.durationMin || 120}"></label></div>
        <label class="field"><span>Dirección del lugar</span><input name="address" required value="${c.address || ''}"></label>
        <div class="row mb"><button type="button" class="btn sm" data-act="geo">📍 Buscar en el mapa</button><span class="small ${c.lat != null ? 'ok' : 'muted'}">${geoMsg || (c.lat != null ? 'Ubicación guardada ✓' : 'Sin ubicación en el mapa')}</span></div>
        <div class="grid c3"><label class="field"><span>Precio (€)</span><input type="number" name="price" min="0" step="0.5" value="${c.price ?? ''}"></label>
          <label class="field"><span>Plazas</span><input type="number" name="capacity" min="1" required value="${c.capacity}"></label>
          <label class="field"><span>Cancelar hasta (h)</span><input type="number" name="cancelHours" min="0" value="${c.cancelHours ?? CONFIG.cancelHours}"></label></div>
        <label class="check"><input type="checkbox" name="showTheme" ${c.showTheme ? 'checked' : ''}><span>Mostrar la temática y los vinos a los clientes</span></label>
        <label class="field"><span>Temática</span><input name="theme" value="${c.theme || ''}"></label>
        <label class="field"><span>Vinos (texto libre)</span><input name="wines" value="${c.wines || ''}"></label>
        <label class="field"><span>Notas para los clientes</span><textarea name="notes">${c.notes || ''}</textarea></label>
        <label class="check"><input type="checkbox" name="published" ${c.published !== false ? 'checked' : ''}><span>Publicada (visible en la app)</span></label>
        <button class="btn primary block" ${busy ? 'disabled' : ''}>${isNew ? 'Crear cata' : 'Guardar cambios'}</button>
      </form>
      ${isNew ? '' : html`<div class="stack">
        <div class="card"><div class="row between"><h3 style="margin:0">Reservas</h3><div class="row"><span class="pill ok">👥 ${c.seatsTaken || 0}/${c.capacity}</span>${c.waitCount ? html`<span class="pill warn">⏳ ${c.waitCount}</span>` : ''}</div></div>
          <div class="row wrap mt"><button class="btn sm" data-act="manual">＋ Reserva manual</button><button class="btn sm" data-act="recheck">🔄 Revisar lista de espera</button><button class="btn sm" data-act="csv">⬇ CSV</button><a class="btn sm gold" href="#/admin/games?cata=${id}">🎲 Crear partida</a></div>
          ${active.length ? html`<div class="scroll-x mt"><table><thead><tr><th>Cliente</th><th>Plazas</th><th>Estado</th><th></th></tr></thead><tbody>${active.map(row)}</tbody></table></div>` : html`<p class="muted mt">Aún no hay reservas.</p>`}
          ${cancelled.length ? html`<details class="mt"><summary class="muted small">Canceladas (${cancelled.length})</summary><div class="scroll-x"><table><tbody>${cancelled.map(row)}</tbody></table></div></details>` : ''}
        </div>
        <div class="card"><button class="btn danger block" data-act="delete">Eliminar cata</button><p class="hint mt">Si ya hay reservas, es mejor desmarcar «Publicada» y avisar a los clientes.</p></div></div>`}
      </div>`);
  };

  const subs = [];
  if (!isNew) {
    subs.push(db.onDoc(`catas/${id}`, (d) => { if (!d) { toast('La cata ya no existe', 'err'); go('/admin'); return; } const keep = c && el.querySelector('#cForm') ? formData(el.querySelector('#cForm')) : null; c = { ...d, lat: c?.latEdited ? c.lat : d.lat, lon: c?.latEdited ? c.lon : d.lon, latEdited: !!c?.latEdited }; if (!keep) render(); else renderKeep(keep); }));
    subs.push(db.onList(`catas/${id}/bookings`, {}, (l) => { books = l; render2(); }));
    subs.push(db.onList(`catas/${id}/contacts`, {}, (l) => { contacts = Object.fromEntries(l.map((x) => [x.id, x])); render2(); }));
  }
  // vuelve a pintar las reservas sin perder lo que se está escribiendo en el formulario
  function render2() { const f = el.querySelector('#cForm'); if (f) renderKeep(formData(f)); else render(); }
  function renderKeep(keep) { render(); const f = el.querySelector('#cForm'); if (!f) return; for (const [k, v] of Object.entries(keep)) { const inp = f.elements[k]; if (!inp) continue; if (inp.type === 'checkbox') inp.checked = !!v; else if (inp.type !== 'datetime-local' || v) inp.value = v ?? ''; } }
  const read = () => {
    const f = formData(el.querySelector('#cForm'));
    return { title: f.title, startsAt: fromLocalInput(f.startsAt), durationMin: f.durationMin || 120, address: f.address, lat: c.lat ?? null, lon: c.lon ?? null, price: f.price ?? 0, capacity: f.capacity, cancelHours: f.cancelHours ?? CONFIG.cancelHours, showTheme: f.showTheme, theme: f.theme, wines: f.wines, notes: f.notes, published: f.published };
  };

  const offs = [
    on(el, 'submit', '#cForm', async (e) => {
      e.preventDefault(); busy = true;
      try {
        const d = read();
        if (isNew) { const nid = await db.add('catas', { ...d, seatsTaken: 0, waitCount: 0, createdAt: db.ts() }); toast('Cata creada'); go('/admin/cata/' + nid); return; }
        await db.update(`catas/${id}`, d); toast('Guardado');
        if (d.capacity > (c.capacity || 0)) { const n = await promoteWaitlist(id); if (n) toast(`${n} persona(s) pasan de la lista de espera a confirmadas`); }
      } catch (ex) { console.error(ex); toast('No se pudo guardar', 'err'); }
      busy = false; render2();
    }),
    on(el, 'click', '[data-act="geo"]', async () => {
      const f = formData(el.querySelector('#cForm')); if (!f.address) return;
      geoMsg = 'Buscando…'; const keep = f; render(); renderKeep(keep);
      const g = await geocode(f.address);
      if (g) { c.lat = g.lat; c.lon = g.lon; c.latEdited = true; geoMsg = 'Ubicación encontrada ✓'; } else geoMsg = 'No encontrada: revisa la dirección';
      renderKeep(keep);
    }),
    on(el, 'click', '[data-promote]', async (e, b) => {
      const bk = books.find((x) => x.id === b.dataset.promote); if (!bk) return;
      try {
        await db.tx(async (tx) => { const cc = await tx.get(`catas/${id}`); tx.update(`catas/${id}/bookings/${bk.id}`, { status: 'confirmed', promotedAt: db.ts() }); tx.set(`users/${bk.uid}/bookings/${id}`, { status: 'confirmed' }, { merge: true }); tx.update(`catas/${id}`, { seatsTaken: db.inc(bk.seats), waitCount: db.inc(-1) }); void cc; });
        if (!bk.manual) await sendNotice(bk.uid, 'seat_freed', { title: c.title, date: c.startsAt }, `/cata/${id}`);
        toast('Reserva confirmada');
      } catch (ex) { console.error(ex); toast('No se pudo confirmar', 'err'); }
    }),
    on(el, 'click', '[data-cancel]', async (e, b) => {
      const bk = books.find((x) => x.id === b.dataset.cancel); if (!bk) return; const k = contacts[bk.id] || {};
      if (!(await confirmBox('Cancelar reserva', `¿Cancelar la reserva de ${k.name || 'este cliente'}?`, 'Cancelar reserva', 'Volver', true))) return;
      try { await cancelBooking(id, bk.uid); if (!bk.manual) await sendNotice(bk.uid, 'booking_cancelled', { title: c.title, date: c.startsAt }, `/cata/${id}`); toast('Reserva cancelada'); } catch (ex) { console.error(ex); toast('No se pudo cancelar', 'err'); }
    }),
    on(el, 'click', '[data-act="recheck"]', async () => { const n = await promoteWaitlist(id); toast(n ? `${n} reserva(s) confirmadas desde la lista de espera` : 'No hay nadie a quien subir ahora'); }),
    on(el, 'click', '[data-act="csv"]', () => {
      const rows = [['Nombre', 'Teléfono', 'Email', 'Plazas', 'Estado', 'Alergias']];
      books.filter((b) => b.status !== 'cancelled').forEach((b) => { const k = contacts[b.id] || {}; rows.push([k.name, k.phone, k.email, b.seats, STATUS_ES[b.status], k.allergies]); });
      downloadCsv(`reservas-${(c.title || 'cata').replace(/\W+/g, '-')}.csv`, rows);
    }),
    on(el, 'click', '[data-act="manual"]', () => {
      const m = modal(html`<h3>Reserva manual</h3><p class="muted small">Para quien te contacta por teléfono o WhatsApp.</p><form id="mForm"><label class="field"><span>Nombre</span><input name="name" required></label><label class="field"><span>Teléfono</span><input name="phone" type="tel"></label><label class="field"><span>Plazas</span><input name="seats" type="number" min="1" max="20" value="2" required></label><label class="field"><span>Alergias</span><input name="allergies"></label><button class="btn primary block">Añadir</button></form>`);
      m.el.querySelector('#mForm').addEventListener('submit', async (e) => {
        e.preventDefault(); const f = formData(e.target); const uid = 'm_' + rid(8);
        try {
          await db.tx(async (tx) => {
            const cc = await tx.get(`catas/${id}`);
            const free = (cc.capacity || 0) - (cc.seatsTaken || 0); const st = f.seats <= free ? 'confirmed' : 'waitlist';
            tx.set(`catas/${id}/bookings/${uid}`, { uid, seats: f.seats, status: st, manual: true, createdAt: db.ts() });
            tx.set(`catas/${id}/contacts/${uid}`, { name: f.name, phone: f.phone || '', email: '', allergies: f.allergies || '' });
            tx.update(`catas/${id}`, st === 'confirmed' ? { seatsTaken: db.inc(f.seats) } : { waitCount: db.inc(1) });
          });
          m.close(); toast('Reserva añadida');
        } catch (ex) { console.error(ex); toast('No se pudo añadir', 'err'); }
      });
    }),
    on(el, 'click', '[data-act="delete"]', async () => {
      if (!(await confirmBox('Eliminar cata', 'Se borrará la cata para siempre. Las reservas dejarán de verse.', 'Eliminar', 'Volver', true))) return;
      await db.del(`catas/${id}`); toast('Cata eliminada'); go('/admin');
    }),
  ];
  render();
  return () => { subs.forEach((f) => f()); offs.forEach((f) => f()); };
}
