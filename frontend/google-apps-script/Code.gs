/*
 * Pega este archivo en script.google.com, como proyecto VINCULADO a tu hoja.
 * En Configuración del proyecto > Propiedades del script crea WRITE_TOKEN.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('WRITE_TOKEN');
    if (!token || data.token !== token) return respuesta({ ok: false, error: 'No autorizado' });

    const nombre = String(data.nombre || '').trim();
    const categoria = String(data.categoria || '').trim();
    const precio = Number(data.precio);
    if (!nombre || !categoria || !Number.isFinite(precio) || precio < 0) {
      return respuesta({ ok: false, error: 'Datos de producto inválidos' });
    }

    const hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    hoja.appendRow([hoja.getLastRow(), nombre, precio, categoria]);
    return respuesta({ ok: true });
  } catch (error) {
    return respuesta({ ok: false, error: error.message });
  }
}

function respuesta(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
