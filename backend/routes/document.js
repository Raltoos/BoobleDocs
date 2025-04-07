const express = require('express');
const router = new express.Router();
const Document = require('../models/document');
const Permission = require('../models/permissions');
const User = require('../models/user');
const { redisClient } = require("../util/redisClient");
const { v4: uuidv4 } = require('uuid');

const isAuthenticated = (req, res, next) => {
    console.log('Session in isAuthenticated:', req.session);
    
    if (!req.session || !req.session.userId) {
        console.log('No valid session found, unauthorized');
        return res.status(401).json({ message: 'Unauthorized' });
    }
    console.log('User authenticated:', req.session.userId);
    next();
};

const checkDocumentPermission = async (req, res, next) => {
    try {
        const documentId = req.params.id;
        const userId = req.session.userId;

        console.log(`Checking permissions for user ${userId} on document ${documentId}`);

        // First check Redis for permissions
        // const permKey = `perm:${documentId}:${userId}`;
        // const redisPerm = await redisClient.hGetAll(permKey);

        // if (redisPerm && Object.keys(redisPerm).length > 0 && redisPerm.access) {
        //     // Permission found in Redis
        //     console.log(`Found cached permission: ${redisPerm.access}`);
        //     req.userPermission = redisPerm.access;
        //     return next();
        // }

        // console.log('No cached permission, checking database');
        // If not in Redis, check MongoDB
        const permission = await Permission.findOne({ docId: documentId, userId });

        if (!permission) {
            console.log('No permission found in database');
            return res.status(403).json({ message: 'You do not have permission to access this document' });
        }

        console.log(`Found database permission: ${permission.access}`);
        // Cache permission in Redis
        // await redisClient.hSet(permKey, {
        //     access: permission.access
        // });

        // Set TTL for permission cache (12 hours)
        // await redisClient.expire(permKey, 43200);

        // Store permission in request object for later use
        req.userPermission = permission.access;
        next();
    } catch (error) {
        console.error('Error checking document permission:', error);
        res.status(500).json({ error: error.message });
    }
};

// Admin check middleware
const isAdmin = (req, res, next) => {
    if (req.userPermission !== 'admin') {
        return res.status(403).json({ message: 'Admin permission required' });
    }
    next();
};

