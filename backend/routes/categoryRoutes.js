import express from 'express';
import db from '../database.js';

const router = express.Router();

// Get all categories with subcategories
router.get('/', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT * FROM categories WHERE parent_id IS NULL ORDER BY display_order
    `).all([]);
    
    const categoriesWithSubs = categories.map(category => {
      const subcategories = db.prepare(`
        SELECT * FROM categories WHERE parent_id = ? ORDER BY display_order
      `).all([category.id]);
      
      return {
        ...category,
        subcategories: subcategories || []
      };
    });
    
    res.json(categoriesWithSubs);
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single category
router.get('/:slug', (req, res) => {
  try {
    const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get([req.params.slug]);
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Get subcategories if this is a parent
    const subcategories = db.prepare('SELECT * FROM categories WHERE parent_id = ? ORDER BY display_order').all([category.id]);
    
    // Get parent if this is a subcategory
    let parent = null;
    if (category.parent_id) {
      parent = db.prepare('SELECT * FROM categories WHERE id = ?').get([category.parent_id]);
    }
    
    res.json({
      ...category,
      subcategories: subcategories || [],
      parent: parent
    });
  } catch (error) {
    console.error('Failed to fetch category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

export default router;