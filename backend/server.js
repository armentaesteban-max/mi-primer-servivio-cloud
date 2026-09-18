const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SHEETS_CSV_URL = process.env.SHEETS_CSV_URL || "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5HGJDaMSk4uQZ51FAyZntKHEt6rm3s4AbxffqiTRPTEllRLW0D-cRBflEv7kKsA_a0I56PxcTjojK/pub?output=csv";

function parseCsv(csv) {
    const rows = []; let row = []; let value = ""; let inQuotes = false;
    for (let i = 0; i < csv.length; i += 1) {
        const char = csv[i]; const next = csv[i + 1];
        if (char === '"' && inQuotes && next === '"') { value += '"'; i += 1; }
        else if (char === '"') inQuotes = !inQuotes;
        else if (char === "," && !inQuotes) { row.push(value.trim()); value = ""; }
        else if ((char === "\n" || char === "\r") && !inQuotes) { if (char === "\r" && next === "\n") i += 1; row.push(value.trim()); if (row.some((cell) => cell !== "")) rows.push(row); row = []; value = ""; }
        else value += char;
    }
    row.push(value.trim()); if (row.some((cell) => cell !== "")) rows.push(row);
    return rows;
}

function normalizar(texto = "") { return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }

async function obtenerProductos() {
    const response = await fetch(SHEETS_CSV_URL);
    if (!response.ok) throw new Error(`Google Sheets respondió con ${response.status}`);
    const [headers, ...rows] = parseCsv(await response.text());
    const columns = headers.map(normalizar); const indexOf = (name) => columns.indexOf(name);
    const id = indexOf("id"); const nombre = indexOf("nombre"); const precio = indexOf("precio"); const categoria = indexOf("categoria");
    if ([nombre, precio, categoria].some((index) => index === -1)) throw new Error("La hoja debe incluir Nombre, Precio y Categoría.");
    return rows.map((row, index) => ({ id: row[id] || index + 1, nombre: row[nombre], precio: Number(row[precio].replace(/[^0-9.-]/g, "")) || 0, categoria: row[categoria] }));
}

app.get("/", (req, res) => {

    res.json({
        mensaje: "Mi primer servicio Cloud",
        estado: "Online",
        tecnologia: "Node.js + Express"
    });

});

app.get("/api/estado", (_req, res) => {
    res.json({ estado: "Online", servidor: "Node.js", servicio: "Cloud API", version: "1.0" });
});

app.get("/api/productos", async (req, res) => {
    try {
        let productos = await obtenerProductos();
        const busqueda = normalizar(req.query.buscar || req.query.q);
        const categoria = normalizar(req.query.categoria);
        if (busqueda) productos = productos.filter((producto) => normalizar(producto.nombre).includes(busqueda));
        if (categoria) productos = productos.filter((producto) => normalizar(producto.categoria) === categoria);
        res.json(productos);
    } catch (error) {
        console.error("No fue posible obtener los productos:", error.message);
        res.status(502).json({ error: "No fue posible obtener los productos de Google Sheets." });
    }
});

app.listen(PORT, () => {

    console.log(
        "Servidor ejecutandose en puerto " + PORT
    );

});
