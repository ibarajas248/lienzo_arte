const express = require('express');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const mongoose = require('mongoose');
const sharp = require('sharp');
const Stroke = require('./models/Stroke');
const StrokeBatch = require('./models/StrokeBatch');
const TileSnapshot = require('./models/TileSnapshot');

let firebaseAuth = null;

try {
    const serviceAccount = require('./firebase-service-account.json');
    initializeApp({ credential: cert(serviceAccount) });
    firebaseAuth = getAuth();
    console.log('Firebase Admin inicializado correctamente.');
} catch (error) {
    console.warn('Firebase Admin no disponible; acceso anonimo habilitado temporalmente:', error.message);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    perMessageDeflate: false,
    httpCompression: false,
    maxHttpBufferSize: 1e6
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lienzoDB';
const CANVAS_CONTROL_PATH = path.join(__dirname, 'canvas-control.json');
const FIREBASE_WEB_CONFIG_PATH = path.join(__dirname, 'firebase-web-config.json');
const DEFAULT_CANVAS_CONTROL = { width: 1280, height: 2400, entryScrollY: 0 };
const CANVAS_ID = 'main';
const ADMIN_EMAILS = new Set(
    String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'ivanbarajashurtado@gmail.com')
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(Boolean)
);
const TILE_SIZE = 1024;
const WORLD_COORD_LIMIT = 1000000000;
const MAX_BATCH_STROKES = 500;
const MAX_TILE_SUBSCRIPTIONS = 120;
const MAX_TILE_REQUESTS = 120;
const MAX_SEGMENTS_PER_TILE = 30000;
const MAX_ADMIN_SEGMENTS_PER_TILE = 80000;
const MAX_UNDO_SEGMENTS = 10000;
const MAX_EXPORT_SEGMENTS = 60000;
const MAX_EXPORT_TILE_SEGMENTS = 140000;
const MAX_EXPORT_TILES = 800;
const MAX_EXPORT_DIMENSION = 250000;
const MAX_EXPORT_RASTER_PIXELS = 36000000;
const MAX_SNAPSHOT_JPEG_PIXELS = 48000000;
const MAX_SNAPSHOT_EXPORT_TILES = 5000;
const MAX_EXPORT_JPEG_DIMENSION = 65000;
const EXPORT_JPEG_QUALITY = 92;
const SAVE_INTERVAL_MS = 1000;
const BATCH_DOC_SEGMENT_LIMIT = 500;
const MAX_VECTOR_RECT_SIZE = TILE_SIZE;
const MAX_TEXT_LENGTH = 240;
const MAX_TEXT_LINES = 32;
const MAX_TEXT_FONT_SIZE = 160;
const MAX_SEGMENT_TILE_COPIES = 64;
const DEFAULT_TEXT_FONT_FAMILY = 'Inter, Arial, sans-serif';
const JSON_COMPRESSION_MIN_BYTES = 4096;
const SNAPSHOT_FILENAME_PATTERN = /^tile-\d+-\d+\.(svg|webp)$/;
const SNAPSHOT_CANVAS_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_OVERVIEW_ROWS = 20000;
const MAX_OVERVIEW_SNAPSHOT_TILES = 2000;
const MINIMAP_META_FILENAME = 'minimap.json';
const FIREBASE_WEB_CONFIG_KEYS = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
    'measurementId'
];
const gzipAsync = promisify(zlib.gzip);
let serverSegmentOrder = Date.now() * 1000;

function normalizeCanvasControl(control) {
    const width = Number(control.width);
    const height = Number(control.height);
    const entryScrollY = Number(control.entryScrollY);
    const normalizedHeight = Number.isFinite(height) && height > 0
        ? Math.round(height)
        : DEFAULT_CANVAS_CONTROL.height;

    return {
        width: Number.isFinite(width) && width > 0 ? Math.round(width) : DEFAULT_CANVAS_CONTROL.width,
        height: normalizedHeight,
        entryScrollY: Number.isFinite(entryScrollY)
            ? Math.min(Math.max(Math.round(entryScrollY), 0), normalizedHeight)
            : DEFAULT_CANVAS_CONTROL.entryScrollY,
        tileSize: TILE_SIZE,
        canvasId: CANVAS_ID
    };
}

function loadCanvasControl() {
    try {
        const rawControl = fs.readFileSync(CANVAS_CONTROL_PATH, 'utf8');
        return normalizeCanvasControl(JSON.parse(rawControl));
    } catch (error) {
        console.error('Error leyendo canvas-control.json, usando valores por defecto:', error.message);
        return normalizeCanvasControl(DEFAULT_CANVAS_CONTROL);
    }
}

function readFirebaseWebConfigFile() {
    try {
        if (!fs.existsSync(FIREBASE_WEB_CONFIG_PATH)) return {};
        const config = JSON.parse(fs.readFileSync(FIREBASE_WEB_CONFIG_PATH, 'utf8'));
        return config && typeof config === 'object' ? config : {};
    } catch (error) {
        console.warn('No se pudo leer firebase-web-config.json:', error.message);
        return {};
    }
}

function getEnvFirebaseWebConfig() {
    return {
        apiKey: process.env.FIREBASE_WEB_API_KEY,
        authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_WEB_PROJECT_ID,
        storageBucket: process.env.FIREBASE_WEB_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_WEB_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_WEB_APP_ID,
        measurementId: process.env.FIREBASE_WEB_MEASUREMENT_ID
    };
}

function compactFirebaseWebConfig(config) {
    const compacted = {};
    for (const key of FIREBASE_WEB_CONFIG_KEYS) {
        const value = config[key];
        if (typeof value === 'string' && value.trim()) {
            compacted[key] = value.trim();
        }
    }
    return compacted;
}

