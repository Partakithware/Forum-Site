import express from 'express';
import db from '../database.js';

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// 1. STATIC ROUTES FIRST
router.get('/all', requireAuth, (req, res) => {
  try {
    const ownerExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get(['Owner']);
    const hasOwner = ownerExists.count > 0;
    
    if (!hasOwner || ['Owner', 'Admin'].includes(req.user.role)) {
      const users = db.prepare(`
        SELECT id, username, role, created_at 
        FROM users 
        ORDER BY 
          CASE role
            WHEN 'Owner' THEN 1
            WHEN 'Admin' THEN 2
            WHEN 'Moderator' THEN 3
            WHEN 'Developer' THEN 4
            ELSE 5
          END,
          username
      `).all([]);
      
      res.json(users);
    } else {
      res.status(403).json({ error: 'Permission denied' });
    }
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// 2. DYNAMIC PARAMETER ROUTES LAST
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Determine if we are searching by ID or Username
    const isId = !isNaN(identifier) && /^\d+$/.test(identifier);
    
    const query = isId 
      ? 'SELECT id, username, role, created_at FROM users WHERE id = ?'
      : 'SELECT id, username, role, created_at FROM users WHERE username = ?';
    
    const user = db.prepare(query).get([identifier]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user stats with a fallback to 0
    const statsResult = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?').get([user.id]);
    
    // Ensure stats is ALWAYS an object so the frontend doesn't crash
    const stats = {
      post_count: statsResult ? (statsResult.count || statsResult.post_count || 0) : 0
    };

    res.json({ ...user, stats });
  } catch (error) {
    console.error('Profile Route Error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user role
router.put('/:id/role', requireAuth, (req, res) => {
  const { role } = req.body;
  const userId = parseInt(req.params.id);
  
  if (!role || !['Owner', 'Admin', 'Moderator', 'Developer', 'Member'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  try {
    const ownerExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get(['Owner']);
    const hasOwner = ownerExists.count > 0;
    
    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get([userId]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    
    if (hasOwner) {
      if (req.user.role === 'Owner') {
      } else if (req.user.role === 'Admin') {
        if (targetUser.role === 'Owner' || role === 'Owner') {
          return res.status(403).json({ error: 'Admins cannot modify Owner roles' });
        }
      } else {
        return res.status(403).json({ error: 'Permission denied' });
      }
    }
    
    if (targetUser.role === 'Owner' && role !== 'Owner') {
      const ownerCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get(['Owner']);
      if (ownerCount.count <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last Owner.' });
      }
    }
    
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run([role, userId]);
    res.json({ message: 'Role updated successfully', userId, newRole: role });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

export default router;