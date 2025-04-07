const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const session = require("express-session");
const connectDB = require('./db/mongoose.js');
const socketHandler = require("./sockethandler");
const { redisStore, redisClient } = require("./util/redisClient");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

socketHandler(io);

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use(express.json());
const sessionMiddleware = session({
  store: redisStore, 
  secret: process.env.SESSION_SECRET || "secret-collaborative-editor-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 3600000
  }
});

app.use(sessionMiddleware);

connectDB();

const userRoutes = require("./routes/users.js");
const documentRoutes = require("./routes/document.js");

app.use('/user', userRoutes);
app.use('/doc', documentRoutes);

app.get('/check', (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false });
  }
  return res.json({ 
    authenticated: true,
    userId: req.session.userId,
    username: req.session.username
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;