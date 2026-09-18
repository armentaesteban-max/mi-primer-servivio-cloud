# Catálogo de productos Cloud

Proyecto listo para desplegarse en Netlify. La API se publica como una Netlify Function y consulta Google Sheets directamente, por lo que no requiere Render, Railway ni ninguna URL adicional.

## Despliegue

1. Sube este repositorio a GitHub.
2. En Netlify elige **Add new site → Import an existing project** y selecciona el repositorio.
3. Netlify detecta `netlify.toml`: usa `frontend` como base, ejecuta `npm run build` y publica `dist`.
4. Pulsa **Deploy site**. No necesitas configurar variables de entorno.

La URL pública tendrá disponibles:

- `/api/productos`: lee los productos de Google Sheets.
- `/api/productos?buscar=mouse`: busca por nombre.
- `/api/productos?categoria=Accesorios`: filtra por categoría.
- `/api/estado`: devuelve el estado de Cloud API.

Los cambios y nuevos productos de Google Sheets se verán al usar **Actualizar datos** o recargar la página. Si la hoja requiere publicación manual, usa **Archivo → Compartir → Publicar en la web** en Google Sheets después de editarla.

## Agregar productos desde la web

El panel **Agregar producto** está preparado para escribir en la hoja de forma segura. Debes hacer esta configuración una sola vez:

1. Abre tu Google Sheet y entra a **Extensiones → Apps Script**.
2. Reemplaza el código con [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
3. En **Configuración del proyecto → Propiedades del script**, crea `WRITE_TOKEN` con una clave larga y privada.
4. Pulsa **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: tú. Acceso: cualquier persona. Copia la URL que termina en `/exec`.
5. En Netlify, entra a **Project configuration → Environment variables** y agrega:
   - `GOOGLE_APPS_SCRIPT_URL`: URL `/exec` copiada.
   - `GOOGLE_APPS_SCRIPT_TOKEN`: el mismo valor de `WRITE_TOKEN`.
   - `ADMIN_TOKEN`: otra clave larga. Esta es la que escribirás en el panel de administración.
6. Haz un nuevo deploy en Netlify.

Las claves nunca se incluyen en el frontend ni se guardan en el repositorio.

## Desarrollo local

- `npm run start:backend` inicia Express en `http://localhost:3000`.
- `npm run start:frontend` inicia React, configurado para consumir esa API local.
