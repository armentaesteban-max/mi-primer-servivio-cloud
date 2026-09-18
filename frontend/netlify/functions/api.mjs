const SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5HGJDaMSk4uQZ51FAyZntKHEt6rm3s4AbxffqiTRPTEllRLW0D-cRBflEv7kKsA_a0I56PxcTjojK/pub?output=csv";

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8"
};

export const config = {
    path: ["/api/productos", "/api/estado"]
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

export default async (request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    const ruta = url.pathname.replace(/^\/(?:\.netlify\/functions\/api|api)/, "") || "/";

    if (ruta === "/estado") {
        return json(200, { estado: "Online", servidor: "Node.js", servicio: "Cloud API", version: "1.0" });
    }

    if (ruta !== "/productos") return json(404, { error: "Endpoint no encontrado." });

    try {
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
};
