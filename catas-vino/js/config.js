/* ============================================================
   CONFIGURACIÓN DE LA APP
   1) Mientras `firebase.apiKey` esté vacío, la app funciona en MODO DEMO
      (datos guardados solo en tu navegador, ideal para probar).
   2) Para usarla de verdad, crea un proyecto en Firebase y pega aquí
      los datos de tu app web (Configuración del proyecto → Tus apps).
   ============================================================ */
export const CONFIG = {
  brand: {
    name: 'Catarsi',
    emoji: '🍷',
    // Logo «catarsi» (archivo propio en img/logo-catarsi.png: barra superior, portada y arranque).
    // Foto de la portada: se carga de https://www.salutcatarsi.cat/. Si quieres que la app no dependa de la web,
    // descárgala a la carpeta img/ y pon aquí su ruta (por ejemplo 'img/foto.jpg').
    logo: 'img/logo-catarsi.png',
    photo: 'https://www.salutcatarsi.cat/wp-content/uploads/2025/02/catarsi_jordi-707x1024.png',
    owner: 'Jordi Roura',
    intro: '',         // texto de presentación propio; vacío = el de las traducciones (home.intro)
    web: 'https://www.salutcatarsi.cat/',
    // Datos de contacto que se muestran a los clientes (déjalos vacíos para ocultarlos)
    whatsapp: '',      // por ejemplo '34600111222' (con prefijo de país, sin +)
    email: 'hola@salutcatarsi.cat',
    instagram: 'salut_catarsi',   // usuario de Instagram, sin @
  },

  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  firebaseSdkVersion: '10.14.1',

  // Idiomas disponibles para los clientes. El catalán es el idioma principal: todo el contenido
  // (tasts, noticias, premios) se escribe en catalán y la interfaz se traduce a los demás.
  languages: [
    ['ca', 'Català'], ['es', 'Español'], ['en', 'English'], ['fr', 'Français'],
    ['de', 'Deutsch'], ['it', 'Italiano'],
  ],
  defaultLang: 'ca',
  noAutoLang: ['es'],   // idiomas que NO se eligen solos según el navegador (quien tiene el móvil en castellano ve el catalán; puede cambiar a mano)

  // Reglas de negocio
  cancelHours: 48,          // plazo para cancelar desde la app
  minAge: 18,
  game: { basePoints: 100, speedBonusMax: 50, defaultSeconds: 20 },
  ranking: { pointsPerGame: 0 },  // puntos extra por participar (0 = ninguno)
  stamps: { goal: 5, discountPct: 10 },   // tarjeta de sellos: 1 sello por cata jugada; al llegar a `goal`, descuento del `discountPct` %
  trust: { minRatings: 3 },       // la valoración media solo sale en la portada a partir de este número de valoraciones

  // Si usas Google/Apple como método de acceso, actívalos en Firebase → Authentication
  loginMethods: { email: true, google: true, apple: true },
};

export const isDemo = () => !CONFIG.firebase.apiKey;
