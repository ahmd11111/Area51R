const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { v4: uuidv4 } = require('uuid');
const adminConfig = require('./adminConfig');
const pay = require('./pay');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// ADMIN PASSWORD CONFIGURATION
// =============================================================================
// ⚠️ IMPORTANT: Change this password for production security!
// You can also use environment variable: process.env.ADMIN_PASSWORD
// Location: server.js line 14
// Current Admin: X5Admin@support.com / X5Admin2026
// =============================================================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Moza3119989';
// =============================================================================

// Discord Webhook function for automated delivery
async function sendDiscordWebhook(order) {
  const webhookUrl = pay.discord.webhookUrl;
  if (!webhookUrl || webhookUrl.includes('YOUR_WEBHOOK_ID')) {
    console.log('Discord webhook not configured. Order:', order.id);
    return false;
  }

  const itemsList = order.items.map(item => `• ${item.name} - $${item.price.toFixed(2)}`).join('\n');
  
  const embed = {
    embeds: [{
      title: '🎉 New Order Received! - Fast Delivery',
      color: parseInt(pay.discord.embedColor, 16),
      fields: [
        { name: '🆔 Order ID', value: order.id.substring(0, 8), inline: true },
        { name: '👤 Customer', value: order.userEmail, inline: true },
        { name: '💰 Total', value: `$${order.total.toFixed(2)}`, inline: true },
        { name: '📦 Items Purchased', value: itemsList },
        { name: '🎮 Discord Buyer', value: order.discordId || 'Not provided', inline: true },
        { name: '📧 Delivery Status', value: '⏳ Waiting for payment confirmation', inline: true }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Area 51 - Automated Delivery System' }
    }]
  };

  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      resolve(res.statusCode === 204);
    });
    req.on('error', reject);
    req.write(JSON.stringify(embed));
    req.end();
  });
}

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
  secret: 'x5-secret-key-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Load translations
const locales = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales.json'), 'utf8'));

// i18n helper function
function t(key, lang = 'en') {
  const keys = key.split('.');
  let value = locales[lang] || locales['en'];
  for (const k of keys) {
    value = value ? value[k] : key;
  }
  return value || key;
}

// Database setup
const adapter = new JSONFile(path.join(__dirname, 'db.json'));
const db = new Low(adapter, {
  products: [],
  orders: [],
  siteSettings: {
    siteName: 'Area 51',
    siteDescription: 'متجرك الإلكتروني الأول للمنتجات الرقمية',
    heroTitle: 'مرحباً بك في Area 51',
    heroSubtitle: 'اكتشف منتجات رقمية مذهلة بأسعار لا تقبل المنافسة',
    rulesContent: 'مرحباً بك في متجرنا! يرجى قراءة القوانين قبل الشراء.',
    supportEmail: 'support@area51.com',
    supportPhone: '+1234567890'
  },
  users: []
});

// Initialize database
async function initDB() {
  await db.read();
  if (!db.data.products || db.data.products.length === 0) {
    // Add sample products
    db.data.products = [
      {
        id: uuidv4(),
        name: 'Premium Headphones',
        price: 199.99,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
        description: 'High-quality wireless headphones with noise cancellation',
        category: 'Electronics',
        createdAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: 'Smart Watch',
        price: 299.99,
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
        description: 'Feature-rich smartwatch with health monitoring',
        category: 'Electronics',
        createdAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: 'Gaming Mouse',
        price: 79.99,
        image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400',
        description: 'Professional gaming mouse with RGB lighting',
        category: 'Gaming',
        createdAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: 'Mechanical Keyboard',
        price: 149.99,
        image: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=400',
        description: 'Premium mechanical keyboard with customizable switches',
        category: 'Gaming',
        createdAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: 'Webcam HD',
        price: 89.99,
        image: 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400',
        description: '1080p HD webcam for streaming and video calls',
        category: 'Electronics',
        createdAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: 'Monitor Stand',
        price: 49.99,
        image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400',
        description: 'Ergonomic monitor stand with storage',
        category: 'Accessories',
        createdAt: new Date().toISOString()
      }
    ];
  }
  if (!db.data.orders) db.data.orders = [];
  if (!db.data.siteSettings) {
    db.data.siteSettings = {
      siteName: 'Area 51',
      siteDescription: 'متجرك الإلكتروني الأول للمنتجات الرقمية',
      heroTitle: 'مرحباً بك في Area 51',
      heroSubtitle: 'اكتشف منتجات رقمية مذهلة بأسعار لا تقبل المنافسة',
      rulesContent: 'مرحباً بك في متجرنا! يرجى قراءة القوانين قبل الشراء.',
      supportEmail: 'support@area51.com',
      supportPhone: '+1234567890'
    };
  }
  if (!db.data.users) db.data.users = [];
  await db.write();
}
initDB();

