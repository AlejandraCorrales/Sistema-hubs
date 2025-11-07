// ------------------ DEPENDENCIAS ------------------
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mysql = require("mysql2/promise");
const path = require("path");
const crypto = require("crypto");

// AWS SDK v3
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

console.log("DEBUG: process.cwd() =", process.cwd());
console.log("DEBUG: .env path used =", path.resolve(process.cwd(), ".env"));
console.log("ENV CHECK -> DB_HOST:", process.env.DB_HOST);
console.log("ENV CHECK -> DB_USER:", process.env.DB_USER);
console.log("ENV CHECK -> DB_NAME:", process.env.DB_NAME);
console.log("ENV CHECK -> DB_PORT:", process.env.DB_PORT);
console.log("ENV CHECK -> DB_PASSWORD present?:", !!process.env.DB_PASSWORD);

const app = express();
app.use(express.json());

// ------------------ CONFIGURACIÓN CORS ------------------
const allowedOrigins = [
  "https://hubcolectivomariayjuana.site",
  "https://www.hubcolectivomariayjuana.site",
  "https://proyecto-folio-qubio1ovj-alejandracorralesmuro-8459s-projects.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

// ⚡ versión segura que nunca lanza error en preflight
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      // Permitir requests sin origen (como Postman, SSR, etc.)
      return callback(null, true);
    }

    const isAllowed =
      allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log("🚫 Origen bloqueado por CORS:", origin);
      // 👇 En lugar de error, solo no añade el header CORS
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  optionsSuccessStatus: 200, // <--- crucial para Vercel / Chrome
};

// Aplica globalmente
app.use(cors(corsOptions));

// 🔥 MUY IMPORTANTE
app.options("*", cors(corsOptions));
// ⚡ Agregar este middleware para debug y control de preflight
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    console.log("🛰️ Preflight request detectada desde:", req.headers.origin);
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );
    res.sendStatus(200);
  } else {
    next();
  }
});
// ------------------ CONEXIÓN MYSQL ------------------
console.log("🔍 Variables de entorno detectadas:");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "(oculta)" : "NO DETECTADA");
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_PORT:", process.env.DB_PORT);

const db = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST,
  user: process.env.DB_USER || process.env.MYSQLUSER,
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
  database: process.env.DB_NAME || process.env.MYSQLDATABASE,
  port: process.env.DB_PORT || process.env.MYSQLPORT
});

// ------------------ CONFIGURACIÓN AWS S3 ------------------
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// ------------------ MULTER EN MEMORIA ------------------
const upload = multer({ storage: multer.memoryStorage() });

// ------------------ LOGIN ------------------
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
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

// ------------------ TEST DE CONEXIÓN BD ------------------
app.get("/api/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS result");
    console.log("✅ Conexión exitosa a la base de datos:", rows);
    res.json({
      success: true,
      message: "Conexión exitosa con la base de datos 🚀",
      results: rows
    });
  } catch (err) {
    console.error("❌ Error al conectar con la base de datos:", err);
    res.status(500).json({
      success: false,
      error: err.message,
      code: err.code || null
    });
  }
});

// ------------------ CREAR TABLAS ------------------
app.get("/crear-tablas", async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS login (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario VARCHAR(50),
        password VARCHAR(255)
      )
    `);

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

    await db.query(`
      INSERT IGNORE INTO login (usuario, password)
      VALUES ('admin', '12345')
    `);

    res.send("✅ Tablas creadas y usuario de prueba agregado");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error al crear tablas");
  }
});

// ------------------ AGREGAR USUARIO (subida a S3 privada) ------------------
app.post("/agregar", upload.single("fotografia"), async (req, res) => {
  try {
    const { nombre, estado, hub, expediente, ref_nombre, num_ref } = req.body;

    // Contar usuarios para asignar número consecutivo
    const [rows] = await db.query("SELECT COUNT(*) AS total FROM usuarios");
    const numero = rows[0].total + 1;

    // Generar folio: NC + número consecutivo + abreviatura estado
    const folio = `NC${numero}${estado}`;

    let fotoUrl = null;
    if (req.file) {
      const file = req.file;
      const randomName = crypto.randomBytes(16).toString("hex") + path.extname(file.originalname);

      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `usuarios/${folio}/${randomName}`,
        Body: file.buffer,
        ContentType: file.mimetype
      };

      const command = new PutObjectCommand(uploadParams);
      await s3.send(command);

      fotoUrl = uploadParams.Key;
    }

    // Insertar usuario
    await db.query(
      `INSERT INTO usuarios (nombre, folio, estado, hub, expediente, fotografia, ref_nombre, num_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, folio, estado, hub, expediente, fotoUrl, ref_nombre, num_ref]
    );

    res.json({
      success: true,
      usuario: {
        nombre,
        folio,
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
    res.status(500).json({ success: false, message: "Error al agregar usuario" });
  }
});

// ------------------ BUSCAR FOLIO ------------------
app.get("/buscar/:folio", async (req, res) => {
  try {
    const { folio } = req.params;
    const [rows] = await db.query(
      "SELECT nombre, folio, estado, hub, expediente, fotografia, ref_nombre, num_ref FROM usuarios WHERE folio = ?",
      [folio]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: "No se encontró el número de cliente" });
    }

    res.json({
      success: true,
      usuario: rows[0]
    });
  } catch (err) {
    console.error("❌ Error al buscar:", err);
    res.status(500).json({ success: false, message: "Error al buscar usuario" });
  }
});

// ------------------ GENERAR URL SEGURA DE IMAGEN ------------------
app.get("/imagen/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 60 });
    res.json({ url });
  } catch (err) {
    console.error("❌ Error generando URL:", err);
    res.status(500).json({ error: "No se pudo generar URL segura" });
  }
});

// ------------------ RUTA DE PRUEBA DE CONEXIÓN ------------------
app.get("/api/dbTest", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS result");
    res.json({ message: "✅ Conexión exitosa a la base de datos", result: rows });
  } catch (error) {
    console.error("❌ Error de conexión a la base de datos:", error);
    res.status(500).json({ error: "Error de conexión a la base de datos", details: error.message });
  }
});

// ------------------ INICIAR SERVIDOR ------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;
