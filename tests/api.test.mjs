import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const csvUrl = "https://sheets.example.test/catalog.csv";
const scriptUrl = "https://script.example.test/exec";
const writes = [];
const chatRequests = [];
const liveProducts = [
    { id: "a-1", nombre: "Funda transparente", precio: 199, categoria: "Fundas", marcaCompatible: "Samsung", modeloCompatible: "Galaxy A55", existencias: 8 },
    { id: "a-2", nombre: "Cargador USB-C", precio: 350, categoria: "Cargadores", marcaCompatible: "Universal", modeloCompatible: "Universal", existencias: 3 }
];
let listSupported = true;
let csvReads = 0;
const csv = "ID,Nombre,Precio,Categoria\na-1,Funda transparente,199,Fundas\na-2,Cargador USB-C,350,Cargadores\n";

process.env.SHEETS_CSV_URL = csvUrl;
process.env.GOOGLE_APPS_SCRIPT_URL = scriptUrl;
process.env.GOOGLE_APPS_SCRIPT_TOKEN = "test-script-token";
process.env.ADMIN_USER = "admin";
process.env.ADMIN_PASSWORD = "12345";
process.env.OPENAI_API_KEY = "test-openai-key";

globalThis.fetch = async (url, options = {}) => {
    if (String(url) === csvUrl) { csvReads += 1; return new Response(csv, { status: 200 }); }
    if (String(url) === scriptUrl) {
        const payload = JSON.parse(options.body);
        if (payload.action === "list") {
            return new Response(JSON.stringify(listSupported ? { ok: true, productos: liveProducts } : { ok: false, error: "Acción no soportada." }), { status: 200 });
        }
        writes.push(payload);
        if (payload.action === "create") liveProducts.push({ id: "a-3", nombre: payload.nombre, precio: payload.precio, categoria: payload.categoria, marcaCompatible: payload.marcaCompatible, modeloCompatible: payload.modeloCompatible, existencias: payload.existencias });
        if (payload.action === "update") Object.assign(liveProducts.find((product) => product.id === payload.id), { nombre: payload.nombre, precio: payload.precio, categoria: payload.categoria, marcaCompatible: payload.marcaCompatible, modeloCompatible: payload.modeloCompatible, existencias: payload.existencias });
        if (payload.action === "delete") liveProducts.splice(liveProducts.findIndex((product) => product.id === payload.id), 1);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (String(url) === "https://api.openai.com/v1/responses") {
        chatRequests.push({ authorization: options.headers.Authorization, body: JSON.parse(options.body) });
        return new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: "Hay 2 productos." }] }] }), { status: 200 });
    }
    throw new Error(`Unexpected URL: ${url}`);
};

const { default: handler } = await import("../frontend/netlify/functions/api.mjs?test");
const appsScriptContext = {};
runInNewContext(await readFile(new URL("../frontend/google-apps-script/Code.gs", import.meta.url), "utf8"), appsScriptContext);

