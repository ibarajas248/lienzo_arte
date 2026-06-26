const mongoose = require('mongoose');

const strokeSchema = new mongoose.Schema({
    x0: { type: Number, required: true },
    y0: { type: Number, required: true },
    x1: { type: Number, required: true },
    y1: { type: Number, required: true },
    color: { type: String, required: true },
    size: { type: Number, required: true },
    user_email: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 604800 } // Opcional: TTL para que los trazos duren 7 días y no colapsen la BD
});

module.exports = mongoose.model('Stroke', strokeSchema);
