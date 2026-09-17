const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

app.get("/", (req, res) => {

    res.json({
        mensaje: "Mi primer servicio Cloud",
        estado: "Online",
        tecnologia: "Node.js + Express"
    });

});

// Endpoint de productos
app.get("/api/productos", (req, res) => {
    const productos = [
        {
            id: 1,
            nombre: "Laptop",
            precio: 15000,
            categoria: "Computadoras"
        },
        {
            id: 2,
            nombre: "Mouse",
            precio: 350,
            categoria: "Accesorios"
        },
        {
            id: 3,
            nombre: "Teclado",
            precio: 700,
            categoria: "Accesorios"
        }
    ];

    res.json(productos);
});

app.listen(PORT, () => {

    console.log(
        "Servidor ejecutandose en puerto " + PORT
    );

});