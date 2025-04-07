const { redisClient } = require("./util/redisClient");
const Document = require('./models/document');
const User = require('./models/user');
const Permission = require('./models/permissions');

const socketHandler = (io) => {
    // Track active connections by userId and documentId
    const activeConnections = new Map();

    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);

        socket.on("join-document", async ({ documentId, userId, color }) => {
            try {
                console.log(`User ${userId} joined document ${documentId}`);

                // Get username from userId
                const user = await User.findOne({ userId });
                const username = user ? user.username : userId.substring(0, 8);

                // Join socket to document room
                socket.join(documentId);

                // Get document from Redis or MongoDB
                let doc = await getDocumentFromCache(documentId);
                if (!doc) {
                    // If not in cache, get from DB and cache it
                    doc = await getDocumentFromDB(documentId);
                    if (doc) {
                        await cacheDocument(documentId, doc);
                    } else {
                        // Create empty document if it doesn't exist
                        doc = {
                            docId: documentId,
                            title: "Untitled Document",
                            content: "",
                            cursors: []
                        };
                        await cacheDocument(documentId, doc);
                    }
                }

                // Track this user's socket for this document
                await redisClient.hSet(`socket:${socket.id}`, {
                    userId,
                    username,
                    documentId
                });

                // If user already has an active connection to this document, remove their old cursor
                const connectionKey = `${userId}:${documentId}`;
                if (activeConnections.has(connectionKey)) {
                    const oldSocketId = activeConnections.get(connectionKey);
                    // Inform the old connection it's being replaced
                    io.to(oldSocketId).emit("session-expired", {
                        message: "Your session was opened in another window"
                    });
                }

                // Update active connections map
                activeConnections.set(connectionKey, socket.id);

                // Get current cursors, ensuring we have valid data
                let cursors = doc.cursors || [];
                if (!Array.isArray(cursors)) {
                    cursors = [];
                }

                // Remove any existing cursor for this user
                cursors = cursors.filter(c => c.userId !== userId);

                // Add user's cursor with username
                cursors.push({
                    userId,
                    username,
                    position: 0,
                    color,
                    lastActive: Date.now()
                });

                // Update cursor list in Redis
                await redisClient.hSet(`doc:${documentId}`, {
                    cursors: JSON.stringify(cursors)
                });

                // Send current document state to the joining client
                socket.emit("document-state", {
                    content: doc.content,
                    title: doc.title,
                    cursors: cursors
                });

                // Broadcast cursor update to all clients in the document
                io.to(documentId).emit("cursor-update", cursors);
            } catch (error) {
                console.error("Error handling join-document:", error);
                socket.emit("error", { message: "Failed to join document" });
            }
        });

        // Handle text operations (insert, delete) with version control
        socket.on("text-operation", async (operation) => {
            try {
                const { documentId, type, position, character, version } = operation;
                const socketInfo = await redisClient.hGetAll(`socket:${socket.id}`);
                if (!socketInfo || !socketInfo.documentId) return;

                // Verify user has permission to edit (could call checkDocumentPermission)

                // Get document from Redis
                const redisDoc = await getDocumentFromCache(documentId);
                if (!redisDoc) return;

                // Apply operation to content
                let newContent = redisDoc.content || "";
                if (type === "insert" && character) {
                    newContent = newContent.slice(0, position) + character + newContent.slice(position);
                } else if (type === "delete") {
                    newContent = newContent.slice(0, position) + newContent.slice(position + 1);
                }

                // Update Redis cache with new content
                await redisClient.hSet(`doc:${documentId}`, {
                    content: newContent,
                    updatedAt: Date.now(),
                    version: (version || 0) + 1
                });

                // Update user's last active timestamp
                await updateUserActivity(documentId, socketInfo.userId);

                // Broadcast operation to other clients
                socket.to(documentId).emit("text-operation", {
                    ...operation,
                    username: socketInfo.username,
                    timestamp: Date.now()
                });

                // Save to MongoDB periodically (debounced)
                debouncedSaveToMongoDB(documentId, newContent);
            } catch (error) {
                console.error("Error handling text operation:", error);
                socket.emit("error", { message: "Failed to process text operation" });
            }
        });

        // Handle cursor updates
        socket.on("cursor-update", async ({ position, color, documentId }) => {
            try {
                const socketInfo = await redisClient.hGetAll(`socket:${socket.id}`);
                if (!socketInfo || !socketInfo.documentId || !socketInfo.userId) return;

                const userId = socketInfo.userId;
                const username = socketInfo.username;

                // Get current cursors from Redis
                const docData = await redisClient.hGetAll(`doc:${documentId}`);
                if (!docData) return;

                let cursors = [];
                try {
                    cursors = JSON.parse(docData.cursors || "[]");
                    if (!Array.isArray(cursors)) cursors = [];
                } catch (e) {
                    console.error("Error parsing cursors:", e);
                    cursors = [];
                }

                // Update cursor position or add if not exists
                const cursorIndex = cursors.findIndex(c => c.userId === userId);
                if (cursorIndex >= 0) {
                    cursors[cursorIndex] = {
                        userId,
                        username,
                        position,
                        color,
                        lastActive: Date.now()
                    };
                } else {
                    cursors.push({
                        userId,
                        username,
                        position,
                        color,
                        lastActive: Date.now()
                    });
                }

                // Update cursors in Redis
                await redisClient.hSet(`doc:${documentId}`, {
                    cursors: JSON.stringify(cursors)
                });

                // Broadcast to all clients in the document
                io.to(documentId).emit("cursor-update", cursors);
            } catch (error) {
                console.error("Error handling cursor update:", error);
            }
        });

        // Share document with other users (from socket)
        socket.on("share-document", async ({ documentId, username, access }) => {
            try {
                const socketInfo = await redisClient.hGetAll(`socket:${socket.id}`);
                if (!socketInfo || !socketInfo.userId) return;

                // Call the sharing API endpoint
                const targetUser = await User.findOne({ username });
                console.log(targetUser);
                if (!targetUser) {
                    socket.emit("share-result", {
                        success: false,
                        message: "User not found"
                    });
                    return;
                }

                const permission = new Permission({
                    docId: documentId,
                    userId: targetUser.userId,
                    access
                });

                await permission.save();

                // Check if user has admin permission (should be done through an API call)
                // For now we'll assume they do

                // Emit event to notify the user that sharing was successful
                socket.emit("share-result", {
                    success: true,
                    username,
                    access,
                    message: `Document shared with ${username}`
                });

                // Notify the target user if they're online and viewing documents list
                io.to(`user:${targetUser.userId}`).emit("document-shared", {
                    documentId,
                    sharedBy: socketInfo.username
                });
            } catch (error) {
                console.error("Error sharing document through socket:", error);
                socket.emit("share-result", {
                    success: false,
                    message: "Failed to share document"
                });
            }
        });

        // Handle disconnections
        socket.on("disconnect", async () => {
            try {
                console.log("Client disconnected:", socket.id);

                // Get user and document info for this socket
                const socketInfo = await redisClient.hGetAll(`socket:${socket.id}`);
                if (!socketInfo || !socketInfo.documentId || !socketInfo.userId) return;

                const { documentId, userId } = socketInfo;

                // Remove connection from active connections map
                const connectionKey = `${userId}:${documentId}`;
                if (activeConnections.get(connectionKey) === socket.id) {
                    activeConnections.delete(connectionKey);
                }

                // Remove user cursor from document
                const docData = await redisClient.hGetAll(`doc:${documentId}`);
                if (docData && docData.cursors) {
                    let cursors = [];
                    try {
                        cursors = JSON.parse(docData.cursors);
                        if (!Array.isArray(cursors)) cursors = [];

                        const filteredCursors = cursors.filter(c => c.userId !== userId);

                        // Update cursors in Redis
                        await redisClient.hSet(`doc:${documentId}`, {
                            cursors: JSON.stringify(filteredCursors)
                        });

                        // Broadcast cursor update
                        io.to(documentId).emit("cursor-update", filteredCursors);
                    } catch (e) {
                        console.error("Error processing cursors on disconnect:", e);
                    }
                }

                // Clean up socket tracking
                await redisClient.del(`socket:${socket.id}`);

                // If document was being edited, save to MongoDB
                if (docData && docData.content) {
                    try {
                        await Document.findOneAndUpdate(
                            { docId: documentId },
                            { content: docData.content, updatedAt: new Date() }
                        );
                        console.log(`Document ${documentId} saved on disconnect`);
                    } catch (e) {
                        console.error("Error saving document on disconnect:", e);
                    }
                }
            } catch (error) {
                console.error("Error handling disconnect:", error);
            }
        });
    });

    // Set up heartbeat to detect stale connections
    setInterval(async () => {
        try {
            const docs = await redisClient.keys('doc:*');
            for (const docKey of docs) {
                const docId = docKey.split(':')[1];
                const docData = await redisClient.hGetAll(docKey);

                if (docData && docData.cursors) {
                    let cursors = [];
                    try {
                        cursors = JSON.parse(docData.cursors);
                        if (!Array.isArray(cursors)) continue;

                        // Filter out stale cursors (inactive for more than 5 minutes)
                        const now = Date.now();
                        const activeCursors = cursors.filter(c =>
                            !c.lastActive || now - c.lastActive < 5 * 60 * 1000
                        );

                        // If we found and removed stale cursors
                        if (activeCursors.length < cursors.length) {
                            await redisClient.hSet(docKey, {
                                cursors: JSON.stringify(activeCursors)
                            });

                            // Broadcast cursor update
                            io.to(docId).emit("cursor-update", activeCursors);
                        }
                    } catch (e) {
                        console.error("Error processing heartbeat cursors:", e);
                    }
                }
            }
        } catch (error) {
            console.error("Error in heartbeat:", error);
        }
    }, 60000); // Check every minute

    // Helper functions
    async function getDocumentFromCache(documentId) {
        try {
            const docData = await redisClient.hGetAll(`doc:${documentId}`);
            if (!docData || Object.keys(docData).length === 0) return null;

            // Parse cursors if they exist
            let cursors = [];
            if (docData.cursors) {
                try {
                    cursors = JSON.parse(docData.cursors);
                    if (!Array.isArray(cursors)) cursors = [];
                } catch (e) {
                    console.error("Error parsing cursors from cache:", e);
                }
            }

            return {
                docId: documentId,
                title: docData.title || "Untitled Document",
                content: docData.content || "",
                cursors: cursors,
                createdBy: docData.createdBy,
                createdAt: docData.createdAt,
                updatedAt: docData.updatedAt,
                version: docData.version || 0
            };
        } catch (error) {
            console.error("Error retrieving document from cache:", error);
            return null;
        }
    }

    async function getDocumentFromDB(documentId) {
        try {
            const doc = await Document.findOne({ docId: documentId });
            if (!doc) return null;

            return {
                docId: documentId,
                title: doc.title,
                content: doc.content,
                cursors: [],
                createdBy: doc.createdBy,
                createdAt: doc.createdAt.getTime(),
                updatedAt: doc.updatedAt.getTime(),
                version: 0
            };
        } catch (error) {
            console.error("Error retrieving document from DB:", error);
            return null;
        }
    }

    async function cacheDocument(documentId, doc) {
        try {
            await redisClient.hSet(`doc:${documentId}`, {
                docId: documentId,
                title: doc.title || "Untitled Document",
                content: doc.content || "",
                cursors: JSON.stringify(doc.cursors || []),
                createdBy: doc.createdBy,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
                version: doc.version || 0
            });
        } catch (error) {
            console.error("Error caching document:", error);
        }
    }

    async function updateUserActivity(documentId, userId) {
        try {
            const docData = await redisClient.hGetAll(`doc:${documentId}`);
            if (!docData || !docData.cursors) return;

            let cursors = [];
            try {
                cursors = JSON.parse(docData.cursors);
                if (!Array.isArray(cursors)) return;

                const cursorIndex = cursors.findIndex(c => c.userId === userId);
                if (cursorIndex >= 0) {
                    cursors[cursorIndex].lastActive = Date.now();

                    await redisClient.hSet(`doc:${documentId}`, {
                        cursors: JSON.stringify(cursors)
                    });
                }
            } catch (e) {
                console.error("Error updating user activity:", e);
            }
        } catch (error) {
            console.error("Error updating user activity:", error);
        }
    }

    // Save to MongoDB (debounced to avoid too many writes)
    const saveTimers = new Map();
    function debouncedSaveToMongoDB(documentId, content) {
        // Clear existing timer for this document
        if (saveTimers.has(documentId)) {
            clearTimeout(saveTimers.get(documentId));
        }

        // Set new timer
        const timer = setTimeout(async () => {
            try {
                await Document.findOneAndUpdate(
                    { docId: documentId },
                    { content, updatedAt: new Date() }
                );
                console.log(`Document ${documentId} saved to MongoDB`);
                saveTimers.delete(documentId);
            } catch (error) {
                console.error("Error saving document to MongoDB:", error);
            }
        }, 2000); // Save after 2 seconds of inactivity

        saveTimers.set(documentId, timer);
    }
};

module.exports = socketHandler;