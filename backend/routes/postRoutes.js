import express from 'express';
import db from '../database.js';

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Permission helper
function canEditPost(user, post) {
  console.log('canEditPost check:', { userRole: user.role, userId: user.id, postUserId: post.user_id });
  if (['Owner', 'Admin', 'Moderator'].includes(user.role)) {
    return true;
  }
  return user.id === post.user_id;
}

function canDeletePost(user, post) {
  // Staff roles can delete any post
  if (['Owner', 'Admin', 'Moderator'].includes(user.role)) {
    return true;
  }
  // Users can delete their own posts
  return user.id === post.user_id;
}

// Get all posts or posts by category
router.get('/', (req, res) => {
  const { category } = req.query;
  
  try {
    let posts;
    
    if (category) {
      const cat = db.prepare('SELECT id FROM categories WHERE slug = ?').get([category]);
      if (!cat) {
        return res.status(404).json({ error: 'Category not found' });
      }
      
      posts = db.prepare(`
        SELECT posts.*, users.username, users.role as user_role, categories.name as category_name, categories.slug as category_slug
        FROM posts 
        JOIN users ON posts.user_id = users.id 
        JOIN categories ON posts.category_id = categories.id
        WHERE posts.category_id = ?
        ORDER BY posts.created_at DESC
      `).all([cat.id]);
    } else {
      posts = db.prepare(`
        SELECT posts.*, users.username, users.role as user_role, categories.name as category_name, categories.slug as category_slug
        FROM posts 
        JOIN users ON posts.user_id = users.id 
        JOIN categories ON posts.category_id = categories.id
        ORDER BY posts.created_at DESC
      `).all([]);
    }
    
    res.json(posts);
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post
router.get('/:id', (req, res) => {
  try {
    const post = db.prepare(`
      SELECT posts.*, users.username, users.role as user_role, categories.name as category_name, categories.slug as category_slug
      FROM posts 
      JOIN users ON posts.user_id = users.id 
      JOIN categories ON posts.category_id = categories.id
      WHERE posts.id = ?
    `).get([req.params.id]);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json(post);
  } catch (error) {
    console.error('Failed to fetch post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Create post
router.post('/', requireAuth, (req, res) => {
  console.log('Create post request body:', req.body);
  console.log('User from session:', req.user);
  
  const { title, content, link, linkvt, linkjt, link_type, category_slug } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content required' });
  }
  
  if (!category_slug) {
    return res.status(400).json({ error: 'Category required' });
  }
  
  try {
    const category = db.prepare('SELECT id FROM categories WHERE slug = ?').get([category_slug]);
    if (!category) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO posts (user_id, category_id, title, content, link, linkvt, linkjt, link_type) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run([req.user.id, category.id, title, content, link || null, linkvt || null, linkjt || null, link_type || null]);
    
    console.log('Post created successfully:', result);
    res.json({ message: 'Post created successfully', postId: result.lastInsertRowid });
  } catch (error) {
    console.error('!!! Post creation error !!!');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to create post: ' + error.message });
  }
});

// Update post
router.put('/:id', requireAuth, (req, res) => {
  const { title, content, link, linkvt, linkjt, link_type, category_slug } = req.body;
  
  try {
    // Get the post
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get([req.params.id]);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check permissions
    if (!canEditPost(req.user, post)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    // Get category if it's being changed
    let categoryId = post.category_id;
    if (category_slug) {
      const category = db.prepare('SELECT id FROM categories WHERE slug = ?').get([category_slug]);
      if (!category) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      categoryId = category.id;
    }
    
    const stmt = db.prepare(`
      UPDATE posts 
      SET title = ?, content = ?, link = ?, linkvt = ?, linkjt = ?, link_type = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run([
      title || post.title,
      content || post.content,
      link !== undefined ? link : post.link,
      linkvt !== undefined ? linkvt : post.linkvt,
      linkjt !== undefined ? linkjt : post.linkjt,
      link_type !== undefined ? link_type : post.link_type,
      categoryId,
      req.params.id
    ]);
    
    res.json({ message: 'Post updated successfully' });
  } catch (error) {
    console.error('Failed to update post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get([req.params.id]);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check permissions
    if (!canDeletePost(req.user, post)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    db.prepare('DELETE FROM posts WHERE id = ?').run([req.params.id]);
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Failed to delete post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;