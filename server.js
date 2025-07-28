// server.js
require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Respuesta básica para mantener el servicio activo
app.get('/', (req, res) => {
  res.send('Bot SMTP corriendo...');
});

// Iniciar servidor HTTP (para Render)
app.listen(port, () => {
  console.log(`Servidor HTTP escuchando en puerto ${port}`);
});

// Importar y lanzar el bot de Telegram
require('./bot'); // Aquí se lanza tu bot.js
