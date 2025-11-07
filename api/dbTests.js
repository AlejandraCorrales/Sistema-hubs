import mysql from "mysql2/promise";

export default async function handler(req, res) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || process.env.MYSQLHOST,
      user: process.env.DB_USER || process.env.MYSQLUSER,
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
      database: process.env.DB_NAME || process.env.MYSQLDATABASE,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : (process.env.MYSQLPORT ? Number(process.env.MYSQLPORT) : 3306),
      connectTimeout: 10000
    });

    const [rows] = await connection.query("SELECT 1 + 1 AS result");
    await connection.end();

    res.status(200).json({
      success: true,
      message: "Conexión exitosa a la base de datos",
      results: rows
    });
  } catch (err) {
    console.error("Error en /api/dbTest:", err);
    res.status(500).json({
      success: false,
      message: "Error al conectar a la base de datos",
      error: err.message
    });
  }
}
