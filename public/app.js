import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCNieBPVvHXlVXL8pR53j7vS6y4VgLRCdk",
    authDomain: "lienzo-c0432.firebaseapp.com",
    projectId: "lienzo-c0432",
    storageBucket: "lienzo-c0432.firebasestorage.app",
    messagingSenderId: "988868326313",
    appId: "1:988868326313:web:17261c93d66d8cf1ff0ab8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const loginOverlay = document.getElementById('login-overlay');
const loginBtn = document.getElementById('google-login-btn');

// Socket instance (no autoconnect yet)
const socket = io({ autoConnect: false });

let idToken = null;

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Logueado
        idToken = await user.getIdToken();
        loginOverlay.classList.add('hidden');
        
        // Connect socket with token
        socket.auth = { token: idToken };
        socket.connect();
    } else {
        // No logueado
        loginOverlay.classList.remove('hidden');
        socket.disconnect();
    }
});

// Login Button Click
loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(error => {
        console.error("Error logging in:", error);
        alert("Hubo un error al iniciar sesión.");
    });
});

// --- RESTO DE LA LÓGICA DEL CANVAS ---

const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');

const colorPicker = document.getElementById('color-picker');
const sizeSlider = document.getElementById('size-slider');
const sizeValue = document.getElementById('size-value');
const eraserBtn = document.getElementById('eraser-btn');
const clearBtn = document.getElementById('clear-btn');
const statusDot = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');

let isDrawing = false;
let isEraser = false;
let currentX = 0;
let currentY = 0;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

socket.on('connect', () => {
    statusDot.className = 'status-dot connected';
    statusText.innerText = 'Conectado';
});

socket.on('disconnect', () => {
    statusDot.className = 'status-dot';
    statusText.innerText = 'Desconectado';
});

socket.on('connect_error', (err) => {
    console.error("Error de conexión:", err.message);
    statusText.innerText = 'Error de Auth';
    statusDot.className = 'status-dot';
});

socket.on('canvas-init', (history) => {
    history.forEach(drawData => {
        drawLine(drawData.x0, drawData.y0, drawData.x1, drawData.y1, drawData.color, drawData.size);
    });
});

socket.on('draw', (drawData) => {
    drawLine(drawData.x0, drawData.y0, drawData.x1, drawData.y1, drawData.color, drawData.size);
});

socket.on('clear', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

function drawLine(x0, y0, x1, y1, color, size) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    
    if (color === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = size * 2;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.closePath();
}

function startDrawing(e) {
    if(!idToken) return; // Evitar dibujar si no hay token
    isDrawing = true;
    const pos = getPos(e);
    currentX = pos.x;
    currentY = pos.y;
}

function stopDrawing() {
    isDrawing = false;
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    
    const color = isEraser ? 'eraser' : colorPicker.value;
    const size = sizeSlider.value;

    drawLine(currentX, currentY, pos.x, pos.y, color, size);

    socket.emit('draw', {
        x0: currentX,
        y0: currentY,
        x1: pos.x,
        y1: pos.y,
        color: color,
        size: size
    });

    currentX = pos.x;
    currentY = pos.y;
}

function getPos(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

canvas.addEventListener('touchstart', (e) => {
    if(e.target === canvas) e.preventDefault();
    startDrawing(e);
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
    if(e.target === canvas) e.preventDefault();
    draw(e);
}, { passive: false });
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing);

sizeSlider.addEventListener('input', (e) => { sizeValue.innerText = e.target.value; });
eraserBtn.addEventListener('click', () => {
    isEraser = !isEraser;
    isEraser ? eraserBtn.classList.add('active') : eraserBtn.classList.remove('active');
});
colorPicker.addEventListener('change', () => {
    isEraser = false;
    eraserBtn.classList.remove('active');
});
clearBtn.addEventListener('click', () => {
    if(confirm('¿Limpiar todo el lienzo?')) socket.emit('clear');
});
