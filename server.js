const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const mongoose = require('mongoose');
const Stroke = require('./models/Stroke');

// Inicializar Firebase Admin
try {
    const serviceAccount = require('./firebase-service-account.json');
    initializeApp({ credential: cert(serviceAccount) });
    console.log("Firebase Admin inicializado correctamente.");
} catch (error) {
    console.error("CRÍTICO: Error inicializando Firebase Admin:", error);
    process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Conectar a MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/lienzoDB')
    .then(() => console.log('Conectado a MongoDB localmente.'))
    .catch(err => console.error('Error al conectar a MongoDB:', err));

app.use(express.static(path.join(__dirname, 'public')));

// Buffer para guardar trazos en lote (batching) y no saturar Mongo
let strokesBuffer = [];
let saveTimeout = null;

function saveStrokesToDB() {
    if (strokesBuffer.length === 0) return;
    const strokesToSave = [...strokesBuffer];
    strokesBuffer = []; // Limpiamos el buffer
    
    Stroke.insertMany(strokesToSave)
        .catch(err => console.error("Error guardando trazos en lote:", err));
}

io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Autenticación denegada: No se proporcionó token"));
    try {
        const decodedToken = await getAuth().verifyIdToken(token);
        socket.user = decodedToken;
        next();
    } catch (error) {
        console.error("Token inválido:", error);
        return next(new Error("Autenticación denegada: Token inválido"));
    }
});

io.on('connection', async (socket) => {
    console.log(`Usuario conectado: ${socket.user.name} (${socket.user.email})`);

    // Enviar estado histórico desde MongoDB
    try {
        const history = await Stroke.find().sort({ createdAt: 1 }).limit(10000).exec();
        // Convertimos al formato que espera el frontend
        const mappedHistory = history.map(s => ({
            x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, color: s.color, size: s.size
        }));
        socket.emit('canvas-init', mappedHistory);
    } catch (err) {
        console.error("Error al cargar historial:", err);
    }

    // Escuchar eventos de dibujo
    socket.on('draw', (drawData) => {
        // Añadir el email del usuario al trazo
        const newStroke = { ...drawData, user_email: socket.user.email };
        strokesBuffer.push(newStroke);
        
        // Configurar guardado en lote si no está activo
        if (!saveTimeout) {
            saveTimeout = setTimeout(() => {
                saveStrokesToDB();
                saveTimeout = null;
            }, 3000); // Guarda cada 3 segundos
        }

        // Retransmitir a los demás clientes
        socket.broadcast.emit('draw', drawData);
    });
    
    socket.on('clear', async () => {
        // En una app real validaríamos si es admin. Por ahora limpia todo.
        try {
            await Stroke.deleteMany({});
            strokesBuffer = []; // Limpiar también el buffer pendiente
            io.emit('clear');
        } catch (err) {
            console.error("Error al borrar lienzo:", err);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.user.name}`);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