// Auth middleware
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  // Security: Verify admin access using hardcoded ADMIN_PASSWORD
  if (req.session.user && req.session.user.role === 'Administrator' && 
      req.session.user.authenticated && req.session.user.adminPassword === ADMIN_PASSWORD) {
    return next();
  }
  res.redirect('/admin-login');
}

// Admin password check middleware - Uses hardcoded ADMIN_PASSWORD constant
function checkAdminPassword(req, res, next) {
  const { password } = req.body;
  
  // Security: Only allow access if password matches ADMIN_PASSWORD (line 14)
  if (password === ADMIN_PASSWORD) {
    req.session.user = {
      email: 'mohamedalkhameiri15@gmail.com,
      role: 'Administrator',
      name: 'Admin',
      authenticated: true,
      adminPassword: ADMIN_PASSWORD // Store for verification
    };
    return res.redirect('/admin');
  }
  res.render('admin-login', { title: 'Admin Login', error: 'Invalid password' });
}

// Admin access verification middleware - Ensures hardcoded password matches
function verifyAdminAccess(req, res, next) {
  if (req.session.user && req.session.user.role === 'Administrator') {
    // Verify the session was created with correct password
    if (req.session.user.authenticated && req.session.user.adminPassword === ADMIN_PASSWORD) {
      return next();
    }
  }
  res.redirect('/admin-login');
}

// Language middleware - Locked to Arabic (RTL)
app.use((req, res, next) => {
  const lang = 'ar'; // Locked to Arabic
  req.session.lang = lang;
  res.locals.lang = lang;
  res.locals.t = (key) => t(key, lang);
  res.locals.locales = locales;
  next();
});

// Global variables for views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAdmin = req.session.user && req.session.user.role === 'Administrator';
  res.locals.cart = req.session.cart || [];
  next();
});

// Routes

// Language switcher - DISABLED (site locked to Arabic)
// app.get('/lang/:lang', (req, res) => {
//   req.session.lang = req.params.lang;
//   const redirect = req.get('Referer') || '/';
//   res.redirect(redirect);
// });

// Home page
app.get('/', async (req, res) => {
  await db.read();
  const settings = db.data.siteSettings || {};
  res.render('home', { 
    title: 'Home',
    settings
  });
});

// Store page
app.get('/store', async (req, res) => {
  await db.read();
  const products = db.data.products || [];
  const settings = db.data.siteSettings || {};
  res.render('store', { 
    title: 'Store',
    products,
    settings
  });
});

// Rules page
app.get('/rules', async (req, res) => {
  await db.read();
  const settings = db.data.siteSettings || {};
  res.render('rules', { 
    title: 'Rules',
    settings
  });
});

// Leaderboard page
app.get('/leaderboard', async (req, res) => {
  await db.read();
  const orders = db.data.orders || [];
  const settings = db.data.siteSettings || {};
  
  // Calculate top buyers
  const buyerStats = {};
  orders.forEach(order => {
    if (order.userEmail) {
      if (!buyerStats[order.userEmail]) {
        buyerStats[order.userEmail] = { email: order.userEmail, totalOrders: 0, totalSpent: 0 };
      }
      buyerStats[order.userEmail].totalOrders += 1;
      buyerStats[order.userEmail].totalSpent += order.total || 0;
    }
  });
  
  const leaderboard = Object.values(buyerStats)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);
  
  res.render('leaderboard', { 
    title: 'Leaderboard',
    leaderboard,
    settings
  });
});

// Login page
app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('login', { title: 'Login', error: null });
});

