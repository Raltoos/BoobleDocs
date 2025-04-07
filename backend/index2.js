const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const connectDB = require('./db/mongoose.js');
const session = require("express-session");

// const sessionConfig = require("./util/sessionConf");
const socketHandler = require("./sockethandler.js");

const { redisStore } = require("./util/redisClient.js");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
socketHandler(io);

app.use(cors({
  origin: "http://localhost:5174", // Set to frontend origin
  credentials: true, // Allow credentials (cookies/sessions)
}));
app.use(express.json());
app.use(session({
  store: redisStore,
  secret: process.env.SESSION_SECRET || "mysecret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: false,
    maxAge: 3600000, // 1 hour
  },
}));
connectDB();

const userRoutes = require("./routes/users.js")
const documentRoutes = require("./routes/document.js");
app.use('/user', userRoutes);
app.use('/doc', documentRoutes);

app.get('/check', (req, res) => {
  if (!req.session.userId) {
    return res.json({ message: 'false' });
  }

  return res.json({ message: 'true' });
});


// const documents = new Map();

// io.on("connection", (socket) => {
//   console.log("New client connected:", socket.id);

//   socket.on("join-document", ({ documentId, userId, color }) => {
//     console.log(`User ${userId} joined document ${documentId}`);

//     socket.join(documentId);

//     if (!documents.has(documentId)) {
//       documents.set(documentId, {
//         title: "",
//         cursors: [],
//         content: ""
//       });
//     }

//     // Update or add user cursor to the document
//     const doc = documents.get(documentId);
//     const cursorIndex = doc.cursors.findIndex(c => c.userId === userId);

//     if (cursorIndex >= 0) {
//       doc.cursors[cursorIndex] = { userId, position: 0, color };
//     } else {
//       doc.cursors.push({ userId, position: 0, color });
//     }

//     io.to(documentId).emit("cursor-update", doc.cursors);
//   });

//   // Handle text operations (insert, delete)
//   // socket.on("text-operation", (operation) => {
//   //   const { documentId } = operation;

//   //   // Forward operation to all clients in this document
//   //   socket.to(documentId).emit("text-operation", operation);
//   // });
//   socket.on("text-operation", (operation) => {
//     const { documentId, type, position, character } = operation;

//     if (!documents.has(documentId)) return;

//     const doc = documents.get(documentId);

//     if (type === "insert" && character) {
//       doc.content =
//         doc.content.slice(0, position) + character + doc.content.slice(position);
//     } else if (type === "delete") {
//       doc.content = doc.content.slice(0, position) + doc.content.slice(position + 1);
//     }

//     documents.set(documentId, doc);

//     socket.to(documentId).emit("text-operation", operation);
//   });


//   // Handle cursor updates
//   socket.on("cursor-update", ({ userId, position, color, documentId }) => {
//     if (!documents.has(documentId)) return;

//     const doc = documents.get(documentId);
//     const cursorIndex = doc.cursors.findIndex(c => c.userId === userId);

//     if (cursorIndex >= 0) {
//       doc.cursors[cursorIndex] = { userId, position, color };
//     } else {
//       doc.cursors.push({ userId, position, color });
//     }

//     // Broadcast updated cursors to all clients in the document
//     io.to(documentId).emit("cursor-update", doc.cursors);
//   });

//   // Handle disconnections
//   socket.on("disconnect", () => {
//     console.log("Client disconnected:", socket.id);

//     // Clean up cursor data when users disconnect
//     documents.forEach((doc, documentId) => {
//       // This is a simplification - in production you would track which user disconnected
//       // For now, we're just keeping the data
//       io.to(documentId).emit("cursor-update", doc.cursors);
//     });
//   });
// });

// app.get("/document/:id", (req, res) => {
//   const documentId = req.params.id;
//   if (documents.has(documentId)) {
//     res.json(documents.get(documentId));
//   } else {
//     res.json({ title: "", content: "", cursors: [] });
//   }
// });

// app.post("/document/new/:id", (req, res) => {
//   documents.set(req.params.id, {
//     title: "Untitled Document",
//     cursors: [],
//     content: "",
//   });

//   res.sendStatus(200);
// });

// app.patch("/document/title/:id", (req, res) => {
//   const documentId = req.params.id;
//   const { title: newTitle } = req.body;

//   if (!documents.has(documentId)) return;

//   const doc = documents.get(documentId);
//   doc.title = newTitle;
//   documents.set(documentId, doc);

//   res.status(200).json({ message: "Title Updated Successfully" });
// })

// app.get("/documents/", (req, res) => {
//   const jsonObj = {};
//   documents.forEach((value, key) => {
//     jsonObj[key] = value;
//   });

//   res.send(jsonObj)
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// })

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});