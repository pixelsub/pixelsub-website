const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Ensure upload directory =====
const uploadsDir = path.join(__dirname, 'uploads', 'products');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ===== Database Setup =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ===== Initialize Database Tables =====
async function initDB() {
  const client = await pool.connect();
  try {
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'software',
        price DECIMAL(10,2) DEFAULT 0,
        original_price DECIMAL(10,2),
        image TEXT DEFAULT '',
        badge VARCHAR(50),
        description TEXT DEFAULT '',
        featured BOOLEAN DEFAULT false,
        best_seller BOOLEAN DEFAULT false,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);

    // Check if products exist
    const productCount = await client.query('SELECT COUNT(*) FROM products');
    if (parseInt(productCount.rows[0].count) === 0) {
      // Seed default products
      const defaultProducts = [
        ['ChatGPT Plus Subscription', 'ai-tools', 650, 1200, 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=400&fit=crop', 'hot', 'Access GPT-4o, DALL·E, and advanced features. Fast and reliable.', true, true],
        ['Canva Pro Premium', 'graphics-tools', 150, 350, 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=400&fit=crop', 'sale', 'Unlock all Canva Pro features — premium templates, brand kit, magic resize & more.', true, true],
        ['Quillbot Premium', 'writing-tools', 179, 400, 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=400&fit=crop', 'sale', 'Premium paraphrasing tool with unlimited rewrites and grammar checker.', true, false],
        ['Grammarly Premium', 'writing-tools', 250, 600, 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=400&fit=crop', 'sale', 'Advanced writing assistant with tone detection and plagiarism checker.', false, true],
        ['Udemy Subscription', 'educational', 799, 2499, 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=400&h=400&fit=crop', 'hot', 'Access 200,000+ online courses on development, business, design, and more.', true, false],
        ['Office 365 Pro Plus', 'software', 499, 650, 'https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=400&h=400&fit=crop', 'sale', 'Microsoft Office 365 with Word, Excel, PowerPoint, 1TB OneDrive.', true, true],
        ['Perplexity AI Pro', 'ai-tools', 199, 500, 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=400&fit=crop', 'new', 'AI-powered search engine with unlimited Pro searches and GPT-4 access.', true, false],
        ['NordVPN Premium', 'vpn', 299, 800, 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=400&fit=crop', 'sale', 'Fast, secure VPN with 5000+ servers and no-logs policy.', false, true],
        ['Adobe Creative Cloud', 'graphics-tools', 999, 2500, 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&h=400&fit=crop', 'hot', 'Full Adobe suite — Photoshop, Illustrator, Premiere Pro, and 20+ apps.', false, true],
        ['Spotify Premium', 'streaming', 120, 250, 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400&h=400&fit=crop', 'sale', 'Ad-free music streaming, offline downloads, high-quality audio.', false, false],
        ['Netflix Premium', 'streaming', 250, 500, 'https://images.unsplash.com/photo-1574375927938-d5a98e8d7e28?w=400&h=400&fit=crop', 'hot', 'Stream movies, TV shows in 4K Ultra HD on multiple screens.', false, false],
        ['Coursera Plus', 'educational', 599, 1500, 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=400&fit=crop', 'new', 'Unlimited access to 7,000+ courses from top universities.', false, false],
        ['Hix AI Writer', 'ai-tools', 350, 800, 'https://images.unsplash.com/photo-1655720828018-edd2daec9349?w=400&h=400&fit=crop', 'new', 'AI writing assistant with 120+ tools and browser extension.', false, false],
        ['Windows 11 Pro Key', 'software', 899, 1500, 'https://images.unsplash.com/photo-1624571395728-f1df77ce38d0?w=400&h=400&fit=crop', null, 'Genuine Windows 11 Professional license key.', false, false],
        ['YouTube Premium', 'streaming', 99, 200, 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400&h=400&fit=crop', 'sale', 'Ad-free YouTube, background play, YouTube Music.', false, false],
        ['Envato Elements', 'graphics-resources', 399, 900, 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=400&h=400&fit=crop', 'hot', 'Unlimited downloads of templates, graphics, fonts, stock photos.', false, false],
        ['Semrush Pro', 'marketing', 799, 2000, 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop', null, 'All-in-one SEO and marketing toolkit.', false, false],
        ['Xbox Game Pass Ultimate', 'gaming', 450, 900, 'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400&h=400&fit=crop', 'hot', 'Access hundreds of Xbox and PC games, EA Play, cloud gaming.', false, false],
        ['Skillshare Premium', 'educational', 299, 700, 'https://images.unsplash.com/photo-1513258496099-48168024aec0?w=400&h=400&fit=crop', 'sale', 'Unlimited access to creative and business classes.', false, false],
        ['ExpressVPN Premium', 'vpn', 350, 900, 'https://images.unsplash.com/photo-1510511459019-5dda7724fd87?w=400&h=400&fit=crop', null, 'Ultra-fast VPN with servers in 94 countries.', false, false],
        ['Google Play Gift Card', 'gift-cards', 550, null, 'https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb?w=400&h=400&fit=crop', null, 'Google Play gift card for apps, games, movies.', false, false],
        ['Elementor Pro', 'web-elements', 499, 1200, 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=400&h=400&fit=crop', 'sale', 'Premium WordPress page builder with 90+ widgets.', false, false]
      ];

      for (const p of defaultProducts) {
        await client.query(
          'INSERT INTO products (name, category, price, original_price, image, badge, description, featured, best_seller) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          p
        );
      }
      console.log('✅ Seeded 22 default products');
    }

    // Check admin user
    const adminCount = await client.query('SELECT COUNT(*) FROM admin_users');
    if (parseInt(adminCount.rows[0].count) === 0) {
      const hash = bcrypt.hashSync('pixelsub123', 10);
      await client.query('INSERT INTO admin_users (username, password) VALUES ($1, $2)', ['admin', hash]);
      console.log('✅ Created default admin user');
    }

    // Check settings
    const settingsCount = await client.query('SELECT COUNT(*) FROM settings');
    if (parseInt(settingsCount.rows[0].count) === 0) {
      const defaults = {
        siteName: 'PixelSub',
        siteDescription: 'Premium Digital Products & Subscriptions',
        logoUrl: '', currency: '৳', whatsapp: '', facebook: '', instagram: '', youtube: ''
      };
      for (const [key, value] of Object.entries(defaults)) {
        await client.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, value]);
      }
      console.log('✅ Created default settings');
    }

    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  } finally {
    client.release();
  }
}

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'pixelsub-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

// ===== File Upload Config =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `product-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype));
  }
});

// ===== Auth Middleware =====
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ===== AUTH API =====
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM admin_users WHERE username = $1', [username]);
    if (result.rows.length > 0 && bcrypt.compareSync(password, result.rows[0].password)) {
      req.session.isAdmin = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth-check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

// ===== PRODUCTS API =====
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
    const products = result.rows.map(row => ({
      id: row.id, name: row.name, category: row.category,
      price: parseFloat(row.price), originalPrice: row.original_price ? parseFloat(row.original_price) : null,
      image: row.image, badge: row.badge, description: row.description,
      featured: row.featured, bestSeller: row.best_seller, active: row.active
    }));
    res.json(products);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = result.rows[0];
    res.json({
      id: row.id, name: row.name, category: row.category,
      price: parseFloat(row.price), originalPrice: row.original_price ? parseFloat(row.original_price) : null,
      image: row.image, badge: row.badge, description: row.description,
      featured: row.featured, bestSeller: row.best_seller, active: row.active
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const { name, category, price, originalPrice, image, badge, description, featured, bestSeller } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, category, price, original_price, image, badge, description, featured, best_seller) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [name || 'Untitled', category || 'software', price || 0, originalPrice || null, image || '', badge || null, description || '', featured || false, bestSeller || false]
    );
    const row = result.rows[0];
    res.json({ id: row.id, name: row.name, category: row.category, price: parseFloat(row.price), originalPrice: row.original_price ? parseFloat(row.original_price) : null, image: row.image, badge: row.badge, description: row.description, featured: row.featured, bestSeller: row.best_seller, active: row.active });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const { name, category, price, originalPrice, image, badge, description, featured, bestSeller } = req.body;
    const result = await pool.query(
      'UPDATE products SET name=$1, category=$2, price=$3, original_price=$4, image=$5, badge=$6, description=$7, featured=$8, best_seller=$9 WHERE id=$10 RETURNING *',
      [name, category, parseFloat(price) || 0, originalPrice ? parseFloat(originalPrice) : null, image, badge || null, description, featured || false, bestSeller || false, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = result.rows[0];
    res.json({ id: row.id, name: row.name, category: row.category, price: parseFloat(row.price), originalPrice: row.original_price ? parseFloat(row.original_price) : null, image: row.image, badge: row.badge, description: row.description, featured: row.featured, bestSeller: row.best_seller, active: row.active });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== UPLOAD API =====
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/products/${req.file.filename}` });
});

// ===== SETTINGS API =====
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(row => settings[row.key] = row.value);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', requireAuth, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await pool.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, value]
      );
    }
    const result = await pool.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(row => settings[row.key] = row.value);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== CHANGE PASSWORD =====
app.post('/api/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await pool.query('SELECT * FROM admin_users LIMIT 1');
    if (result.rows.length === 0) return res.status(400).json({ error: 'No admin found' });
    if (!bcrypt.compareSync(currentPassword, result.rows[0].password)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE admin_users SET password = $1 WHERE id = $2', [hash, result.rows[0].id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Catch-all =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/product', (req, res) => res.sendFile(path.join(__dirname, 'public', 'product.html')));

// ===== Start Server =====
async function start() {
  if (process.env.DATABASE_URL) {
    await initDB();
  } else {
    console.log('⚠️  No DATABASE_URL found. Running without database (local mode).');
  }
  app.listen(PORT, () => {
    console.log(`\n  ⚡ PixelSub Server running at http://localhost:${PORT}`);
    console.log(`  📦 Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`  🔑 Default login: admin / pixelsub123\n`);
  });
}

start();
