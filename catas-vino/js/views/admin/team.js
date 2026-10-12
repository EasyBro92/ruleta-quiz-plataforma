/* Panel: equipo con acceso a la gestión */
import { db } from '../../store.js';
import { S } from '../../state.js';
import { t } from '../../i18n.js';
import { html, setHtml, on, formData, toast, confirmBox } from '../../util.js';
import { adminTabs } from './ui.js';

const ROLES = ['admin', 'presenter'];

export default function view({ el }) {
  let staff = null, msg = '';
  const render = () => setHtml(el, html`${adminTabs('/admin/team')}<h1>${t('a.tab.team')}</h1>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));align-items:start">
      <div class="card"><h3>${t('a.team.people')}</h3>${staff === null ? '…' : staff.map((p) => html`<div class="row mb"><div class="grow"><b>${p.name || p.email}</b><div class="small muted">${p.email || ''}</div></div>
        <select data-role="${p.id}" ${p.id === S.user.uid ? 'disabled' : ''}>${ROLES.map((k) => html`<option value="${k}" ${p.role === k ? 'selected' : ''}>${t('a.team.role.' + k)}</option>`)}</select>
        ${p.id === S.user.uid ? '' : html`<button class="btn sm danger" data-rm="${p.id}">${t('a.remove')}</button>`}</div>`)}</div>
      <form class="card" id="addForm"><h3>${t('a.team.addTitle')}</h3><p class="muted small">${t('a.team.addHint')}</p>
        ${msg ? html`<div class="note mb">${msg}</div>` : ''}
        <label class="field"><span>${t('f.email')}</span><input type="email" name="email" required></label>
        <label class="field"><span>${t('a.team.perms')}</span><select name="role">${ROLES.map((k) => html`<option value="${k}">${t('a.team.roleLong.' + k)}</option>`)}</select></label>
        <button class="btn primary block">${t('a.team.give')}</button></form></div>`);
  const u = db.onList('staff', {}, (l) => { staff = l; render(); });
  const offs = [
    on(el, 'submit', '#addForm', async (e) => {
      e.preventDefault(); const f = formData(e.target); msg = '';
      const users = await db.list('users', { where: [['email', '==', f.email.toLowerCase()]] });
      const hit = users[0] || (await db.list('users')).find((x) => (x.email || '').toLowerCase() === f.email.toLowerCase());
      if (!hit) { msg = t('a.team.notReg'); render(); return; }
      await db.set(`staff/${hit.id}`, { role: f.role, email: hit.email, name: hit.name || '' }); toast(t('a.team.granted')); e.target.reset();
    }),
    on(el, 'change', '[data-role]', async (e, s) => { await db.update(`staff/${s.dataset.role}`, { role: s.value }); toast(t('a.team.updated')); }),
    on(el, 'click', '[data-rm]', async (e, b) => { if (await confirmBox(t('a.team.rmTitle'), t('a.team.rmAsk'), t('a.remove'), t('common.back'), true)) { await db.del(`staff/${b.dataset.rm}`); toast(t('a.team.removed')); } }),
  ];
  render();
  return () => { u(); offs.forEach((f) => f()); };
}
