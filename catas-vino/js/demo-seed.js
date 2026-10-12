/* Datos de ejemplo para el MODO DEMO (los nombres de bodegas son inventados). */
import { questionFor, CORE_CATS } from './quiz.js';

export function seedDemo() {
  const D = {};
  const now = Date.now(), DAY = 86400000;
  const at = (days, h, m = 0) => { const d = new Date(now + days * DAY); d.setHours(h, m, 0, 0); return d.getTime(); };
  const iso = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // ---- personas ----
  D['staff/u_admin'] = { role: 'admin', email: 'admin@demo.com', name: 'Equipo Demo' };
  D['users/u_admin'] = { uid: 'u_admin', name: 'Equipo Demo', nick: 'Sumiller', email: 'admin@demo.com', phone: '600000000', allergies: '', lang: 'es', adult: true, createdAt: now };
  D['users/u_ana'] = { uid: 'u_ana', name: 'Ana Demo', nick: 'Ana', email: 'ana@demo.com', phone: '611111111', allergies: 'Sin gluten', lang: 'es', adult: true, createdAt: now };

  // ---- ajustes ----
  D['settings/categories'] = { extra: [{ key: 'pairing', label: 'Maridaje ideal' }] };
  const free = [];
  for (let i = 3; i < 60; i++) { const d = new Date(now + i * DAY); if ([5, 6, 0].includes(d.getDay())) free.push(iso(d.getTime())); }
  D['settings/availability'] = { dates: free };

  // ---- vinos ----
  const W = (id, name, attrs, notes = '') => { D['wines/' + id] = { name, attrs, notes, createdAt: now }; return { id, name, attrs }; };
  const wines = [
    W('w1', 'Altozano Crianza', { winery: 'Bodegas Altozano', variety: 'Tempranillo', abv: '14', origin: 'Ribera del Duero', wood: 'Roble americano', aging: '14 meses en barrica', vintage: '2020', pairing: 'Cordero asado' }),
    W('w2', 'Solana Reserva', { winery: 'Finca La Solana', variety: 'Garnacha', abv: '14,5', origin: 'Rioja', wood: 'Roble francés', aging: '18 meses en barrica', vintage: '2018', pairing: 'Guisos de carne' }),
    W('w3', 'Pazo do Río', { winery: 'Pazo do Río', variety: 'Albariño', abv: '12,5', origin: 'Rías Baixas', wood: 'Sin madera (acero inoxidable)', aging: 'Seis meses sobre lías', vintage: '2023', pairing: 'Marisco y pescado' }),
    W('w4', 'Viñas del Sil Godello', { winery: 'Viñas del Sil', variety: 'Godello', abv: '13', origin: 'Valdeorras', wood: 'Roble francés', aging: '6 meses en barrica', vintage: '2022', pairing: 'Pulpo a la gallega' }),
    W('w5', 'Marlot Verdejo', { winery: 'Casa Marlot', variety: 'Verdejo', abv: '13', origin: 'Rueda', wood: 'Sin madera (acero inoxidable)', aging: 'Sin crianza en barrica', vintage: '2023', pairing: 'Ensaladas y arroces' }),
    W('w6', 'Peñalara Monastrell', { winery: 'Bodegas Peñalara', variety: 'Monastrell', abv: '15', origin: 'Jumilla', wood: 'Roble francés y americano', aging: '12 meses en barrica', vintage: '2019', pairing: 'Carnes a la brasa' }),
    W('w7', 'Cuatro Vientos Mencía', { winery: 'Bodega Cuatro Vientos', variety: 'Mencía', abv: '13,5', origin: 'Bierzo', wood: 'Roble francés', aging: '10 meses en barrica', vintage: '2021', pairing: 'Embutidos y setas' }),
    W('w8', 'Montgrí Brut Nature', { winery: 'Cavas Montgrí', variety: 'Xarel·lo y Macabeo', abv: '11,5', origin: 'Cava (Penedès)', wood: 'Sin madera (acero inoxidable)', aging: '18 meses en botella', vintage: '2021', pairing: 'Aperitivos' }),
  ];

  // ---- preguntas ----
  const qs = [];
  const add = (q) => { if (q) qs.push(q); };
  add(questionFor(wines[0], 'variety', wines)); add(questionFor(wines[0], 'origin', wines)); add(questionFor(wines[0], 'wood', wines));
  add(questionFor(wines[2], 'variety', wines)); add(questionFor(wines[2], 'abv', wines)); add(questionFor(wines[2], 'origin', wines));
  add(questionFor(wines[5], 'variety', wines)); add(questionFor(wines[5], 'abv', wines)); add(questionFor(wines[5], 'vintage', wines));
  add(questionFor(wines[6], 'origin', wines)); add(questionFor(wines[7], 'aging', wines));
  qs.forEach((q, i) => { q.ref = 'Vino ' + (['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C', 'D', 'E'][i]); });
  const free1 = { prompt: '¿Qué aroma típico aporta la barrica de roble americano?', options: ['Vainilla y coco', 'Pimiento verde', 'Manzana ácida', 'Pan tostado y levadura'], correct: 0, category: '', wineId: '', ref: '', durationSec: 15, points: 100, explanation: 'El roble americano suele aportar notas dulces de vainilla y coco.', image: '', mapQuery: '' };
  const free2 = { prompt: '¿A qué temperatura se recomienda servir un vino blanco joven?', options: ['4–6 °C', '8–10 °C', '14–16 °C', '18–20 °C'], correct: 1, category: '', wineId: '', ref: '', durationSec: 15, points: 100, explanation: 'Entre 8 y 10 °C resalta su frescura sin apagar los aromas.', image: '', mapQuery: '' };
  qs.push(free1, free2);
  qs.forEach((q, i) => { D['questions/q' + (i + 1)] = { ...q, createdAt: now + i }; });

  // ---- catas ----
  const cata = (id, o) => { D['catas/' + id] = { published: true, durationMin: 120, cancelHours: 48, seatsTaken: 0, waitCount: 0, createdAt: now, ...o }; };
  cata('c1', { title: 'Tintos con carácter: Ribera y Rioja', startsAt: at(6, 20), price: 25, capacity: 12, seatsTaken: 7, address: 'Calle Mayor 12, Madrid', lat: 40.4153, lon: -3.7074, showTheme: true, theme: 'Tempranillo y garnacha: cómo cambia la barrica el carácter de un tinto', wines: 'Seis tintos de crianza y reserva', notes: 'Incluye tabla de quesos y embutidos.' });
  cata('c2', { title: 'Blancos atlánticos', startsAt: at(13, 19, 30), price: 22, capacity: 10, seatsTaken: 4, address: 'Plaza del Ayuntamiento 3, Valencia', lat: 39.4699, lon: -0.3763, showTheme: true, theme: 'Albariño, godello y verdejo frente a frente', wines: 'Cinco blancos y un espumoso', notes: '' });
  cata('c3', { title: 'Cata sorpresa a ciegas', startsAt: at(20, 20), price: 28, capacity: 8, seatsTaken: 8, waitCount: 1, address: 'Calle Sierpes 40, Sevilla', lat: 37.3891, lon: -5.9936, showTheme: false, theme: 'Un misterio que descubrirás en la mesa', wines: '', notes: 'La temática se desvela durante la cata.' });
  const book = (cid, uid, seats, status, name, offset = 0) => {
    D[`catas/${cid}/bookings/${uid}`] = { uid, seats, status, createdAt: now - 3 * DAY + offset };
    D[`catas/${cid}/contacts/${uid}`] = { name, phone: '600123456', email: `${uid}@demo.com`, allergies: '' };
    if (uid.startsWith('u_')) { const c = D[`catas/${cid}`]; D[`users/${uid}/bookings/${cid}`] = { cataId: cid, title: c.title, startsAt: c.startsAt, address: c.address || '', cancelHours: c.cancelHours ?? 48, seats, status, createdAt: now - 3 * DAY + offset }; }
  };
  book('c1', 'f1', 3, 'confirmed', 'Carlos Ruiz', 1); book('c1', 'f2', 2, 'confirmed', 'Lucía Pérez', 2); book('c1', 'u_ana', 2, 'confirmed', 'Ana Demo', 3);
  book('c2', 'f3', 4, 'confirmed', 'Pablo Gil', 4);
  book('c3', 'f1', 4, 'confirmed', 'Carlos Ruiz', 5); book('c3', 'f2', 4, 'confirmed', 'Lucía Pérez', 6); book('c3', 'f4', 1, 'waitlist', 'Marta Soler', 7);

  // ---- ranking acumulado y premios ----
  const lb = (uid, nick, points, games, wins, badges) => { D['leaderboard/' + uid] = { uid, nick, points, games, wins, badges, updatedAt: now }; };
  lb('f1', 'Carlos', 980, 7, 3, ['first_game', 'podium', 'veteran', 'champion']); lb('f2', 'Lucía', 760, 6, 2, ['first_game', 'podium', 'veteran', 'champion']);
  lb('u_ana', 'Ana', 420, 3, 1, ['first_game', 'podium', 'champion']); lb('f3', 'Pablo', 310, 2, 0, ['first_game']);
  const R = (id, title, desc, type, cost, extra = {}) => { D['rewards/' + id] = { title, desc, type, cost, active: true, createdAt: now, ...extra }; };
  R('r1', '10 % de descuento en tu próxima cata', 'Se aplica a una reserva. Enseña el código en el local.', 'discount', 300);
  R('r2', 'Copa de bienvenida gratis', 'Una copa de espumoso al llegar a tu próxima cata.', 'free', 500);
  R('r3', 'Sorteo: cata para dos personas', 'Cada participación suma una papeleta en el sorteo.', 'raffle', 200);

  D['announcements/a1'] = { title: 'Nuevas catas de otoño', body: 'Ya puedes reservar las catas de las próximas semanas. ¡Plazas limitadas!', createdAt: now - DAY };
  return D;
}

export const CORE_KEYS = CORE_CATS.map((c) => c.key);
