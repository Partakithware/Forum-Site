import express from 'express';
import bcrypt from 'bcrypt';
import passport from '../auth.js';
import db from '../database.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  console.log('Request body:', req.body);
  console.log('Username:', req.body.username);
  console.log('Password:', req.body.password);
  
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  try {
    console.log('Step 1: Starting password hash...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Step 2: Password hashed successfully');
    console.log('Step 3: Preparing database insert...');
    
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    console.log('Step 4: Running insert with params:', [username, hashedPassword]);
    
    const result = stmt.run([username, hashedPassword]);
    console.log('Step 5: Insert successful, result:', result);
    
    res.json({ message: 'User registered successfully', userId: result.lastInsertRowid });
  } catch (error) {
    console.error('!!! Registration error !!!');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.message && error.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
  }
});

// Login
router.post('/login', passport.authenticate('local'), (req, res) => {
  res.json({ message: 'Login successful', user: { id: req.user.id, username: req.user.username } });
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logout successful' });
  });
});

// Check auth status
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ 
      user: { 
        id: req.user.id, 
        username: req.user.username,
        role: req.user.role 
      } 
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

export default router;