app.post('/login', async (req, res) => {
  const { email, password, discordUsername } = req.body;
  
  // Check if admin - Use hardcoded ADMIN_PASSWORD for verification
  if (email === adminConfig.adminEmail && password === ADMIN_PASSWORD) {
    req.session.user = {
      email: adminConfig.adminEmail,
      role: 'Administrator',
      name: 'Admin',
      discordUsername: discordUsername || null,
      authenticated: true,
      adminPassword: Moza3119989
    };
    return res.redirect('/');
  }
  
  // Regular user login
  await db.read();
  const user = db.data.users.find(u => u.email === email && u.password === password);
  
  if (user) {
    req.session.user = {
      email: user.email,
      role: 'User',
      name: user.name,
      discordUsername: user.discordUsername || null
    };
    return res.redirect('/');
  }
  
  res.render('login', { title: 'Login', error: t('auth.invalidCredentials', req.session.lang) });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Admin login page
app.get('/admin-login', (req, res) => {
  res.render('admin-login', { title: 'Admin Login', error: null });
});

app.post('/admin-login', checkAdminPassword);

// Register page
app.get('/register', (req, res) => {
  res.render('register', { title: 'Register', error: null });
});

app.post('/register', async (req, res) => {
  const { email, password, name, discordUsername } = req.body;
  
  // Validate Discord username is provided (required for digital delivery)
  if (!discordUsername || discordUsername.trim() === '') {
    return res.render('register', { title: 'Register', error: 'Discord username is required for digital product delivery' });
  }
  
  await db.read();
  
  // Check if user exists
  const existingUser = db.data.users.find(u => u.email === email);
  if (existingUser) {
    return res.render('register', { title: 'Register', error: 'Email already registered' });
  }
  
  // Create new user with mandatory Discord username
  const newUser = {
    id: uuidv4(),
    email,
    password,
    name,
    discordUsername: discordUsername.trim(), // Required for instant digital delivery
    createdAt: new Date().toISOString()
  };
  
  db.data.users.push(newUser);
  await db.write();
  
  // Auto login with Discord username for delivery
  req.session.user = {
    email: newUser.email,
    role: 'User',
    name: newUser.name,
    discordUsername: newUser.discordUsername
  };
  
  res.redirect('/');
});

// Cart routes
app.post('/cart/add', (req, res) => {
  const { productId, name, price, image } = req.body;
  
  if (!req.session.cart) {
    req.session.cart = [];
  }
  
  const existingItem = req.session.cart.find(item => item.productId === productId);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    req.session.cart.push({
      productId,
      name,
      price: parseFloat(price),
      image,
      quantity: 1
    });
  }
  
  res.redirect('/store');
});

app.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.render('cart', { title: 'Shopping Cart', cart, total });
});

app.post('/cart/remove', (req, res) => {
  const { productId } = req.body;
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter(item => item.productId !== productId);
  }
  res.redirect('/cart');
});

app.post('/cart/checkout', async (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) {
    return res.redirect('/cart');
  }
  
  // Use Discord username from session (mandatory) or from form
  const discordId = req.session.user?.discordUsername || req.body.discordId;
  
  // Validate Discord username for instant digital delivery
  if (!discordId || discordId.trim() === '') {
    return res.redirect('/cart?error=discord_required');
  }
  
  // Get payment method
  const paymentMethod = req.body.paymentMethod || 'paypal';
  const txid = req.body.txid || null; // For Binance payments
  
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  await db.read();
  
  const order = {
    id: uuidv4(),
    userEmail: req.session.user ? req.session.user.email : 'Guest',
    discordId: discordId.trim(), // Required for instant digital delivery
    items: cart,
    total,
    paymentMethod: paymentMethod,
    txid: txid, // Binance transaction ID
    status: paymentMethod === 'binance' ? 'Pending Verification' : 'Pending',
    createdAt: new Date().toISOString()
  };
  
  db.data.orders.push(order);
  await db.write();
  
  // Send Discord webhook notification with buyer Discord ID for instant delivery
  try {
    await sendDiscordWebhook(order);
  } catch (err) {
    console.error('Discord webhook error:', err.message);
  }
  
  // Clear cart
  req.session.cart = [];
  
  res.render('order-success', { title: 'Order Placed', orderId: order.id });
});

// Admin routes
app.get('/admin', isAdmin, async (req, res) => {
  await db.read();
  const products = db.data.products || [];
  const orders = db.data.orders || [];
  res.render('admin/dashboard', { 
    title: 'Admin Dashboard',
    products,
    orders
  });
});

app.get('/admin/products', isAdmin, async (req, res) => {
  await db.read();
  const products = db.data.products || [];
  res.render('admin/products', { title: 'Manage Products', products });
});

app.get('/admin/products/new', isAdmin, (req, res) => {
  res.render('admin/product-form', { title: 'New Product', product: null });
});

