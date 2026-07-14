const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
const sharp = require('sharp');

const StrokeBatch = require('../models/StrokeBatch');
const TileSnapshot = require('../models/TileSnapshot');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lienzoDB';
const CANVAS_ID = process.env.CANVAS_ID || 'main';
const CANVAS_CONTROL_PATH = path.join(__dirname, '..', 'canvas-control.json');
const TILE_SIZE = 1024;
const VECTOR_RECT_BLEED = 0.45;
const SNAPSHOT_ROOT = path.join(__dirname, '..', 'public', 'snapshots', CANVAS_ID);
const PUBLIC_SNAPSHOT_ROOT = `/snapshots/${CANVAS_ID}`;
const SNAPSHOT_FORMAT = String(process.env.SNAPSHOT_FORMAT || 'webp').toLowerCase() === 'svg' ? 'svg' : 'webp';
const WEBP_QUALITY = Math.min(Math.max(Number(process.env.SNAPSHOT_WEBP_QUALITY) || 82, 40), 95);
const MAX_TEXT_LINES = 32;
const DEFAULT_TEXT_FONT_FAMILY = 'Inter, Arial, sans-serif';

function loadCanvasControl() {
    try {
        return JSON.parse(fs.readFileSync(CANVAS_CONTROL_PATH, 'utf8'));
    } catch (error) {
        return { width: 1280, height: 2400 };
    }
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function segmentOrder(batch, segment, index) {
    const order = Number(segment.order);
    if (Number.isFinite(order)) return order;
    return new Date(batch.createdAt || 0).getTime() * 1000 + index;
}

function segmentOpacity(segment) {
    const opacity = Number(segment && segment.opacity);
    if (!Number.isFinite(opacity) || segment.color === 'eraser') return 1;
    return Math.min(Math.max(opacity, 0.05), 1);
}

function normalizeSegment(batch, segment, index) {
    return {
        ...segment,
        order: segmentOrder(batch, segment, index)
    };
}

function normalizeTextValue(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .slice(0, MAX_TEXT_LINES)
        .map(line => line.trim().slice(0, 80))
        .join('\n')
        .trim();
}

function normalizeTextFontFamily(value) {
    const fontFamily = String(value || '').trim();
    if (!fontFamily || fontFamily.length > 80) return DEFAULT_TEXT_FONT_FAMILY;
    if (!/^[a-zA-Z0-9\s,'-]+$/.test(fontFamily)) return DEFAULT_TEXT_FONT_FAMILY;
    return fontFamily;
}

function segmentToSvg(segment, tileLeft, tileTop) {
    if (segment.kind === 'rect') {
        const x = number(segment.x) - tileLeft - VECTOR_RECT_BLEED;
        const y = number(segment.y) - tileTop - VECTOR_RECT_BLEED;
        const width = number(segment.width) + VECTOR_RECT_BLEED * 2;
        const height = number(segment.height) + VECTOR_RECT_BLEED * 2;
        return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${escapeXml(segment.color)}" opacity="1"/>`;
    }

    if (segment.kind === 'text') {
        const text = normalizeTextValue(segment.text);
        if (!text) return '';
        const size = Math.min(Math.max(number(segment.size) || 36, 6), 160);
        const color = /^#[0-9a-fA-F]{6}$/.test(String(segment.color || '')) ? segment.color : '#000000';
        const fontFamily = normalizeTextFontFamily(segment.fontFamily);
        const x = number(segment.x) - tileLeft;
        const y = number(segment.y) - tileTop;
        const lineHeight = Math.round(size * 1.22);
        const tspans = text.split('\n').map((line, index) => (
            `<tspan x="${x}" y="${y + size * 0.92 + index * lineHeight}">${escapeXml(line)}</tspan>`
        )).join('');
        return `<text font-family="${escapeXml(fontFamily)}" font-size="${size}" fill="${escapeXml(color)}" xml:space="preserve">${tspans}</text>`;
    }

    const strokeColor = segment.color === 'eraser' ? '#ffffff' : segment.color;
    const strokeWidth = segment.color === 'eraser' ? number(segment.size) * 2 : number(segment.size);
    const opacity = segmentOpacity(segment);

    return [
        `<line x1="${number(segment.x0) - tileLeft}" y1="${number(segment.y0) - tileTop}"`,
        `x2="${number(segment.x1) - tileLeft}" y2="${number(segment.y1) - tileTop}"`,
        `stroke="${escapeXml(strokeColor)}" stroke-width="${strokeWidth}"`,
        `stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`
    ].join(' ');
}

function buildSvg({ width, height, tileLeft, tileTop, segments }) {
    const body = segments.map(segment => segmentToSvg(segment, tileLeft, tileTop)).join('\n');
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" opacity="1" style="background:#ffffff">`,
        '<defs>',
        `<clipPath id="tileClip"><rect x="0" y="0" width="${width}" height="${height}"/></clipPath>`,
        '</defs>',
        '<rect x="0" y="0" width="100%" height="100%" fill="#ffffff" opacity="1"/>',
        '<g clip-path="url(#tileClip)" opacity="1">',
        body,
        '</g>',
        '</svg>',
        ''
    ].join('\n');
}

async function writeSnapshotFile({ svg, tileX, tileY }) {
    fs.mkdirSync(SNAPSHOT_ROOT, { recursive: true });

    if (SNAPSHOT_FORMAT === 'svg') {
        const filename = `tile-${tileX}-${tileY}.svg`;
        const filePath = path.join(SNAPSHOT_ROOT, filename);
        fs.writeFileSync(filePath, svg);
        fs.writeFileSync(`${filePath}.gz`, zlib.gzipSync(svg, { level: zlib.constants.Z_BEST_SPEED }));

        return {
            filename,
            filePath,
            publicPath: `${PUBLIC_SNAPSHOT_ROOT}/${filename}`,
            byteSize: fs.statSync(filePath).size,
            format: 'svg',
            mimeType: 'image/svg+xml'
        };
    }

    const filename = `tile-${tileX}-${tileY}.webp`;
    const filePath = path.join(SNAPSHOT_ROOT, filename);
    await sharp(Buffer.from(svg), { density: 72 })
        .webp({ quality: WEBP_QUALITY, effort: 4, smartSubsample: true })
        .toFile(filePath);

    return {
        filename,
        filePath,
        publicPath: `${PUBLIC_SNAPSHOT_ROOT}/${filename}`,
        byteSize: fs.statSync(filePath).size,
        format: 'webp',
        mimeType: 'image/webp'
    };
}

function parseTileFilter() {
    const rawTiles = String(process.env.TILES || '').trim();
    if (!rawTiles) return null;

    return new Set(rawTiles.split(',').map(value => value.trim()).filter(Boolean));
}

async function generateSnapshotForTile(tile, control) {
    const tileLeft = tile.tileX * TILE_SIZE;
    const tileTop = tile.tileY * TILE_SIZE;
    const width = Math.max(1, Math.min(TILE_SIZE, Number(control.width || 1280) - tileLeft));
    const height = TILE_SIZE;
    if (width <= 0) return null;

    const batches = await StrokeBatch.find({
        canvasId: CANVAS_ID,
        tileX: tile.tileX,
        tileY: tile.tileY
    })
        .sort({ createdAt: 1 })
        .select('segments createdAt -_id')
        .lean()
        .exec();

    const segments = [];
    for (const batch of batches) {
        batch.segments.forEach((segment, index) => {
            segments.push(normalizeSegment(batch, segment, index));
        });
    }

    if (segments.length === 0) return null;
    segments.sort((a, b) => a.order - b.order);

    const upToOrder = segments[segments.length - 1].order;
    const svg = buildSvg({ width, height, tileLeft, tileTop, segments });
    const snapshotFile = await writeSnapshotFile({
        svg,
        tileX: tile.tileX,
        tileY: tile.tileY
    });

    await TileSnapshot.findOneAndUpdate(
        { canvasId: CANVAS_ID, tileX: tile.tileX, tileY: tile.tileY },
        {
            canvasId: CANVAS_ID,
            tileX: tile.tileX,
            tileY: tile.tileY,
            upToOrder,
            segmentCount: segments.length,
            width,
            height,
            path: snapshotFile.publicPath,
            format: snapshotFile.format,
            mimeType: snapshotFile.mimeType,
            byteSize: snapshotFile.byteSize,
            generatedAt: new Date()
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return { ...tile, segmentCount: segments.length, byteSize: snapshotFile.byteSize, path: snapshotFile.publicPath };
}

async function main() {
    const control = loadCanvasControl();
    const tileFilter = parseTileFilter();
    await mongoose.connect(MONGODB_URI);

    const tiles = await StrokeBatch.aggregate([
        { $match: { canvasId: CANVAS_ID } },
        { $group: { _id: { tileX: '$tileX', tileY: '$tileY' }, batches: { $sum: 1 } } },
        { $sort: { '_id.tileY': 1, '_id.tileX': 1 } }
    ]);

    let generated = 0;
    for (const tileGroup of tiles) {
        const tile = { tileX: tileGroup._id.tileX, tileY: tileGroup._id.tileY };
        const key = `${tile.tileX}:${tile.tileY}`;
        if (tileFilter && !tileFilter.has(key)) continue;

        const result = await generateSnapshotForTile(tile, control);
        if (!result) continue;

        generated += 1;
        console.log(`snapshot ${key}: ${result.segmentCount} segmentos, ${result.byteSize} bytes, ${SNAPSHOT_FORMAT}`);
    }

    console.log(`Snapshots generadas: ${generated}`);
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
