/* Panel: equipo con acceso a la gestión */
import { db } from '../../store.js';
import { S } from '../../state.js';
import { html, setHtml, on, formData, toast, confirmBox } from '../../util.js';
import { adminTabs } from './ui.js';

const ROLES = { admin: 'Administrador (todo)', presenter: 'Presentador (catas, preguntas y partidas)' };

export default function view({ el }) {
  let staff = null, msg = '';
  const render = () => setHtml(el, html`${adminTabs('/admin/team')}<h1>Equipo</h1>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));align-items:start">
      <div class="card"><h3>Personas con acceso</h3>${staff === null ? '…' : staff.map((p) => html`<div class="row mb"><div class="grow"><b>${p.name || p.email}</b><div class="small muted">${p.email || ''}</div></div>
        <select data-role="${p.id}" ${p.id === S.user.uid ? 'disabled' : ''}>${Object.entries(ROLES).map(([k, v]) => html`<option value="${k}" ${p.role === k ? 'selected' : ''}>${k === 'admin' ? 'Administrador' : 'Presentador'}</option>`)}</select>
        ${p.id === S.user.uid ? '' : html`<button class="btn sm danger" data-rm="${p.id}">Quitar</button>`}</div>`)}</div>
      <form class="card" id="addForm"><h3>Añadir a alguien</h3><p class="muted small">La persona debe haberse registrado antes en la app con ese correo.</p>
        ${msg ? html`<div class="note mb">${msg}</div>` : ''}
        <label class="field"><span>Correo electrónico</span><input type="email" name="email" required></label>
        <label class="field"><span>Permisos</span><select name="role">${Object.entries(ROLES).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></label>
        <button class="btn primary block">Dar acceso</button></form></div>`);
  const u = db.onList('staff', {}, (l) => { staff = l; render(); });
  const offs = [
    on(el, 'submit', '#addForm', async (e) => {
      e.preventDefault(); const f = formData(e.target); msg = '';
      const users = await db.list('users', { where: [['email', '==', f.email.toLowerCase()]] });
      const hit = users[0] || (await db.list('users')).find((x) => (x.email || '').toLowerCase() === f.email.toLowerCase());
      if (!hit) { msg = 'Ese correo todavía no se ha registrado. Pídele que cree su cuenta en la app y vuelve a intentarlo.'; render(); return; }
      await db.set(`staff/${hit.id}`, { role: f.role, email: hit.email, name: hit.name || '' }); toast('Acceso concedido'); e.target.reset();
    }),
    on(el, 'change', '[data-role]', async (e, s) => { await db.update(`staff/${s.dataset.role}`, { role: s.value }); toast('Permisos actualizados'); }),
    on(el, 'click', '[data-rm]', async (e, b) => { if (await confirmBox('Quitar acceso', '¿Quitar el acceso a la gestión a esta persona?', 'Quitar', 'Volver', true)) { await db.del(`staff/${b.dataset.rm}`); toast('Acceso retirado'); } }),
  ];
  render();
  return () => { u(); offs.forEach((f) => f()); };
}
