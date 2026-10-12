# 🍷 Catarsi — tasts de vi: reserves + joc en directe

App web instalable (PWA) para Catarsi (https://www.salutcatarsi.cat/), el negocio de catas itinerantes de Jordi Roura:

- **Portada**: tu logo, tu foto y una breve presentación; debajo, un calendario mensual con las catas marcadas (al pulsar un día se ve esa cata y se puede reservar), las próximas catas en **tarjetas deslizables** (se arrastran con el dedo; en el ordenador, con las flechas), las novedades y el aviso para pedir una cata privada.
- **Clientes**: ven las próximas catas, reservan plazas (con lista de espera), piden una cata privada, juegan en directo, suben en el ranking y canjean premios. En 6 idiomas; **el catalán es el idioma principal** (CA, ES, EN, FR, DE, IT).
- **Tú y tu equipo**: panel para crear catas, ver y gestionar reservas, responder a catas privadas, mantener el catálogo de vinos y las preguntas, **presentar la partida** y entregar premios.
- Funciona **sin instalar nada**: es HTML + JavaScript. Se aloja en **GitHub Pages** y los datos viven en **Firebase**.

---

## 1. Probarla ahora mismo (modo demo, sin Firebase)

Mientras `apiKey` esté vacío en `js/config.js`, la app funciona en **modo demo**: los datos se guardan solo en tu navegador, con datos de ejemplo.

```bash
cd catas-vino
python3 -m http.server 8000      # o cualquier servidor estático
# abre http://localhost:8000
```

Cuentas de prueba (se ven también en la barra ámbar “MODO DEMO” de arriba):

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@demo.com` | `demo1234` |
| Cliente | `ana@demo.com` | `demo1234` |

Para probar una **partida en directo** en demo, abre varias pestañas del mismo navegador: una como admin (Panel → Partidas → crear → *Presentar*), otra con el código en `#/play` como invitado, otra en `#/screen/CODIGO` (pantalla grande). Se sincronizan entre pestañas.

> El modo demo no sirve para probar con móviles distintos: cada navegador tiene sus propios datos. Para eso hace falta Firebase (siguiente punto).

---

## 2. Poner la app de verdad (Firebase + GitHub Pages)

### 2.1 Crear el proyecto de Firebase
1. Entra en <https://console.firebase.google.com> → **Añadir proyecto** (puedes desactivar Google Analytics).
2. En la página del proyecto pulsa **`</>` (Web)** → pon un nombre → *Registrar app*. Copia el bloque `firebaseConfig`.
3. Abre `js/config.js` y pega los valores en `firebase: { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }`. En cuanto `apiKey` tenga valor, la app deja el modo demo.

### 2.2 Autenticación
**Build → Authentication → Sign-in method**, activa:
- **Correo electrónico/contraseña**
- **Anónimo** ← *imprescindible*: es lo que permite entrar a una partida como invitado con código/QR.
- **Google** (elige un correo de soporte).
- **Apple** (opcional; exige cuenta de Apple Developer. Si no lo vas a usar, pon `apple: false` en `loginMethods` de `config.js`).

En **Authentication → Settings → Authorized domains** añade tu dominio de GitHub Pages: `TUUSUARIO.github.io`.

### 2.3 Base de datos y reglas
1. **Build → Firestore Database → Crear base de datos** → modo *producción* → región europea (p. ej. `eur3` o `europe-west`).
2. Pestaña **Reglas** → borra lo que haya, pega el contenido de **`firestore.rules`** → **Publicar**.
3. Antes de abrirla al público, prueba las reglas con el *Simulador de reglas* de esa misma pestaña (no he podido probarlas contra un Firebase real; ver “Limitaciones”).

### 2.4 Crear al primer administrador
Las reglas impiden que nadie se haga admin desde la app; el primero se crea a mano:
1. Abre tu app publicada y **regístrate** con tu email (o Google).
2. En Firebase → **Authentication → Users**, copia tu **UID**.
3. **Firestore → Iniciar colección** → ID de colección `staff` → ID de documento = **tu UID** → campos: `role` (string) = `admin`, `email` (string), `name` (string).
4. Recarga la app: aparece el icono ⚙️ **Panel**. Desde **Panel → Equipo** añades al resto (por email, deben haberse registrado antes) como *admin* o *presentador*.

### 2.5 Publicar en GitHub Pages
1. Crea un repositorio en GitHub y sube **el contenido de la carpeta `catas-vino`** (que `index.html` quede en la raíz del repositorio).
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`**.
3. En un minuto tendrás `https://TUUSUARIO.github.io/NOMBRE-REPO/`. Todas las rutas son relativas, así que funciona en subcarpeta.
4. **Cada vez que cambies archivos**, sube también el número de `VERSION` en `sw.js` (`catas-v4`, `catas-v5`…) para que los móviles recojan la versión nueva.

### 2.6 Instalarla en el móvil
- **Android (Chrome)**: menú ⋮ → *Instalar aplicación* (la app muestra además un aviso propio).
- **iPhone (Safari)**: botón Compartir → *Añadir a pantalla de inicio* (la app lo explica con un aviso).

---

## 3. Primeros pasos en el panel

1. **Vinos**: añade los vinos que vas a catar (variedad, graduación, bodega, origen, madera, crianza, añada) y, si quieres, tus propias categorías extra (maridaje, color, enólogo…).
2. **Preguntas**: créalas a mano (con imagen o mapa) o **genéralas desde un vino** — las opciones falsas se calculan solas con el resto del catálogo. Tiempo y puntos por pregunta.
3. **Catas**: fecha, lugar (con mapa), precio, aforo, duración, tema/vinos (se muestran al cliente solo si lo marcas). Desde cada cata ves reservas, lista de espera, reserva manual y exportación CSV.
4. **Partidas**: elige preguntas y orden, modo de equipos (sin equipos / libres / asignados / por mesas) → *Crear partida*. Aparece el **código y el QR**.
5. **Presentar**: tú lanzas cada pregunta; se cierra sola cuando todos responden o se acaba el tiempo (o la cierras tú). Pantalla grande en `#/screen/CODIGO` (ábrela en el portátil conectado a un proyector/TV).
6. **Premios**: descuentos, copa/cata gratis, sorteos; canjes con código que validas tú. **Novedades** para anunciar eventos.
7. **Catas privadas**: marca en el calendario las fechas libres; las solicitudes llegan al panel y las aceptas, rechazas o contraproponen fecha.

Puntos de una pregunta: `puntos base + hasta un 50 % extra por rapidez` (valores en `js/config.js → game`).

---

## 4. Personalizar

- **Logo y foto (portada)**: el logo «catarsi» ya está en la app (`img/logo-catarsi.png`; se usa en la barra superior, la portada y la pantalla de arranque). La foto se carga desde tu web (`js/config.js → brand.photo`); para que la app no dependa de la web, descárgala a `img/` y pon `photo: 'img/foto.jpg'`. En `js/config.js → brand` también puedes poner `owner` (tu nombre bajo la foto) e `intro` (tu texto de presentación).
- **Nombre, correo, Instagram, WhatsApp**: `js/config.js → brand` (`email`, `instagram`, `whatsapp`; los que dejes vacíos no se muestran). El lema está en las traducciones (`brand.tagline`).
- **Colores**: variables CSS al principio de `css/app.css` (fondo claro con granate y dorado como acentos).
- **Tipografías**: Newsreader (títulos) y Hanken Grotesk (texto), cargadas desde Google Fonts en `index.html`; sin internet se usan fuentes del sistema.
- **Iconos**: carpeta `icons/` (192, 512, maskable, apple-touch, favicon).
- **Plazo de cancelación (48 h), edad mínima, puntos por partida**: `js/config.js`.
- **Idiomas**: el catalán (`js/locales/ca.js`) es el idioma principal y el de respaldo: si a otro idioma le falta una frase, se ve en catalán. Quien tenga el navegador en castellano ve la app en catalán la primera vez (puede cambiar con el selector; se configura en `js/config.js → noAutoLang`).
- **Contenido (tasts, novedades, premios, preguntas)**: se escribe **una sola vez, en catalán**; la interfaz se traduce sola. Lo que se guarda desde el panel (por ejemplo las preguntas que se generan desde un vino) también sale en catalán.
- **Panel de gestión**: disponible en catalán y castellano (en los demás idiomas se ve en catalán). Las frases están en `js/locales/ca.js` y `es.js`, con claves que empiezan por `a.` (panel) y `q.` (generador de preguntas).
- **Textos**: `js/locales/*.js` (una clave por línea, no cambies las claves ni lo que va entre {llaves}).

---

## 5. Cómo está organizado

```
index.html · manifest.webmanifest · sw.js     PWA
css/app.css                                   estilos
js/config.js                                  ← lo que tú tocas
js/store.js                                   capa de datos: modo demo y Firebase con la misma API
js/api.js · js/game.js                        reservas, lista de espera, avisos / lógica de la partida
js/icons.js                                   iconos de línea (SVG) de la interfaz
js/views/*.js                                 pantallas del cliente (catas.js = portada + calendario)
img/                                          logo «catarsi» (y tu foto, si la copias aquí)
js/views/admin/*.js                           panel de administración
js/locales/*.js                               traducciones
firestore.rules                               seguridad de la base de datos
```

Colecciones de Firestore: `users`, `staff`, `catas` (+ `bookings` sin datos personales, `contacts` con nombre/teléfono/alergias), `privateRequests`, `settings`, `wines`, `questions`, `sessions` (+ `players`, `teams`, `answers`, `qs` con la respuesta correcta —solo equipo—, `ratings`), `leaderboard`, `results`, `rewards`, `redemptions`, `announcements`.

El **presentador hace de árbitro**: su dispositivo abre cada pregunta, revela la respuesta, calcula los puntos con la hora del servidor y guarda el ranking al terminar. Los participantes solo pueden escribir su propia respuesta, y solo mientras la pregunta está abierta.

---

## 6. Limitaciones de esta primera versión (sé honesto con esto)

- **Probado en modo demo** con un navegador automatizado (reservas, lista de espera, panel completo, partida con varios jugadores, pantalla grande, puntuación, ranking acumulado y valoraciones). **El adaptador de Firebase y las reglas de seguridad no se han podido probar** contra un proyecto real. Es lo primero que hay que verificar tras configurar Firebase, con dos móviles reales.
- **Sin servidor propio**: reservas, lista de espera y puntos se calculan en los dispositivos (con transacciones). Las reglas los acotan, pero no son a prueba de un usuario técnico malintencionado. Para endurecerlo: Cloud Functions (fase 2).
- **Avisos solo dentro de la app** (🔔). No hay notificaciones push ni emails todavía.
- **Pago solo en el local**; la app gestiona reservas, no cobra.
- **Panel de gestión solo en catalán y castellano.**
- **La foto se carga desde salutcatarsi.cat**: si esa web cambia el archivo de sitio, desaparece de la app (se muestra un marcador). Cópiala a `img/` cuando puedas.
- **Iconos de la app instalada** (carpeta `icons/`): ya llevan el logo «catarsi». Si ya tenías la app instalada en el móvil, puede que el icono antiguo se mantenga hasta que la desinstales y vuelvas a instalarla.
- **Mapas**: se usan OpenStreetMap/Nominatim (gratis, sin clave). Para mucho tráfico conviene otro proveedor.
- Las imágenes de preguntas se reducen y se guardan dentro de Firestore (sin Firebase Storage) para no exigir plan de pago; para muchas imágenes grandes conviene pasar a Storage.
- La edad se confirma con una casilla y se comprueba en el local.

## 7. Fase 2 (cuando quieras)

1. Publicar en **Google Play y App Store** (envolver la PWA con Capacitor o PWABuilder; Apple pide cuenta de pago y revisión).
2. **Notificaciones push** (Firebase Cloud Messaging) y **emails** de confirmación/recordatorio (Cloud Functions + extensión de email).
3. **Pago online** (Stripe) para señal de reserva.
4. **Cloud Functions** para reservas, lista de espera y puntos.
5. Panel de gestión en más idiomas.
