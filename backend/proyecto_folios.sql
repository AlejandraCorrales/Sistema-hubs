CREATE DATABASE IF NOT EXISTS proyecto_folios;
USE proyecto_folios;

-- Tabla de usuarios
DROP TABLE IF EXISTS usuarios;
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    folio VARCHAR(20) UNIQUE NOT NULL,
    estado VARCHAR(50) NOT NULL,
    hub VARCHAR(100) DEFAULT NULL,
    expediente VARCHAR(50) DEFAULT NULL,
    fotografia VARCHAR(255) DEFAULT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de login
CREATE TABLE IF NOT EXISTS login (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Usuario de prueba para login
INSERT INTO login (usuario, password) VALUES
('admin', '1234'),
('usuario1', 'password1');