function getFirebaseWebConfigStatus() {
    const fileConfig = readFirebaseWebConfigFile();
    const envConfig = compactFirebaseWebConfig(getEnvFirebaseWebConfig());
    const config = compactFirebaseWebConfig({ ...fileConfig, ...envConfig });
    const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
    const missing = requiredKeys.filter(key => !config[key]);

    return {
        enabled: missing.length === 0,
        config,
        missing
    };
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function buildUserProfile(decodedToken = {}) {
    const email = normalizeEmail(decodedToken.email || decodedToken.uid || 'anonymous');
    return {
        uid: String(decodedToken.uid || ''),
        email,
        name: String(decodedToken.name || decodedToken.displayName || email || 'Usuario'),
        isAnonymous: email === 'anonymous'
    };
}

function isAdminProfile(user) {
    return Boolean(user && ADMIN_EMAILS.has(normalizeEmail(user.email)));
}

function getBearerToken(req) {
    const authorization = String(req.headers.authorization || '');
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : '';
}

async function requireAdmin(req, res, next) {
    if (!firebaseAuth) {
        return res.status(503).json({ error: 'firebase_admin_unavailable' });
    }

    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'auth_required' });

    try {
        const decodedToken = await firebaseAuth.verifyIdToken(token);
        const user = buildUserProfile(decodedToken);
        if (!isAdminProfile(user)) {
            return res.status(403).json({ error: 'admin_required' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Token admin invalido:', error.message);
        return res.status(401).json({ error: 'invalid_token' });
    }
}

let canvasControlCache = loadCanvasControl();
fs.watchFile(CANVAS_CONTROL_PATH, { interval: 5000 }, () => {
    canvasControlCache = loadCanvasControl();
});

function tileForPoint(x, y) {
    return {
        tileX: Math.floor(x / TILE_SIZE),
        tileY: Math.floor(y / TILE_SIZE)
    };
}

function maxHorizontalTileX() {
    return Math.ceil(canvasControlCache.width / TILE_SIZE) - 1;
}

function isAllowedTile(tileX, tileY) {
    return Number.isInteger(tileX)
        && Number.isInteger(tileY)
        && tileX >= 0
        && tileX <= maxHorizontalTileX()
        && tileY >= 0
        && tileY <= 1000000;
}

function tileForSegment(segment) {
    let midX;
    let midY;

    if (segment.kind === 'rect' || segment.kind === 'text') {
        midX = Number(segment.x) + (Number(segment.width) || 0) / 2;
        midY = Number(segment.y) + (Number(segment.height) || 0) / 2;
    } else {
        midX = (Number(segment.x0) + Number(segment.x1)) / 2;
        midY = (Number(segment.y0) + Number(segment.y1)) / 2;
    }

    midX = Math.min(Math.max(Number.isFinite(midX) ? midX : 0, 0), canvasControlCache.width);
    midY = Math.max(Number.isFinite(midY) ? midY : 0, 0);
    return tileForPoint(midX, midY);
}

function segmentBoundsForTiles(segment) {
    if (!segment || typeof segment !== 'object') return null;

    if (segment.kind === 'rect') {
        const x = Number(segment.x);
        const y = Number(segment.y);
        const width = Number(segment.width);
        const height = Number(segment.height);
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
        return { left: x, top: y, right: x + width, bottom: y + height };
    }

    if (segment.kind === 'text') {
        const x = Number(segment.x);
        const y = Number(segment.y);
        const size = Math.min(Math.max(Number(segment.size) || 36, 6), MAX_TEXT_FONT_SIZE);
        const text = normalizeTextValue(segment.text);
        if (![x, y].every(Number.isFinite) || !text) return null;
        const width = Number(segment.width);
        const height = Number(segment.height);
        const metrics = estimateTextMetrics(text, size);
        return {
            left: x,
            top: y,
            right: x + (Number.isFinite(width) && width > 0 ? width : metrics.width),
            bottom: y + (Number.isFinite(height) && height > 0 ? height : metrics.height)
        };
    }

    const x0 = Number(segment.x0);
    const y0 = Number(segment.y0);
    const x1 = Number(segment.x1);
    const y1 = Number(segment.y1);
    const size = Math.max(1, Number(segment.size) || 1);
    if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
    const radius = (segment.color === 'eraser' ? size * 2 : size) / 2 + 2;
    return {
        left: Math.min(x0, x1) - radius,
        top: Math.min(y0, y1) - radius,
        right: Math.max(x0, x1) + radius,
        bottom: Math.max(y0, y1) + radius
    };
}

function tileKeysForSegment(segment) {
    const bounds = segmentBoundsForTiles(segment);
    if (!bounds) {
        const tile = tileForSegment(segment);
        return [tileKey(tile.tileX, tile.tileY)];
    }

    const maxTileX = maxHorizontalTileX();
    const minTileX = Math.min(Math.max(Math.floor(Math.max(bounds.left, 0) / TILE_SIZE), 0), maxTileX);
    const maxSegmentTileX = Math.min(Math.max(Math.floor(Math.max(bounds.right - 0.001, bounds.left) / TILE_SIZE), minTileX), maxTileX);
    const minTileY = Math.max(Math.floor(Math.max(bounds.top, 0) / TILE_SIZE), 0);
    const maxTileY = Math.max(Math.floor(Math.max(bounds.bottom - 0.001, bounds.top) / TILE_SIZE), minTileY);
    const keys = [];

    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
        for (let tileX = minTileX; tileX <= maxSegmentTileX; tileX += 1) {
            keys.push(tileKey(tileX, tileY));
            if (keys.length >= MAX_SEGMENT_TILE_COPIES) return keys;
        }
    }

    return keys.length > 0 ? keys : [tileKey(minTileX, minTileY)];
}

function tileKey(tileX, tileY) {
    return `${tileX}:${tileY}`;
}

function roomName(tileX, tileY) {
    return `${CANVAS_ID}:tile:${tileX}:${tileY}`;
}

function parseTileKey(rawKey) {
    if (typeof rawKey !== 'string') return null;
    const parts = rawKey.split(':');
    if (parts.length !== 2) return null;

    const tileX = Number(parts[0]);
    const tileY = Number(parts[1]);
    if (!isAllowedTile(tileX, tileY)) return null;

    return { tileX, tileY, key: tileKey(tileX, tileY) };
}

function parseTileList(rawTiles, maxTiles) {
    const values = Array.isArray(rawTiles)
        ? rawTiles
        : String(rawTiles || '').split(',');
    const parsed = [];
    const seen = new Set();

    for (const rawValue of values) {
        const tile = parseTileKey(String(rawValue).trim());
        if (!tile || seen.has(tile.key)) continue;

        parsed.push(tile);
        seen.add(tile.key);
        if (parsed.length >= maxTiles) break;
    }

    return parsed;
}

function parseUndoOrders(rawOrders, maxOrders) {
    if (!Array.isArray(rawOrders)) return [];

    const parsed = [];
    const seen = new Set();

    for (const rawOrder of rawOrders) {
        const order = Number(rawOrder);
        if (
            !Number.isFinite(order)
            || order <= 0
            || order > Number.MAX_SAFE_INTEGER
            || seen.has(order)
        ) {
            continue;
        }

        const normalizedOrder = Math.round(order);
        parsed.push(normalizedOrder);
        seen.add(normalizedOrder);
        if (parsed.length >= maxOrders) break;
    }

    return parsed;
}

async function sendJsonResponse(req, res, payload) {
    const body = Buffer.from(JSON.stringify(payload));
    const acceptEncoding = String(req.headers['accept-encoding'] || '');

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Vary', 'Accept-Encoding');

    if (body.length < JSON_COMPRESSION_MIN_BYTES || !/\bgzip\b/.test(acceptEncoding)) {
        res.send(body);
        return;
    }

    const compressed = await gzipAsync(body, { level: zlib.constants.Z_BEST_SPEED });
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', compressed.length);
    res.send(compressed);
}

function isHexColor(color) {
    return /^#[0-9a-fA-F]{6}$/.test(color);
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function nextServerSegmentOrder() {
    serverSegmentOrder = Math.max(serverSegmentOrder + 1, Date.now() * 1000);
    return serverSegmentOrder;
}

function normalizeSegmentOrder(drawData) {
    const order = Number(drawData.order);
    if (Number.isFinite(order) && order > 0 && order <= Number.MAX_SAFE_INTEGER) {
        serverSegmentOrder = Math.max(serverSegmentOrder, Math.round(order));
        return Math.round(order);
    }

    return nextServerSegmentOrder();
}

function normalizeSegmentOpacity(drawData) {
    const opacity = Number(drawData && drawData.opacity);
    if (!Number.isFinite(opacity)) return 1;
    return Math.min(Math.max(opacity, 0.05), 1);
}

function normalizeSegment(drawData) {
    if (!drawData || typeof drawData !== 'object') return null;
    const kind = String(drawData.kind || 'line');
    if (kind === 'rect') return normalizeVectorRect(drawData);
    if (kind === 'text') return normalizeTextSegment(drawData);
    return normalizeLineSegment(drawData);
}

function normalizeLineSegment(drawData) {
    const x0 = Number(drawData.x0);
    const y0 = Number(drawData.y0);
    const x1 = Number(drawData.x1);
    const y1 = Number(drawData.y1);
    const size = Number(drawData.size);
    const color = String(drawData.color || '');
    const width = canvasControlCache.width;

    const isValid = [x0, y0, x1, y1, size].every(Number.isFinite)
        && x0 >= 0 && x0 <= width
        && x1 >= 0 && x1 <= width
        && y0 >= 0 && y0 <= WORLD_COORD_LIMIT
        && y1 >= 0 && y1 <= WORLD_COORD_LIMIT
        && size > 0 && size <= 200
        && (color === 'eraser' || isHexColor(color));

    if (!isValid) return null;

    return {
        kind: 'line',
        x0,
        y0,
        x1,
        y1,
        color,
        size,
        opacity: color === 'eraser' ? 1 : normalizeSegmentOpacity(drawData),
        order: normalizeSegmentOrder(drawData)
    };
}

function normalizeVectorRect(drawData) {
    const x = Number(drawData.x);
    const y = Number(drawData.y);
    const width = Number(drawData.width);
    const height = Number(drawData.height);
    const color = String(drawData.color || '');
    const canvasWidth = canvasControlCache.width;

    const isValid = [x, y, width, height].every(Number.isFinite)
        && x >= 0
        && y >= 0
        && width > 0
        && height > 0
        && width <= MAX_VECTOR_RECT_SIZE
        && height <= MAX_VECTOR_RECT_SIZE
        && x + width <= canvasWidth
        && y + height <= WORLD_COORD_LIMIT
        && isHexColor(color);

    if (!isValid) return null;

    return { kind: 'rect', x, y, width, height, color, order: normalizeSegmentOrder(drawData) };
}

function normalizeTextValue(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[^\S\n]+/g, ' ')
        .split('\n')
        .slice(0, MAX_TEXT_LINES)
        .map(line => line.trim().slice(0, 80))
        .join('\n')
        .trim()
        .slice(0, MAX_TEXT_LENGTH);
}

function normalizeTextFontFamily(value) {
    const fontFamily = String(value || '').trim();
    if (!fontFamily || fontFamily.length > 80) return DEFAULT_TEXT_FONT_FAMILY;
    if (!/^[a-zA-Z0-9\s,'-]+$/.test(fontFamily)) return DEFAULT_TEXT_FONT_FAMILY;
    return fontFamily;
}

function estimateTextMetrics(text, size) {
    const lines = String(text || '').split('\n').filter(line => line.length > 0);
    const lineHeight = Math.round(size * 1.22);
    const maxChars = lines.reduce((max, line) => Math.max(max, line.length), 1);
    return {
        width: Math.max(1, Math.ceil(maxChars * size * 0.62)),
        height: Math.max(lineHeight, Math.ceil(lines.length * lineHeight)),
        lineHeight
    };
}

function normalizeTextSegment(drawData) {
    const x = Number(drawData.x);
    const y = Number(drawData.y);
    const size = Number(drawData.size);
    const color = String(drawData.color || '');
    const text = normalizeTextValue(drawData.text);
    const fontFamily = normalizeTextFontFamily(drawData.fontFamily);
    const canvasWidth = canvasControlCache.width;

    const isValid = [x, y, size].every(Number.isFinite)
        && x >= 0
        && x <= canvasWidth
        && y >= 0
        && y <= WORLD_COORD_LIMIT
        && size >= 6
        && size <= MAX_TEXT_FONT_SIZE
        && text.length > 0
        && isHexColor(color);

    if (!isValid) return null;

    const metrics = estimateTextMetrics(text, size);
    const width = Number(drawData.width);
    const height = Number(drawData.height);

    return {
        kind: 'text',
        x,
        y,
        text,
        color,
        size,
        fontFamily,
        width: Number.isFinite(width) && width > 0 ? Math.min(width, canvasWidth) : metrics.width,
        height: Number.isFinite(height) && height > 0 ? Math.min(height, size * MAX_TEXT_LINES * 1.5) : metrics.height,
        order: normalizeSegmentOrder(drawData)
    };
}

function acceptStrokes(rawStrokes) {
    if (!Array.isArray(rawStrokes)) return [];

    return rawStrokes
        .slice(0, MAX_BATCH_STROKES)
        .map(normalizeSegment)
        .filter(Boolean);
}

function groupSegmentsByTile(segments) {
    const groups = new Map();

    for (const segment of segments) {
        for (const key of tileKeysForSegment(segment)) {
            const tile = parseTileKey(key);
            if (!tile) continue;
            if (!groups.has(key)) groups.set(key, { tileX: tile.tileX, tileY: tile.tileY, segments: [] });
            groups.get(key).segments.push(segment);
        }
    }

    return groups;
}

function chunkSegments(segments, chunkSize) {
    const chunks = [];
    for (let index = 0; index < segments.length; index += chunkSize) {
        chunks.push(segments.slice(index, index + chunkSize));
    }
    return chunks;
}

let tileSaveBuffer = new Map();
let saveTimeout = null;
let activeSavePromise = null;

async function saveTileBufferToDB() {
    if (activeSavePromise) {
        try {
            await activeSavePromise;
        } catch (error) {
            // The original saver already logged the error.
        }
    }

    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }

    if (tileSaveBuffer.size === 0) return;
    const bufferToSave = tileSaveBuffer;
    tileSaveBuffer = new Map();
    const docs = [];

    for (const tileGroup of bufferToSave.values()) {
        for (const segmentChunk of chunkSegments(tileGroup.segments, BATCH_DOC_SEGMENT_LIMIT)) {
            docs.push({
                canvasId: CANVAS_ID,
                tileX: tileGroup.tileX,
                tileY: tileGroup.tileY,
                segments: segmentChunk,
                user_email: tileGroup.userEmail,
                user_name: tileGroup.userName,
                user_uid: tileGroup.userUid
            });
        }
    }

    if (docs.length === 0) return;

    try {
        activeSavePromise = StrokeBatch.insertMany(docs, { ordered: false });
        await activeSavePromise;
    } catch (err) {
        console.error('Error guardando lotes por tile:', err.message);
    } finally {
        activeSavePromise = null;
    }
}

function scheduleSave() {
    if (!saveTimeout) saveTimeout = setTimeout(saveTileBufferToDB, SAVE_INTERVAL_MS);
}

function addSegmentsToSaveBuffer(tileGroups, userProfile) {
    const userEmail = normalizeEmail(userProfile && userProfile.email) || 'anonymous';
    const userName = String((userProfile && userProfile.name) || userEmail);
    const userUid = String((userProfile && userProfile.uid) || '');

    for (const group of tileGroups.values()) {
        const key = `${tileKey(group.tileX, group.tileY)}:${userEmail}`;
        if (!tileSaveBuffer.has(key)) {
            tileSaveBuffer.set(key, {
                tileX: group.tileX,
                tileY: group.tileY,
                userEmail,
                userName,
                userUid,
                segments: []
            });
        }

        tileSaveBuffer.get(key).segments.push(...group.segments);
    }
    scheduleSave();
}

function decorateSegmentsForClient(segments, userProfile) {
    const userEmail = normalizeEmail(userProfile && userProfile.email) || 'anonymous';
    const userName = String((userProfile && userProfile.name) || userEmail);
    const userUid = String((userProfile && userProfile.uid) || '');

    return segments.map(segment => ({
        ...segment,
        userEmail,
        userName,
        userUid
    }));
}

function removeOrdersFromSaveBuffer(orderSet, userEmail) {
    const changedTileKeys = new Set();

    for (const [key, group] of tileSaveBuffer) {
        if (!group || group.userEmail !== userEmail || !Array.isArray(group.segments)) continue;

        const beforeCount = group.segments.length;
        group.segments = group.segments.filter(segment => !orderSet.has(Number(segment.order)));

        if (group.segments.length !== beforeCount) {
            changedTileKeys.add(tileKey(group.tileX, group.tileY));
        }

        if (group.segments.length === 0) {
            tileSaveBuffer.delete(key);
        }
    }

    return changedTileKeys;
}

async function removeOrdersFromDatabase(orders, tiles, userEmail) {
    const filter = {
        canvasId: CANVAS_ID,
        user_email: userEmail,
        'segments.order': { $in: orders }
    };

    if (tiles.length > 0) {
        filter.$or = tiles.map(tile => ({ tileX: tile.tileX, tileY: tile.tileY }));
    }

    const result = await StrokeBatch.updateMany(filter, {
        $pull: {
            segments: {
                order: { $in: orders }
            }
        }
    });

    await StrokeBatch.deleteMany({
        canvasId: CANVAS_ID,
        user_email: userEmail,
        segments: { $size: 0 }
    });

    return result.modifiedCount || 0;
}

async function fetchTilePayload(tileList) {
    if (tileList.length === 0) return [];

    const tileFilters = tileList.map(tile => ({ tileX: tile.tileX, tileY: tile.tileY }));
    const snapshots = await TileSnapshot.find({
        canvasId: CANVAS_ID,
        $or: tileFilters
    })
        .select('tileX tileY upToOrder segmentCount width height path byteSize generatedAt -_id')
        .lean()
        .exec();
    const snapshotMap = new Map();
    for (const snapshot of snapshots) {
        snapshotMap.set(tileKey(snapshot.tileX, snapshot.tileY), snapshot);
    }

    const batchFilters = tileList.map(tile => {
        const snapshot = snapshotMap.get(tile.key);
        const upToOrder = Number(snapshot && snapshot.upToOrder) || 0;
        const filter = { tileX: tile.tileX, tileY: tile.tileY };
        if (upToOrder > 0) filter['segments.order'] = { $gt: upToOrder };
        return filter;
    });

    const batches = await StrokeBatch.find({
        canvasId: CANVAS_ID,
        $or: batchFilters
    })
        .sort({ createdAt: 1 })
        .select('tileX tileY segments createdAt -_id')
        .lean()
        .exec();

    const grouped = new Map();
    for (const tile of tileList) {
        const snapshot = snapshotMap.get(tile.key);
        grouped.set(tile.key, {
            tileX: tile.tileX,
            tileY: tile.tileY,
            snapshot: snapshot
                ? {
                    url: `${snapshot.path}?v=${new Date(snapshot.generatedAt || 0).getTime()}`,
                    upToOrder: Number(snapshot.upToOrder) || 0,
                    segmentCount: Number(snapshot.segmentCount) || 0,
                    width: Number(snapshot.width) || TILE_SIZE,
                    height: Number(snapshot.height) || TILE_SIZE,
                    byteSize: Number(snapshot.byteSize) || 0,
                    generatedAt: snapshot.generatedAt
                }
                : null,
            segments: []
        });
    }

    for (const batch of batches) {
        const key = tileKey(batch.tileX, batch.tileY);
        const target = grouped.get(key);
        if (!target || target.segments.length >= MAX_SEGMENTS_PER_TILE) continue;

        const available = MAX_SEGMENTS_PER_TILE - target.segments.length;
        const batchOrder = new Date(batch.createdAt || 0).getTime() * 1000;
        const snapshotOrder = Number(target.snapshot && target.snapshot.upToOrder) || 0;
        const segments = batch.segments
            .map((segment, index) => ({
                ...segment,
                order: Number.isFinite(Number(segment.order))
                    ? Number(segment.order)
                    : batchOrder + index
            }))
            .filter(segment => Number(segment.order) > snapshotOrder)
            .slice(0, available);
        target.segments.push(...segments);
    }

    return Array.from(grouped.values());
}

async function fetchCanvasOverview() {
    const [snapshots, latestBatch] = await Promise.all([
        TileSnapshot.find({ canvasId: CANVAS_ID })
            .sort({ tileY: 1, tileX: 1 })
            .select('tileX tileY segmentCount width height path byteSize generatedAt -_id')
            .lean()
            .exec(),
        StrokeBatch.findOne({ canvasId: CANVAS_ID })
            .sort({ tileY: -1 })
            .select('tileY -_id')
            .lean()
            .exec()
    ]);

    const rowsByTileY = new Map();
    const snapshotTiles = [];
    let maxSnapshotTileY = -1;

    for (const snapshot of snapshots) {
        const tileY = Number(snapshot.tileY);
        const tileX = Number(snapshot.tileX);
        if (!Number.isInteger(tileY) || !Number.isInteger(tileX)) continue;

        maxSnapshotTileY = Math.max(maxSnapshotTileY, tileY);
        if (!rowsByTileY.has(tileY)) {
            rowsByTileY.set(tileY, {
                tileY,
                tileCount: 0,
                segmentCount: 0,
                byteSize: 0,
                columns: []
            });
        }

        const row = rowsByTileY.get(tileY);
        row.tileCount += 1;
        row.segmentCount += Number(snapshot.segmentCount) || 0;
        row.byteSize += Number(snapshot.byteSize) || 0;
        if (row.columns.length < 8) row.columns.push(tileX);

        if (snapshotTiles.length < MAX_OVERVIEW_SNAPSHOT_TILES && snapshot.path) {
            snapshotTiles.push({
                tileX,
                tileY,
                url: `${snapshot.path}?v=${new Date(snapshot.generatedAt || 0).getTime()}`,
                width: Number(snapshot.width) || TILE_SIZE,
                height: Number(snapshot.height) || TILE_SIZE,
                segmentCount: Number(snapshot.segmentCount) || 0,
                byteSize: Number(snapshot.byteSize) || 0
            });
        }
    }

    const rows = Array.from(rowsByTileY.values())
        .sort((a, b) => a.tileY - b.tileY)
        .slice(0, MAX_OVERVIEW_ROWS);
    const latestTileY = Number(latestBatch && latestBatch.tileY);
    const maxTileY = Math.max(maxSnapshotTileY, Number.isFinite(latestTileY) ? latestTileY : -1);
    const contentHeight = Math.max(canvasControlCache.height, (maxTileY + 1) * TILE_SIZE);
    const minimapSnapshot = readMinimapSnapshotMetadata(contentHeight);

    return {
        canvasId: CANVAS_ID,
        width: canvasControlCache.width,
        height: contentHeight,
        configuredHeight: canvasControlCache.height,
        tileSize: TILE_SIZE,
        rows,
        minimapSnapshot,
        snapshotTiles: minimapSnapshot ? [] : snapshotTiles,
        truncatedSnapshots: snapshots.length > MAX_OVERVIEW_SNAPSHOT_TILES,
        truncated: rowsByTileY.size > MAX_OVERVIEW_ROWS
    };
}

async function fetchContributors() {
    const contributors = await StrokeBatch.aggregate([
        { $match: { canvasId: CANVAS_ID } },
        {
            $project: {
                user_email: { $ifNull: ['$user_email', 'anonymous'] },
                user_name: { $ifNull: ['$user_name', ''] },
                user_uid: { $ifNull: ['$user_uid', ''] },
                segmentCount: { $size: '$segments' },
                createdAt: 1
            }
        },
        {
            $group: {
                _id: '$user_email',
                name: { $last: '$user_name' },
                uid: { $last: '$user_uid' },
                batchCount: { $sum: 1 },
                segmentCount: { $sum: '$segmentCount' },
                latestAt: { $max: '$createdAt' }
            }
        },
        { $sort: { segmentCount: -1, latestAt: -1 } },
        { $limit: 500 }
    ]);

    return contributors.map(contributor => {
        const email = normalizeEmail(contributor._id || 'anonymous');
        return {
            email,
            name: contributor.name || email,
            uid: contributor.uid || '',
            batchCount: contributor.batchCount || 0,
            segmentCount: contributor.segmentCount || 0,
            latestAt: contributor.latestAt || null
        };
    });
}

async function fetchAdminTilePayload(tileList) {
    if (tileList.length === 0) return [];

    const tileFilters = tileList.map(tile => ({ tileX: tile.tileX, tileY: tile.tileY }));
    const batches = await StrokeBatch.find({
        canvasId: CANVAS_ID,
        $or: tileFilters
    })
        .sort({ createdAt: 1 })
        .select('tileX tileY segments user_email user_name user_uid createdAt -_id')
        .lean()
        .exec();

    const grouped = new Map();
    for (const tile of tileList) {
        grouped.set(tile.key, {
            tileX: tile.tileX,
            tileY: tile.tileY,
            segments: []
        });
    }

    for (const batch of batches) {
        const key = tileKey(batch.tileX, batch.tileY);
        const target = grouped.get(key);
        if (!target || target.segments.length >= MAX_ADMIN_SEGMENTS_PER_TILE) continue;

        const available = MAX_ADMIN_SEGMENTS_PER_TILE - target.segments.length;
        const batchOrder = new Date(batch.createdAt || 0).getTime() * 1000;
        const userEmail = normalizeEmail(batch.user_email || 'anonymous');
        const userName = String(batch.user_name || userEmail);
        const userUid = String(batch.user_uid || '');
        const segments = (Array.isArray(batch.segments) ? batch.segments : [])
            .map((segment, index) => ({
                ...segment,
                order: Number.isFinite(Number(segment.order))
                    ? Number(segment.order)
                    : batchOrder + index,
                userEmail,
                userName,
                userUid
            }))
            .slice(0, available);

        target.segments.push(...segments);
    }

    return Array.from(grouped.values());
}

function normalizeExportArea(rawArea = {}) {
    const rawX = Number(rawArea.x);
    const rawY = Number(rawArea.y);
    const rawWidth = Number(rawArea.width);
    const rawHeight = Number(rawArea.height);

    if (![rawX, rawY, rawWidth, rawHeight].every(Number.isFinite)) return null;

    const left = Math.max(Math.min(rawX, rawX + rawWidth), 0);
    const right = Math.min(Math.max(rawX, rawX + rawWidth), canvasControlCache.width);
    const top = Math.max(Math.min(rawY, rawY + rawHeight), 0);
    const bottom = Math.min(Math.max(rawY, rawY + rawHeight), WORLD_COORD_LIMIT);
    const width = Math.round(right - left);
    const height = Math.round(bottom - top);

    if (width <= 0 || height <= 0) return null;
    if (width > MAX_EXPORT_DIMENSION || height > MAX_EXPORT_DIMENSION) {
        const error = new Error('export_area_too_large');
        error.status = 413;
        throw error;
    }

    return {
        x: Math.round(left),
        y: Math.round(top),
        width,
        height
    };
}

function validateRasterExportArea(area) {
    const pixelCount = area.width * area.height;
    if (
        area.width > MAX_EXPORT_JPEG_DIMENSION
        || area.height > MAX_EXPORT_JPEG_DIMENSION
        || pixelCount > MAX_EXPORT_RASTER_PIXELS
    ) {
        const error = new Error(`export_raster_area_too_large:${pixelCount}`);
        error.status = 413;
        error.details = {
            pixelCount,
            maxRasterPixels: MAX_EXPORT_RASTER_PIXELS,
            maxJpegDimension: MAX_EXPORT_JPEG_DIMENSION
        };
        throw error;
    }
}

function snapshotFilePathFromPublicPath(publicPath) {
    const rawPath = String(publicPath || '').split('?')[0];
    const filename = path.basename(rawPath);
    if (!SNAPSHOT_FILENAME_PATTERN.test(filename)) return null;

    const expectedPrefix = `/snapshots/${CANVAS_ID}/`;
    if (!rawPath.startsWith(expectedPrefix)) return null;

    const filePath = path.join(__dirname, 'public', 'snapshots', CANVAS_ID, filename);
    if (!fs.existsSync(filePath)) return null;
    return filePath;
}

function getSnapshotJpegScale(area) {
    const pixelCount = area.width * area.height;
    const pixelScale = pixelCount <= MAX_SNAPSHOT_JPEG_PIXELS ? 1 : Math.sqrt(MAX_SNAPSHOT_JPEG_PIXELS / pixelCount);
    const dimensionScale = Math.min(
        1,
        MAX_EXPORT_JPEG_DIMENSION / Math.max(area.width, 1),
        MAX_EXPORT_JPEG_DIMENSION / Math.max(area.height, 1)
    );
    return Math.max(0.02, Math.min(pixelScale, dimensionScale));
}

function scaledSize(value, scale) {
    return Math.max(1, Math.round(value * scale));
}

function getExportTileRange(area) {
    const paddingTiles = 1;
    const minTileX = Math.max(Math.floor(area.x / TILE_SIZE) - paddingTiles, 0);
    const maxTileX = Math.min(Math.floor((area.x + area.width) / TILE_SIZE) + paddingTiles, maxHorizontalTileX());
    const minTileY = Math.max(Math.floor(area.y / TILE_SIZE) - paddingTiles, 0);
    const maxTileY = Math.floor((area.y + area.height) / TILE_SIZE) + paddingTiles;
    const tileCount = Math.max(0, maxTileX - minTileX + 1) * Math.max(0, maxTileY - minTileY + 1);

    if (tileCount > MAX_EXPORT_TILES) {
        const error = new Error('export_area_too_many_tiles');
        error.status = 413;
        throw error;
    }

    return { minTileX, maxTileX, minTileY, maxTileY };
}

async function estimateExportTileSegments(range) {
    const [result] = await StrokeBatch.aggregate([
        {
            $match: {
                canvasId: CANVAS_ID,
                tileX: { $gte: range.minTileX, $lte: range.maxTileX },
                tileY: { $gte: range.minTileY, $lte: range.maxTileY }
            }
        },
        {
            $project: {
                segmentCount: { $size: '$segments' }
            }
        },
        {
            $group: {
                _id: null,
                batchCount: { $sum: 1 },
                segmentCount: { $sum: '$segmentCount' }
            }
        }
    ]).exec();

    return {
        batchCount: Number(result && result.batchCount) || 0,
        segmentCount: Number(result && result.segmentCount) || 0
    };
}

function segmentBounds(segment) {
    if (!segment || typeof segment !== 'object') return null;

    if (segment.kind === 'rect') {
        const x = Number(segment.x);
        const y = Number(segment.y);
        const width = Number(segment.width);
        const height = Number(segment.height);
        if (![x, y, width, height].every(Number.isFinite)) return null;
        return { left: x, top: y, right: x + width, bottom: y + height };
    }

    if (segment.kind === 'text') {
        const x = Number(segment.x);
        const y = Number(segment.y);
        const size = Number(segment.size) || 36;
        const text = normalizeTextValue(segment.text);
        const metrics = estimateTextMetrics(text, size);
        const width = Number(segment.width);
        const height = Number(segment.height);
        if (![x, y].every(Number.isFinite) || !text) return null;
        return {
            left: x,
            top: y,
            right: x + (Number.isFinite(width) && width > 0 ? width : metrics.width),
            bottom: y + (Number.isFinite(height) && height > 0 ? height : metrics.height)
        };
    }

    const x0 = Number(segment.x0);
    const y0 = Number(segment.y0);
    const x1 = Number(segment.x1);
    const y1 = Number(segment.y1);
    const size = Number(segment.size) || 1;
    if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
    const radius = Math.max(1, (segment.color === 'eraser' ? size * 2 : size) / 2);

    return {
        left: Math.min(x0, x1) - radius,
        top: Math.min(y0, y1) - radius,
        right: Math.max(x0, x1) + radius,
        bottom: Math.max(y0, y1) + radius
    };
}

function boundsIntersectArea(bounds, area) {
    return Boolean(bounds
        && bounds.right >= area.x
        && bounds.left <= area.x + area.width
        && bounds.bottom >= area.y
        && bounds.top <= area.y + area.height);
}

function numberIdentity(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(3) : '0';
}

function segmentIdentity(segment) {
    const order = Number.isFinite(Number(segment && segment.order)) ? Number(segment.order) : 0;
    if (segment.kind === 'rect') {
        return [
            order,
            'rect',
            numberIdentity(segment.x),
            numberIdentity(segment.y),
            numberIdentity(segment.width),
            numberIdentity(segment.height),
            segment.color || ''
        ].join('|');
    }

    if (segment.kind === 'text') {
        return [
            order,
            'text',
            numberIdentity(segment.x),
            numberIdentity(segment.y),
            numberIdentity(segment.size),
            numberIdentity(segment.width),
            numberIdentity(segment.height),
            segment.color || '',
            normalizeTextValue(segment.text)
        ].join('|');
    }

    return [
        order,
        'line',
        numberIdentity(segment.x0),
        numberIdentity(segment.y0),
        numberIdentity(segment.x1),
        numberIdentity(segment.y1),
        numberIdentity(segment.size),
        numberIdentity(segment.opacity),
        segment.color || ''
    ].join('|');
}

function exportSegmentToSvg(segment, area) {
    if (segment.kind === 'rect') {
        const color = isHexColor(segment.color) ? segment.color : '#000000';
        return `<rect x="${Number(segment.x) - area.x}" y="${Number(segment.y) - area.y}" width="${Number(segment.width)}" height="${Number(segment.height)}" fill="${escapeXml(color)}"/>`;
    }

    if (segment.kind === 'text') {
        const text = normalizeTextValue(segment.text);
        if (!text) return '';
        const size = Math.min(Math.max(Number(segment.size) || 36, 6), MAX_TEXT_FONT_SIZE);
        const color = isHexColor(segment.color) ? segment.color : '#000000';
        const fontFamily = normalizeTextFontFamily(segment.fontFamily);
        const x = Number(segment.x) - area.x;
        const y = Number(segment.y) - area.y;
        const lineHeight = Math.round(size * 1.22);
        const lines = text.split('\n');
        const tspans = lines.map((line, index) => (
            `<tspan x="${x}" y="${y + size * 0.92 + index * lineHeight}">${escapeXml(line)}</tspan>`
        )).join('');
        return `<text font-family="${escapeXml(fontFamily)}" font-size="${size}" fill="${escapeXml(color)}" xml:space="preserve">${tspans}</text>`;
    }

    const size = Math.max(0.5, Number(segment.size) || 1);
    const strokeWidth = segment.color === 'eraser' ? size * 2 : size;
    const stroke = segment.color === 'eraser'
        ? '#ffffff'
        : (isHexColor(segment.color) ? segment.color : '#000000');
    const opacity = segment.color === 'eraser' ? 1 : normalizeSegmentOpacity(segment);

    return `<path d="M ${Number(segment.x0) - area.x} ${Number(segment.y0) - area.y} L ${Number(segment.x1) - area.x} ${Number(segment.y1) - area.y}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
}

async function buildExportSvg(area) {
    const range = getExportTileRange(area);
    const estimate = await estimateExportTileSegments(range);
    if (estimate.segmentCount > MAX_EXPORT_TILE_SEGMENTS) {
        const error = new Error(`export_tile_segment_estimate_exceeded:${estimate.segmentCount}`);
        error.status = 413;
        error.details = {
            estimatedSegments: estimate.segmentCount,
            maxTileSegments: MAX_EXPORT_TILE_SEGMENTS
        };
        throw error;
    }

    const cursor = StrokeBatch.find({
        canvasId: CANVAS_ID,
        tileX: { $gte: range.minTileX, $lte: range.maxTileX },
        tileY: { $gte: range.minTileY, $lte: range.maxTileY }
    })
        .sort({ createdAt: 1 })
        .select('segments createdAt -_id')
        .lean()
        .cursor();

    const segments = [];
    const seenSegmentIdentities = new Set();
    for await (const batch of cursor) {
        const batchOrder = new Date(batch.createdAt || 0).getTime() * 1000;
        const batchSegments = Array.isArray(batch.segments) ? batch.segments : [];

        for (let index = 0; index < batchSegments.length; index += 1) {
            const segment = batchSegments[index];
            if (!boundsIntersectArea(segmentBounds(segment), area)) continue;

            const orderedSegment = {
                ...segment,
                order: Number.isFinite(Number(segment.order))
                    ? Number(segment.order)
                    : batchOrder + index
            };
            const identity = segmentIdentity(orderedSegment);
            if (seenSegmentIdentities.has(identity)) continue;
            seenSegmentIdentities.add(identity);
            segments.push(orderedSegment);

            if (segments.length > MAX_EXPORT_SEGMENTS) {
                const error = new Error('export_too_many_segments');
                error.status = 413;
                error.details = {
                    actualSegments: segments.length,
                    maxSegments: MAX_EXPORT_SEGMENTS
                };
                throw error;
            }
        }
    }

    segments.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    const body = segments.map(segment => exportSegmentToSvg(segment, area)).join('\n');
    const metadata = [
        `<!-- canvasId: ${escapeXml(CANVAS_ID)} -->`,
        `<!-- area: x=${area.x}, y=${area.y}, width=${area.width}, height=${area.height} -->`,
        `<!-- segments: ${segments.length} -->`,
        `<!-- exportedAt: ${new Date().toISOString()} -->`
    ].join('\n');

    return {
        svg: [
            `<?xml version="1.0" encoding="UTF-8"?>`,
            `<svg xmlns="http://www.w3.org/2000/svg" width="${area.width}" height="${area.height}" viewBox="0 0 ${area.width} ${area.height}">`,
            metadata,
            `<rect x="0" y="0" width="${area.width}" height="${area.height}" fill="#ffffff"/>`,
            `<defs><clipPath id="exportClip"><rect x="0" y="0" width="${area.width}" height="${area.height}"/></clipPath></defs>`,
            `<g clip-path="url(#exportClip)">`,
            body,
            `</g>`,
            `</svg>`
        ].join('\n'),
        segmentCount: segments.length,
        estimatedSegments: estimate.segmentCount
    };
}

async function buildExportJpeg(area) {
    validateRasterExportArea(area);
    const exportResult = await buildExportSvg(area);
    const image = await sharp(Buffer.from(exportResult.svg), {
        density: 72,
        limitInputPixels: MAX_EXPORT_RASTER_PIXELS
    })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: EXPORT_JPEG_QUALITY, mozjpeg: true })
        .toBuffer();

    return {
        ...exportResult,
        image
    };
}

async function buildSnapshotExportJpeg(area) {
    const minTileX = Math.max(Math.floor(area.x / TILE_SIZE), 0);
    const maxTileX = Math.min(Math.floor((area.x + area.width - 1) / TILE_SIZE), maxHorizontalTileX());
    const minTileY = Math.max(Math.floor(area.y / TILE_SIZE), 0);
    const maxTileY = Math.max(Math.floor((area.y + area.height - 1) / TILE_SIZE), minTileY);
    const tileCount = Math.max(0, maxTileX - minTileX + 1) * Math.max(0, maxTileY - minTileY + 1);

    if (tileCount > MAX_SNAPSHOT_EXPORT_TILES) {
        const error = new Error(`snapshot_export_too_many_tiles:${tileCount}`);
        error.status = 413;
        error.details = {
            tileCount,
            maxSnapshotExportTiles: MAX_SNAPSHOT_EXPORT_TILES
        };
        throw error;
    }

    const scale = getSnapshotJpegScale(area);
    const outputWidth = scaledSize(area.width, scale);
    const outputHeight = scaledSize(area.height, scale);
    const snapshots = await TileSnapshot.find({
        canvasId: CANVAS_ID,
        tileX: { $gte: minTileX, $lte: maxTileX },
        tileY: { $gte: minTileY, $lte: maxTileY }
    })
        .sort({ tileY: 1, tileX: 1 })
        .select('tileX tileY width height path generatedAt -_id')
        .lean()
        .exec();

    const composites = [];
    for (const snapshot of snapshots) {
        const filePath = snapshotFilePathFromPublicPath(snapshot.path);
        if (!filePath) continue;

        const tileLeft = Number(snapshot.tileX) * TILE_SIZE;
        const tileTop = Number(snapshot.tileY) * TILE_SIZE;
        const tileWidth = Math.max(1, Number(snapshot.width) || TILE_SIZE);
        const tileHeight = Math.max(1, Number(snapshot.height) || TILE_SIZE);
        const left = Math.max(area.x, tileLeft);
        const top = Math.max(area.y, tileTop);
        const right = Math.min(area.x + area.width, tileLeft + tileWidth);
        const bottom = Math.min(area.y + area.height, tileTop + tileHeight);
        const cropWidth = Math.round(right - left);
        const cropHeight = Math.round(bottom - top);
        if (cropWidth <= 0 || cropHeight <= 0) continue;

        const destLeft = Math.round((left - area.x) * scale);
        const destTop = Math.round((top - area.y) * scale);
        if (destLeft >= outputWidth || destTop >= outputHeight) continue;
        const destWidth = Math.max(1, Math.min(outputWidth - destLeft, Math.round(cropWidth * scale)));
        const destHeight = Math.max(1, Math.min(outputHeight - destTop, Math.round(cropHeight * scale)));
        if (destWidth <= 0 || destHeight <= 0) continue;

        const input = await sharp(filePath, { limitInputPixels: false })
            .extract({
                left: Math.max(0, Math.round(left - tileLeft)),
                top: Math.max(0, Math.round(top - tileTop)),
                width: cropWidth,
                height: cropHeight
            })
            .resize(destWidth, destHeight, { fit: 'fill' })
            .toBuffer();

        composites.push({
            input,
            left: destLeft,
            top: destTop
        });
    }

    let pipeline = sharp({
        create: {
            width: outputWidth,
            height: outputHeight,
            channels: 3,
            background: '#ffffff'
        }
    });

    if (composites.length > 0) {
        pipeline = pipeline.composite(composites);
    }

    const image = await pipeline
        .jpeg({ quality: EXPORT_JPEG_QUALITY, mozjpeg: true })
        .toBuffer();

    return {
        image,
        source: 'snapshots',
        tileCount,
        snapshotCount: snapshots.length,
        renderedSnapshotCount: composites.length,
        scale,
        outputWidth,
        outputHeight
    };
}

function sendExportError(res, error, fallbackError) {
    const status = Number(error.status) || 500;
    const message = status === 413
        ? 'export_area_too_large'
        : fallbackError;
    console.error('Error exportando:', error.message);
    return res.status(status).json({
        error: message,
        detail: error.message,
        limits: {
            maxSegments: MAX_EXPORT_SEGMENTS,
            maxTileSegments: MAX_EXPORT_TILE_SEGMENTS,
            maxTiles: MAX_EXPORT_TILES,
            maxRasterPixels: MAX_EXPORT_RASTER_PIXELS,
            maxJpegDimension: MAX_EXPORT_JPEG_DIMENSION,
            maxSnapshotJpegPixels: MAX_SNAPSHOT_JPEG_PIXELS,
            maxSnapshotExportTiles: MAX_SNAPSHOT_EXPORT_TILES
        },
        ...(error.details || {})
    });
}

function readMinimapSnapshotMetadata(contentHeight) {
    const metadataPath = path.join(__dirname, 'public', 'snapshots', CANVAS_ID, MINIMAP_META_FILENAME);
    try {
        if (!fs.existsSync(metadataPath)) return null;

        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const filename = path.basename(String(metadata.url || '').split('?')[0]);
        const imagePath = path.join(__dirname, 'public', 'snapshots', CANVAS_ID, filename);
        if (!metadata.url || !fs.existsSync(imagePath)) return null;

        const stats = fs.statSync(imagePath);
        const generatedAt = metadata.generatedAt || stats.mtime.toISOString();
        return {
            url: `${metadata.url}?v=${new Date(generatedAt).getTime() || stats.mtimeMs}`,
            width: Number(metadata.width) || 0,
            height: Number(metadata.height) || 0,
            worldWidth: Number(metadata.worldWidth) || canvasControlCache.width,
            worldHeight: Math.max(Number(metadata.worldHeight) || 0, contentHeight),
            byteSize: stats.size,
            generatedAt
        };
    } catch (error) {
        console.warn('No se pudo leer minimap snapshot:', error.message);
        return null;
    }
}

async function migrateLegacyStrokesToTiles() {
    const existingTileBatches = await StrokeBatch.estimatedDocumentCount();
    if (existingTileBatches > 0) return;

    const legacyCount = await Stroke.estimatedDocumentCount();
    if (legacyCount === 0) return;

    console.log(`Migrando ${legacyCount} trazos legacy a lotes por tile...`);
    const cursor = Stroke.find()
        .sort({ createdAt: 1 })
        .select('x0 y0 x1 y1 color size user_email -_id')
        .lean()
        .cursor();

    const docs = [];
    const grouped = new Map();

    async function flushGroups(force = false) {
        for (const [key, group] of grouped) {
            if (!force && group.segments.length < BATCH_DOC_SEGMENT_LIMIT) continue;

            while (group.segments.length > 0 && (force || group.segments.length >= BATCH_DOC_SEGMENT_LIMIT)) {
                const segmentChunk = group.segments.splice(0, BATCH_DOC_SEGMENT_LIMIT);
                docs.push({
                    canvasId: CANVAS_ID,
                    tileX: group.tileX,
                    tileY: group.tileY,
                    segments: segmentChunk,
                    user_email: group.userEmail,
                    user_name: group.userEmail,
                    user_uid: ''
                });
            }

            if (group.segments.length === 0) grouped.delete(key);
        }

        if (docs.length >= 100 || (force && docs.length > 0)) {
            const docsToSave = docs.splice(0, docs.length);
            await StrokeBatch.insertMany(docsToSave, { ordered: false });
        }
    }

    for await (const legacyStroke of cursor) {
        const segment = normalizeSegment(legacyStroke);
        if (!segment) continue;

        const { tileX, tileY } = tileForSegment(segment);
        const userEmail = normalizeEmail(legacyStroke.user_email || 'anonymous');
        const key = `${tileKey(tileX, tileY)}:${userEmail}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                tileX,
                tileY,
                userEmail,
                segments: []
            });
        }

        grouped.get(key).segments.push(segment);
        await flushGroups(false);
    }

    await flushGroups(true);
    console.log('Migracion legacy completada.');
}

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Conectado a MongoDB localmente.');
        await migrateLegacyStrokesToTiles();
    })
    .catch(err => console.error('Error al conectar a MongoDB:', err));

