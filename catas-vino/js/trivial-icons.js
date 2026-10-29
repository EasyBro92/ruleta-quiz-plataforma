/* Iconos de línea de las 6 categorías del trivial (mismo trazo que el resto de la app).
   Sustituyen a los emojis: un emoji se dibuja distinto en cada móvil y hacía la ruleta «de juguete». */
import { raw } from './util.js';

export const CAT_PATHS = {
  // racimo con su hoja
  raim: '<circle cx="8.3" cy="10.6" r="2"/><circle cx="12" cy="10.6" r="2"/><circle cx="15.7" cy="10.6" r="2"/><circle cx="10.1" cy="14.2" r="2"/><circle cx="13.9" cy="14.2" r="2"/><circle cx="12" cy="17.8" r="2"/><path d="M12 8.6V5M12 5.6c1.2-1.9 3.2-2.5 5.2-2.1-.2 2-1.8 3.5-5.2 3.4"/>',
  // sierra de Montserrat
  cat: '<path d="M2.6 19.5 9.4 7l3.7 6.3 2.2-3.1 6.1 9.3z"/><path d="M7.4 11.2l2 1.7 2-1.5"/>',
  // sol
  esp: '<circle cx="12" cy="12" r="3.9"/><path d="M12 3.4v2.3M12 18.3v2.3M3.4 12h2.3M18.3 12h2.3M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6"/>',
  // copa de cava con burbujas
  escum: '<path d="M7.6 3.8h5.8l-.5 7.6a2.4 2.4 0 0 1-4.8 0z"/><path d="M10.5 13.8v6.4M7.6 20.2h5.8"/><circle cx="17.2" cy="5.6" r="1.1"/><circle cx="19" cy="9.6" r=".8"/><circle cx="16.2" cy="9.9" r=".6"/>',
  // barrica
  gener: '<path d="M6.8 4.4h10.4c1.8 3.6 1.8 11.6 0 15.2H6.8c-1.8-3.6-1.8-11.6 0-15.2z"/><path d="M5.9 9h12.2M5.9 15h12.2"/><path d="M12 11.4v1.4"/>',
  // piezas sueltas (no son categorías): corona y copa
  corona: '<path d="M4.5 17.5h15M5.2 17.5 4 8.5l4.6 3.9L12 6l3.4 6.4L20 8.5l-1.2 9"/>',
  copa: '<path d="M7.2 3h9.6l-.7 6.4a4.1 4.1 0 0 1-8.2 0L7.2 3z"/><path d="M7.6 8.2h8.8M12 13.6V20.5M8.6 20.5h6.8"/>',
  // botella
  cult: '<path d="M10.4 3h3.2v4.4c0 1.2 1.9 2.1 1.9 4.6v7.8a1.2 1.2 0 0 1-1.2 1.2h-4.6a1.2 1.2 0 0 1-1.2-1.2V12c0-2.5 1.9-3.4 1.9-4.6z"/><path d="M8.6 14.2h6.8M8.6 17.6h6.8"/>',
};

/** SVG suelto (para usar dentro de html`...`). */
export const catIcon = (key, size = 22, stroke = 1.7) =>
  raw(`<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAT_PATHS[key] || ''}</svg>`);

/** El mismo dibujo anidado en otro SVG (la ruleta): centrado en (0,0) y girado `deg` grados. */
export const catInWheel = (key, size, deg = 0, color = '#fff', stroke = 1.9) =>
  `<g transform="rotate(${deg})"><svg x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${CAT_PATHS[key] || ''}</svg></g>`;
