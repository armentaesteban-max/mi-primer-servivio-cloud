import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const csvUrl = "https://sheets.example.test/catalog.csv";
const scriptUrl = "https://script.example.test/exec";
const writes = [];
const csv = "ID,Nombre,Precio,Categoria\na-1,Laptop,15000,Computación\na-2,Mouse,350,Accesorios\n";

process.env.SHEETS_CSV_URL = csvUrl;
process.env.GOOGLE_APPS_SCRIPT_URL = scriptUrl;
process.env.GOOGLE_APPS_SCRIPT_TOKEN = "test-script-token";
process.env.ADMIN_USER = "admin";
process.env.ADMIN_PASSWORD = "12345";

globalThis.fetch = async (url, options = {}) => {
    if (String(url) === csvUrl) return new Response(csv, { status: 200 });
    if (String(url) === scriptUrl) {
        writes.push(JSON.parse(options.body));
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
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

test("product read requires login and parses the Sheets CSV", async () => {
    const unauthorized = await handler(request("/productos"));
    assert.equal(unauthorized.status, 401);
    const response = await handler(request("/productos", { password: "12345" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [
        { id: "a-1", nombre: "Laptop", precio: 15000, categoria: "Computación" },
        { id: "a-2", nombre: "Mouse", precio: 350, categoria: "Accesorios" }
    ]);
});

test("product search filters records returned from Sheets", async () => {
    const response = await handler(request("/productos?buscar=mouse", { password: "12345" }));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map((product) => product.id), ["a-2"]);
});

test("create, update, and delete proxy the matching Apps Script actions", async () => {
    const product = { nombre: "Teclado", precio: 700, categoria: "Accesorios" };
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
});

test("invalid product data is rejected before calling Apps Script", async () => {
    const previousWriteCount = writes.length;
    const response = await handler(request("/productos", { method: "POST", body: { nombre: "", precio: -1, categoria: "" }, password: "12345" }));
    assert.equal(response.status, 400);
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
