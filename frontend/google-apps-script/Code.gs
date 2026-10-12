/*
 * Pega este archivo en script.google.com, como proyecto VINCULADO a tu hoja.
 * En Configuración del proyecto > Propiedades del script crea WRITE_TOKEN.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('WRITE_TOKEN');
    if (!token || data.token !== token) return respuesta({ ok: false, error: 'No autorizado' });

    const hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (hoja.getLastRow() === 0) {
      hoja.appendRow(['ID', 'Nombre', 'Precio', 'Categoria']);
    }

    const valores = hoja.getDataRange().getValues();
    const encabezados = valores[0].map(normalizar);
    const columnas = {
      id: encabezados.indexOf('id'),
      nombre: encabezados.indexOf('nombre'),
      precio: encabezados.indexOf('precio'),
      categoria: encabezados.indexOf('categoria')
    };
    if (Object.values(columnas).some(function (indice) { return indice < 0; })) {
      return respuesta({ ok: false, error: 'La hoja requiere las columnas ID, Nombre, Precio y Categoria.' });
    }

    const accion = data.action || 'create';
    if (accion === 'delete') {
      const fila = buscarFila(valores, columnas.id, data.id);
      if (fila < 0) return respuesta({ ok: false, error: 'Producto no encontrado.' });
      hoja.deleteRow(fila + 1);
      return respuesta({ ok: true, id: data.id });
    }

    const nombre = String(data.nombre || '').trim();
    const categoria = String(data.categoria || '').trim();
    const precio = Number(data.precio);
    if (!nombre || !categoria || !Number.isFinite(precio) || precio < 0) {
      return respuesta({ ok: false, error: 'Completa nombre, precio válido y categoría.' });
    }

    const id = accion === 'create' ? Utilities.getUuid() : String(data.id || '');
    if (accion === 'create') {
      const nuevaFila = Array(valores[0].length).fill('');
      nuevaFila[columnas.id] = id;
      nuevaFila[columnas.nombre] = nombre;
      nuevaFila[columnas.precio] = precio;
      nuevaFila[columnas.categoria] = categoria;
      hoja.appendRow(nuevaFila);
      return respuesta({ ok: true, producto: { id: id, nombre: nombre, precio: precio, categoria: categoria } });
    }

    if (accion === 'update') {
      const fila = buscarFila(valores, columnas.id, id);
      if (fila < 0) return respuesta({ ok: false, error: 'Producto no encontrado.' });
      const numeroFila = fila + 1;
      hoja.getRange(numeroFila, columnas.id + 1).setValue(id);
      hoja.getRange(numeroFila, columnas.nombre + 1).setValue(nombre);
      hoja.getRange(numeroFila, columnas.precio + 1).setValue(precio);
      hoja.getRange(numeroFila, columnas.categoria + 1).setValue(categoria);
      return respuesta({ ok: true, producto: { id: id, nombre: nombre, precio: precio, categoria: categoria } });
    }

    return respuesta({ ok: false, error: 'Acción no soportada.' });
  } catch (error) {
    return respuesta({ ok: false, error: error.message });
  }
}

function normalizar(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function buscarFila(valores, columnaId, id) {
  for (var indice = 1; indice < valores.length; indice += 1) {
    var idGuardado = valores[indice][columnaId] || String(indice);
    if (String(idGuardado) === String(id)) return indice;
  }
  return -1;
}

function respuesta(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
