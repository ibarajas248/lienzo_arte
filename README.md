# Lienzo colaborativo

Aplicacion web de dibujo colaborativo en tiempo real, montada sobre Node.js,
Express, Socket.io y MongoDB. El lienzo esta optimizado para crecer en vertical:
el ancho se mantiene fijo y el contenido se guarda por tiles para cargar solo la
zona visible.

URL publica actual:

```text
https://168-231-67-54.sslip.io/
```

> Nota de seguridad: no documentar ni subir contrasenas, claves privadas, tokens,
> archivos `.env` ni `firebase-service-account.json`. El archivo de servicio de
> Firebase esta ignorado por git y debe mantenerse privado.

## Estado actual

- Acceso anonimo habilitado temporalmente.
- Login con Google opcional mediante Firebase Auth.
- Backend Node.js expuesto detras de Nginx.
- MongoDB local en el servidor.
- HTTPS activo mediante Let's Encrypt usando `sslip.io`.
- Lienzo blanco para el area dibujable.
- Fondo oscuro fuera del ancho del lienzo.
- Dibujo en tiempo real mediante Socket.io.
- Carga bajo demanda por tiles.
- Soporte para insertar imagenes JPG, PNG y WebP como bloques vectorizados.
- Navegador/minimapa lateral con miniaturas reales proporcionadas al ancho y
  scroll interno para saltar rapido por el alto del lienzo.

## Caracteristicas principales

- Dibujo colaborativo en tiempo real.
- Lienzo vertical escalable.
- Pan, zoom y centrado de vista.
- Navegador lateral tipo minimapa con preview proporcionado al ancho,
  scroll interno y click/drag sobre la posicion vertical.
- Borrador.
- Limpieza completa del lienzo.
- Persistencia en MongoDB.
- Carga solo de tiles visibles.
- Insercion de imagenes:
  - el usuario selecciona una imagen;
  - la imagen aparece flotante;
  - el usuario la mueve con el mouse;
  - al hacer click se coloca;
  - se reduce a una paleta corta de colores;
  - se convierte a rectangulos vectoriales;
  - solo se guardan bloques de color en MongoDB, no el archivo original.

## Stack tecnico

- Node.js
- Express
- Socket.io
- MongoDB
- Mongoose
- Firebase Admin para validar tokens de Google
- Firebase Web SDK para iniciar sesion desde el navegador
- Nginx como reverse proxy
- Certbot / Let's Encrypt para SSL

## Estructura del proyecto

```text
lienzo/
  public/
    index.html        Interfaz principal
    app.js            Cliente canvas, tiles, socket, imagenes vectorizadas
    style.css         Estilos de UI y lienzo
  models/
    Stroke.js         Modelo legacy de trazos individuales
    StrokeBatch.js    Modelo actual por lotes/tiles
    TileSnapshot.js   Metadata de snapshots aplanadas por tile
  scripts/
    generate-tile-snapshots.js Generador de snapshots WebP por tile
    load-test-socket.js        Prueba de carga con clientes Socket.io
  canvas-control.json Configuracion del ancho y entrada inicial
  firebase-web-config.example.json Ejemplo de config publica Firebase Web
  server.js           Backend, API, Socket.io y persistencia
  package.json        Scripts y dependencias
```

## Instalacion local

Requisitos:

- Node.js
- MongoDB local o accesible por URI

Instalar dependencias:

```bash
npm install
```

Crear o revisar `canvas-control.json`:

```json
{
  "width": 1280,
  "height": 20400,
  "entryScrollY": 0
}
```

Ejecutar:

```bash
npm start
```

Por defecto el servidor escucha en:

```text
http://localhost:3000
```

## Variables de entorno

El backend puede configurarse con:

```bash
PORT=3000
HOST=127.0.0.1
MONGODB_URI=mongodb://127.0.0.1:27017/lienzoDB
FIREBASE_WEB_API_KEY=...
FIREBASE_WEB_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
FIREBASE_WEB_PROJECT_ID=tu-proyecto
FIREBASE_WEB_STORAGE_BUCKET=tu-proyecto.appspot.com
FIREBASE_WEB_MESSAGING_SENDER_ID=...
FIREBASE_WEB_APP_ID=...
```

Si no se define `MONGODB_URI`, usa:

