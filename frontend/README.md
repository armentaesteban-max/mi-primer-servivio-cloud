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

## Desarrollo local

- `npm run start:backend` inicia Express en `http://localhost:3000`.
- `npm run start:frontend` inicia React, configurado para consumir esa API local.
