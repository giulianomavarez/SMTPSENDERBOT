// migrate.js
const db = require('./db');

// Añadir columnas si no existen
const addColumn = (columnName, type) => {
  db.get(`PRAGMA table_info(users)`, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener información de la tabla:', err);
      return;
    }

    const columns = rows.map(row => row.name);
    if (!columns.includes(columnName)) {
      db.run(`ALTER TABLE users ADD COLUMN ${columnName} ${type}`, (err) => {
        if (err) {
          console.error(`Error al añadir columna ${columnName}:`, err);
        } else {
          console.log(`Columna ${columnName} añadida correctamente.`);
        }
      });
    } else {
      console.log(`La columna ${columnName} ya existe.`);
    }
  });
};

// Añadir las columnas necesarias
addColumn('last_sender_name', 'TEXT');
addColumn('last_subject', 'TEXT');
addColumn('last_letter', 'TEXT');
