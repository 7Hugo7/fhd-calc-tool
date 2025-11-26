import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { password } = req.body;
    const correctPassword = 'BigBrother2025!';

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    if (password !== correctPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Get admin user
    const user = db.prepare('SELECT * FROM users WHERE role = ? AND active = 1 LIMIT 1').get('admin');

    if (!user) {
      return res.status(500).json({ error: 'No admin user found' });
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);

    const isValidPassword = bcrypt.compareSync(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
