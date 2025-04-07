const { redisStore } = require("../util/redisClient");
require("dotenv").config();

const sessionConfig = {
    store: redisStore,
    secret: process.env.SESSION_SECRET || "mysecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: false,
        maxAge: 3600000, // 1 hour
    },
};

module.exports = { sessionConfig };