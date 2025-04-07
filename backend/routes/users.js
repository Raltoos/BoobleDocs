const express = require('express');
const router = new express.Router();

const bcrypt = require("bcrypt");
const User = require("../models/user");
const { v4: uuidv4 } = require('uuid');

router.post("/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;

    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: existingUser.username === username
          ? 'Username already taken'
          : 'Email already registered'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    const user = new User({
      userId,
      username,
      passwordHash,
      email
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully', userId });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    req.session.userId = user.userId;
    req.session.username = username;

    res.json({
      message: 'Login successful',
      userId: user.userId,
      username: user.username
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

router.get("/me", (req, res) => {
  if (!req.session) {
    return res.status(400).json({
      message: 'Unauthorized'
    });
  }

  return res.status(200).json({
    userId: req.session.userId,
    username: req.session.username
  })
});

module.exports = router;