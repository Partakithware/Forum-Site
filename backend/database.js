import initSqlJs from 'sql.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'forum.db');

let db;
let SQL;

async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: file => `./node_modules/sql.js/dist/${file}`
  });
  
  let buffer;
  try {
    buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('Loaded existing database');
  } catch (err) {
    db = new SQL.Database();
    console.log('Created new database');
  }
  
  // Initialize schema
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'Member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      parent_id INTEGER,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      link TEXT,
      linkvt TEXT,
      linkjt TEXT,
      link_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);
  
  // Insert default categories if they don't exist
  //const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get([]);
  // Insert default categories if they don't exist
  const res = all('SELECT COUNT(*) as count FROM categories');
  const count = res[0]?.count || 0;
    // FIX 1: Check the number directly
  if (count === 0) {
    console.log('Inserting default categories...');
    
    // Main categories
    run(`INSERT INTO categories (name, slug, parent_id, display_order) VALUES ('Projects', 'projects', NULL, 4)`);
    run(`INSERT INTO categories (name, slug, parent_id, display_order) VALUES ('General', 'general', NULL, 1)`);
    run(`INSERT INTO categories (name, slug, parent_id, display_order) VALUES ('Art', 'art', NULL, 2)`);
    run(`INSERT INTO categories (name, slug, parent_id, display_order) VALUES ('Programming', 'programming', NULL, 3)`);
    
    
    // Projects subcategories
    // FIX 2: Use your 'get' helper here, otherwise projectsId will be undefined
    const projectRow = get('SELECT id FROM categories WHERE slug = ?', ['projects']);
    
    if (projectRow) {
        const projectsId = projectRow.id;
        run(`INSERT INTO categories (name, slug, parent_id, display_order) VALUES ('Completed', 'completed', ?, 1)`, [projectsId]);
        run(`INSERT INTO categories (name, slug, parent_id, display_order) VALUES ('In Progress', 'in-progress', ?, 2)`, [projectsId]);
        run(`INSERT INTO categories (name, slug, parent_id, display_order) VALUES ('Request', 'request', ?, 3)`, [projectsId]);
    }
  }
  
  saveDatabase();
  console.log('Database initialized successfully');
}

function saveDatabase() {
  if (db) {
    try {
      const data = db.export();
      fs.writeFileSync(dbPath, data);
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }
}

// Helper functions
function get(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  } catch (err) {
    console.error('Database get error:', err);
    throw err;
  }
}

function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  } catch (err) {
    console.error('Database all error:', err);
    throw err;
  }
}

function run(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    saveDatabase();
  } catch (err) {
    console.error('Database run error:', err);
    throw err;
  }
}
// Export database interface
export default {
  init: initDatabase,
  get,
  all,
  run,
  prepare: (sql) => ({
    get: (params = []) => get(sql, params),
    all: (params = []) => all(sql, params),
    run: (params = []) => {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
      saveDatabase();
      
      // Return lastInsertRowid
      const result = get('SELECT last_insert_rowid() as id');
      return { lastInsertRowid: result ? result.id : null };
    }
  }),
  save: saveDatabase
};