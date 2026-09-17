import { useEffect, useState } from "react";

function App() {
    const [productos, setProductos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch("http://localhost:3000/api/productos")
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Error en el servidor");
                }
                return response.json();
            })
            .then((data) => {
                setProductos(data);
                setCargando(false);
            })
            .catch((error) => {
                console.error(error);
                setError(true);
                setCargando(false);
            });
    }, []);

    return (
        <div style={{ padding: "40px", fontFamily: "Arial" }}>
            <h1>Mi Primer Servicio Cloud</h1>
            <p>
                Aplicación React consumiendo una API desarrollada con Node.js
            </p>

            {cargando && <p>Cargando información...</p>}

            {error && <p>No fue posible conectar con el servicio.</p>}

            {!cargando &&
                !error &&
                productos.map((producto) => (
                    <div
                        key={producto.id}
                        style={{
                            border: "1px solid gray",
                            padding: "15px",
                            marginTop: "10px",
                            borderRadius: "8px"
                        }}
                    >
                        <h3>{producto.nombre}</h3>
                        <p>Precio: ${producto.precio}</p>
                        <p>Categoría: {producto.categoria}</p>
                    </div>
                ))}
        </div>
    );
}

export default App;