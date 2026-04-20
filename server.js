require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const https = require('https');
const bcrypt = require('bcrypt'); // مكتبة التشفير

// =============================================================================
// PAYPAL CONFIGURATION
// =============================================================================
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';

let paypal;
try {
    paypal = require('@paypal/checkout-server-sdk');
} catch (e) {
    console.error('⚠️ PayPal SDK not installed.');
}

function getClient() {
    if (!paypal) return null;
    let environment;
    if (PAYPAL_MODE === 'live') {
        environment = new paypal.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
    } else {
        environment = new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
    }
    return new paypal.core.PayPalHttpClient(environment);
}

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// ADMIN CONFIGURATION FROM .ENV
// =============================================================================
const ADMINS = [
    { email: process.env.ADMIN_1_EMAIL, password: process.env.ADMIN_1_PASSWORD, name: 'Super Admin' },
    { email: process.env.ADMIN_2_EMAIL, password: process.env.ADMIN_2_PASSWORD, name: 'Manager' }
].filter(admin => admin.email && admin.password);

function isAdminUser(email, password) {
    return ADMINS.find(admin => admin.email === email && admin.password === password);
}
// =============================================================================

// Discord Webhook function
async function sendDiscordWebhook(order) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes('YOUR_WEBHOOK_ID')) return false;

  const itemsList = order.items.map(item => `• ${item.name} - $${item.price.toFixed(2)}`).join('\n');
  
  const embed = {
    embeds: [{
      title: '🎉 New Order Received!',
      color: parseInt(process.env.DISCORD_EMBED_COLOR || '5814783', 16),
      fields: [
        { name: '🆔 Order ID', value: order.id.substring(0, 8), inline: true },
        { name: '👤 Customer', value: order.userEmail, inline: true },
        { name: '💰 Total Paid', value: `$${order.total.toFixed(2)}`, inline: true },
        { name: '📦 Items', value: itemsList },
        { name: '🎮 Discord', value: order.discordId || 'N/A', inline: true },
        { name: '✅ Status', value: 'Paid via PayPal', inline: true },
        { name: '🏷️ Discount', value: order.discountApplied > 0 ? `$${order.discountApplied.toFixed(2)} OFF` : 'None', inline: true }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Area 51 Store' }
    }]
  };

  return new Promise((resolve, reject) => {
    try {
        const url = new URL(webhookUrl);
        const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => resolve(res.statusCode === 204));
        req.on('error', reject);
        req.write(JSON.stringify(embed));
        req.end();
    } catch (err) { reject(err); }
  });
}

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: 'x5-secret-key-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: false }
}));

app.use((req, res, next) => {
  if (req.session.user && req.session.rememberMe) req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
  next();
});