```text
mongodb://127.0.0.1:27017/lienzoDB
```

## Login con Google

El servidor usa dos configuraciones distintas de Firebase:

- `firebase-service-account.json`: privado, solo para el backend. Sirve para
  validar tokens con Firebase Admin.
- `firebase-web-config.json`: publico, usado por el navegador para abrir Google
  Login. No contiene la clave privada del service account.

Para activarlo, copia el ejemplo:

```bash
cp firebase-web-config.example.json firebase-web-config.json
```

Luego pega la configuracion web de Firebase Console en
`firebase-web-config.json`. Tambien puedes usar variables de entorno con los
nombres `FIREBASE_WEB_*` mostrados arriba.

En Firebase Console, agrega como dominio autorizado:

```text
168-231-67-54.sslip.io
```

El acceso como invitado sigue habilitado. Si el usuario entra con Google, el
cliente envia el ID token por Socket.io y el backend lo valida con Firebase
Admin. Para hacer obligatorio el login mas adelante, hay que rechazar sockets
sin token en el middleware `io.use(...)` de `server.js`.

### Herramientas admin locales

El usuario admin puede usar **Calco** desde el menu. Esta herramienta carga una
imagen JPG/PNG/WebP solo en el navegador del admin, con opacidad y tamano
ajustables. La imagen se renderiza como referencia translucida debajo de los
trazos para poder pintar encima, pero no se guarda en MongoDB, no se emite por
Socket.io y no forma parte del lienzo ni de las snapshots. Al ocultarla,
quitarla, cerrar sesion o recargar la pagina desaparece.

### Pincel de presion

Los usuarios autenticados pueden activar **Presion** desde el menu. Este modo
solo dibuja cuando el navegador recibe eventos de un lapiz/tableta
digitalizadora (`pointerType: "pen"`) con presion. La presion modifica el
grosor y la opacidad del segmento guardado.

## Configuracion del lienzo

El archivo `canvas-control.json` controla:

- `width`: ancho fijo del lienzo en coordenadas de mundo.
- `height`: altura de referencia inicial.
- `entryScrollY`: posicion vertical inicial al entrar.

Actualmente el proyecto esta pensado para crecer principalmente en vertical:

- `x` debe estar entre `0` y `width`.
- `y` empieza en `0` y crece hacia abajo.
- el backend acepta coordenadas verticales muy grandes mediante
  `WORLD_COORD_LIMIT`.

Para agregar espacio arriba sin usar coordenadas negativas, se debe:

1. aumentar `height` en multiplos de `1024`;
2. mover los datos existentes hacia abajo por esa misma cantidad;
3. sumar `1` a `tileY` por cada tile nuevo agregado arriba.

Con este modelo, el espacio nuevo de arriba queda en `y=0..1023` y todo el
dibujo historico pasa a empezar desde `y=1024`.

El tile actual mide:

```text
1024 x 1024
```

Con un ancho de `1280`, los tiles horizontales validos son:

```text
tileX = 0
tileX = 1
```

El eje vertical crece con:

```text
tileY >= 0
```

El tile superior actual usa:

```text
0:0
1:0
```

## Modelo de datos

La coleccion principal actual es:

```text
strokebatches
```

Modelo:

```js
{
  canvasId: "main",
  tileX: Number,
  tileY: Number,
  segments: [Segment],
  user_email: "anonymous",
  createdAt: Date
}
```

Indice principal:

```js
{ canvasId: 1, tileX: 1, tileY: 1, createdAt: 1 }
{ canvasId: 1, tileY: -1 }
```

### Segmento tipo linea

Usado para trazos normales y borrador:

```js
{
  kind: "line",
  x0: Number,
  y0: Number,
  x1: Number,
  y1: Number,
  color: "#00ffcc" | "eraser",
  size: Number,
  opacity: Number,
  order: Number
}
```

`opacity` es opcional. El pincel de presion lo usa para que una presion baja
sea mas suave y una presion alta quede mas remarcada. Los trazos antiguos sin
ese campo se interpretan con opacidad `1`.

### Segmento tipo rectangulo

Usado para imagenes vectorizadas:

```js
{
  kind: "rect",
  x: Number,
  y: Number,
  width: Number,
  height: Number,
  color: "#aabbcc",
  order: Number
}
```

