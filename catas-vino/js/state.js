/* Estado global compartido (usuario, perfil, rol) y pequeño bus de eventos */
export const S = {
  user: null,        // usuario de autenticación {uid,email,name,anonymous}
  profile: null,     // documento users/{uid}
  staff: null,       // 'admin' | 'presenter' | null
  lang: 'es',
  unread: 0,         // avisos sin leer
  installEvent: null,
  pendingProfile: null,
};
const L = {};
export const bus = {
  on(ev, fn) { (L[ev] = L[ev] || new Set()).add(fn); return () => L[ev].delete(fn); },
  emit(ev, v) { (L[ev] || []).forEach((f) => f(v)); },
};
export const go = (h) => { location.hash = h.startsWith('#') ? h : '#' + h; };
export const isStaff = () => !!S.staff;
export const isAdmin = () => S.staff === 'admin';
export const loggedIn = () => !!S.user && !S.user.anonymous;
export const myNick = () => S.profile?.nick || S.profile?.name || S.user?.name || '';
