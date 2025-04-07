const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    docId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    access: {
        type: String,
        enum: ['read', 'write', 'admin'],
        default: 'read'
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

// Compound index for faster lookups
permissionSchema.index({ docId: 1, userId: 1 }, { unique: true });
// Index for finding all docs a user can access
permissionSchema.index({ userId: 1 });

const Permission = mongoose.model('Permission', permissionSchema);

module.exports = Permission;