function request(path, { method = "GET", body, password } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (password) headers["X-Admin-Token"] = password;
    return new Request(`https://cloudcatalog.example.test/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

test("login rejects incorrect credentials and accepts valid credentials", async () => {
    const invalid = await handler(request("/login", { method: "POST", body: { usuario: "admin", password: "wrong" } }));
    assert.equal(invalid.status, 401);
    const valid = await handler(request("/login", { method: "POST", body: { usuario: "admin", password: "12345" } }));
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).ok, true);
});

test("product read requires login and uses live Apps Script data", async () => {
    const unauthorized = await handler(request("/productos"));
    assert.equal(unauthorized.status, 401);
    const response = await handler(request("/productos", { password: "12345" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [
        { id: "a-1", nombre: "Funda transparente", precio: 199, categoria: "Fundas", marcaCompatible: "Samsung", modeloCompatible: "Galaxy A55", existencias: 8 },
        { id: "a-2", nombre: "Cargador USB-C", precio: 350, categoria: "Cargadores", marcaCompatible: "Universal", modeloCompatible: "Universal", existencias: 3 }
    ]);
    assert.equal(csvReads, 0);
});

test("product read falls back to CSV for an older Apps Script deployment", async () => {
    listSupported = false;
    try {
        const response = await handler(request("/productos", { password: "12345" }));
        assert.equal(response.status, 200);
        const products = await response.json();
        assert.equal(products.length, 2);
        assert.deepEqual([products[0].marcaCompatible, products[0].modeloCompatible, products[0].existencias], ["", "", 0]);
        assert.equal(csvReads, 1);
    } finally {
        listSupported = true;
    }
});

test("product search filters records returned from Sheets", async () => {
    const response = await handler(request("/productos?buscar=galaxy", { password: "12345" }));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map((product) => product.id), ["a-1"]);
});

test("create, update, and delete proxy the matching Apps Script actions", async () => {
    const product = { nombre: "Protector de pantalla", precio: 150, categoria: "Protectores", marcaCompatible: "Samsung", modeloCompatible: "Galaxy A55", existencias: 12 };
    const create = await handler(request("/productos", { method: "POST", body: product, password: "12345" }));
    assert.equal(create.status, 201);
    const update = await handler(request("/productos/a-3", { method: "PUT", body: product, password: "12345" }));
    assert.equal(update.status, 200);
    const remove = await handler(request("/productos/a-3", { method: "DELETE", password: "12345" }));
    assert.equal(remove.status, 200);
    assert.deepEqual(writes.map(({ action, id }) => [action, id]), [
        ["create", null],
        ["update", "a-3"],
        ["delete", "a-3"]
    ]);
    assert.ok(writes.every((write) => write.token === "test-script-token"));
    assert.equal(writes[0].modeloCompatible, "Galaxy A55");
    assert.equal(writes[1].existencias, 12);
});

test("invalid product data is rejected before calling Apps Script", async () => {
    const previousWriteCount = writes.length;
    const response = await handler(request("/productos", { method: "POST", body: { nombre: "", precio: -1, categoria: "" }, password: "12345" }));
    assert.equal(response.status, 400);
    assert.equal(writes.length, previousWriteCount);
    const invalidStock = await handler(request("/productos", { method: "POST", body: { nombre: "Funda", precio: 99, categoria: "Fundas", existencias: 1.5 }, password: "12345" }));
    assert.equal(invalidStock.status, 400);
    assert.equal(writes.length, previousWriteCount);
});

test("Apps Script assigns the next numeric ID", () => {
    const sheet = {
        getLastRow: () => 5,
        getRange: (row, column, count, width) => {
            assert.deepEqual([row, column, count, width], [2, 1, 4, 1]);
            return { getValues: () => [[26], ["28"], ["invalid"], [30]] };
        }
    };
    assert.equal(appsScriptContext.siguienteId(sheet, 0), 31);
    assert.equal(appsScriptContext.siguienteId({ getLastRow: () => 1 }, 0), 1);
});

test("Apps Script lists the current rows for the CRUD", () => {
    appsScriptContext.PropertiesService = { getScriptProperties: () => ({ getProperty: () => "test-script-token" }) };
    appsScriptContext.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getActiveSheet: () => ({
        getLastRow: () => 2,
        getDataRange: () => ({ getValues: () => [["ID", "Nombre", "Precio", "Categoria", "MarcaCompatible", "ModeloCompatible", "Existencias"], [3, "Funda", 199, "Fundas", "Samsung", "Galaxy A55", 8]] })
    }) }) };
    appsScriptContext.ContentService = {
        MimeType: { JSON: "application/json" },
        createTextOutput: (text) => ({ text, setMimeType() { return this; } })
    };
    const result = appsScriptContext.doPost({ postData: { contents: JSON.stringify({ action: "list", token: "test-script-token" }) } });
    assert.deepEqual(JSON.parse(result.text), { ok: true, productos: [{ id: 3, nombre: "Funda", precio: 199, categoria: "Fundas", marcaCompatible: "Samsung", modeloCompatible: "Galaxy A55", existencias: 8 }] });
});

test("Apps Script adds accessory columns to an existing sheet", () => {
    const values = [["ID", "Nombre", "Precio", "Categoria"], [3, "Funda", 199, "Fundas"]];
    appsScriptContext.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getActiveSheet: () => ({
        getLastRow: () => values.length,
        getDataRange: () => ({ getValues: () => values.map((row) => [...row]) }),
        getRange: (row, column) => ({ setValue(value) { values[row - 1][column - 1] = value; } })
    }) }) };
    const result = appsScriptContext.doPost({ postData: { contents: JSON.stringify({ action: "list", token: "test-script-token" }) } });
    assert.deepEqual(values[0].slice(4), ["MarcaCompatible", "ModeloCompatible", "Existencias"]);
    assert.deepEqual(JSON.parse(result.text).productos[0], { id: 3, nombre: "Funda", precio: 199, categoria: "Fundas", marcaCompatible: "", modeloCompatible: "", existencias: 0 });
});

test("Apps Script saves compatibility and stock in new rows", () => {
    const values = [["ID", "Nombre", "Precio", "Categoria", "MarcaCompatible", "ModeloCompatible", "Existencias"]];
    appsScriptContext.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getActiveSheet: () => ({
        getLastRow: () => values.length,
        getDataRange: () => ({ getValues: () => values.map((row) => [...row]) }),
        appendRow: (row) => values.push(row)
    }) }) };
    appsScriptContext.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
    const result = appsScriptContext.doPost({ postData: { contents: JSON.stringify({ action: "create", token: "test-script-token", nombre: "Funda", precio: 199, categoria: "Fundas", marcaCompatible: "Samsung", modeloCompatible: "Galaxy A55", existencias: 8 }) } });
    assert.equal(JSON.parse(result.text).ok, true);
    assert.deepEqual([...values[1]], [1, "Funda", 199, "Fundas", "Samsung", "Galaxy A55", 8]);
});

test("chat requires login and sends current Sheets records to OpenAI", async () => {
    const denied = await handler(request("/chat", { method: "POST", body: { mensaje: "¿Cuántos hay?" } }));
    assert.equal(denied.status, 401);
    const response = await handler(request("/chat", { method: "POST", password: "12345", body: { mensaje: "¿Cuántos hay?" } }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { respuesta: "Hay 2 productos." });
    assert.equal(chatRequests.at(-1).authorization, "Bearer test-openai-key");
    assert.equal(chatRequests.at(-1).body.store, false);
    assert.match(chatRequests.at(-1).body.input[0].content, /Galaxy A55/);
});

test("chat rejects invalid messages before calling OpenAI", async () => {
    const before = chatRequests.length;
    const response = await handler(request("/chat", { method: "POST", password: "12345", body: { mensaje: " " } }));
    assert.equal(response.status, 400);
    assert.equal(chatRequests.length, before);
});

test("new products are visible immediately through the live read", async () => {
    const create = await handler(request("/productos", { method: "POST", password: "12345", body: { nombre: "Protector", precio: 150, categoria: "Protectores", marcaCompatible: "Samsung", modeloCompatible: "Galaxy A55", existencias: 4 } }));
    assert.equal(create.status, 201);
    const response = await handler(request("/productos", { password: "12345" }));
    assert.equal(response.status, 200);
    assert.ok((await response.json()).some((product) => product.nombre === "Protector" && product.existencias === 4));
    await handler(request("/productos/a-3", { method: "DELETE", password: "12345" }));
});
