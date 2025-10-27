const mongoose = require('mongoose');

const emailHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['generate', 'verify'],
        required: true
    },
    input: {
        type: Object,
        required: true
    },
    results: {
        type: Object,
        required: true
    },
    creditsUsed: {
        type: Number,
        required: true,
        default: 1
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for fast user-based queries
emailHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('EmailHistory', emailHistorySchema);