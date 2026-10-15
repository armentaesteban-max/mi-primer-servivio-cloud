import { useEffect, useMemo, useState } from "react";
import "./App.css";
import "./Workspace.css";
import ChatBot from "./ChatBot.jsx";

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3000" : "")).replace(/\/$/, "");
const PRODUCTS_URL = `${API_URL}/api/productos`;
const INITIAL_PRODUCT = { nombre: "", precio: "", categoria: "", marcaCompatible: "", modeloCompatible: "", existencias: "0" };
const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

function normalize(value = "") {
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
}

function App() {
    const [session, setSession] = useState(null);
    const [login, setLogin] = useState({ usuario: "", password: "" });
    const [loginError, setLoginError] = useState("");
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [productForm, setProductForm] = useState(INITIAL_PRODUCT);
    const [editingId, setEditingId] = useState(null);
    const [formOpen, setFormOpen] = useState(false);

    const loadProducts = async (credentials = session) => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(PRODUCTS_URL, {
                headers: credentials ? { "X-Admin-Token": credentials.password } : undefined
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "No fue posible consultar Google Sheets.");
            setProducts(result);
        } catch (loadError) {
            setError(loadError.message || "No fue posible conectar con la API.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!session) return undefined;
        let active = true;
        fetch(PRODUCTS_URL, { headers: { "X-Admin-Token": session.password } })
            .then(async (response) => {
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "No fue posible consultar Google Sheets.");
                if (active) setProducts(result);
            })
            .catch((loadError) => { if (active) setError(loadError.message || "No fue posible conectar con la API."); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [session]);

    const categories = useMemo(() => [...new Set(products.map((product) => product.categoria))].sort(), [products]);
    const filteredProducts = useMemo(() => products.filter((product) => {
        const matchesSearch = [product.nombre, product.marcaCompatible, product.modeloCompatible].some((value) => normalize(value).includes(normalize(search)));
        return matchesSearch && (!category || product.categoria === category);
    }), [products, search, category]);

    const submitLogin = async (event) => {
        event.preventDefault();
        setBusy(true);
        setLoginError("");
        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(login)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "No fue posible iniciar sesión.");
            setLoading(true);
            setSession({ usuario: login.usuario, password: login.password });
            setLogin({ usuario: "", password: "" });
        } catch (loginRequestError) {
            setLoginError(loginRequestError.message);
        } finally {
            setBusy(false);
        }
    };

    const openCreateForm = () => {
        setEditingId(null);
        setProductForm(INITIAL_PRODUCT);
        setNotice("");
        setFormOpen(true);
    };

    const openEditForm = (product) => {
        setEditingId(product.id);
        setProductForm({ nombre: product.nombre, precio: String(product.precio), categoria: product.categoria, marcaCompatible: product.marcaCompatible || "", modeloCompatible: product.modeloCompatible || "", existencias: String(product.existencias ?? 0) });
        setNotice("");
        setFormOpen(true);
    };

    const saveProduct = async (event) => {
        event.preventDefault();
        setBusy(true);
        setNotice("");
        try {
            const response = await fetch(`${PRODUCTS_URL}${editingId ? `/${encodeURIComponent(editingId)}` : ""}`, {
                method: editingId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json", "X-Admin-Token": session.password },
                body: JSON.stringify(productForm)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "No fue posible guardar el producto.");
            setNotice(editingId ? "Producto actualizado en Google Sheets." : "Producto creado en Google Sheets.");
            setFormOpen(false);
            await loadProducts(session);
        } catch (saveError) {
            setNotice(saveError.message);
        } finally {
            setBusy(false);
        }
    };

    const deleteProduct = async (product) => {
        if (!window.confirm(`¿Eliminar “${product.nombre}” de Google Sheets?`)) return;
        setBusy(true);
        setNotice("");
        try {
            const response = await fetch(`${PRODUCTS_URL}/${encodeURIComponent(product.id)}`, {
                method: "DELETE",
                headers: { "X-Admin-Token": session.password }
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "No fue posible eliminar el producto.");
            setNotice("Producto eliminado de Google Sheets.");
            await loadProducts(session);
        } catch (deleteError) {
            setNotice(deleteError.message);
        } finally {
            setBusy(false);
        }
    };

    if (!session) {
        return <main className="login-screen">
            <section className="login-aside">
                <a className="brand login-brand" href="#inicio"><span>◈</span> móvil<span>stock</span></a>
                <div className="login-intro">
                    <p className="eyebrow">Accesorios para celulares · Google Sheets</p>
                    <h1>Accesorios,<br /><em>bajo control.</em></h1>
                    <p>Administra fundas, cargadores y otros accesorios con sus modelos compatibles y existencias.</p>
                </div>
                <span className="login-aside-note">PRÁCTICA DE SERVICIOS CLOUD <i>·</i> 01 / 04</span>
            </section>
            <section className="login-main">
                <form className="login-form" onSubmit={submitLogin}>
                    <div className="login-symbol" aria-hidden="true">↗</div>
                    <p className="eyebrow">Acceso al sistema</p>
                    <h2>Inicia sesión</h2>
                    <p className="login-caption">Usa tus credenciales de administrador para entrar al inventario.</p>
                    <label htmlFor="login-user">Usuario</label>
                    <input id="login-user" autoComplete="username" required value={login.usuario} onChange={(event) => setLogin({ ...login, usuario: event.target.value })} placeholder="admin" />
                    <label htmlFor="login-password">Contraseña</label>
                    <input id="login-password" type="password" autoComplete="current-password" required value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} placeholder="Tu contraseña" />
                    {loginError && <p className="inline-error" role="alert">{loginError}</p>}
                    <button className="solid-button" type="submit" disabled={busy}>{busy ? "Validando..." : "Iniciar sesión"}<span aria-hidden="true">↗</span></button>
                    <p className="login-footnote">Inventario de accesorios <i /> Google Sheets <i /> Asistente</p>
                </form>
            </section>
        </main>;
    }

    return <main className="catalog-app">
        <header className="workspace-header">
            <a className="brand" href="#catalogo"><span>◈</span> móvil<span>stock</span></a>
            <div className="header-right"><span className="connection-state"><i /> Google Sheets</span><span className="user-name">{session.usuario}</span><button className="text-button" type="button" onClick={() => { setSession(null); setProducts([]); }}>Cerrar sesión</button></div>
        </header>
        <section className="workspace" id="catalogo">
            <div className="workspace-heading">
                <div><p className="eyebrow">Inventario / Accesorios</p><h1>Accesorios para celulares</h1><p>Consulta compatibilidad, precios y existencias desde Google Sheets.</p></div>
                <button className="solid-button add-button" type="button" onClick={openCreateForm}><span aria-hidden="true">+</span> Agregar accesorio</button>
            </div>
            <div className="summary-row"><div><strong>{products.length}</strong><span>accesorios en la hoja</span></div><div className="sync-actions"><span>{loading ? "Sincronizando..." : "Datos de Google Sheets"}</span><button className="outline-button" type="button" onClick={() => loadProducts(session)} disabled={loading}>↻ Actualizar</button></div></div>
            {notice && <p className="notice" role="status">{notice}</p>}
            {error && <p className="inline-error" role="alert">{error}</p>}
            <section className="table-section" aria-label="Registros de accesorios">
                <div className="table-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar accesorio o modelo..." aria-label="Buscar accesorios por nombre o compatibilidad" /></label><label className="category-select"><span>Tipo</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todos</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><span className="result-count">{filteredProducts.length} resultados</span></div>
                <div className="table-scroll"><table><thead><tr><th>ID</th><th>Accesorio</th><th>Tipo</th><th>Compatibilidad</th><th className="number-cell">Existencias</th><th className="number-cell">Precio</th><th className="actions-heading">Acciones</th></tr></thead><tbody>
                    {filteredProducts.map((product) => <tr key={product.id}><td className="id-cell">{product.id}</td><td className="product-name">{product.nombre}</td><td><span className="category-label">{product.categoria}</span></td><td>{[product.marcaCompatible, product.modeloCompatible].filter(Boolean).join(" ") || "Sin especificar"}</td><td className="number-cell"><span className={Number(product.existencias) === 0 ? "stock-empty" : ""}>{Number(product.existencias) || 0}</span></td><td className="number-cell">{money.format(product.precio)}</td><td className="row-actions"><button type="button" onClick={() => openEditForm(product)} disabled={busy}>Editar</button><button type="button" className="delete-action" onClick={() => deleteProduct(product)} disabled={busy}>Eliminar</button></td></tr>)}
                </tbody></table></div>
                {!loading && !error && filteredProducts.length === 0 && <p className="empty-state">{products.length ? "No hay accesorios que coincidan con la búsqueda." : "La hoja todavía no tiene accesorios."}</p>}
                {loading && <p className="empty-state">Consultando la hoja de Google Sheets...</p>}
            </section>
            <footer className="workspace-footer"><span>Móvil Stock · Inventario de accesorios</span><span>React <i /> Node.js API <i /> Google Sheets</span></footer>
        </section>
        <ChatBot apiUrl={API_URL} password={session.password} />
        {formOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}><section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title"><div className="dialog-heading"><div><p className="eyebrow">Google Sheets</p><h2 id="product-dialog-title">{editingId ? "Editar accesorio" : "Nuevo accesorio"}</h2></div><button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Cerrar formulario">×</button></div><form onSubmit={saveProduct} className="product-form"><label htmlFor="product-name">Nombre<input id="product-name" autoFocus required maxLength="120" value={productForm.nombre} onChange={(event) => setProductForm({ ...productForm, nombre: event.target.value })} placeholder="Ej. Funda transparente" /></label><div className="form-pair"><label htmlFor="product-price">Precio (MXN)<input id="product-price" required type="number" min="0" step="0.01" value={productForm.precio} onChange={(event) => setProductForm({ ...productForm, precio: event.target.value })} placeholder="0.00" /></label><label htmlFor="product-category">Tipo de accesorio<input id="product-category" required maxLength="80" value={productForm.categoria} onChange={(event) => setProductForm({ ...productForm, categoria: event.target.value })} placeholder="Ej. Fundas" /></label></div><div className="form-pair"><label htmlFor="product-brand">Marca compatible<input id="product-brand" maxLength="80" value={productForm.marcaCompatible} onChange={(event) => setProductForm({ ...productForm, marcaCompatible: event.target.value })} placeholder="Ej. Samsung o Universal" /></label><label htmlFor="product-model">Modelo compatible<input id="product-model" maxLength="80" value={productForm.modeloCompatible} onChange={(event) => setProductForm({ ...productForm, modeloCompatible: event.target.value })} placeholder="Ej. Galaxy A55" /></label></div><label htmlFor="product-stock">Existencias<input id="product-stock" required type="number" min="0" step="1" value={productForm.existencias} onChange={(event) => setProductForm({ ...productForm, existencias: event.target.value })} /></label>{notice && <p className="inline-error" role="alert">{notice}</p>}<div className="dialog-actions"><button className="outline-button" type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="solid-button" type="submit" disabled={busy}>{busy ? "Guardando..." : editingId ? "Guardar cambios" : "Agregar accesorio"}</button></div></form></section></div>}
    </main>;
}

export default App;
