import { responderChat } from "../../shared/chat-core.mjs";

const SHEETS_CSV_URL = process.env.SHEETS_CSV_URL || "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5HGJDaMSk4uQZ51FAyZntKHEt6rm3s4AbxffqiTRPTEllRLW0D-cRBflEv7kKsA_a0I56PxcTjojK/pub?output=csv";

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8"
};

export const config = {
    path: ["/api/*"]
};

function json(status, body) {
    return new Response(JSON.stringify(body), { status, headers });
}

function normalizar(texto = "") {
    return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function parseCsv(csv) {
    const rows = [];
    let row = [];
    let value = "";
    let inQuotes = false;

    for (let index = 0; index < csv.length; index += 1) {
        const char = csv[index];
        const next = csv[index + 1];

        if (char === '"' && inQuotes && next === '"') {
            value += '"';
            index += 1;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
            row.push(value.trim());
            value = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n") index += 1;
            row.push(value.trim());
            if (row.some((cell) => cell !== "")) rows.push(row);
            row = [];
            value = "";
        } else {
            value += char;
        }
    }

    row.push(value.trim());
    if (row.some((cell) => cell !== "")) rows.push(row);
    return rows;
}

async function obtenerProductos() {
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const scriptToken = process.env.GOOGLE_APPS_SCRIPT_TOKEN;
    if (scriptUrl && scriptToken) {
        try {
            const liveResponse = await fetch(scriptUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "list", token: scriptToken })
            });
            if (liveResponse.ok) {
                const result = await liveResponse.json();
                if (result.ok && Array.isArray(result.productos)) return result.productos;
            }
        } catch (error) {
            console.warn("No fue posible leer directamente de Apps Script:", error.message);
        }
    }
    const response = await fetch(SHEETS_CSV_URL);
    if (!response.ok) throw new Error(`Google Sheets respondió con ${response.status}`);

    const [headersCsv, ...rows] = parseCsv(await response.text());
    const columnas = headersCsv.map(normalizar);
    const indice = (nombre) => columnas.indexOf(nombre);
    const id = indice("id");
    const nombre = indice("nombre");
    const precio = indice("precio");
    const categoria = indice("categoria");

    if ([nombre, precio, categoria].some((valor) => valor === -1)) {
        throw new Error("La hoja no tiene las columnas requeridas.");
    }

    return rows.map((fila, index) => ({
        id: fila[id] || index + 1,
        nombre: fila[nombre],
        precio: Number(fila[precio].replace(/[^0-9.-]/g, "")) || 0,
        categoria: fila[categoria]
    }));
}

function validarProducto(producto = {}) {
    const nombre = String(producto.nombre || "").trim();
    const categoria = String(producto.categoria || "").trim();
    const precio = Number(producto.precio);
    if (!nombre || !categoria || !Number.isFinite(precio) || precio < 0) {
        throw new Error("Completa nombre, precio válido y categoría.");
    }
    return { nombre, precio, categoria };
}

function credencialesValidas(usuario, password) {
    const usuarioEsperado = process.env.ADMIN_USER || "admin";
    const passwordEsperado = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN || "12345";
    return usuario === usuarioEsperado && password === passwordEsperado;
}

function passwordValido(password) {
    const passwordEsperado = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN || "12345";
    return password === passwordEsperado;
}

async function mutarProducto(accion, producto, id, password) {
    if (!passwordValido(password)) {
        const error = new Error("Sesión no válida. Inicia sesión de nuevo.");
        error.status = 401;
        throw error;
    }

    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const scriptToken = process.env.GOOGLE_APPS_SCRIPT_TOKEN;
    if (!scriptUrl || !scriptToken) {
        const error = new Error("Las escrituras no están configuradas. Revisa las variables de Netlify y el despliegue de Apps Script.");
        error.status = 503;
        throw error;
    }

    const response = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: accion, id, ...producto, token: scriptToken })
    });
    if (!response.ok) {
        const error = new Error("Google Sheets no pudo guardar los cambios.");
        error.status = 502;
        throw error;
    }
    const result = await response.json();
    if (!result.ok) {
        const error = new Error(result.error || "Google Sheets rechazó el cambio.");
        error.status = 400;
        throw error;
    }
    return result;
}

export default async (request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    const ruta = url.pathname.replace(/^\/(?:\.netlify\/functions\/api|api)/, "") || "/";

    if (ruta === "/estado") {
        return json(200, { estado: "Online", servidor: "Node.js", servicio: "Cloud API", version: "1.0" });
    }

    if (ruta === "/login") {
        if (request.method !== "POST") return json(405, { error: "Método no permitido." });
        try {
            const { usuario, password } = await request.json();
            if (!credencialesValidas(String(usuario || ""), String(password || ""))) {
                return json(401, { error: "Usuario o contraseña incorrectos." });
            }
            return json(200, { ok: true });
        } catch {
            return json(400, { error: "Solicitud de inicio de sesión inválida." });
        }
    }

    if (ruta === "/chat") {
        if (request.method !== "POST") return json(405, { error: "Método no permitido." });
        if (!passwordValido(request.headers.get("x-admin-token"))) return json(401, { error: "Inicia sesión para usar el asistente." });
        try {
            return json(200, await responderChat(await request.json(), obtenerProductos));
        } catch (error) {
            console.error("No fue posible responder el chat:", error.message);
            return json(error.status || 502, { error: error.status ? error.message : "No fue posible consultar el asistente." });
        }
    }

    const productoRoute = ruta.match(/^\/productos(?:\/([^/]+))?$/);
    if (!productoRoute) return json(404, { error: "Endpoint no encontrado." });

    const id = productoRoute[1] ? decodeURIComponent(productoRoute[1]) : null;
    const password = request.headers.get("x-admin-token");

    if (request.method === "GET") {
        if (!passwordValido(password)) return json(401, { error: "Inicia sesión para consultar los productos." });
        try {
            if (id) return json(404, { error: "Producto no encontrado." });
            let productos = await obtenerProductos();
            const busqueda = normalizar(url.searchParams.get("buscar") || url.searchParams.get("q"));
            const categoria = normalizar(url.searchParams.get("categoria"));
            if (busqueda) productos = productos.filter((producto) => normalizar(producto.nombre).includes(busqueda));
            if (categoria) productos = productos.filter((producto) => normalizar(producto.categoria) === categoria);
            return json(200, productos);
        } catch (error) {
            console.error("No fue posible obtener los productos:", error.message);
            return json(502, { error: "No fue posible obtener los productos de Google Sheets." });
        }
    }

    if (!["POST", "PUT", "DELETE"].includes(request.method)) return json(405, { error: "Método no permitido." });
    if ((request.method === "POST" && id) || (request.method !== "POST" && !id)) {
        return json(400, { error: "La ruta del producto no es válida para este método." });
    }

    try {
        const producto = request.method === "DELETE" ? {} : validarProducto(await request.json());
        const accion = request.method === "POST" ? "create" : request.method === "PUT" ? "update" : "delete";
        const result = await mutarProducto(accion, producto, id, password);
        return json(request.method === "POST" ? 201 : 200, result);
    } catch (error) {
        console.error("No fue posible modificar Google Sheets:", error.message);
        return json(error.status || 400, { error: error.message || "No fue posible guardar el cambio." });
    }
};
