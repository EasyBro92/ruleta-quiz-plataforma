/* Iconos de línea (SVG) para la interfaz: mismo trazo y tamaño en toda la app. */
import { raw } from './util.js';

const P = {
  glass: '<path d="M7.2 3h9.6l-.7 6.4a4.1 4.1 0 0 1-8.2 0L7.2 3z"/><path d="M7.6 8.2h8.8M12 13.6V20.5M8.6 20.5h6.8"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="9" cy="9" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r=".9" fill="currentColor" stroke="none"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5.2A3 3 0 0 0 8 10.6M16 6h2.8A3 3 0 0 1 16 10.6M12 13.2V17M8.8 20h6.4"/>',
  user: '<circle cx="12" cy="8.2" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4"/>',
  sliders: '<path d="M4 7h9M17.5 7H20M4 17h2.5M11 17h9"/><circle cx="15.2" cy="7" r="2.2"/><circle cx="8.7" cy="17" r="2.2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2z"/><path d="M10 21h4"/>',
  clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.8v4.6l3 1.6"/>',
  pin: '<path d="M12 21s6.2-5.4 6.2-10.2a6.2 6.2 0 1 0-12.4 0C5.8 15.6 12 21 12 21z"/><circle cx="12" cy="10.8" r="2.2"/>',
  euro: '<path d="M17.2 7.2A6.2 6.2 0 0 0 7 12a6.2 6.2 0 0 0 10.2 4.8M5 10.5h8.2M5 13.5h8.2"/>',
  left: '<path d="M14.5 6l-6 6 6 6"/>',
  right: '<path d="M9.5 6l6 6-6 6"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>',
  download: '<path d="M12 4v11M7.5 10.8 12 15.3l4.5-4.5M5 20h14"/>',
  share: '<path d="M12 15V4M8.5 7.5 12 4l3.5 3.5M8 10H6.5A2.5 2.5 0 0 0 4 12.5v5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-5a2.5 2.5 0 0 0-2.5-2.5H16"/>',
  crown: '<path d="M4.5 17.5h15M5.2 17.5 4 8.5l4.6 3.9L12 6l3.4 6.4L20 8.5l-1.2 9"/>',
  plus: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>',
  megaphone:'<path d="M4 10v4h3l7 4V6L7 10H4z"/><path d="M17.5 9.5a4 4 0 0 1 0 5"/>',
  route: '<path d="M20 4l-6.2 16-2.7-6.9L4 10.4 20 4z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="M4.5 8l7.5 5.5L19.5 8"/>',
  chat: '<path d="M5 18.5V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9.5L5 18.5z"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.4l2.5 2.5 5-5.4"/>',
  hourglass: '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 4 5 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 5-4 8.5s4 4.5 4 8.5"/>',
  insta: '<rect x="4" y="4" width="16" height="16" rx="4.8"/><circle cx="12" cy="12" r="3.7"/><circle cx="16.9" cy="7.1" r=".9" fill="currentColor" stroke="none"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5z"/>',
  users: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5M16 6.3a3 3 0 0 1 0 5.8M17.6 14.7c1.8.5 3 1.9 3.4 4.3"/>',
};

/** Devuelve un SVG listo para usar dentro de html`...`. */
export const icon = (name, size = 22, stroke = 1.6) =>
  raw(`<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`);

/** Silueta genérica para el marcador de la foto. */
export const portraitPlaceholder = () =>
  raw('<svg viewBox="0 0 200 240" fill="currentColor" aria-hidden="true"><circle cx="100" cy="86" r="42"/><path d="M14 240c4-52 40-82 86-82s82 30 86 82z"/></svg>');