app.use(express.json({ limit: '64kb' }));

app.get('/api/health', async (req, res) => {
    const mongoOk = mongoose.connection.readyState === 1;
    const batchCount = mongoOk ? await StrokeBatch.estimatedDocumentCount() : 0;

    res.status(mongoOk ? 200 : 503).json({
        ok: mongoOk,
        mongoReadyState: mongoose.connection.readyState,
        tileSize: TILE_SIZE,
        batchCount
    });
});

app.get('/api/firebase-config', (req, res) => {
    const firebaseConfig = getFirebaseWebConfigStatus();
    res.setHeader('Cache-Control', 'no-store');
    if (!firebaseConfig.enabled) {
        return res.json({
            enabled: false,
            missing: firebaseConfig.missing
        });
    }

    return res.json({
        enabled: true,
        config: firebaseConfig.config
    });
});

app.get('/api/canvas-control', (req, res) => {
    res.json(canvasControlCache);
});

app.get('/api/tiles', async (req, res) => {
    try {
        const tiles = parseTileList(req.query.tiles, MAX_TILE_REQUESTS);
        const payload = await fetchTilePayload(tiles);
        await sendJsonResponse(req, res, { canvasId: CANVAS_ID, tileSize: TILE_SIZE, tiles: payload });
    } catch (error) {
        console.error('Error cargando tiles:', error);
        res.status(500).json({ error: 'tiles_load_failed' });
    }
});

