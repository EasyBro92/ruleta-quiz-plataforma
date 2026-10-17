/* Datos de ejemplo para el MODO DEMO (los nombres de bodegas son inventados). Todo el contenido va en catalán. */
import { questionFor, CORE_CATS } from './quiz.js';

export function seedDemo() {
  const D = {};
  const now = Date.now(), DAY = 86400000;
  const at = (days, h, m = 0) => { const d = new Date(now + days * DAY); d.setHours(h, m, 0, 0); return d.getTime(); };
  const iso = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // ---- personas ----
  D['staff/u_admin'] = { role: 'admin', email: 'admin@demo.com', name: 'Equip Demo' };
  D['users/u_admin'] = { uid: 'u_admin', name: 'Equip Demo', nick: 'Sommelier', email: 'admin@demo.com', phone: '600000000', allergies: '', lang: 'ca', adult: true, createdAt: now };
  D['users/u_ana'] = { uid: 'u_ana', name: 'Anna Demo', nick: 'Anna', email: 'ana@demo.com', phone: '611111111', allergies: 'Sense gluten', lang: 'ca', adult: true, createdAt: now };

  // ---- ajustes ----
  D['settings/categories'] = { extra: [{ key: 'pairing', label: 'Maridatge ideal' }] };
  const free = [];
  for (let i = 3; i < 60; i++) { const d = new Date(now + i * DAY); if ([5, 6, 0].includes(d.getDay())) free.push(iso(d.getTime())); }
  D['settings/availability'] = { dates: free };

  // ---- vinos ----
  const W = (id, name, attrs, notes = '') => { D['wines/' + id] = { name, attrs, notes, createdAt: now }; return { id, name, attrs }; };
  const wines = [
    W('w1', 'Mas del Roure Criança', { winery: 'Celler Mas del Roure', variety: 'Garnatxa', abv: '14', origin: 'Empordà', wood: 'Roure francès', aging: '14 mesos en barrica', vintage: '2020', pairing: 'Anyell rostit' }),
    W('w2', 'Costers de Pedra Reserva', { winery: 'Celler Costers de Pedra', variety: 'Carinyena', abv: '14,5', origin: 'Priorat', wood: 'Roure francès', aging: '18 mesos en barrica', vintage: '2018', pairing: 'Guisats de carn' }),
    W('w3', 'Pazo do Río', { winery: 'Pazo do Río', variety: 'Albariño', abv: '12,5', origin: 'Rías Baixas', wood: 'Sense fusta (acer inoxidable)', aging: 'Sis mesos sobre mares', vintage: '2023', pairing: 'Marisc i peix' }),
    W('w4', 'Viñas del Sil Godello', { winery: 'Viñas del Sil', variety: 'Godello', abv: '13', origin: 'Valdeorras', wood: 'Roure francès', aging: '6 mesos en barrica', vintage: '2022', pairing: 'Pop a la gallega' }),
    W('w5', 'Marlot Verdejo', { winery: 'Casa Marlot', variety: 'Verdejo', abv: '13', origin: 'Rueda', wood: 'Sense fusta (acer inoxidable)', aging: 'Sense criança en barrica', vintage: '2023', pairing: 'Amanides i arrossos' }),
    W('w6', 'Peñalara Monastrell', { winery: 'Bodegas Peñalara', variety: 'Monastrell', abv: '15', origin: 'Jumilla', wood: 'Roure francès i americà', aging: '12 mesos en barrica', vintage: '2019', pairing: 'Carns a la brasa' }),
    W('w7', 'Cuatro Vientos Mencía', { winery: 'Bodega Cuatro Vientos', variety: 'Mencía', abv: '13,5', origin: 'Bierzo', wood: 'Roure francès', aging: '10 mesos en barrica', vintage: '2021', pairing: 'Embotits i bolets' }),
    W('w8', 'Montgrí Brut Nature', { winery: 'Caves Montgrí', variety: 'Xarel·lo i Macabeu', abv: '11,5', origin: 'Cava (Penedès)', wood: 'Sense fusta (acer inoxidable)', aging: '18 mesos en ampolla', vintage: '2021', pairing: 'Aperitius' }),
  ];

  // ---- preguntas ----
  const qs = [];
  const add = (q) => { if (q) qs.push(q); };
  add(questionFor(wines[0], 'variety', wines)); add(questionFor(wines[0], 'origin', wines)); add(questionFor(wines[0], 'wood', wines));
  add(questionFor(wines[2], 'variety', wines)); add(questionFor(wines[2], 'abv', wines)); add(questionFor(wines[2], 'origin', wines));
  add(questionFor(wines[5], 'variety', wines)); add(questionFor(wines[5], 'abv', wines)); add(questionFor(wines[5], 'vintage', wines));
  add(questionFor(wines[6], 'origin', wines)); add(questionFor(wines[7], 'aging', wines));
  qs.forEach((q, i) => { q.ref = 'Vi ' + (['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C', 'D', 'E'][i]); });
  const free1 = { prompt: 'Quin aroma típic aporta la barrica de roure americà?', options: ['Vainilla i coco', 'Pebrot verd', 'Poma àcida', 'Pa torrat i llevat'], correct: 0, category: '', wineId: '', ref: '', durationSec: 15, points: 100, explanation: 'El roure americà sol aportar notes dolces de vainilla i coco.', image: '', mapQuery: '' };
  const free2 = { prompt: 'A quina temperatura es recomana servir un vi blanc jove?', options: ['4–6 °C', '8–10 °C', '14–16 °C', '18–20 °C'], correct: 1, category: '', wineId: '', ref: '', durationSec: 15, points: 100, explanation: 'Entre 8 i 10 °C ressalta la seva frescor sense apagar els aromes.', image: '', mapQuery: '' };
  qs.push(free1, free2);
  qs.forEach((q, i) => { D['questions/q' + (i + 1)] = { ...q, createdAt: now + i }; });

  // ---- catas ----
  const cata = (id, o) => { D['catas/' + id] = { published: true, durationMin: 120, cancelHours: 48, seatsTaken: 0, waitCount: 0, createdAt: now, ...o }; };
  cata('c1', { title: 'Negres amb caràcter: Empordà i Priorat', startsAt: at(6, 20), price: 25, capacity: 12, seatsTaken: 7, address: 'Carrer de la Força 10, Girona', lat: 41.9843, lon: 2.8283, showTheme: true, theme: 'Garnatxa i carinyena: com la barrica canvia el caràcter d\'un negre', wines: 'Sis negres de criança i reserva', notes: 'Inclou taula de formatges i embotits.' });
  cata('c2', { title: 'Blancs atlàntics', startsAt: at(13, 19, 30), price: 22, capacity: 10, seatsTaken: 4, address: 'Plaça de l\'Oli 2, Girona', lat: 41.9836, lon: 2.8241, showTheme: true, theme: 'Albariño, godello i verdejo cara a cara', wines: 'Cinc blancs i un escumós', notes: '' });
  cata('c3', { title: 'Tast sorpresa a cegues', startsAt: at(20, 20), price: 28, capacity: 8, seatsTaken: 8, waitCount: 1, address: 'Carrer Ciutadans 15, Girona', lat: 41.9857, lon: 2.8227, showTheme: false, theme: 'Un misteri que descobriràs a la taula', wines: '', notes: 'La temàtica es descobreix durant el tast.' });
  const book = (cid, uid, seats, status, name, offset = 0) => {
    D[`catas/${cid}/bookings/${uid}`] = { uid, seats, status, createdAt: now - 3 * DAY + offset };
    D[`catas/${cid}/contacts/${uid}`] = { name, phone: '600123456', email: `${uid}@demo.com`, allergies: '' };
    if (uid.startsWith('u_')) { const c = D[`catas/${cid}`]; D[`users/${uid}/bookings/${cid}`] = { cataId: cid, title: c.title, startsAt: c.startsAt, address: c.address || '', cancelHours: c.cancelHours ?? 48, seats, status, createdAt: now - 3 * DAY + offset }; }
  };
  book('c1', 'f1', 3, 'confirmed', 'Carles Vila', 1); book('c1', 'f2', 2, 'confirmed', 'Lluïsa Pons', 2); book('c1', 'u_ana', 2, 'confirmed', 'Anna Demo', 3);
  book('c2', 'f3', 4, 'confirmed', 'Pau Gil', 4);
  book('c3', 'f1', 4, 'confirmed', 'Carles Vila', 5); book('c3', 'f2', 4, 'confirmed', 'Lluïsa Pons', 6); book('c3', 'f4', 1, 'waitlist', 'Marta Soler', 7);

  // ---- ranking acumulado y premios ----
  const lb = (uid, nick, points, games, wins, badges) => { D['leaderboard/' + uid] = { uid, nick, points, games, wins, badges, updatedAt: now }; };
  lb('f1', 'Carles', 980, 7, 3, ['first_game', 'podium', 'veteran', 'champion']); lb('f2', 'Lluïsa', 760, 6, 2, ['first_game', 'podium', 'veteran', 'champion']);
  lb('u_ana', 'Anna', 420, 3, 1, ['first_game', 'podium', 'champion']); lb('f3', 'Pau', 310, 2, 0, ['first_game']);
  const R = (id, title, desc, type, cost, extra = {}) => { D['rewards/' + id] = { title, desc, type, cost, active: true, createdAt: now, ...extra }; };
  R('r1', '10 % de descompte al teu proper tast', 'S\'aplica a una reserva. Ensenya el codi al local.', 'discount', 300);
  R('r2', 'Copa de benvinguda gratis', 'Una copa d\'escumós en arribar al teu proper tast.', 'free', 500);
  R('r3', 'Sorteig: tast per a dues persones', 'Cada participació suma una butlleta al sorteig.', 'raffle', 200);

  // opiniones de ejemplo (solo en modo demo; en la app real las eliges tú desde Gestió → Confiança)
  D['reviews/rv1'] = { stars: 5, comment: 'Opinió d\'exemple: així es veuran les opinions destacades a la portada.', nick: 'Client d\'exemple', title: '', sample: true, featuredAt: now - 2 * DAY };
  D['reviews/rv2'] = { stars: 5, comment: 'Una altra opinió d\'exemple. Pots triar-ne dels tasts o afegir-ne de pròpies.', nick: 'Client d\'exemple', title: '', sample: true, featuredAt: now - 3 * DAY };

  D['announcements/a1'] = { title: 'Nous tasts de tardor', body: 'Ja pots reservar els tasts de les properes setmanes. Places limitades!', createdAt: now - DAY };
  return D;
}

export const CORE_KEYS = CORE_CATS.map((c) => c.key);