// Create new document
router.post("/new", isAuthenticated, async (req, res) => {
    try {
        const { title } = req.body;
        const userId = req.session.userId;
        const documentId = uuidv4();

        const document = new Document({
            docId: documentId,
            title: title || `Document ${documentId.substring(0, 6)}`,
            content: '',
            cursors: JSON.stringify([]),
            createdBy: userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await document.save();

        const permission = new Permission({
            docId: documentId,
            userId,
            access: 'admin'
        });

        await permission.save();

        await redisClient.hSet(`doc:${documentId}`, {
            docId: documentId,
            title: document.title,
            content: '',
            cursors: JSON.stringify([]),
            createdBy: userId,
            createdAt: document.createdAt.getTime(),
            updatedAt: document.updatedAt.getTime()
        });

        await redisClient.hSet(`perm:${documentId}:${userId}`, {
            access: 'admin'
        });

        // Invalidate user's document list cache
        await redisClient.del(`documents:user:${userId}`);

        res.status(201).json({ 
            message: 'Document created successfully', 
            docId: documentId,
            title: document.title
        });
    } catch (error) {
        console.error('Error creating document:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get document
router.get("/:id", isAuthenticated, checkDocumentPermission, async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.session.userId;
        
        console.log(`Fetching document ${documentId} for user ${userId}`);

        // // First check Redis
        // const docData = await redisClient.hGetAll(`doc:${documentId}`);

        // if (docData && Object.keys(docData).length > 0) {
        //     console.log('Document found in Redis cache');
        //     // Parse cursors from JSON
        //     let cursors = [];
        //     try {
        //         if (docData.cursors) {
        //             cursors = JSON.parse(docData.cursors);
        //         }
        //     } catch (e) {
        //         console.error("Error parsing cursors:", e);
        //     }

        //     return res.json({
        //         docId: documentId,
        //         content: docData.content || '',
        //         cursors: cursors,
        //         title: docData.title || 'Untitled Document',
        //         permission: req.userPermission
        //     });
        // }

        // console.log('Document not in cache, fetching from database');
        const doc = await Document.findOne({ docId: documentId });

        if (!doc) {
            console.log('Document not found in database');
            return res.status(404).json({ message: "Document not found" });
        }

        console.log('Document found in database, caching in Redis');
        // await redisClient.hSet(`doc:${documentId}`, {
        //     docId: documentId,
        //     title: doc.title,
        //     content: doc.content,
        //     cursors: JSON.stringify([]),
        //     createdBy: doc.createdBy,
        //     createdAt: doc.createdAt.getTime(),
        //     updatedAt: doc.updatedAt.getTime()
        // });

        res.json({
            docId: documentId,
            content: doc.content || '',
            cursors: [],
            title: doc.title,
            permission: req.userPermission
        });
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all documents for a user
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const cacheKey = `documents:user:${userId}`;

        console.log(`Fetching all documents for user ${userId}`);

        // const cachedDocs = await redisClient.get(cacheKey);
        
        // if (cachedDocs) {
        //     console.log('Found documents in cache');
        //     return res.json(JSON.parse(cachedDocs));
        // }

        console.log('Documents not in cache, fetching from database');
        // If not in cache, get from MongoDB
        const userPermissions = await Permission.find({ userId });
        const docIds = userPermissions.map(perm => perm.docId);

        // Get all documents the user has access to
        const docs = await Document.find(
            { docId: { $in: docIds } },
            { docId: 1, title: 1, createdBy: 1, updatedAt: 1 }
        );

        // Create response object with permissions
        const result = {};
        for (const doc of docs) {
            // Find permission for this document
            const perm = userPermissions.find(p => p.docId === doc.docId);
            
            if (perm) {
                result[doc.docId] = {
                    docId: doc.docId,
                    title: doc.title,
                    createdBy: doc.createdBy,
                    updatedAt: doc.updatedAt,
                    access: perm.access
                };
            }
        }

        console.log(`Found ${Object.keys(result).length} documents, caching result`);
        // Cache result in Redis (expires in 15 minutes)
        await redisClient.set(cacheKey, JSON.stringify(result), 'EX', 900);

        res.json(result);
    } catch (error) {
        console.error('Error fetching user documents:', error);
        res.status(500).json({ error: error.message });
    }
});

// // Share document with another user
// router.post("/:id/share", isAuthenticated, checkDocumentPermission, isAdmin, async (req, res) => {
//     try {
//         const documentId = req.params.id;
//         const { username, access } = req.body;

//         if (!username || !access) {
//             return res.status(400).json({ message: 'Username and access level are required' });
//         }

//         if (!['read', 'write', 'admin'].includes(access)) {
//             return res.status(400).json({ message: 'Invalid access level' });
//         }

//         // Find user to share with
//         const targetUser = await User.findOne({ username });

//         if (!targetUser) {
//             return res.status(404).json({ message: 'User not found' });
//         }

//         // Add or update permission in MongoDB
//         const permission = await Permission.findOneAndUpdate(
//             { docId: documentId, userId: targetUser.userId },
//             { access },
//             { upsert: true, new: true }
//         );

//         // Update Redis permission cache
//         await redisClient.hSet(`perm:${documentId}:${targetUser.userId}`, {
//             access
//         });

//         // Invalidate documents list cache for the target user
//         await redisClient.del(`documents:user:${targetUser.userId}`);

//         res.json({ 
//             message: `Document shared with ${username}`,
//             username,
//             access
//         });
//     } catch (error) {
//         console.error('Error sharing document:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

router.post("/:id/share", isAuthenticated, checkDocumentPermission, isAdmin, async (req, res) => {
    try {
        const documentId = req.params.id;
        const { username, access } = req.body;

        if (!username || !access) {
            return res.status(400).json({ message: 'Username and access level are required' });
        }

        if (!['read', 'write', 'admin'].includes(access)) {
            return res.status(400).json({ message: 'Invalid access level' });
        }

        // Find user to share with
        const targetUser = await User.findOne({ username });
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Use update operators to update the permission document or insert a new one if not found
        const permission = await Permission.findOneAndUpdate(
            { docId: documentId, userId: targetUser.userId },
            {
                $set: { access },
                $setOnInsert: { docId: documentId, userId: targetUser.userId }
            },
            { upsert: true, new: true }
        );

        // Update Redis permission cache
        await redisClient.hSet(`perm:${documentId}:${targetUser.userId}`, { access });
        // Invalidate documents list cache for the target user
        await redisClient.del(`documents:user:${targetUser.userId}`);

        res.json({ 
            message: `Document shared with ${username}`,
            username,
            access
        });
    } catch (error) {
        console.error('Error sharing document:', error);
        res.status(500).json({ error: error.message });
    }
});


// Update document title or content
router.put("/:id", isAuthenticated, checkDocumentPermission, async (req, res) => {
    try {
        const documentId = req.params.id;
        const { content, title } = req.body;

        // Check if user has write or admin access
        if (req.userPermission === 'read') {
            return res.status(403).json({ message: 'You do not have permission to edit this document' });
        }

        // Title can only be changed by admin
        if (title !== undefined && req.userPermission !== 'admin') {
            return res.status(403).json({ message: 'Only admins can change document title' });
        }

        // Prepare update data
        const updateData = { updatedAt: new Date() };
        if (content !== undefined) updateData.content = content;
        if (title !== undefined && req.userPermission === 'admin') updateData.title = title;

        // Update document in MongoDB
        const updatedDoc = await Document.findOneAndUpdate(
            { docId: documentId },
            updateData,
            { new: true }
        );

        if (!updatedDoc) {
            return res.status(404).json({ message: 'Document not found' });
        }

        // Update document in Redis
        const redisUpdateData = {
            updatedAt: updateData.updatedAt.getTime()
        };

        if (content !== undefined) redisUpdateData.content = content;
        if (title !== undefined && req.userPermission === 'admin') redisUpdateData.title = title;

        await redisClient.hSet(`doc:${documentId}`, redisUpdateData);

        res.json({ 
            message: 'Document updated successfully',
            title: updatedDoc.title
        });
    } catch (error) {
        console.error('Error updating document:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete document
router.delete("/:id", isAuthenticated, checkDocumentPermission, isAdmin, async (req, res) => {
    try {
        const documentId = req.params.id;

        // Get all users who had access to this document
        const permissions = await Permission.find({ docId: documentId });
        const userIds = permissions.map(perm => perm.userId);

        // Delete document from MongoDB
        await Document.deleteOne({ docId: documentId });

        // Delete all permissions for this document
        await Permission.deleteMany({ docId: documentId });

        // Delete document from Redis
        await redisClient.del(`doc:${documentId}`);

        // Delete all permissions from Redis and invalidate user document lists
        for (const userId of userIds) {
            await redisClient.del(`perm:${documentId}:${userId}`);
            await redisClient.del(`documents:user:${userId}`);
        }

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;