app.post('/admin/products/new', isAdmin, async (req, res) => {
  const { name, price, description, category, image } = req.body;
  
  await db.read();
  
  const newProduct = {
    id: uuidv4(),
    name,
    price: parseFloat(price),
    description,
    category,
    image: image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
    createdAt: new Date().toISOString()
  };
  
  db.data.products.push(newProduct);
  await db.write();
  
  res.redirect('/admin/products');
});

app.get('/edit/:id', isAdmin, async (req, res) => {
  await db.read();
  const product = db.data.products.find(p => p.id === req.params.id);
  
  if (!product) {
    return res.redirect('/store');
  }
  
  res.render('admin/product-form', { title: 'Edit Product', product });
});

app.post('/edit/:id', isAdmin, async (req, res) => {
  const { name, price, description, category, image } = req.body;
  
  await db.read();
  
  const productIndex = db.data.products.findIndex(p => p.id === req.params.id);
  if (productIndex !== -1) {
    db.data.products[productIndex] = {
      ...db.data.products[productIndex],
      name,
      price: parseFloat(price),
      description,
      category,
      image: image || db.data.products[productIndex].image
    };
    await db.write();
  }
  
  res.redirect('/admin/products');
});

app.post('/admin/products/delete/:id', isAdmin, async (req, res) => {
  await db.read();
  db.data.products = db.data.products.filter(p => p.id !== req.params.id);
  await db.write();
  res.redirect('/admin/products');
});

// Delete ALL products - Bulk admin action with confirmation
app.post('/admin/products/delete-all', isAdmin, async (req, res) => {
  await db.read();
  const productCount = db.data.products.length;
  db.data.products = []; // Clear all products
  await db.write();
  console.log(`Admin deleted all ${productCount} products`);
  res.redirect('/admin?deleted=' + productCount);
});

// Admin site settings
app.get('/admin/settings', isAdmin, async (req, res) => {
  await db.read();
  const settings = db.data.siteSettings || {};
  res.render('admin/settings', { title: 'Site Settings', settings });
});

app.post('/admin/settings', isAdmin, async (req, res) => {
  const { siteName, siteDescription, heroTitle, heroSubtitle, rulesContent, supportEmail, supportPhone } = req.body;
  
  await db.read();
  
  db.data.siteSettings = {
    siteName,
    siteDescription,
    heroTitle,
    heroSubtitle,
    rulesContent,
    supportEmail,
    supportPhone
  };
  
  await db.write();
  
  res.redirect('/admin/settings');
});

// Admin text editor
app.get('/admin/edit-text', isAdmin, async (req, res) => {
  await db.read();
  const settings = db.data.siteSettings || {};
  res.render('admin/edit-text', { title: 'Edit Site Text', settings });
});

app.post('/admin/edit-text', isAdmin, async (req, res) => {
  const { key, value } = req.body;
  
  await db.read();
  
  if (key && value) {
    db.data.siteSettings[key] = value;
    await db.write();
  }
  
  res.redirect('/admin/edit-text');
});


// Admin coupons page
app.get('/admin/coupons', isAdmin, async (req, res) => {
  await db.read();
  const coupons = db.data.coupons || [];
  res.render('admin/coupons', { title: 'Manage Coupons', coupons });
});

// Add new coupon
app.post('/admin/coupons/new', isAdmin, async (req, res) => {
  const { code, discount } = req.body;
  await db.read();
  if (!db.data.coupons) db.data.coupons = [];
  db.data.coupons.push({
    id: uuidv4(),
    code: code.trim(),
    discount: parseFloat(discount)
  });
  await db.write();
  res.redirect('/admin/coupons');
});

// Delete coupon
app.post('/admin/coupons/delete/:id', isAdmin, async (req, res) => {
  await db.read();
  db.data.coupons = db.data.coupons.filter(c => c.id !== req.params.id);
  await db.write();
  res.redirect('/admin/coupons');
});

// Admin orders
app.get('/admin/orders', isAdmin, async (req, res) => {
  await db.read();
  const orders = db.data.orders || [];
  res.render('admin/orders', { title: 'Manage Orders', orders });
});

app.post('/admin/orders/:id/status', isAdmin, async (req, res) => {
  const { status } = req.body;
  
  await db.read();
  
  const orderIndex = db.data.orders.findIndex(o => o.id === req.params.id);
  if (orderIndex !== -1) {
    db.data.orders[orderIndex].status = status;
    await db.write();
  }
  
  res.redirect('/admin/orders');
});

// Start server
app.listen(PORT, () => {
  console.log(`Area 51 server running on http://localhost:${PORT}`);
});
