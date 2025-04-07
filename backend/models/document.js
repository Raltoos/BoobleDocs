const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    docId: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        default: 'Untitled Document'
    },
    content: {
        type: String,
        default: ''
    },
    createdBy: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Add index for faster queries
documentSchema.index({ docId: 1 });
documentSchema.index({ createdBy: 1 });

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;