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
      hoja.appendRow(['ID', 'Nombre', 'Precio', 'Categoria', 'MarcaCompatible', 'ModeloCompatible', 'Existencias']);
    }

    let valores = hoja.getDataRange().getValues();
    const nuevasColumnas = ['MarcaCompatible', 'ModeloCompatible', 'Existencias'];
    nuevasColumnas.forEach(function (nombre) {
      if (valores[0].map(normalizar).indexOf(normalizar(nombre)) < 0) {
        const columna = valores[0].length + 1;
        hoja.getRange(1, columna).setValue(nombre);
        valores[0].push(nombre);
      }
    });
    valores = hoja.getDataRange().getValues();
    const encabezados = valores[0].map(normalizar);
    const columnas = {
      id: encabezados.indexOf('id'),
      nombre: encabezados.indexOf('nombre'),
      precio: encabezados.indexOf('precio'),
      categoria: encabezados.indexOf('categoria'),
      marcaCompatible: encabezados.indexOf('marcacompatible'),
      modeloCompatible: encabezados.indexOf('modelocompatible'),
      existencias: encabezados.indexOf('existencias')
    };
    if (Object.values(columnas).some(function (indice) { return indice < 0; })) {
      return respuesta({ ok: false, error: 'La hoja requiere las columnas ID, Nombre, Precio y Categoria.' });
    }

    const accion = data.action || 'create';
    if (accion === 'list') {
      const productos = valores.slice(1).filter(function (fila) {
        return fila.some(function (celda) { return celda !== ''; });
      }).map(function (fila, indice) {
        return {
          id: fila[columnas.id] || indice + 1,
          nombre: String(fila[columnas.nombre] || ''),
          precio: Number(fila[columnas.precio]) || 0,
          categoria: String(fila[columnas.categoria] || ''),
          marcaCompatible: String(fila[columnas.marcaCompatible] || ''),
          modeloCompatible: String(fila[columnas.modeloCompatible] || ''),
          existencias: Number(fila[columnas.existencias]) || 0
        };
      });
      return respuesta({ ok: true, productos: productos });
    }
    if (accion === 'delete') {
      const fila = buscarFila(valores, columnas.id, data.id);
      if (fila < 0) return respuesta({ ok: false, error: 'Producto no encontrado.' });
      hoja.deleteRow(fila + 1);
      return respuesta({ ok: true, id: data.id });
    }

    const nombre = String(data.nombre || '').trim();
    const categoria = String(data.categoria || '').trim();
    const precio = Number(data.precio);
    const marcaCompatible = String(data.marcaCompatible || '').trim();
    const modeloCompatible = String(data.modeloCompatible || '').trim();
    const existencias = data.existencias === undefined ? 0 : Number(data.existencias);
    if (!nombre || !categoria || !Number.isFinite(precio) || precio < 0) {
      return respuesta({ ok: false, error: 'Completa nombre, precio válido y categoría.' });
    }
    if (!Number.isSafeInteger(existencias) || existencias < 0) {
      return respuesta({ ok: false, error: 'Las existencias deben ser un número entero mayor o igual a cero.' });
    }
    const producto = { nombre: nombre, precio: precio, categoria: categoria, marcaCompatible: marcaCompatible, modeloCompatible: modeloCompatible, existencias: existencias };

    if (accion === 'create') {
      const bloqueo = LockService.getScriptLock();
      bloqueo.waitLock(10000);
      try {
        const id = siguienteId(hoja, columnas.id);
        const nuevaFila = Array(valores[0].length).fill('');
        nuevaFila[columnas.id] = id;
        nuevaFila[columnas.nombre] = nombre;
        nuevaFila[columnas.precio] = precio;
        nuevaFila[columnas.categoria] = categoria;
        nuevaFila[columnas.marcaCompatible] = marcaCompatible;
        nuevaFila[columnas.modeloCompatible] = modeloCompatible;
        nuevaFila[columnas.existencias] = existencias;
        hoja.appendRow(nuevaFila);
        return respuesta({ ok: true, producto: Object.assign({ id: id }, producto) });
      } finally {
        bloqueo.releaseLock();
      }
    }

    if (accion === 'update') {
      const id = String(data.id || '');
      const fila = buscarFila(valores, columnas.id, id);
      if (fila < 0) return respuesta({ ok: false, error: 'Producto no encontrado.' });
      const numeroFila = fila + 1;
      hoja.getRange(numeroFila, columnas.id + 1).setValue(id);
      hoja.getRange(numeroFila, columnas.nombre + 1).setValue(nombre);
      hoja.getRange(numeroFila, columnas.precio + 1).setValue(precio);
      hoja.getRange(numeroFila, columnas.categoria + 1).setValue(categoria);
      hoja.getRange(numeroFila, columnas.marcaCompatible + 1).setValue(marcaCompatible);
      hoja.getRange(numeroFila, columnas.modeloCompatible + 1).setValue(modeloCompatible);
      hoja.getRange(numeroFila, columnas.existencias + 1).setValue(existencias);
      return respuesta({ ok: true, producto: Object.assign({ id: id }, producto) });
    }

    return respuesta({ ok: false, error: 'Acción no soportada.' });
  } catch (error) {
    return respuesta({ ok: false, error: error.message });
  }
}

function normalizar(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function siguienteId(hoja, columnaId) {
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return 1;
  const ids = hoja.getRange(2, columnaId + 1, ultimaFila - 1, 1).getValues();
  const maximo = ids.reduce(function (mayor, fila) {
    const id = Number(fila[0]);
    return Number.isSafeInteger(id) && id > mayor ? id : mayor;
  }, 0);
  return maximo + 1;
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
