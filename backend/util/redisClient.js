const { createClient } = require('redis');
const {RedisStore} = require("connect-redis");

const redisClient = createClient();

redisClient.connect().catch((e) => console.log("Could not connect to Redis: ", e));
redisClient.on('connect', () => console.log('✅ Connected to Redis successfully!'));

const redisStore = new RedisStore({client: redisClient});
module.exports = {redisStore, redisClient};