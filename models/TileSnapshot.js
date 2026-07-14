const mongoose = require('mongoose');

const tileSnapshotSchema = new mongoose.Schema({
    canvasId: { type: String, required: true, default: 'main', index: true },
    tileX: { type: Number, required: true },
    tileY: { type: Number, required: true },
    upToOrder: { type: Number, required: true, default: 0 },
    segmentCount: { type: Number, required: true, default: 0 },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    path: { type: String, required: true },
    format: { type: String, enum: ['svg', 'webp'], default: 'webp' },
    mimeType: { type: String, default: 'image/webp' },
    byteSize: { type: Number, required: true, default: 0 },
    generatedAt: { type: Date, default: Date.now }
});

tileSnapshotSchema.index({ canvasId: 1, tileX: 1, tileY: 1 }, { unique: true });

module.exports = mongoose.model('TileSnapshot', tileSnapshotSchema);
