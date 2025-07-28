// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Definir la ruta de la base de datos
const dbPath = path.resolve(__dirname, 'bot.db');

// Crear una instancia de la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite.');
  }
});

// Inicializar la tabla de usuarios si no existe
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      chat_id INTEGER PRIMARY KEY,
      lang TEXT DEFAULT 'es',
      smtp_host TEXT,
      smtp_port INTEGER DEFAULT 587,
      smtp_user TEXT,
      smtp_pass TEXT,
      last_sender_name TEXT,
      last_subject TEXT,
      last_letter TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error al crear la tabla de usuarios:', err.message);
    } else {
      console.log('Tabla de usuarios lista.');
    }
  });
});

module.exports = db;