app.get('/api/canvas-overview', async (req, res) => {
    try {
        const overview = await fetchCanvasOverview();
        await sendJsonResponse(req, res, overview);
    } catch (error) {
        console.error('Error cargando resumen del lienzo:', error);
        res.status(500).json({ error: 'overview_load_failed' });
    }
});

app.get('/api/admin/contributors', requireAdmin, async (req, res) => {
    try {
        await saveTileBufferToDB();
        const contributors = await fetchContributors();
        await sendJsonResponse(req, res, {
            canvasId: CANVAS_ID,
            admin: {
                email: req.user.email,
                name: req.user.name
            },
            contributors
        });
    } catch (error) {
        console.error('Error cargando colaboradores admin:', error);
        res.status(500).json({ error: 'contributors_load_failed' });
    }
});

app.get('/api/admin/tiles', requireAdmin, async (req, res) => {
    try {
        const tiles = parseTileList(req.query.tiles, MAX_TILE_REQUESTS);
        await saveTileBufferToDB();
        const payload = await fetchAdminTilePayload(tiles);
        await sendJsonResponse(req, res, { canvasId: CANVAS_ID, tileSize: TILE_SIZE, tiles: payload });
    } catch (error) {
        console.error('Error cargando tiles admin:', error);
        res.status(500).json({ error: 'admin_tiles_load_failed' });
    }
});

