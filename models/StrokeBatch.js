const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
    kind: { type: String, enum: ['line', 'rect', 'text'], default: 'line' },
    x0: Number,
    y0: Number,
    x1: Number,
    y1: Number,
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    text: String,
    fontFamily: String,
    color: { type: String, required: true },
    size: Number,
    opacity: Number,
    order: Number
}, { _id: false });

const strokeBatchSchema = new mongoose.Schema({
    canvasId: { type: String, required: true, default: 'main', index: true },
    tileX: { type: Number, required: true },
    tileY: { type: Number, required: true },
    segments: { type: [segmentSchema], required: true },
    user_email: { type: String, required: true, default: 'anonymous' },
    user_name: { type: String, default: '' },
    user_uid: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, index: true }
});

strokeBatchSchema.index({ canvasId: 1, tileX: 1, tileY: 1, createdAt: 1 });
strokeBatchSchema.index({ canvasId: 1, tileY: -1 });
strokeBatchSchema.index({ canvasId: 1, user_email: 1, createdAt: -1 });

module.exports = mongoose.model('StrokeBatch', strokeBatchSchema);
