/* ============================================================
   CONFIGURACIÓN DE LA APP
   1) Mientras `firebase.apiKey` esté vacío, la app funciona en MODO DEMO
      (datos guardados solo en tu navegador, ideal para probar).
   2) Para usarla de verdad, crea un proyecto en Firebase y pega aquí
      los datos de tu app web (Configuración del proyecto → Tus apps).
   ============================================================ */
export const CONFIG = {
  brand: {
    name: 'Catas de vino',          // nombre provisional, cámbialo cuando lo tengas
    tagline: 'Cata, juega y gana',
    emoji: '🍷',
    // Portada: tu logo y tu foto. Sube los archivos a la carpeta img/ y escribe aquí su ruta
    // (por ejemplo 'img/logo.png' y 'img/foto.jpg'). Mientras estén vacíos se ve un marcador.
    logo: '',
    photo: '',
    owner: '',         // tu nombre, si quieres que aparezca bajo la foto
    intro: '',         // texto de presentación propio; vacío = el de las traducciones (home.intro)
    // Datos de contacto que se muestran a los clientes (déjalos vacíos para ocultarlos)
    whatsapp: '',      // por ejemplo '34600111222' (con prefijo de país, sin +)
    email: '',
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

  // Idiomas disponibles para los clientes
  languages: [
    ['es', 'Español'], ['en', 'English'], ['fr', 'Français'],
    ['de', 'Deutsch'], ['it', 'Italiano'], ['ca', 'Català'],
  ],
  defaultLang: 'es',

  // Reglas de negocio
  cancelHours: 48,          // plazo para cancelar desde la app
  minAge: 18,
  game: { basePoints: 100, speedBonusMax: 50, defaultSeconds: 20 },
  ranking: { pointsPerGame: 0 },  // puntos extra por participar (0 = ninguno)

  // Si usas Google/Apple como método de acceso, actívalos en Firebase → Authentication
  loginMethods: { email: true, google: true, apple: true },
};

export const isDemo = () => !CONFIG.firebase.apiKey;
