const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Ensure data directories =====
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads', 'products');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ===== JSON Database Helpers =====
function readJSON(filename) {
  const filepath = path.join(dataDir, filename);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function writeJSON(filename, data) {
  const filepath = path.join(dataDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ===== Initialize Default Data =====
function initData() {
  // Settings
  if (!readJSON('settings.json')) {
    writeJSON('settings.json', {
      siteName: 'PixelSub',
      siteDescription: 'Premium Digital Products & Subscriptions',
      logoUrl: '',
      currency: '৳',
      whatsapp: '',
      facebook: '',
      instagram: '',
      youtube: ''
    });
  }

  // Admin user
  if (!readJSON('admin.json')) {
    const hash = bcrypt.hashSync('pixelsub123', 10);
    writeJSON('admin.json', {
      username: 'admin',
      password: hash
    });
  }

  // Products
  if (!readJSON('products.json')) {
    writeJSON('products.json', [
      { id: 1, name: "ChatGPT Plus Subscription", category: "ai-tools", price: 650, originalPrice: 1200, image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=400&fit=crop", badge: "hot", description: "Access GPT-4o, DALL·E, and advanced features. Fast and reliable.", featured: true, bestSeller: true, active: true },
      { id: 2, name: "Canva Pro Premium", category: "graphics-tools", price: 150, originalPrice: 350, image: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=400&fit=crop", badge: "sale", description: "Unlock all Canva Pro features — premium templates, brand kit, magic resize & more.", featured: true, bestSeller: true, active: true },
      { id: 3, name: "Quillbot Premium", category: "writing-tools", price: 179, originalPrice: 400, image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=400&fit=crop", badge: "sale", description: "Premium paraphrasing tool with unlimited rewrites and grammar checker.", featured: true, bestSeller: false, active: true },
      { id: 4, name: "Grammarly Premium", category: "writing-tools", price: 250, originalPrice: 600, image: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=400&fit=crop", badge: "sale", description: "Advanced writing assistant with tone detection and plagiarism checker.", featured: false, bestSeller: true, active: true },
      { id: 5, name: "Udemy Subscription", category: "educational", price: 799, originalPrice: 2499, image: "https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=400&h=400&fit=crop", badge: "hot", description: "Access 200,000+ online courses on development, business, design, and more.", featured: true, bestSeller: false, active: true },
      { id: 6, name: "Office 365 Pro Plus", category: "software", price: 499, originalPrice: 650, image: "https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=400&h=400&fit=crop", badge: "sale", description: "Microsoft Office 365 with Word, Excel, PowerPoint, 1TB OneDrive.", featured: true, bestSeller: true, active: true },
      { id: 7, name: "Perplexity AI Pro", category: "ai-tools", price: 199, originalPrice: 500, image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=400&fit=crop", badge: "new", description: "AI-powered search engine with unlimited Pro searches and GPT-4 access.", featured: true, bestSeller: false, active: true },
      { id: 8, name: "NordVPN Premium", category: "vpn", price: 299, originalPrice: 800, image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=400&fit=crop", badge: "sale", description: "Fast, secure VPN with 5000+ servers and no-logs policy.", featured: false, bestSeller: true, active: true },
      { id: 9, name: "Adobe Creative Cloud", category: "graphics-tools", price: 999, originalPrice: 2500, image: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&h=400&fit=crop", badge: "hot", description: "Full Adobe suite — Photoshop, Illustrator, Premiere Pro, and 20+ apps.", featured: false, bestSeller: true, active: true },
      { id: 10, name: "Spotify Premium", category: "streaming", price: 120, originalPrice: 250, image: "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400&h=400&fit=crop", badge: "sale", description: "Ad-free music streaming, offline downloads, high-quality audio.", featured: false, bestSeller: false, active: true },
      { id: 11, name: "Netflix Premium", category: "streaming", price: 250, originalPrice: 500, image: "https://images.unsplash.com/photo-1574375927938-d5a98e8d7e28?w=400&h=400&fit=crop", badge: "hot", description: "Stream movies, TV shows in 4K Ultra HD on multiple screens.", featured: false, bestSeller: false, active: true },
      { id: 12, name: "Coursera Plus", category: "educational", price: 599, originalPrice: 1500, image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=400&fit=crop", badge: "new", description: "Unlimited access to 7,000+ courses from top universities.", featured: false, bestSeller: false, active: true },
      { id: 13, name: "Hix AI Writer", category: "ai-tools", price: 350, originalPrice: 800, image: "https://images.unsplash.com/photo-1655720828018-edd2daec9349?w=400&h=400&fit=crop", badge: "new", description: "AI writing assistant with 120+ tools and browser extension.", featured: false, bestSeller: false, active: true },
      { id: 14, name: "Windows 11 Pro Key", category: "software", price: 899, originalPrice: 1500, image: "https://images.unsplash.com/photo-1624571395728-f1df77ce38d0?w=400&h=400&fit=crop", badge: null, description: "Genuine Windows 11 Professional license key.", featured: false, bestSeller: false, active: true },
      { id: 15, name: "YouTube Premium", category: "streaming", price: 99, originalPrice: 200, image: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400&h=400&fit=crop", badge: "sale", description: "Ad-free YouTube, background play, YouTube Music.", featured: false, bestSeller: false, active: true },
      { id: 16, name: "Envato Elements", category: "graphics-resources", price: 399, originalPrice: 900, image: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=400&h=400&fit=crop", badge: "hot", description: "Unlimited downloads of templates, graphics, fonts, stock photos.", featured: false, bestSeller: false, active: true },
      { id: 17, name: "Semrush Pro", category: "marketing", price: 799, originalPrice: 2000, image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop", badge: null, description: "All-in-one SEO and marketing toolkit.", featured: false, bestSeller: false, active: true },
      { id: 18, name: "Xbox Game Pass Ultimate", category: "gaming", price: 450, originalPrice: 900, image: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400&h=400&fit=crop", badge: "hot", description: "Access hundreds of Xbox and PC games, EA Play, cloud gaming.", featured: false, bestSeller: false, active: true },
      { id: 19, name: "Skillshare Premium", category: "educational", price: 299, originalPrice: 700, image: "https://images.unsplash.com/photo-1513258496099-48168024aec0?w=400&h=400&fit=crop", badge: "sale", description: "Unlimited access to creative and business classes.", featured: false, bestSeller: false, active: true },
      { id: 20, name: "ExpressVPN Premium", category: "vpn", price: 350, originalPrice: 900, image: "https://images.unsplash.com/photo-1510511459019-5dda7724fd87?w=400&h=400&fit=crop", badge: null, description: "Ultra-fast VPN with servers in 94 countries.", featured: false, bestSeller: false, active: true },
      { id: 21, name: "Google Play Gift Card", category: "gift-cards", price: 550, originalPrice: null, image: "https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb?w=400&h=400&fit=crop", badge: null, description: "Google Play gift card for apps, games, movies.", featured: false, bestSeller: false, active: true },
      { id: 22, name: "Elementor Pro", category: "web-elements", price: 499, originalPrice: 1200, image: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=400&h=400&fit=crop", badge: "sale", description: "Premium WordPress page builder with 90+ widgets.", featured: false, bestSeller: false, active: true }
    ]);
  }
}

initData();

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'pixelsub-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Static files
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// ===== Auth Middleware =====
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ===== AUTH API =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const admin = readJSON('admin.json');
  if (!admin) return res.status(500).json({ error: 'Admin data not found' });

  if (username === admin.username && bcrypt.compareSync(password, admin.password)) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth-check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

// ===== PRODUCTS API =====
app.get('/api/products', (req, res) => {
  const products = readJSON('products.json') || [];
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const products = readJSON('products.json') || [];
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

app.post('/api/products', requireAuth, (req, res) => {
  const products = readJSON('products.json') || [];
  const maxId = products.length > 0 ? Math.max(...products.map(p => p.id)) : 0;

  const newProduct = {
    id: maxId + 1,
    name: req.body.name || 'Untitled Product',
    category: req.body.category || 'software',
    price: parseFloat(req.body.price) || 0,
    originalPrice: req.body.originalPrice ? parseFloat(req.body.originalPrice) : null,
    image: req.body.image || '',
    badge: req.body.badge || null,
    description: req.body.description || '',
    featured: req.body.featured || false,
    bestSeller: req.body.bestSeller || false,
    active: true
  };

  products.push(newProduct);
  writeJSON('products.json', products);
  res.json(newProduct);
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const products = readJSON('products.json') || [];
  const index = products.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Not found' });

  products[index] = { ...products[index], ...req.body, id: products[index].id };
  if (req.body.originalPrice === '' || req.body.originalPrice === null) {
    products[index].originalPrice = null;
  } else if (req.body.originalPrice) {
    products[index].originalPrice = parseFloat(req.body.originalPrice);
  }
  if (req.body.price) products[index].price = parseFloat(req.body.price);

  writeJSON('products.json', products);
  res.json(products[index]);
});

app.delete('/api/products/:id', requireAuth, (req, res) => {
  let products = readJSON('products.json') || [];
  products = products.filter(p => p.id !== parseInt(req.params.id));
  writeJSON('products.json', products);
  res.json({ success: true });
});

// ===== UPLOAD API =====
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/products/${req.file.filename}`;
  res.json({ url });
});

// ===== SETTINGS API =====
app.get('/api/settings', (req, res) => {
  const settings = readJSON('settings.json') || {};
  res.json(settings);
});

app.post('/api/settings', requireAuth, (req, res) => {
  const current = readJSON('settings.json') || {};
  const updated = { ...current, ...req.body };
  writeJSON('settings.json', updated);
  res.json(updated);
});

// ===== CHANGE PASSWORD =====
app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = readJSON('admin.json');

  if (!bcrypt.compareSync(currentPassword, admin.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  admin.password = bcrypt.hashSync(newPassword, 10);
  writeJSON('admin.json', admin);
  res.json({ success: true });
});

// ===== Catch-all for SPA =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/product', (req, res) => res.sendFile(path.join(__dirname, 'public', 'product.html')));

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`\n  ⚡ PixelSub Server running at http://localhost:${PORT}`);
  console.log(`  📦 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`  🔑 Default login: admin / pixelsub123\n`);
});
