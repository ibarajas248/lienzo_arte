const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const sharp = require('sharp');

const TileSnapshot = require('../models/TileSnapshot');
const StrokeBatch = require('../models/StrokeBatch');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lienzoDB';
const CANVAS_ID = process.env.CANVAS_ID || 'main';
const CANVAS_CONTROL_PATH = path.join(__dirname, '..', 'canvas-control.json');
const TILE_SIZE = 1024;
const OUTPUT_WIDTH = Math.max(48, Number(process.env.MINIMAP_WIDTH) || 160);
const MAX_OUTPUT_HEIGHT = Math.max(1024, Number(process.env.MINIMAP_MAX_HEIGHT) || 24000);
const SNAPSHOT_ROOT = path.join(__dirname, '..', 'public', 'snapshots', CANVAS_ID);
const PUBLIC_SNAPSHOT_ROOT = `/snapshots/${CANVAS_ID}`;
const OUTPUT_FILENAME = 'minimap.webp';
const META_FILENAME = 'minimap.json';

function loadCanvasControl() {
    try {
        return JSON.parse(fs.readFileSync(CANVAS_CONTROL_PATH, 'utf8'));
    } catch (error) {
        return { width: 1280, height: 2400 };
    }
}

function snapshotFilePath(publicPath) {
    const cleanPath = String(publicPath || '').split('?')[0];
    const expectedPrefix = `${PUBLIC_SNAPSHOT_ROOT}/`;
    if (!cleanPath.startsWith(expectedPrefix)) return null;

    const filename = path.basename(cleanPath);
    if (!/^tile-\d+-\d+\.(svg|webp)$/.test(filename)) return null;
    return path.join(SNAPSHOT_ROOT, filename);
}

async function getContentHeight(control) {
    const latestSnapshot = await TileSnapshot.findOne({ canvasId: CANVAS_ID })
        .sort({ tileY: -1 })
        .select('tileY -_id')
        .lean()
        .exec();
    const latestBatch = await StrokeBatch.findOne({ canvasId: CANVAS_ID })
        .sort({ tileY: -1 })
        .select('tileY -_id')
        .lean()
        .exec();

    const maxTileY = Math.max(
        Number.isFinite(Number(latestSnapshot && latestSnapshot.tileY)) ? Number(latestSnapshot.tileY) : -1,
        Number.isFinite(Number(latestBatch && latestBatch.tileY)) ? Number(latestBatch.tileY) : -1
    );

    return Math.max(Number(control.height) || 0, (maxTileY + 1) * TILE_SIZE, TILE_SIZE);
}

async function renderTileInput(snapshot, scale) {
    const filePath = snapshotFilePath(snapshot.path);
    if (!filePath || !fs.existsSync(filePath)) return null;

    const width = Math.max(1, Math.round((Number(snapshot.width) || TILE_SIZE) * scale));
    const height = Math.max(1, Math.round((Number(snapshot.height) || TILE_SIZE) * scale));
    const left = Math.round(Number(snapshot.tileX) * TILE_SIZE * scale);
    const top = Math.round(Number(snapshot.tileY) * TILE_SIZE * scale);

    const input = await sharp(filePath, { density: 72 })
        .resize(width, height, { fit: 'fill' })
        .webp({ quality: 72, effort: 3 })
        .toBuffer();

    return { input, left, top };
}

async function main() {
    const control = loadCanvasControl();
    const worldWidth = Math.max(1, Number(control.width) || 1280);

    await mongoose.connect(MONGODB_URI);

    const snapshots = await TileSnapshot.find({ canvasId: CANVAS_ID })
        .sort({ tileY: 1, tileX: 1 })
        .select('tileX tileY width height path generatedAt -_id')
        .lean()
        .exec();

    const worldHeight = await getContentHeight(control);
    const requestedScale = OUTPUT_WIDTH / worldWidth;
    const maxScale = MAX_OUTPUT_HEIGHT / worldHeight;
    const scale = Math.min(requestedScale, maxScale);
    const outputWidth = Math.max(1, Math.round(worldWidth * scale));
    const outputHeight = Math.max(1, Math.round(worldHeight * scale));

    fs.mkdirSync(SNAPSHOT_ROOT, { recursive: true });

    const composites = [];
    for (const snapshot of snapshots) {
        const input = await renderTileInput(snapshot, scale);
        if (input) composites.push(input);
    }

    const outputPath = path.join(SNAPSHOT_ROOT, OUTPUT_FILENAME);
    await sharp({
        create: {
            width: outputWidth,
            height: outputHeight,
            channels: 3,
            background: '#ffffff'
        }
    })
        .composite(composites)
        .webp({ quality: 76, effort: 4 })
        .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    const metadata = {
        canvasId: CANVAS_ID,
        url: `${PUBLIC_SNAPSHOT_ROOT}/${OUTPUT_FILENAME}`,
        width: outputWidth,
        height: outputHeight,
        worldWidth,
        worldHeight,
        scale,
        tileCount: composites.length,
        byteSize: stats.size,
        generatedAt: new Date().toISOString()
    };

    fs.writeFileSync(path.join(SNAPSHOT_ROOT, META_FILENAME), `${JSON.stringify(metadata, null, 2)}\n`);
    console.log(`Minimap snapshot generada: ${metadata.url}`);
    console.log(`${outputWidth}x${outputHeight}px, ${metadata.byteSize} bytes, ${composites.length} tiles`);

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
