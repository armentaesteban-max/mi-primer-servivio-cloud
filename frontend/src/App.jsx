import { useEffect, useMemo, useState } from "react";
import "./App.css";

// En Netlify se usa la función incluida en este repositorio. VITE_API_URL permite
// reemplazarla por una API externa si hiciera falta en el futuro.
const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3000" : "")).replace(/\/$/, "");

function App() {
    const [productos, setProductos] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [categoria, setCategoria] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [estado, setEstado] = useState(null);

    const cargarProductos = async () => {
        setCargando(true); setError("");
        try {
            const response = await fetch(`${API_URL}/api/productos`);
            if (!response.ok) throw new Error("Error en el servidor");
            setProductos(await response.json());
        } catch (fetchError) {
            console.error(fetchError); setError("No fue posible conectar con el servicio de productos.");
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

    return <main className="app">
        <header className="encabezado"><div><p className="etiqueta">Cloud Computing</p><h1>Catálogo de productos</h1><p className="subtitulo">Datos sincronizados desde Google Sheets.</p></div>
            <div className={`estado ${estado?.estado === "Online" ? "online" : "offline"}`}><span /><div><strong>Servicio: {estado?.estado || "Comprobando..."}</strong>{estado?.servicio && <small>{estado.servidor} · {estado.servicio} v{estado.version}</small>}</div></div>
        </header>
        <section className="controles" aria-label="Filtros de productos">
            <label>Buscar producto<input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Escribe un nombre..." /></label>
            <label>Categoría<select value={categoria} onChange={(event) => setCategoria(event.target.value)}><option value="">Todas las categorías</option>{categorias.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <button type="button" onClick={cargarProductos} disabled={cargando}>{cargando ? "Actualizando..." : "Actualizar datos"}</button>
        </section>
        {error && <p className="mensaje error">{error}</p>}
        {!error && cargando && <p className="mensaje">Cargando productos...</p>}
        {!cargando && !error && <><p className="resultado">{productosFiltrados.length} producto{productosFiltrados.length === 1 ? "" : "s"} encontrado{productosFiltrados.length === 1 ? "" : "s"}</p><section className="productos" aria-live="polite">{productosFiltrados.map((producto) => <article className="producto" key={producto.id}><p className="categoria">{producto.categoria}</p><h2>{producto.nombre}</h2><p className="precio">{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(producto.precio)}</p></article>)}</section>{productosFiltrados.length === 0 && <p className="mensaje">No hay productos que coincidan con los filtros.</p>}</>}
    </main>;
}

export default App;
