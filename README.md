# Móvil Stock

Inventario de accesorios para celulares con React, API REST de Node.js, Netlify Functions y Google Sheets. Incluye login sencillo, altas, consultas, edición, eliminación, búsqueda por nombre o compatibilidad, filtro por tipo y existencias.

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

La cuenta propietaria del script debe tener permiso para editar la hoja. Después de copiar cambios a `Code.gs`, vuelve a desplegar una versión nueva de la aplicación web. El script añade automáticamente las columnas `MarcaCompatible`, `ModeloCompatible` y `Existencias` a la hoja existente. Conserva las columnas `ID`, `Nombre`, `Precio` y `Categoria`; los registros anteriores quedan con compatibilidad vacía y cero existencias hasta que los edites. Con la acción `list`, la API lee los productos directamente de Apps Script y muestra las altas, ediciones y eliminaciones sin esperar al CSV publicado. Si el script desplegado aún no admite `list`, la API usa el CSV como respaldo.

## Login

Configura las variables privadas `ADMIN_USER` y `ADMIN_PASSWORD` en el servicio de despliegue. En desarrollo local, los valores demostrativos son `admin` y `12345`. Cámbialos antes de publicar. El login de esta práctica no sustituye un sistema de autenticación seguro para producción.

## Asistente de inventario

Después de iniciar sesión, abre **Asistente** en la esquina inferior derecha. Responde preguntas sobre accesorios, compatibilidad, precios y existencias usando una lectura nueva de Google Sheets en cada mensaje. Solo afirma compatibilidad cuando la marca y el modelo están registrados. Para crear, editar o eliminar accesorios, utiliza los controles de la tabla.

Configura `OPENAI_API_KEY` como variable **privada del servidor** en Railway o Netlify y en `backend/.env` para desarrollo local. Puedes elegir otro modelo mediante `OPENAI_MODEL` (por defecto `gpt-6-luna`). Nunca uses una variable `VITE_*` para la clave: esas variables se incluyen en el navegador. Reinicia Express o vuelve a desplegar el servicio después de cambiar la configuración. El endpoint `POST /api/chat` requiere la sesión de administrador y envía el inventario actual a OpenAI para responder; el chat no modifica la hoja.

**Facturación del asistente:** `OPENAI_API_KEY` usa la API de OpenAI, cuya facturación y límites son independientes del plan ChatGPT/Codex. Si aparece «agotó el saldo de su cuenta API», revisa el saldo y los límites de la organización propietaria de esa clave en la plataforma de OpenAI. Si aparece «límite de solicitudes», revisa los límites de velocidad de esa organización o espera antes de intentar de nuevo. El archivo `backend/.env` local no incluye actualmente una clave API; una clave configurada en Railway o Netlify solo se puede comprobar desde las variables privadas de ese despliegue.

## API

- `POST /api/login`: valida usuario y contraseña.
- `GET /api/productos`: consulta accesorios; `buscar` revisa nombre, marca y modelo compatibles; `categoria` filtra por tipo.
- `POST /api/productos`: crea un producto.
- `PUT /api/productos/:id`: actualiza un producto.
- `DELETE /api/productos/:id`: elimina un producto.
- `GET /api/estado`: estado de la API.

Las operaciones de escritura requieren una sesión de administrador y se envían a Apps Script con las acciones `create`, `update` o `delete`.

Cada accesorio tiene `nombre`, `categoria` (tipo, por ejemplo Fundas o Cargadores), `precio`, `marcaCompatible`, `modeloCompatible` y `existencias`. Para accesorios universales, usa `Universal` como marca compatible. En la interfaz, marca y modelo se pueden dejar vacíos si aún no conoces la compatibilidad; el asistente no hará suposiciones sobre ellos.

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
