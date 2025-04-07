const jwt = require("jsonwebtoken");
const redisClient = require("./redisClient");

const SECRET_KEY = process.env.JWT_SECRET_KEY;

async function authenticateToken(req, res, next) {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access Denied" });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const session = await redisClient.get(`session:${decoded.id}`);

    if (!session) return res.status(403).json({ message: "Session Expired" });

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid Token" });
  }
}

module.exports = authenticateToken;
