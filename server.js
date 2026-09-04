require('dotenv').config();

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Behind a proxy (Railway/Render/Heroku) so secure cookies and rate-limit IPs work.
if (IS_PROD) app.set('trust proxy', 1);

// ===== Session secret =====
// Prefer a configured secret. If none is set we generate a random one rather than
// falling back to a hardcoded default, which anyone reading the repo could use to
// forge an admin session. The tradeoff: a generated secret only lives as long as
// this process, so a restart invalidates existing admin logins.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('base64url');

if (!process.env.SESSION_SECRET) {
  console.warn(
    '⚠️  SESSION_SECRET is not set — using a random secret for this process only.\n' +
    '   Admins will be logged out whenever the server restarts.\n' +
    '   Set SESSION_SECRET in your environment to keep sessions stable.'
  );
}

// ===== Ensure upload directory =====
const uploadsDir = path.join(__dirname, 'uploads', 'products');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ===== Pricing rules (server-side source of truth) =====
// The client may suggest a plan/type, but never a price.
const PLAN_MULTIPLIERS = { '1-month': 1, '3-months': 2.5, '6-months': 4.5, '1-year': 8 };
const TYPE_MULTIPLIERS = { shared: 1, personal: 1.8 };

function priceFor(basePrice, plan, type) {
  const planMult = PLAN_MULTIPLIERS[plan] ?? PLAN_MULTIPLIERS['1-month'];
  const typeMult = TYPE_MULTIPLIERS[type] ?? TYPE_MULTIPLIERS.shared;
  return Math.round(Number(basePrice) * planMult * typeMult);
}

// ===== Database Setup =====
const HAS_DB = !!process.env.DATABASE_URL;
const pool = HAS_DB
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

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

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(50),
        note TEXT,
        payment_method VARCHAR(50),
        transaction_id VARCHAR(255),
        items JSONB,
        total DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Each plan carries its own price, so a product can offer any set of
      -- durations instead of fixed multiples of one base price.
      CREATE TABLE IF NOT EXISTS product_plans (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        label VARCHAR(100) NOT NULL,
        sublabel VARCHAR(150) DEFAULT '',
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        original_price DECIMAL(10,2),
        sort_order INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS product_faqs (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0
      );

      -- Admin-entered testimonials. There are no customer accounts, so these
      -- are not customer-submitted reviews.
      CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        author VARCHAR(150) NOT NULL,
        rating SMALLINT NOT NULL DEFAULT 5,
        body TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_plans_product ON product_plans(product_id);
      CREATE INDEX IF NOT EXISTS idx_faqs_product ON product_faqs(product_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);
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
      const username = process.env.ADMIN_USERNAME || 'admin';
      const initialPassword = process.env.ADMIN_PASSWORD;

      if (!initialPassword) {
        console.error(
          '❌ No admin user exists and ADMIN_PASSWORD is not set.\n' +
          '   Set ADMIN_PASSWORD in your .env (or host env vars) and restart to create the first admin.'
        );
      } else {
        const hash = bcrypt.hashSync(initialPassword, 10);
        await client.query('INSERT INTO admin_users (username, password) VALUES ($1, $2)', [username, hash]);
        console.log(`✅ Created admin user "${username}" from ADMIN_PASSWORD`);
      }
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
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD
  }
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

// ===== DB guard =====
// Without a database every /api route would throw an opaque 500. Say so clearly instead.
const DB_FREE_ROUTES = ['/pricing'];

app.use('/api', (req, res, next) => {
  if (DB_FREE_ROUTES.includes(req.path)) return next();
  if (!HAS_DB) {
    return res.status(503).json({
      error: 'Database not configured. Set DATABASE_URL in .env and restart the server.'
    });
  }
  next();
});

