import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3000" : "")).replace(/\/$/, "");
const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function App() {
    const [productos, setProductos] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [categoria, setCategoria] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [estado, setEstado] = useState(null);
    const [mostrarPanel, setMostrarPanel] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [aviso, setAviso] = useState("");
    const [nuevoProducto, setNuevoProducto] = useState({ nombre: "", precio: "", categoria: "", clave: "" });

    const cargarProductos = async () => {
        setCargando(true); setError("");
        try {
            const response = await fetch(`${API_URL}/api/productos`);
            if (!response.ok) throw new Error("Error al consultar los productos");
            setProductos(await response.json());
        } catch (fetchError) {
            console.error(fetchError); setError("No fue posible conectar con el catálogo.");
        } finally { setCargando(false); }
    };

    useEffect(() => {
        cargarProductos();
        fetch(`${API_URL}/api/estado`).then((response) => response.ok ? response.json() : Promise.reject())
            .then(setEstado).catch(() => setEstado({ estado: "Sin conexión" }));
    }, []);

    const categorias = useMemo(() => [...new Set(productos.map((producto) => producto.categoria))].sort(), [productos]);
    const productosFiltrados = useMemo(() => {
        const texto = busqueda.trim().toLocaleLowerCase();
        return productos.filter((producto) => producto.nombre.toLocaleLowerCase().includes(texto) && (!categoria || producto.categoria === categoria));
    }, [productos, busqueda, categoria]);

    const actualizarCampo = (event) => setNuevoProducto({ ...nuevoProducto, [event.target.name]: event.target.value });

    const guardarProducto = async (event) => {
        event.preventDefault(); setAviso(""); setGuardando(true);
        try {
            const response = await fetch(`${API_URL}/api/productos`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Admin-Token": nuevoProducto.clave },
                body: JSON.stringify({ nombre: nuevoProducto.nombre, precio: nuevoProducto.precio, categoria: nuevoProducto.categoria })
            });
            const respuesta = await response.json();
            if (!response.ok) throw new Error(respuesta.error || "No fue posible guardar el producto.");
            setAviso("Producto guardado en Google Sheets.");
            setNuevoProducto({ nombre: "", precio: "", categoria: "", clave: "" });
            cargarProductos();
        } catch (saveError) { setAviso(saveError.message); }
        finally { setGuardando(false); }
    };

    return <main className="app-shell">
        <nav className="topbar"><a className="brand" href="#inicio"><span>◈</span> cloud<span>catalog</span></a><div className="nav-actions"><a href="#catalogo">Catálogo</a><button className="button ghost" type="button" onClick={() => setMostrarPanel(!mostrarPanel)}>+ Agregar producto</button></div></nav>
        <section className="hero" id="inicio"><div className="hero-copy"><p className="eyebrow">Inventario conectado · Google Sheets</p><h1>Productos que se<br /><em>mantienen al día.</em></h1><p>Explora, filtra y administra tu catálogo desde una experiencia simple y rápida.</p><div className="hero-actions"><a className="button primary" href="#catalogo">Ver catálogo <span>↓</span></a><button className="button text" type="button" onClick={() => setMostrarPanel(true)}>Administrar productos</button></div></div><div className="hero-card"><div className="hero-card-top"><span>Estado de API</span><b className={estado?.estado === "Online" ? "ok" : "bad"}>● {estado?.estado || "Verificando"}</b></div><div className="hero-chart"><i /><i /><i /><i /><i /><i /><i /></div><div className="hero-card-bottom"><strong>{productos.length}</strong><span>productos sincronizados</span></div></div></section>

        {mostrarPanel && <section className="admin-panel" aria-label="Agregar producto"><div className="panel-heading"><div><p className="eyebrow">Panel de administración</p><h2>Agregar producto</h2><p>Guárdalo directamente en tu hoja de cálculo.</p></div><button className="close" type="button" onClick={() => setMostrarPanel(false)} aria-label="Cerrar">×</button></div><form onSubmit={guardarProducto}><label>Nombre del producto<input required name="nombre" value={nuevoProducto.nombre} onChange={actualizarCampo} placeholder="Ej. Monitor 24 pulgadas" /></label><label>Precio (MXN)<input required min="0" step="0.01" type="number" name="precio" value={nuevoProducto.precio} onChange={actualizarCampo} placeholder="0.00" /></label><label>Categoría<input required name="categoria" value={nuevoProducto.categoria} onChange={actualizarCampo} placeholder="Ej. Computadoras" /></label><label>Clave de administrador<input required type="password" name="clave" value={nuevoProducto.clave} onChange={actualizarCampo} placeholder="Tu clave privada" /></label><button className="button primary" disabled={guardando}>{guardando ? "Guardando..." : "Guardar en Google Sheets"}</button></form>{aviso && <p className={`form-message ${aviso.includes("guardado") ? "success" : "failure"}`}>{aviso}</p>}<small>La clave solo se usa para validar esta operación y no se guarda en el navegador.</small></section>}

        <section className="catalog-section" id="catalogo"><div className="section-heading"><div><p className="eyebrow">Catálogo</p><h2>Encuentra lo que necesitas</h2></div><button className="refresh" type="button" onClick={cargarProductos} disabled={cargando}>↻ {cargando ? "Sincronizando" : "Sincronizar"}</button></div><section className="filters" aria-label="Filtros de productos"><label><span>⌕</span><input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por nombre..." /></label><label className="select-wrap"><select value={categoria} onChange={(event) => setCategoria(event.target.value)}><option value="">Todas las categorías</option>{categorias.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></section>
            {error && <p className="message failure">{error}</p>}{!error && cargando && <p className="message">Cargando catálogo...</p>}{!cargando && !error && <><p className="results"><b>{productosFiltrados.length}</b> productos encontrados</p><div className="products">{productosFiltrados.map((producto, index) => <article className="product" key={producto.id}><div className="product-mark">{String(index + 1).padStart(2, "0")}</div><p>{producto.categoria}</p><h3>{producto.nombre}</h3><strong>{dinero.format(producto.precio)}</strong><span className="product-arrow">↗</span></article>)}</div>{productosFiltrados.length === 0 && <p className="message">No encontramos productos con esos filtros.</p>}</>}</section>
        <footer><span>Cloud Catalog · Práctica de Cloud Computing</span><span>{estado?.servidor || "Node.js"} · {estado?.servicio || "Cloud API"}</span></footer>
    </main>;
}

export default App;