Las imagenes no se guardan como JPG/PNG/WebP en la base de datos. Se convierten
en rectangulos de color para reducir peso y permitir renderizado por tiles.

El campo `order` define el orden visual global. Es importante porque el lienzo
carga varios tiles a la vez; sin ese valor, un segmento viejo de un tile vecino
podria dibujarse despues de un trazo nuevo y parecer que quedo por encima.

### Snapshots por tile

Para el usuario normal, la carga no depende de reconstruir todas las capas
historicas. El backend puede generar una imagen aplanada por tile en:

```text
public/snapshots/main/tile-X-Y.webp
```

La coleccion `tilesnapshots` registra:

```js
{
  canvasId: "main",
  tileX: Number,
  tileY: Number,
  upToOrder: Number,
  segmentCount: Number,
  width: Number,
  height: Number,
  path: "/snapshots/main/tile-X-Y.webp",
  format: "webp",
  mimeType: "image/webp",
  byteSize: Number,
  generatedAt: Date
}
```

El cliente publico carga:

```text
snapshot aplanada + segmentos nuevos con order > upToOrder
```

Los trazos completos siguen en `strokebatches` para una futura vista de
administrador donde se puedan auditar o gestionar contribuciones.

Generar snapshots:

```bash
npm run snapshots:generate
npm run minimap:generate
```

`snapshots:generate` crea WebP por tile por defecto. Si necesitas volver a SVG
para diagnostico puedes ejecutar `SNAPSHOT_FORMAT=svg npm run snapshots:generate`.

`minimap:generate` crea una WebP pequena en
`public/snapshots/main/minimap.webp`. El navegador lateral carga esa imagen
unica en vez de renderizar muchas snapshots dentro del navegador pequeno.

## Imagenes vectorizadas

Flujo actual:

1. El usuario abre el menu.
2. Pulsa `Imagen`.
3. Selecciona un archivo JPG, PNG o WebP.
4. La imagen aparece flotante sobre el lienzo.
5. El usuario mueve el mouse para ubicarla.
6. Click para soltarla.
7. El navegador la reduce y vectoriza.
8. Se guardan rectangulos de color por tiles.

Parametros importantes en `public/app.js`:

```js
MAX_IMAGE_BYTES = 12 * 1024 * 1024
IMAGE_MAX_WIDTH = 760
IMAGE_MAX_HEIGHT = 1400
IMAGE_CELL_SIZE = 3
IMAGE_COLOR_COUNT = 24
IMAGE_KMEANS_ITERATIONS = 4
IMAGE_PALETTE_SAMPLE_LIMIT = 9000
IMAGE_WHITE_THRESHOLD = 252
IMAGE_SEND_CHUNK_SIZE = 500
```

Esto busca equilibrio entre calidad visual, peso en MongoDB y fluidez.

## API HTTP

### `GET /api/health`

Devuelve estado del backend y MongoDB.

Ejemplo:

```json
{
  "ok": true,
  "mongoReadyState": 1,
  "tileSize": 1024,
  "batchCount": 1740
}
```

### `GET /api/canvas-control`

Devuelve la configuracion actual del lienzo:

```json
{
  "width": 1280,
  "height": 20400,
  "entryScrollY": 0,
  "tileSize": 1024,
  "canvasId": "main"
}
```

### `GET /api/firebase-config`

Devuelve la configuracion publica de Firebase Web si esta disponible. No expone
el `firebase-service-account.json`.

Respuesta activa:

```json
{
  "enabled": true,
  "config": {
    "apiKey": "...",
    "authDomain": "tu-proyecto.firebaseapp.com",
    "projectId": "tu-proyecto",
    "appId": "..."
  }
}
```

Respuesta sin configurar:

```json
{
  "enabled": false,
  "missing": ["apiKey"]
}
```

### `GET /api/tiles?tiles=0:0,1:0`

Carga la snapshot aplanada de los tiles solicitados y solo los segmentos
posteriores a esa snapshot.
Cuando el navegador acepta `gzip`, el backend comprime respuestas grandes para
acelerar la carga de dibujos pesados.

Respuesta:

```json
{
  "canvasId": "main",
  "tileSize": 1024,
  "tiles": [
    {
      "tileX": 0,
      "tileY": 0,
      "snapshot": {
        "url": "/snapshots/main/tile-0-0.webp?v=1710000000000",
        "upToOrder": 1710000000000,
        "segmentCount": 12000,
        "width": 1024,
        "height": 1024
      },
      "segments": []
    }
  ]
}
```

### `GET /api/canvas-overview`

Devuelve un resumen liviano del lienzo para el navegador/minimapa. No devuelve
trazos ni capas completas; devuelve alto estimado, densidad por fila y rutas de
snapshots aplanadas para pintar una miniatura real del lienzo.

Respuesta:

```json
{
  "canvasId": "main",
  "width": 1280,
  "height": 60416,
  "configuredHeight": 21424,
  "tileSize": 1024,
  "rows": [
    {
      "tileY": 0,
      "tileCount": 2,
      "segmentCount": 10000,
      "byteSize": 850000,
      "columns": [0, 1]
    }
  ],
  "snapshotTiles": [
    {
      "tileX": 0,
      "tileY": 0,
      "url": "/snapshots/main/tile-0-0.webp?v=1710000000000",
      "width": 1024,
      "height": 1024,
      "segmentCount": 10000,
      "byteSize": 850000
    }
  ],
  "truncatedSnapshots": false,
  "truncated": false
}
```

El cliente usa este endpoint para pintar el minimapa lateral con snapshots
reducidas. El preview conserva la proporcion usando el ancho disponible; si el
lienzo es muy alto, el minimapa usa scroll interno en vez de aplastar todo en
una sola vista.

Para mantener fluidez, el minimapa no se redibuja en cada frame del lienzo
principal. Se actualiza de forma limitada y usa una snapshot WebP pequena, no
trazos historicos completos ni muchas imagenes pesadas en el cliente.

### `POST /api/admin/export-svg`

Exporta un area rectangular del lienzo como SVG vectorial. Requiere token
Firebase de un admin en el header:

```text
Authorization: Bearer <idToken>
```

Body:

```json
{
  "area": {
    "x": 0,
    "y": 0,
    "width": 1280,
    "height": 3000
  }
}
```

Solo `ivanbarajashurtado@gmail.com` tiene acceso por defecto. El export usa los
segmentos originales de MongoDB, no las snapshots WebP, para conservar calidad
vectorial. Si el area contiene demasiados segmentos, el servidor responde `413`
y se debe seleccionar una zona mas pequena.

### `POST /api/admin/export-jpg`

Exporta la misma area seleccionada como JPG. Tambien requiere token Firebase de
admin. Este endpoint usa las snapshots WebP por tile como fuente rapida, no
reconstruye trazo por trazo desde `strokebatches`.

Si el area es enorme, el servidor mantiene toda la zona seleccionada pero puede
reducir la escala de salida para evitar bloquear memoria/CPU. La imagen refleja
el ultimo snapshot generado; trazos posteriores al snapshot apareceran despues
de ejecutar `npm run snapshots:generate`.

## Eventos Socket.io

### Cliente -> servidor

`viewport-tiles`

El cliente informa que tiles tiene visibles para entrar/salir de salas:

```js
socket.emit("viewport-tiles", {
  tiles: ["0:0", "1:0", "0:1"]
});
```

`draw-batch`

Envia un lote de segmentos:

```js
socket.emit("draw-batch", [
  {
    kind: "line",
    x0: 10,
    y0: 10,
    x1: 20,
    y1: 20,
    color: "#00ffcc",
    size: 5
  }
]);
```

`clear`

Borra el lienzo completo:

```js
socket.emit("clear");
```

### Servidor -> cliente

`world-init`

Envia la configuracion inicial del lienzo.

`tile-draw-batch`

Emite segmentos nuevos a los clientes que estan viendo el tile.

`clear`

Ordena limpiar cache local del cliente.

## Escalabilidad

La escalabilidad se apoya en tres ideas:

1. No cargar todo el lienzo.
2. Guardar por tiles.
3. Enviar lotes pequenos y solo a quien ve la zona afectada.

Limites configurados en `server.js`:

```js
MAX_BATCH_STROKES = 500
MAX_TILE_SUBSCRIPTIONS = 120
MAX_TILE_REQUESTS = 120
MAX_SEGMENTS_PER_TILE = 30000
SAVE_INTERVAL_MS = 1000
BATCH_DOC_SEGMENT_LIMIT = 500
```

El servidor agrupa segmentos en memoria por tile y los guarda cada segundo.
Esto reduce escrituras pequenas en MongoDB.

## Despliegue actual

Servidor actual:

```text
168.231.67.54
```

Ruta de la app:

```text
/opt/lienzo
```

Servicio systemd:

```text
lienzo
```

MongoDB:

```text
mongodb://127.0.0.1:27017/lienzoDB
```

Proxy:

```text
Nginx -> 127.0.0.1:3000
```

URL HTTPS:

```text
https://168-231-67-54.sslip.io/
```

Comandos utiles en el servidor:

```bash
systemctl status lienzo --no-pager
systemctl restart lienzo
journalctl -u lienzo -n 100 --no-pager
curl -fsS http://127.0.0.1/api/health
```

Verificar MongoDB:

```bash
systemctl status mongod --no-pager
mongosh "mongodb://127.0.0.1:27017/lienzoDB"
```

Dentro de `mongosh`:

```js
db.stats(1024 * 1024)
db.strokebatches.estimatedDocumentCount()
db.strokebatches.getIndexes()
```

## Despliegue manual de cambios

Subir archivos modificados a:

```text
/opt/lienzo
```

Si se cambia backend o modelos:

```bash
systemctl restart lienzo
curl -fsS http://127.0.0.1/api/health
```

Si solo se cambia `public/app.js`, `public/index.html` o `public/style.css`,
puede bastar con subir los archivos. Conviene cambiar el query string de assets:

```html
app.js?v=nueva-version
style.css?v=nueva-version
```

Asi se evita cache vieja en navegadores.

## Seguridad y pendientes

Pendientes recomendados antes de uso comercial fuerte:

- Agregar terminos de uso antes de permitir dibujar.
- Guardar aceptacion de terminos en MongoDB.
- Implementar login completo.
- Agregar moderacion de contenido.
- Agregar rate limiting por IP o sesion.
- Agregar backups automaticos de MongoDB.
- Agregar panel de exportacion para prints.
- Agregar sistema de versiones/cortes del lienzo para vender drops.

## Derechos y monetizacion

El proyecto puede monetizarse con prints, drops, patrocinios o galerias. Para
vender obras colectivas de forma mas segura, los usuarios deberian aceptar
terminos antes de dibujar, otorgando permiso comercial sobre sus aportes.

Sin esos terminos, no conviene asumir que todos los derechos comerciales de los
trazos de terceros quedan automaticamente cedidos.

## Troubleshooting

### Otra persona no puede abrir el sitio

Verificar:

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://168-231-67-54.sslip.io/
systemctl status nginx --no-pager
systemctl status lienzo --no-pager
```

### La app carga pero no dibuja en tiempo real

Verificar Socket.io y logs:

```bash
journalctl -u lienzo -n 100 --no-pager
curl -fsS http://127.0.0.1/api/health
```

### La base de datos crece mucho

Revisar:

```js
db.stats(1024 * 1024)
db.strokebatches.estimatedDocumentCount()
db.strokebatches.aggregate([
  { $project: { tileX: 1, tileY: 1, segmentCount: { $size: "$segments" } } },
  { $sort: { segmentCount: -1 } },
  { $limit: 20 }
])
```

### Las imagenes pesan demasiado

Ajustar en `public/app.js`:

```js
IMAGE_CELL_SIZE
IMAGE_COLOR_COUNT
IMAGE_MAX_WIDTH
IMAGE_MAX_HEIGHT
```

Mas calidad implica mas segmentos y mas peso en MongoDB.

## Comandos de verificacion local

```bash
node --check server.js
node --check public/app.js
node --check models/StrokeBatch.js
npm start
```

## Notas importantes

- `clear` borra todo el lienzo actual.
- `Stroke.js` es un modelo legacy; la coleccion actual optimizada es
  `strokebatches`.
- El acceso anonimo esta habilitado temporalmente.
- El archivo `firebase-service-account.json` no debe compartirse.
- Las imagenes no se guardan como archivo original, sino como bloques
  vectorizados.