app.post('/api/admin/export-svg', requireAdmin, async (req, res) => {
    try {
        const area = normalizeExportArea(req.body && req.body.area ? req.body.area : req.body);
        if (!area) return res.status(400).json({ error: 'invalid_export_area' });

        await saveTileBufferToDB();
        const startedAt = Date.now();
        const { svg, segmentCount, estimatedSegments } = await buildExportSvg(area);
        const filename = `lienzo-${CANVAS_ID}-x${area.x}-y${area.y}-w${area.width}-h${area.height}.svg`;

        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Export-Segment-Count', String(segmentCount));
        res.setHeader('X-Export-Estimated-Segment-Count', String(estimatedSegments));
        console.log(`SVG exportado por ${req.user.email}: ${area.width}x${area.height}, ${segmentCount}/${estimatedSegments} segmentos, ${Date.now() - startedAt}ms`);
        return res.send(svg);
    } catch (error) {
        return sendExportError(res, error, 'export_svg_failed');
    }
});

app.post('/api/admin/export-jpg', requireAdmin, async (req, res) => {
    try {
        const area = normalizeExportArea(req.body && req.body.area ? req.body.area : req.body);
        if (!area) return res.status(400).json({ error: 'invalid_export_area' });

        const startedAt = Date.now();
        const exportResult = await buildSnapshotExportJpeg(area);
        const { image } = exportResult;
        const filename = `lienzo-${CANVAS_ID}-x${area.x}-y${area.y}-w${area.width}-h${area.height}.jpg`;

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Export-Mode', exportResult.source);
        res.setHeader('X-Export-Tile-Count', String(exportResult.tileCount));
        res.setHeader('X-Export-Snapshot-Count', String(exportResult.renderedSnapshotCount));
        res.setHeader('X-Export-Scale', String(exportResult.scale));
        res.setHeader('X-Export-Output-Width', String(exportResult.outputWidth));
        res.setHeader('X-Export-Output-Height', String(exportResult.outputHeight));
        res.setHeader('X-Export-Byte-Size', String(image.length));
        console.log(`JPG snapshot exportado por ${req.user.email}: ${area.width}x${area.height} -> ${exportResult.outputWidth}x${exportResult.outputHeight}, ${exportResult.renderedSnapshotCount}/${exportResult.tileCount} snapshots, ${image.length} bytes, ${Date.now() - startedAt}ms`);
        return res.send(image);
    } catch (error) {
        return sendExportError(res, error, 'export_jpg_failed');
    }
});