let locales = {};
try { locales = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales.json'), 'utf8')); } catch (err) {}

function t(key, lang = 'en') {
  const keys = key.split('.');
  let value = locales[lang] || locales['en'] || {};
  for (const k of keys) value = value ? value[k] : key;
  return value || key;
}

// Database setup
const adapter = new JSONFile(path.join(__dirname, 'db.json'));
const db = new Low(adapter, { products: [], orders: [], siteSettings: {}, users: [], coupons: [] });

async function initDB() {
  await db.read();
  if (!db.data.products || db.data.products.length === 0) {
    db.data.products = [{ id: uuidv4(), name: 'Premium Headphones', price: 199.99, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', description: 'High-quality wireless headphones', category: 'Electronics', createdAt: new Date().toISOString() }];
  }
  if (!db.data.orders) db.data.orders = [];
  if (!db.data.siteSettings) db.data.siteSettings = { siteName: 'Area 51', siteDescription: 'Store', heroTitle: 'Welcome', heroSubtitle: 'Shop now', rulesContent: 'Rules', supportEmail: 'support@test.com', supportPhone: '123' };
  if (!db.data.users) db.data.users = [];
  if (!db.data.coupons) db.data.coupons = [];
  await db.write();
}
initDB();

function isAuthenticated(req, res, next) { if (req.session.user) return next(); res.redirect('/login'); }
function isAdmin(req, res, next) { if (req.session.user && req.session.user.role === 'Administrator' && req.session.user.isAdminVerified) return next(); res.redirect('/admin-login'); }

function handleAdminLogin(req, res, next) {
  const { email, password } = req.body;
  const admin = isAdminUser(email, password);
  if (admin) {
    req.session.user = { email: admin.email, role: 'Administrator', name: admin.name, isAdminVerified: true, authenticated: true };
    req.session.rememberMe = true;
    return res.redirect('/admin');
  }
  res.render('admin-login', { title: 'Admin Login', error: 'Invalid Admin Credentials' });
}

app.use((req, res, next) => {
  const lang = 'ar'; 
  req.session.lang = lang;
  res.locals.lang = lang;
  res.locals.t = (key) => t(key, lang);
  res.locals.locales = locales;
  next();
});

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAdmin = req.session.user && req.session.user.role === 'Administrator';
  res.locals.cart = req.session.cart || [];
  res.locals.PAYPAL_CLIENT_ID = PAYPAL_CLIENT_ID; 
  next();
});

// Routes
app.get('/', async (req, res) => { await db.read(); res.render('home', { title: 'Area51', settings: db.data.siteSettings }); });
app.get('/store', async (req, res) => { await db.read(); res.render('store', { title: 'Store', products: db.data.products, settings: db.data.siteSettings }); });
app.get('/rules', async (req, res) => { await db.read(); res.render('rules', { title: 'Rules', settings: db.data.siteSettings }); });

app.get('/leaderboard', async (req, res) => {
  await db.read();
  const orders = db.data.orders || [];
  const buyerStats = {};
  orders.forEach(order => {
    if (order.userEmail) {
      if (!buyerStats[order.userEmail]) buyerStats[order.userEmail] = { email: order.userEmail, totalOrders: 0, totalSpent: 0 };
      buyerStats[order.userEmail].totalOrders += 1;
      buyerStats[order.userEmail].totalSpent += order.total || 0;
    }
  });
  const leaderboard = Object.values(buyerStats).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
  res.render('leaderboard', { title: 'Leaderboard', leaderboard, settings: db.data.siteSettings });
});

// Login
app.get('/login', (req, res) => { if (req.session.user) return res.redirect('/'); res.render('login', { title: 'Login', error: null }); });

app.post('/login', async (req, res) => {
  const { email, password, discordUsername, rememberMe } = req.body;
  
  // Check Admin (Plain text comparison from .env)
  const admin = isAdminUser(email, password);
  if (admin) {
    req.session.user = { email: admin.email, role: 'Administrator', name: admin.name, isAdminVerified: true, authenticated: true };
    req.session.rememberMe = true;
    return res.redirect('/');
  }
  
  // Regular User Login (BCrypt Comparison)
  await db.read();
  const user = db.data.users.find(u => u.email === email);
  
  if (user) {
    const match = await bcrypt.compare(password, user.password);
    
    if (match) {
      req.session.user = {
        email: user.email,
        role: 'User',
        name: user.name,
        discordUsername: user.discordUsername || null
      };
      req.session.rememberMe = (rememberMe === 'on');
      return res.redirect('/');
    }
  }
  
  res.render('login', { title: 'Login', error: 'Invalid Email or Password' });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// Admin Login Page
app.get('/admin-login', (req, res) => { res.render('admin-login', { title: 'Admin Login', error: null }); });
app.post('/admin-login', handleAdminLogin);

// Register (WITH BCRYPT HASHING)
app.get('/register', (req, res) => { res.render('register', { title: 'Register', error: null }); });

app.post('/register', async (req, res) => {
  const { email, password, name, discordUsername } = req.body;
  if (!discordUsername || discordUsername.trim() === '') {
    return res.render('register', { title: 'Register', error: 'Discord username is required' });
  }
  
  await db.read();
  if (db.data.users.find(u => u.email === email)) {
    return res.render('register', { title: 'Register', error: 'Email already registered' });
  }
  
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  
  const newUser = {
    id: uuidv4(),
    email,
    password: hashedPassword,
    name,
    discordUsername: discordUsername.trim(),
    createdAt: new Date().toISOString()
  };
  
  db.data.users.push(newUser);
  await db.write();
  
  req.session.user = {
    email: newUser.email,
    role: 'User',
    name: newUser.name,
    discordUsername: newUser.discordUsername
  };
  
  res.redirect('/');
});

// Cart Logic
app.post('/cart/add', (req, res) => {
  const { productId, name, price, image } = req.body;
  if (!req.session.cart) req.session.cart = [];
  const existingItem = req.session.cart.find(item => item.productId === productId);
  if (existingItem) { existingItem.quantity += 1; } 
  else { req.session.cart.push({ productId, name, price: parseFloat(price), image, quantity: 1 }); }
  res.redirect('/store');
});

app.get('/cart', async (req, res) => {
  await db.read();
  const cart = req.session.cart || [];
  const coupons = db.data.coupons || [];
  
  let subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let discountAmount = 0;
  let appliedCoupon = null;
  let promoError = null;

  const promoCode = req.query.promo ? req.query.promo.trim().toUpperCase() : null;

  if (promoCode && coupons.length > 0) {
    const validCoupon = coupons.find(c => c.code.toUpperCase() === promoCode);
    if (validCoupon) {
      discountAmount = (subtotal * (validCoupon.discount / 100));
      appliedCoupon = { code: validCoupon.code, percent: validCoupon.discount, amount: discountAmount };
    } else { promoError = 'كود الخصم غير صالح'; }
  }

  // No shipping cost as requested
  const finalTotal = Math.max(0, subtotal - discountAmount);

  res.render('cart', { 
    title: 'Shopping Cart', 
    cart, 
    subtotal,
    discountAmount,
    finalTotal,
    appliedCoupon,
    promoError
  });
});

app.post('/cart/remove', (req, res) => {
  const { productId } = req.body;
  if (req.session.cart) req.session.cart = req.session.cart.filter(item => item.productId !== productId);
  res.redirect('/cart');
});

// PayPal API Routes
app.post('/api/create-paypal-order', isAuthenticated, async (req, res) => {
    const client = getClient();
    if (!client) return res.status(500).json({ error: 'PayPal SDK not configured' });
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.status(400).json({ error: 'Cart is empty' });
    
    // Recalculate totals on server side for security
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // Note: For full discount support in payment, you need to store discount in session. 
    // Here we charge subtotal for simplicity. To support discounts fully, store applied coupon in session.
    const totalValue = subtotal.toFixed(2); 

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({ intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: 'USD', value: totalValue }, description: `Order from Area 51 Store` }] });

    try {
        const order = await client.execute(request);
        res.json({ id: order.result.id });
    } catch (err) { res.status(500).json({ error: 'Failed to create PayPal order' }); }
});

