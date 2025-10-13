const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mysql = require("mysql2/promise");
const path = require("path");
const corsOptions = {
    
    origin: 'https://hubcolectivomariayjuana.site', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, 
    optionsSuccessStatus: 200 
};
const app = express();
app.use(express.json());

// Conexión a MySQL
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});
app.use(cors(corsOptions)); // Aplica la configuración a las peticiones normales
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.options("*", cors(corsOptions)); // Aplica la configuración a las peticiones 'preflight'
// Configuración de subida de imágenes
const storage = multer.diskStorage({
 destination: function (req, file, cb) {
  cb(null, "uploads/");
 },
 filename: function (req, file, cb) {
 cb(null, Date.now() + path.extname(file.originalname));
 }
});

const upload = multer({ storage });

// --- LOGIN ---
app.post("/login", async (req, res) => {
  try {
    const { usuario, password } = req.body;
    const [rows] = await db.query(
      "SELECT * FROM login WHERE usuario = ? AND password = ?",
      [usuario, password]
    );

    if (rows.length > 0) {
      res.json({ success: true, message: "✅ Login correcto" });
    } else {
      res.json({ success: false, message: "❌ Usuario o contraseña incorrectos" });
    }
  } catch (err) {
    console.error("❌ Error en login:", err);
    res.json({ success: false, message: "Error en el servidor" });
  }
});

// ------------------ RUTA TEMPORAL PARA CREAR TABLAS ------------------
app.get("/crear-tablas", async (req, res) => {
  try {
    // Tabla login
    await db.query(`
      CREATE TABLE IF NOT EXISTS login (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario VARCHAR(50),
        password VARCHAR(255)
      )
    `);

    // Tabla usuarios
    await db.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100),
        folio VARCHAR(50),
        estado VARCHAR(50),
        hub VARCHAR(50),
        expediente VARCHAR(50),
        fotografia VARCHAR(255),
        ref_nombre VARCHAR(100),
        num_ref VARCHAR(50)
      )
    `);

    // Usuario de prueba
    await db.query(`
      INSERT INTO login (usuario, password)
      VALUES ('admin', '12345')
    `);

    res.send("✅ Tablas creadas y usuario de prueba agregado");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error al crear tablas");
  }
});



// ------------------ RUTA AGREGAR ------------------
app.post("/agregar", upload.single("fotografia"), async (req, res) => {
  try {
const { nombre, estado, hub, expediente, ref_nombre, ref_telefono, ref_direccion } = req.body;

    // Contar usuarios para asignar número consecutivo
    const [rows] = await db.query("SELECT COUNT(*) AS total FROM usuarios");
    const numero = rows[0].total + 1;

    // Generar folio: NC + número consecutivo + abreviatura estado
    const folio = `NC${numero}${estado}`;

    let fotoUrl = null;
    if (req.file) {
      fotoUrl = "/uploads/" + req.file.filename;
    }

    // Insertar usuario en la BD
    await db.query(
"INSERT INTO usuarios (nombre, folio, estado, hub, expediente, fotografia, ref_nombre, num_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
[nombre, folio, estado, hub, expediente, fotoUrl, ref_nombre, num_ref]
);


   res.json({
  success: true,
  usuario: { 
    nombre, 
    folio,  // se llama folio en la BD, pero en frontend lo mostramos como "Número de Cliente"
    estado, 
    hub, 
    expediente, 
    ref_nombre,
    num_ref,
    fotografia_url: fotoUrl 
  }
});
  } catch (err) {
    console.error("❌ Error al agregar:", err);
    res.json({ success: false, message: "Error al agregar usuario" });
  }
});

// --- BUSCAR FOLIO ---
app.get("/buscar/:folio", async (req, res) => {
  try {
    const folio = req.params.folio;
   const [rows] = await db.query(
 "SELECT nombre, folio, estado, hub, expediente, fotografia, ref_nombre, num_ref FROM usuarios WHERE folio = ?",
  [folio]
);

    if (rows.length === 0) {
      return res.json({ success: false, message: "No se encontró el número de cliente" });
    }

    res.json({
     success: true,
usuario: {
 nombre: rows[0].nombre,
folio: rows[0].folio,
 estado: rows[0].estado,
 hub: rows[0].hub,
 expediente: rows[0].expediente,
 fotografia_url: rows[0].fotografia,
 ref_nombre: rows[0].ref_nombre,
 num_ref: rows[0].num_ref
}

    });
  } catch (err) {
    console.error("❌ Error al buscar:", err);
    res.json({ success: false, message: "Error al buscar usuario" });
  }
});
db.getConnection()
    .then(connection => {
        console.log("✅ Conexión a la base de datos exitosa.");
        connection.release(); // Libera la conexión de prueba

        // AHORA INICIAMOS EL SERVIDOR SOLO SI LA BD ESTÁ VIVA
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, '0.0.0.0', () => { 
            console.log(`✅ Servidor corriendo en http://0.0.0.0:${PORT}`);
        });
    })
    .catch(err => {
        // Si hay un error, lo registramos y cerramos el proceso.
        // Esto aparecerá como un error FATAL en los logs de Railway.
        console.error("❌ FATAL: No se pudo conectar a la base de datos:", err.message);
        process.exit(1);
    });