app.get('/snapshots/:canvasId/:filename', (req, res, next) => {
    const canvasId = String(req.params.canvasId || '');
    const filename = String(req.params.filename || '');
    if (!SNAPSHOT_CANVAS_PATTERN.test(canvasId) || !SNAPSHOT_FILENAME_PATTERN.test(filename)) {
        return next();
    }

    const snapshotPath = path.join(__dirname, 'public', 'snapshots', canvasId, filename);
    if (!fs.existsSync(snapshotPath)) return next();

    const isWebp = filename.endsWith('.webp');
    res.setHeader('Content-Type', isWebp ? 'image/webp' : 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Vary', 'Accept-Encoding');

    if (isWebp) return res.sendFile(snapshotPath);

    const gzipPath = `${snapshotPath}.gz`;
    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    if (/\bgzip\b/.test(acceptEncoding) && fs.existsSync(gzipPath)) {
        res.setHeader('Content-Encoding', 'gzip');
        return res.sendFile(gzipPath);
    }

    return res.sendFile(snapshotPath);
});

app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    maxAge: '5m'
}));

io.use(async (socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token || !firebaseAuth) {
        socket.user = { uid: '', name: 'Invitado', email: 'anonymous', isAnonymous: true };
        return next();
    }

    try {
        const decodedToken = await firebaseAuth.verifyIdToken(token);
        socket.user = { ...buildUserProfile(decodedToken), isAnonymous: false };
        next();
    } catch (error) {
        console.error('Token invalido, continuando como invitado:', error.message);
        socket.user = { uid: '', name: 'Invitado', email: 'anonymous', isAnonymous: true };
        next();
    }
});

