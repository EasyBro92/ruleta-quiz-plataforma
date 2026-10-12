/* Entrar / crear cuenta */
import { auth } from '../store.js';
import { S, go, loggedIn } from '../state.js';
import { t } from '../i18n.js';
import { CONFIG } from '../config.js';
import { html, setHtml, on, formData, toast } from '../util.js';
import { icon } from '../icons.js';

const errMsg = (e) => {
  const c = e?.code || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return t('auth.err.bad');
  if (c.includes('email-already')) return t('auth.err.exists');
  if (c.includes('weak')) return t('auth.err.weak');
  if (c.includes('invalid-email')) return t('auth.err.email');
  if (c.includes('popup-closed') || c.includes('cancelled')) return '';
  if (c.includes('operation-not-allowed')) return t('auth.err.disabled');
  return t('err.generic');
};

export default function view({ el, query }) {
  const next = query.next || '/';
  if (loggedIn()) { go(next); return; }
  let tab = 'in', err = '', busy = false;
  const render = () => {
    const m = CONFIG.loginMethods;
    setHtml(el, html`<div class="center mb"><span class="big-ic">${icon('user', 34, 1.3)}</span><h1>${tab === 'in' ? t('auth.login') : t('auth.signup')}</h1></div>
      <div class="card">
        <div class="seg mb"><button data-tab="in" class="${tab === 'in' ? 'on' : ''}">${t('auth.login')}</button><button data-tab="up" class="${tab === 'up' ? 'on' : ''}">${t('auth.signup')}</button></div>
        ${err ? html`<div class="err">${err}</div>` : ''}
        ${m.google || m.apple ? html`<div class="stack mb">${m.google ? html`<button class="btn block" data-prov="google"><b class="prov-g" aria-hidden="true">G</b>${t('auth.google')}</button>` : ''}${m.apple ? html`<button class="btn block" data-prov="apple"><b class="prov-a" aria-hidden="true"></b>${t('auth.apple')}</button>` : ''}</div><div class="center muted small mb">${t('auth.or')}</div>` : ''}
        ${m.email ? (tab === 'in' ? html`<form id="inForm">
            <label class="field"><span>${t('f.email')}</span><input type="email" name="email" required autocomplete="email"></label>
            <label class="field"><span>${t('f.password')}</span><input type="password" name="pass" required autocomplete="current-password"></label>
            <button class="btn primary block" ${busy ? 'disabled' : ''}>${t('auth.login')}</button>
            <p class="center mt"><a href="#" data-act="reset" class="small">${t('auth.forgot')}</a></p></form>`
          : html`<form id="upForm">
            <label class="field"><span>${t('f.name')}</span><input name="name" required autocomplete="name"></label>
            <label class="field"><span>${t('f.nick')}</span><input name="nick" required maxlength="18"></label>
            <label class="field"><span>${t('f.email')}</span><input type="email" name="email" required autocomplete="email"></label>
            <label class="field"><span>${t('f.password')}</span><input type="password" name="pass" required minlength="6" autocomplete="new-password"></label>
            <label class="field"><span>${t('f.phone')}</span><input type="tel" name="phone" required autocomplete="tel"></label>
            <label class="field"><span>${t('f.allergies')}</span><input name="allergies" placeholder="${t('f.allergiesPh')}"></label>
            <label class="check"><input type="checkbox" name="adult" required><span>${t('age.confirm', { n: CONFIG.minAge })}</span></label>
            <p class="hint">${t('age.local')}</p>
            <button class="btn primary block" ${busy ? 'disabled' : ''}>${t('auth.signup')}</button></form>`) : ''}
      </div>
      <p class="center muted small mt">${t('auth.privacy')}</p>`);
  };
  const run = async (fn) => { busy = true; err = ''; render(); try { await fn(); } catch (e) { console.error(e); err = errMsg(e); } busy = false; if (!loggedIn()) render(); };
  const offs = [
    on(el, 'click', '[data-tab]', (e, b) => { tab = b.dataset.tab; err = ''; render(); }),
    on(el, 'click', '[data-prov]', (e, b) => run(() => auth.provider(b.dataset.prov))),
    on(el, 'submit', '#inForm', (e) => { e.preventDefault(); const f = formData(e.target); run(() => auth.signIn(f.email, f.pass)); }),
    on(el, 'submit', '#upForm', (e) => { e.preventDefault(); const f = formData(e.target); if (!f.adult) return; S.pendingProfile = { name: f.name, nick: f.nick, phone: f.phone, allergies: f.allergies }; run(() => auth.signUp(f.email, f.pass, f.name)); }),
    on(el, 'click', '[data-act="reset"]', async (e) => { e.preventDefault(); const em = el.querySelector('[name=email]')?.value; if (!em) { err = t('auth.err.email'); render(); return; } try { await auth.reset(em); toast(t('auth.resetSent')); } catch { toast(t('err.generic'), 'err'); } }),
  ];
  // al iniciar sesión, la app vuelve a enrutar; aquí redirigimos a la página pedida
  const unsub = (async () => { const { bus } = await import('../state.js'); return bus.on('auth', (u) => { if (u && !u.anonymous) go(next); }); })();
  render();
  return () => { offs.forEach((f) => f()); unsub.then((f) => f()); };
}
