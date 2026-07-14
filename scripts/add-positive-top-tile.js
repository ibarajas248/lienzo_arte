const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const StrokeBatch = require('../models/StrokeBatch');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lienzoDB';
const CANVAS_CONTROL_PATH = path.join(__dirname, '..', 'canvas-control.json');
const CANVAS_ID = process.env.CANVAS_ID || 'main';
const TILE_SIZE = 1024;
const MIGRATION_KEY = `positive-top-tile:${CANVAS_ID}:1`;

const migrationSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    canvasId: { type: String, required: true },
    shiftY: { type: Number, required: true },
    tileDelta: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'maintenance_migrations' });

const legacyStrokeSchema = new mongoose.Schema({
    y0: Number,
    y1: Number
}, { collection: 'strokes', strict: false });

const Migration = mongoose.model('MaintenanceMigration', migrationSchema);
const LegacyStroke = mongoose.model('LegacyStroke', legacyStrokeSchema);

function loadCanvasControl() {
    return JSON.parse(fs.readFileSync(CANVAS_CONTROL_PATH, 'utf8'));
}

function saveCanvasControl(control) {
    fs.writeFileSync(CANVAS_CONTROL_PATH, `${JSON.stringify(control, null, 2)}\n`);
}

async function shiftStrokeBatches() {
    return StrokeBatch.updateMany(
        { canvasId: CANVAS_ID },
        [
            {
                $set: {
                    tileY: { $add: ['$tileY', 1] },
                    segments: {
                        $map: {
                            input: '$segments',
                            as: 'segment',
                            in: {
                                $cond: [
                                    { $eq: ['$$segment.kind', 'rect'] },
                                    {
                                        $mergeObjects: [
                                            '$$segment',
                                            { y: { $add: ['$$segment.y', TILE_SIZE] } }
                                        ]
                                    },
                                    {
                                        $mergeObjects: [
                                            '$$segment',
                                            {
                                                y0: { $add: ['$$segment.y0', TILE_SIZE] },
                                                y1: { $add: ['$$segment.y1', TILE_SIZE] }
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        ],
        { updatePipeline: true }
    );
}

async function shiftLegacyStrokes() {
    return LegacyStroke.updateMany(
        {},
        [
            {
                $set: {
                    y0: { $add: ['$y0', TILE_SIZE] },
                    y1: { $add: ['$y1', TILE_SIZE] }
                }
            }
        ],
        { updatePipeline: true }
    );
}

async function main() {
    await mongoose.connect(MONGODB_URI);

    const existing = await Migration.findOne({ key: MIGRATION_KEY }).lean();
    if (existing) {
        console.log(`La migracion ya fue ejecutada: ${MIGRATION_KEY}`);
        await mongoose.disconnect();
        return;
    }

    const control = loadCanvasControl();
    const currentHeight = Number(control.height);
    control.height = Number.isFinite(currentHeight) && currentHeight > 0
        ? Math.round(currentHeight) + TILE_SIZE
        : TILE_SIZE;
    control.entryScrollY = 0;

    const batchResult = await shiftStrokeBatches();
    const legacyResult = await shiftLegacyStrokes();

    await Migration.create({
        key: MIGRATION_KEY,
        canvasId: CANVAS_ID,
        shiftY: TILE_SIZE,
        tileDelta: 1
    });

    saveCanvasControl(control);

    console.log('Migracion completada.');
    console.log(`strokebatches modificados: ${batchResult.modifiedCount || 0}`);
    console.log(`strokes legacy modificados: ${legacyResult.modifiedCount || 0}`);
    console.log(`height nuevo: ${control.height}`);

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