io.on('connection', (socket) => {
    const userName = socket.user.name || 'Invitado';
    const canWrite = socket.user && !socket.user.isAnonymous;
    const userProfile = canWrite
        ? {
            uid: String(socket.user.uid || ''),
            name: String(socket.user.name || socket.user.email || 'Usuario'),
            email: normalizeEmail(socket.user.email || socket.user.uid || 'authenticated')
        }
        : { uid: '', name: 'Invitado', email: 'anonymous' };
    const userEmail = userProfile.email;
    socket.data.tileRooms = new Set();
    console.log(`Usuario conectado: ${userName} (${userEmail})`);

    socket.emit('world-init', canvasControlCache);

    socket.on('viewport-tiles', (payload) => {
        const tiles = parseTileList(payload && payload.tiles, MAX_TILE_SUBSCRIPTIONS);
        const nextRooms = new Set(tiles.map(tile => roomName(tile.tileX, tile.tileY)));

        for (const room of socket.data.tileRooms) {
            if (!nextRooms.has(room)) socket.leave(room);
        }

        for (const room of nextRooms) {
            if (!socket.data.tileRooms.has(room)) socket.join(room);
        }

        socket.data.tileRooms = nextRooms;
    });

    socket.on('draw-batch', (drawBatch) => {
        if (!canWrite) {
            socket.emit('write-denied', { reason: 'auth_required' });
            return;
        }

        const acceptedStrokes = acceptStrokes(drawBatch);
        if (acceptedStrokes.length === 0) return;

        const tileGroups = groupSegmentsByTile(acceptedStrokes);
        addSegmentsToSaveBuffer(tileGroups, userProfile);

        for (const group of tileGroups.values()) {
            socket.to(roomName(group.tileX, group.tileY)).emit('tile-draw-batch', {
                tileX: group.tileX,
                tileY: group.tileY,
                segments: decorateSegmentsForClient(group.segments, userProfile)
            });
        }
    });

    socket.on('draw', (drawData) => {
        if (!canWrite) {
            socket.emit('write-denied', { reason: 'auth_required' });
            return;
        }

        const acceptedStrokes = acceptStrokes([drawData]);
        if (acceptedStrokes.length === 0) return;

        const tileGroups = groupSegmentsByTile(acceptedStrokes);
        addSegmentsToSaveBuffer(tileGroups, userProfile);
        for (const group of tileGroups.values()) {
            socket.to(roomName(group.tileX, group.tileY)).emit('tile-draw-batch', {
                tileX: group.tileX,
                tileY: group.tileY,
                segments: decorateSegmentsForClient(group.segments, userProfile)
            });
        }
    });

    socket.on('undo-segments', async (payload) => {
        if (!canWrite) {
            socket.emit('write-denied', { reason: 'auth_required' });
            return;
        }

        const orders = parseUndoOrders(payload && payload.orders, MAX_UNDO_SEGMENTS);
        if (orders.length === 0) return;

        const tiles = parseTileList(payload && payload.tiles, MAX_TILE_REQUESTS);
        const orderSet = new Set(orders);
        const changedTileKeys = removeOrdersFromSaveBuffer(orderSet, userEmail);

        try {
            await saveTileBufferToDB();
            await removeOrdersFromDatabase(orders, tiles, userEmail);
        } catch (err) {
            console.error('Error deshaciendo segmentos:', err.message);
            return;
        }

        for (const tile of tiles) changedTileKeys.add(tile.key);

        const message = { orders };
        if (changedTileKeys.size === 0) {
            socket.broadcast.emit('tile-undo-segments', message);
            return;
        }

        for (const key of changedTileKeys) {
            const tile = parseTileKey(key);
            if (!tile) continue;
            socket.to(roomName(tile.tileX, tile.tileY)).emit('tile-undo-segments', message);
        }
    });

    socket.on('clear', async () => {
        if (!canWrite) {
            socket.emit('write-denied', { reason: 'auth_required' });
            return;
        }

        try {
            await saveTileBufferToDB();
            await Promise.all([
                Stroke.deleteMany({}),
                StrokeBatch.deleteMany({ canvasId: CANVAS_ID })
            ]);
            tileSaveBuffer = new Map();
            io.emit('clear');
        } catch (err) {
            console.error('Error al borrar lienzo:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${userName}`);
    });
});

server.listen(PORT, HOST, () => {
    console.log(`Servidor corriendo en http://${HOST || 'localhost'}:${PORT}`);
});