// ===== Rate limiters =====
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many orders submitted. Please try again later.' }
});

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
app.post('/api/login', loginLimiter, async (req, res) => {
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

// ===== Row mappers =====
function mapProduct(row) {
  return {
    id: row.id, name: row.name, category: row.category,
    price: parseFloat(row.price),
    originalPrice: row.original_price ? parseFloat(row.original_price) : null,
    image: row.image, badge: row.badge, description: row.description,
    featured: row.featured, bestSeller: row.best_seller, active: row.active
  };
}

function mapPlan(row) {
  return {
    id: row.id,
    label: row.label,
    sublabel: row.sublabel || '',
    price: parseFloat(row.price),
    originalPrice: row.original_price ? parseFloat(row.original_price) : null,
    sortOrder: row.sort_order
  };
}

// ===== PRODUCTS API =====
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
    res.json(result.rows.map(mapProduct));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Returns the product plus its plans, FAQs and reviews so the detail page
// needs a single request.
app.get('/api/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid product id' });

    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const [plans, faqs, reviews] = await Promise.all([
      pool.query(
        'SELECT * FROM product_plans WHERE product_id = $1 AND active = true ORDER BY sort_order ASC, id ASC',
        [id]
      ),
      pool.query(
        'SELECT * FROM product_faqs WHERE product_id = $1 ORDER BY sort_order ASC, id ASC',
        [id]
      ),
      pool.query(
        'SELECT * FROM product_reviews WHERE product_id = $1 ORDER BY created_at DESC',
        [id]
      )
    ]);

    res.json({
      ...mapProduct(result.rows[0]),
      plans: plans.rows.map(mapPlan),
      faqs: faqs.rows.map(r => ({ id: r.id, question: r.question, answer: r.answer })),
      reviews: reviews.rows.map(r => ({
        id: r.id, author: r.author, rating: r.rating, body: r.body, createdAt: r.created_at
      }))
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
    res.json(mapProduct(row));
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
    res.json(mapProduct(result.rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== PLANS API =====
// Plans replace the whole set for a product in one call: the admin form edits
// them as a list, so diffing individual rows would add nothing.
app.put('/api/products/:id/plans', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const productId = parseInt(req.params.id, 10);
    if (!Number.isInteger(productId)) return res.status(400).json({ error: 'Invalid product id' });

    const plans = Array.isArray(req.body.plans) ? req.body.plans : null;
    if (!plans) return res.status(400).json({ error: 'plans must be an array' });
    if (plans.length > 20) return res.status(400).json({ error: 'Too many plans (max 20)' });

    for (const p of plans) {
      if (!String(p.label || '').trim()) {
        return res.status(400).json({ error: 'Every plan needs a label' });
      }
      if (!(Number(p.price) >= 0)) {
        return res.status(400).json({ error: `Plan "${p.label}" needs a valid price` });
      }
    }

    const exists = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    await client.query('BEGIN');
    await client.query('DELETE FROM product_plans WHERE product_id = $1', [productId]);

    for (let i = 0; i < plans.length; i++) {
      const p = plans[i];
      await client.query(
        'INSERT INTO product_plans (product_id, label, sublabel, price, original_price, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [
          productId,
          String(p.label).trim().slice(0, 100),
          String(p.sublabel || '').trim().slice(0, 150),
          Number(p.price),
          p.originalPrice ? Number(p.originalPrice) : null,
          i
        ]
      );
    }
    await client.query('COMMIT');

    const saved = await client.query(
      'SELECT * FROM product_plans WHERE product_id = $1 ORDER BY sort_order ASC, id ASC',
      [productId]
    );
    res.json(saved.rows.map(mapPlan));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ===== FAQ API =====
app.put('/api/products/:id/faqs', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const productId = parseInt(req.params.id, 10);
    if (!Number.isInteger(productId)) return res.status(400).json({ error: 'Invalid product id' });

    const faqs = Array.isArray(req.body.faqs) ? req.body.faqs : null;
    if (!faqs) return res.status(400).json({ error: 'faqs must be an array' });
    if (faqs.length > 50) return res.status(400).json({ error: 'Too many FAQs (max 50)' });

    const clean = faqs
      .map(f => ({ question: String(f.question || '').trim(), answer: String(f.answer || '').trim() }))
      .filter(f => f.question);

    await client.query('BEGIN');
    await client.query('DELETE FROM product_faqs WHERE product_id = $1', [productId]);
    for (let i = 0; i < clean.length; i++) {
      await client.query(
        'INSERT INTO product_faqs (product_id, question, answer, sort_order) VALUES ($1,$2,$3,$4)',
        [productId, clean[i].question, clean[i].answer, i]
      );
    }
    await client.query('COMMIT');

    const saved = await client.query(
      'SELECT * FROM product_faqs WHERE product_id = $1 ORDER BY sort_order ASC, id ASC',
      [productId]
    );
    res.json(saved.rows.map(r => ({ id: r.id, question: r.question, answer: r.answer })));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ===== REVIEWS API =====
app.put('/api/products/:id/reviews', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const productId = parseInt(req.params.id, 10);
    if (!Number.isInteger(productId)) return res.status(400).json({ error: 'Invalid product id' });

    const reviews = Array.isArray(req.body.reviews) ? req.body.reviews : null;
    if (!reviews) return res.status(400).json({ error: 'reviews must be an array' });
    if (reviews.length > 100) return res.status(400).json({ error: 'Too many reviews (max 100)' });

    const clean = reviews
      .map(r => ({
        author: String(r.author || '').trim().slice(0, 150),
        rating: Math.min(Math.max(parseInt(r.rating, 10) || 5, 1), 5),
        body: String(r.body || '').trim()
      }))
      .filter(r => r.author);

    await client.query('BEGIN');
    await client.query('DELETE FROM product_reviews WHERE product_id = $1', [productId]);
    for (const r of clean) {
      await client.query(
        'INSERT INTO product_reviews (product_id, author, rating, body) VALUES ($1,$2,$3,$4)',
        [productId, r.author, r.rating, r.body]
      );
    }
    await client.query('COMMIT');

    const saved = await client.query(
      'SELECT * FROM product_reviews WHERE product_id = $1 ORDER BY created_at DESC',
      [productId]
    );
    res.json(saved.rows.map(r => ({
      id: r.id, author: r.author, rating: r.rating, body: r.body, createdAt: r.created_at
    })));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
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

// ===== ORDERS API =====
const ALLOWED_PAYMENT_METHODS = ['bkash', 'nagad', 'rocket'];

app.post('/api/orders', orderLimiter, async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, note, paymentMethod, transactionId, items } = req.body;

    // --- Validate customer details ---
    const name = String(customerName || '').trim();
    const email = String(customerEmail || '').trim();
    const phone = String(customerPhone || '').trim();
    const trxId = String(transactionId || '').trim();

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Name, email and phone are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!trxId) {
      return res.status(400).json({ error: 'Transaction ID is required.' });
    }
    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: 'Too many items in one order.' });
    }

    // --- Price the order from the database, ignoring any client-sent price ---
    const ids = [...new Set(items.map(i => parseInt(i.productId ?? i.id, 10)).filter(Number.isInteger))];
    if (ids.length === 0) {
      return res.status(400).json({ error: 'No valid products in cart.' });
    }

    const lookup = await pool.query(
      'SELECT id, name, price FROM products WHERE id = ANY($1::int[]) AND active = true',
      [ids]
    );
    const priceMap = new Map(lookup.rows.map(r => [r.id, r]));

    // Plans referenced by the cart. Fetched with their product_id so a planId
    // cannot be borrowed from a different product.
    const planIds = [...new Set(items.map(i => parseInt(i.planId, 10)).filter(Number.isInteger))];
    const planMap = new Map();
    if (planIds.length > 0) {
      const planRows = await pool.query(
        'SELECT * FROM product_plans WHERE id = ANY($1::int[]) AND active = true',
        [planIds]
      );
      planRows.rows.forEach(r => planMap.set(r.id, r));
    }

    let total = 0;
    const pricedItems = [];

    for (const item of items) {
      const productId = parseInt(item.productId ?? item.id, 10);
      const product = priceMap.get(productId);
      if (!product) {
        return res.status(400).json({ error: `Product ${productId} is unavailable.` });
      }

      const qty = Math.min(Math.max(parseInt(item.qty, 10) || 1, 1), 99);
      const planId = parseInt(item.planId, 10);

      let unitPrice;
      let planLabel = null;

      if (Number.isInteger(planId)) {
        const plan = planMap.get(planId);
        if (!plan) {
          return res.status(400).json({ error: 'A selected plan is no longer available.' });
        }
        if (plan.product_id !== productId) {
          return res.status(400).json({ error: 'Plan does not belong to that product.' });
        }
        unitPrice = parseFloat(plan.price);
        planLabel = plan.label;
      } else if (PLAN_MULTIPLIERS[item.plan] || TYPE_MULTIPLIERS[item.type]) {
        // Legacy cart still in a browser's localStorage from before per-plan pricing.
        const plan = PLAN_MULTIPLIERS[item.plan] ? item.plan : '1-month';
        const type = TYPE_MULTIPLIERS[item.type] ? item.type : 'shared';
        unitPrice = priceFor(product.price, plan, type);
        planLabel = `${plan} / ${type}`;
      } else {
        // Product has no plans configured — use its own price.
        unitPrice = parseFloat(product.price);
      }

      total += unitPrice * qty;
      pricedItems.push({
        productId, name: product.name, qty,
        planId: Number.isInteger(planId) ? planId : null,
        plan: planLabel,
        price: unitPrice, lineTotal: unitPrice * qty
      });
    }

    const result = await pool.query(
      'INSERT INTO orders (customer_name, customer_email, customer_phone, note, payment_method, transaction_id, items, total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [
        name.slice(0, 255), email.slice(0, 255), phone.slice(0, 50),
        String(note || '').slice(0, 1000), paymentMethod, trxId.slice(0, 255),
        JSON.stringify(pricedItems), total
      ]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error('Order creation failed:', e.message);
    res.status(500).json({ error: 'Could not place order. Please try again.' });
  }
});

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const ALLOWED_ORDER_STATUSES = ['pending', 'confirmed', 'delivered', 'cancelled'];

app.put('/api/orders/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!ALLOWED_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== PRICING API =====
// Single source of truth for plan/type multipliers so the UI can't drift from the server.
app.get('/api/pricing', (req, res) => {
  res.json({ plans: PLAN_MULTIPLIERS, types: TYPE_MULTIPLIERS });
});

// ===== Catch-all =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/product', (req, res) => res.sendFile(path.join(__dirname, 'public', 'product.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'public', 'checkout.html')));

// ===== Start Server =====
async function start() {
  if (HAS_DB) {
    await initDB();
  } else {
    console.log('⚠️  No DATABASE_URL set — /api routes will return 503 until you add one to .env');
  }
  app.listen(PORT, () => {
    console.log(`\n  ⚡ PixelSub Server running at http://localhost:${PORT}`);
    console.log(`  📦 Admin Panel: http://localhost:${PORT}/admin\n`);
  });
}

start();