app.post('/api/capture-paypal-order', isAuthenticated, async (req, res) => {
    const client = getClient();
    if (!client) return res.status(500).json({ error: 'PayPal SDK not configured' });
    const { orderID } = req.body;
    const cart = req.session.cart || [];
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const expectedTotal = subtotal.toFixed(2);

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    try {
        const capture = await client.execute(request);
        
        const orderData = {
            id: uuidv4(),
            userEmail: req.session.user?.email || 'Guest',
            discordId: req.session.user?.discordUsername || 'Guest',
            items: cart,
            total: parseFloat(expectedTotal),
            discountApplied: 0, // Update if using session-based discounts
            paymentMethod: 'paypal',
            paypalOrderId: orderID,
            paypalTransactionId: capture.result.id,
            status: 'Paid',
            createdAt: new Date().toISOString()
        };

        await db.read();
        db.data.orders.push(orderData);
        await db.write();
        req.session.cart = [];
        await sendDiscordWebhook(orderData);
        res.json({ status: 'success', orderId: orderData.id });
    } catch (err) { res.status(500).json({ error: 'Failed to capture payment' }); }
});

// Admin Routes
app.get('/admin', isAdmin, async (req, res) => { await db.read(); res.render('admin/dashboard', { title: 'Admin Dashboard', products: db.data.products, orders: db.data.orders }); });
app.get('/admin/products', isAdmin, async (req, res) => { await db.read(); res.render('admin/products', { title: 'Manage Products', products: db.data.products }); });
app.get('/admin/products/new', isAdmin, (req, res) => { res.render('admin/product-form', { title: 'New Product', product: null }); });
app.post('/admin/products/new', isAdmin, async (req, res) => {
  const { name, price, description, category, image } = req.body;
  await db.read();
  db.data.products.push({ id: uuidv4(), name, price: parseFloat(price), description, category, image: image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', createdAt: new Date().toISOString() });
  await db.write();
  res.redirect('/admin/products');
});
app.get('/edit/:id', isAdmin, async (req, res) => { await db.read(); const product = db.data.products.find(p => p.id === req.params.id); if (!product) return res.redirect('/store'); res.render('admin/product-form', { title: 'Edit Product', product }); });
app.post('/edit/:id', isAdmin, async (req, res) => {
  const { name, price, description, category, image } = req.body;
  await db.read();
  const idx = db.data.products.findIndex(p => p.id === req.params.id);
  if (idx !== -1) { db.data.products[idx] = { ...db.data.products[idx], name, price: parseFloat(price), description, category, image: image || db.data.products[idx].image }; await db.write(); }
  res.redirect('/admin/products');
});
app.post('/admin/products/delete/:id', isAdmin, async (req, res) => { await db.read(); db.data.products = db.data.products.filter(p => p.id !== req.params.id); await db.write(); res.redirect('/admin/products'); });
app.post('/admin/products/delete-all', isAdmin, async (req, res) => { await db.read(); const count = db.data.products.length; db.data.products = []; await db.write(); res.redirect('/admin?deleted=' + count); });
app.get('/admin/settings', isAdmin, async (req, res) => { await db.read(); res.render('admin/settings', { title: 'Site Settings', settings: db.data.siteSettings }); });
app.post('/admin/settings', isAdmin, async (req, res) => {
  const { siteName, siteDescription, heroTitle, heroSubtitle, rulesContent, supportEmail, supportPhone } = req.body;
  await db.read();
  db.data.siteSettings = { siteName, siteDescription, heroTitle, heroSubtitle, rulesContent, supportEmail, supportPhone };
  await db.write();
  res.redirect('/admin/settings');
});
app.get('/admin/edit-text', isAdmin, async (req, res) => { await db.read(); res.render('admin/edit-text', { title: 'Edit Site Text', settings: db.data.siteSettings }); });
app.post('/admin/edit-text', isAdmin, async (req, res) => {
  const { key, value } = req.body;
  await db.read();
  if (key && value) { db.data.siteSettings[key] = value; await db.write(); }
  res.redirect('/admin/edit-text');
});
app.get('/admin/coupons', isAdmin, async (req, res) => { await db.read(); res.render('admin/coupons', { title: 'Manage Coupons', coupons: db.data.coupons || [] }); });
app.post('/admin/coupons/new', isAdmin, async (req, res) => {
  const { code, discount } = req.body;
  await db.read();
  if (!db.data.coupons) db.data.coupons = [];
  db.data.coupons.push({ id: uuidv4(), code: code.trim().toUpperCase(), discount: parseFloat(discount) });
  await db.write();
  res.redirect('/admin/coupons');
});
app.post('/admin/coupons/delete/:id', isAdmin, async (req, res) => { await db.read(); db.data.coupons = db.data.coupons.filter(c => c.id !== req.params.id); await db.write(); res.redirect('/admin/coupons'); });
app.get('/admin/orders', isAdmin, async (req, res) => { await db.read(); res.render('admin/orders', { title: 'Manage Orders', orders: db.data.orders }); });
app.post('/admin/orders/:id/status', isAdmin, async (req, res) => {
  const { status } = req.body;
  await db.read();
  const idx = db.data.orders.findIndex(o => o.id === req.params.id);
  if (idx !== -1) { db.data.orders[idx].status = status; await db.write(); }
  res.redirect('/admin/orders');
});

app.listen(PORT, () => { console.log(`🚀 Area 51 server running on http://localhost:${PORT}`); });
