# Cloud Catalog

Inventario de productos con React, API REST de Node.js, Netlify Functions y Google Sheets. Incluye login sencillo, altas, consultas, edición, eliminación, búsqueda por nombre, filtro por categoría y contador.

## Estructura

- `frontend/`: interfaz React, Netlify Function y el puente de Apps Script.
- `backend/`: API Express para desarrollo local.
- `tests/`: pruebas de contrato para la API de Netlify.
- `netlify.toml`: build y despliegue de Netlify.

## Google Sheets

La primera fila de la hoja debe tener los encabezados `ID`, `Nombre`, `Precio` y `Categoria`. Publica la hoja como CSV desde **Archivo → Compartir → Publicar en la web** para habilitar la lectura.

Para habilitar alta, edición y eliminación:

1. En la hoja, abre **Extensiones → Apps Script**.
2. Copia [`frontend/google-apps-script/Code.gs`](frontend/google-apps-script/Code.gs) en el proyecto vinculado a esa hoja.
3. En la configuración de Apps Script, crea la propiedad `WRITE_TOKEN` con un token secreto.
4. Despliega como **Aplicación web**, ejecutando como tú y con acceso para cualquier persona; copia la URL que termina en `/exec`.
5. En las variables privadas del servicio (Railway o Netlify) configura `GOOGLE_APPS_SCRIPT_URL` con esa URL y `GOOGLE_APPS_SCRIPT_TOKEN` con el mismo token de `WRITE_TOKEN`.

La cuenta propietaria del script debe tener permiso para editar la hoja. Después de copiar cambios a `Code.gs`, vuelve a desplegar una versión nueva de la aplicación web. Con la acción `list`, la API lee los productos directamente de Apps Script y muestra las altas, ediciones y eliminaciones sin esperar al CSV publicado. Si el script desplegado aún no admite `list`, la API usa el CSV como respaldo.

## Login

Configura las variables privadas `ADMIN_USER` y `ADMIN_PASSWORD` en el servicio de despliegue. En desarrollo local, los valores demostrativos son `admin` y `12345`. Cámbialos antes de publicar. El login de esta práctica no sustituye un sistema de autenticación seguro para producción.

## Asistente de inventario

Después de iniciar sesión, abre **Asistente** en la esquina inferior derecha. Responde preguntas sobre productos, precios y categorías usando una lectura nueva de Google Sheets en cada mensaje. También explica cómo usar los botones del CRUD. Para crear, editar o eliminar productos, utiliza los controles de la tabla.

Configura `OPENAI_API_KEY` como variable **privada del servidor** en Railway o Netlify y en `backend/.env` para desarrollo local. Puedes elegir otro modelo mediante `OPENAI_MODEL` (por defecto `gpt-6-luna`). Nunca uses una variable `VITE_*` para la clave: esas variables se incluyen en el navegador. Reinicia Express o vuelve a desplegar el servicio después de cambiar la configuración. El endpoint `POST /api/chat` requiere la sesión de administrador y envía el inventario actual a OpenAI para responder; el chat no modifica la hoja.

## API

- `POST /api/login`: valida usuario y contraseña.
- `GET /api/productos`: consulta productos; admite `buscar` y `categoria`.
- `POST /api/productos`: crea un producto.
- `PUT /api/productos/:id`: actualiza un producto.
- `DELETE /api/productos/:id`: elimina un producto.
- `GET /api/estado`: estado de la API.

Las operaciones de escritura requieren una sesión de administrador y se envían a Apps Script con las acciones `create`, `update` o `delete`.

## Ejecutar localmente

Requiere Node.js 22 o superior. Instala las dependencias:

```sh
npm ci --prefix backend
npm ci --prefix frontend
```

En PowerShell, copia la plantilla y completa `backend/.env` con tu URL `/exec` y el mismo token configurado como `WRITE_TOKEN` en Apps Script. Ese archivo se ignora en Git:

```powershell
Copy-Item backend/.env.example backend/.env
```

Después inicia ambos servicios en terminales separadas:

```sh
npm run start:backend
npm run start:frontend
```

La interfaz estará en `http://localhost:5173` (o el siguiente puerto libre); Express escucha en `http://localhost:3000`. Reinicia el backend después de modificar `backend/.env` para que cargue las variables.

## Comandos

- `npm test`: pruebas de contrato de la función Netlify con Sheets/Apps Script simulados.
- `npm run lint`: lint de la interfaz.
- `npm run build`: build de producción de React.


## Desplegar en Railway

1. Crea un servicio desde este repositorio de GitHub y deja la **Root Directory** en la raíz (`/`). Railway detectará el `Dockerfile`: instala las dependencias con Node.js 22, compila React y ejecuta Express. La web y `/api/*` comparten el mismo dominio; deja `VITE_API_URL` sin configurar.
2. En **Variables**, configura `ADMIN_USER`, `ADMIN_PASSWORD`, `GOOGLE_APPS_SCRIPT_URL`, `GOOGLE_APPS_SCRIPT_TOKEN` y `OPENAI_API_KEY`. Si usas otra hoja CSV, añade `SHEETS_CSV_URL`. `OPENAI_MODEL` es opcional y usa `gpt-6-luna` por defecto. No pongas claves en variables `VITE_*`.
3. En **Settings → Networking**, genera un dominio público. Railway proporciona `PORT`; el servidor escucha en ese puerto en `0.0.0.0`. Puedes usar `/api/estado` como ruta de healthcheck.

Para leer al instante, el Apps Script desplegado debe incluir la acción `list`. El CSV publicado sirve de respaldo. Las escrituras necesitan que Apps Script esté desplegado y que `GOOGLE_APPS_SCRIPT_TOKEN` coincida con la propiedad `WRITE_TOKEN` del script. El chat requiere una clave válida de OpenAI.

## Desplegar en Netlify

Importa el repositorio de GitHub. Netlify utiliza `netlify.toml` para ejecutar `npm run build` dentro de `frontend` y publicar `frontend/dist`. Configura las variables privadas descritas arriba y vuelve a desplegar.