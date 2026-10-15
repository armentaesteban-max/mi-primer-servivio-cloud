const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const FRONTEND_DIST = path.join(__dirname, "../frontend/dist");

app.use(cors());
app.use(express.json());
if (fs.existsSync(path.join(FRONTEND_DIST, "index.html"))) {
    app.use(express.static(FRONTEND_DIST));
}

const PORT = process.env.PORT || 3000;
const SHEETS_CSV_URL = process.env.SHEETS_CSV_URL || "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5HGJDaMSk4uQZ51FAyZntKHEt6rm3s4AbxffqiTRPTEllRLW0D-cRBflEv7kKsA_a0I56PxcTjojK/pub?output=csv";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN || "12345";
const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const APPS_SCRIPT_TOKEN = process.env.GOOGLE_APPS_SCRIPT_TOKEN;

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

function validarProducto(producto = {}) {
    const nombre = String(producto.nombre || "").trim();
    const categoria = String(producto.categoria || "").trim();
    const precio = Number(producto.precio);
    if (!nombre || !categoria || !Number.isFinite(precio) || precio < 0) {
        throw Object.assign(new Error("Completa nombre, precio válido y categoría."), { status: 400 });
    }
    const marcaCompatible = String(producto.marcaCompatible || "").trim();
    const modeloCompatible = String(producto.modeloCompatible || "").trim();
    const existencias = producto.existencias === undefined ? 0 : Number(producto.existencias);
    if (!Number.isSafeInteger(existencias) || existencias < 0) {
        throw Object.assign(new Error("Las existencias deben ser un número entero mayor o igual a cero."), { status: 400 });
    }
    return { nombre, precio, categoria, marcaCompatible, modeloCompatible, existencias };
}

function requireAdmin(req, res, next) {
    if (req.get("X-Admin-Token") !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Inicia sesión para consultar o modificar productos." });
    }
    next();
}

async function mutarProducto(action, producto, id) {
    if (!APPS_SCRIPT_URL || !APPS_SCRIPT_TOKEN) {
        throw Object.assign(new Error("Las escrituras requieren configurar Google Apps Script."), { status: 503 });
    }
    const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, id, ...producto, token: APPS_SCRIPT_TOKEN })
    });
    if (!response.ok) throw Object.assign(new Error("Google Sheets no pudo guardar los cambios."), { status: 502 });
    const result = await response.json();
    if (!result.ok) throw Object.assign(new Error(result.error || "Google Sheets rechazó el cambio."), { status: 400 });
    return result;
}

async function obtenerProductos() {
    if (APPS_SCRIPT_URL && APPS_SCRIPT_TOKEN) {
        try {
            const liveResponse = await fetch(APPS_SCRIPT_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "list", token: APPS_SCRIPT_TOKEN })
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
    const [headers, ...rows] = parseCsv(await response.text());
    const columns = headers.map(normalizar); const indexOf = (name) => columns.indexOf(name);
    const id = indexOf("id"); const nombre = indexOf("nombre"); const precio = indexOf("precio"); const categoria = indexOf("categoria");
    if ([nombre, precio, categoria].some((index) => index === -1)) throw new Error("La hoja debe incluir Nombre, Precio y Categoría.");
    const marcaCompatible = indexOf("marcacompatible"); const modeloCompatible = indexOf("modelocompatible"); const existencias = indexOf("existencias");
    return rows.map((row, index) => ({ id: row[id] || index + 1, nombre: row[nombre], precio: Number(row[precio].replace(/[^0-9.-]/g, "")) || 0, categoria: row[categoria], marcaCompatible: row[marcaCompatible] || "", modeloCompatible: row[modeloCompatible] || "", existencias: Number(row[existencias]) || 0 }));
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

app.post("/api/login", (req, res) => {
    const usuario = String(req.body.usuario || "");
    const password = String(req.body.password || "");
    if (usuario !== ADMIN_USER || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
    }
    res.json({ ok: true });
});

app.get("/api/productos", requireAdmin, async (req, res) => {
    try {
        let productos = await obtenerProductos();
        const busqueda = normalizar(req.query.buscar || req.query.q);
        const categoria = normalizar(req.query.categoria);
        if (busqueda) productos = productos.filter((producto) => [producto.nombre, producto.marcaCompatible, producto.modeloCompatible].some((valor) => normalizar(valor).includes(busqueda)));
        if (categoria) productos = productos.filter((producto) => normalizar(producto.categoria) === categoria);
        res.json(productos);
    } catch (error) {
        console.error("No fue posible obtener los productos:", error.message);
        res.status(502).json({ error: "No fue posible obtener los productos de Google Sheets." });
    }
});

app.post("/api/chat", requireAdmin, async (req, res) => {
    try {
        const { responderChat } = await import("../frontend/shared/chat-core.mjs");
        res.json(await responderChat(req.body, obtenerProductos));
    } catch (error) {
        console.error("No fue posible responder el chat:", error.message);
        res.status(error.status || 502).json({ error: error.status ? error.message : "No fue posible consultar el asistente." });
    }
});

app.post("/api/productos", requireAdmin, async (req, res) => {
    try {
        const producto = validarProducto(req.body);
        const result = await mutarProducto("create", producto);
        res.status(201).json(result);
    } catch (error) {
        console.error("No fue posible crear el producto:", error.message);
        res.status(error.status || 502).json({ error: error.message });
    }
});

app.put("/api/productos/:id", requireAdmin, async (req, res) => {
    try {
        const producto = validarProducto(req.body);
        const result = await mutarProducto("update", producto, req.params.id);
        res.json(result);
    } catch (error) {
        console.error("No fue posible actualizar el producto:", error.message);
        res.status(error.status || 502).json({ error: error.message });
    }
});

app.delete("/api/productos/:id", requireAdmin, async (req, res) => {
    try {
        const result = await mutarProducto("delete", {}, req.params.id);
        res.json(result);
    } catch (error) {
        console.error("No fue posible eliminar el producto:", error.message);
        res.status(error.status || 502).json({ error: error.message });
    }
});

app.use((req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "Endpoint no encontrado." });
    }
    if ((req.method === "GET" || req.method === "HEAD") && fs.existsSync(path.join(FRONTEND_DIST, "index.html"))) {
        return res.sendFile(path.join(FRONTEND_DIST, "index.html"));
    }
    next();
});

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        "Servidor ejecutandose en puerto " + PORT
    );

});
