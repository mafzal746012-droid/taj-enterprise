const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Database path
const dataDir = process.env.DATA_PATH || './';
const dbPath = path.join(dataDir, 'database.sqlite');
console.log(`Using database at: ${dbPath}`);

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open database (creates if not exists)
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    price REAL,
    category TEXT,
    image TEXT,
    stock INTEGER DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE,
    customer_name TEXT,
    customer_phone TEXT,
    address TEXT,
    city TEXT,
    pincode TEXT,
    landmark TEXT,
    items TEXT,
    total REAL,
    delivery_slot TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default products if empty
const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get().count;
if (productCount === 0) {
  const defaultProducts = [
    ["Amul Gold 5L", 332.5, "milk", "images/Gold_5L.jpg", 10],
    ["Amul Gold 500ml", 35, "milk", "images/Gold_500ml.jpg", 10],
    ["Amul Taaza 5L", 262.5, "milk", "images/Taaza_5L.jpg", 10],
    ["Amul Taaza 1L", 57, "milk", "images/Taaza_1L.jpg", 10],
    ["Amul Taaza 500ml", 29, "milk", "images/Taaza_500ml.jpg", 10],
    ["Amul Taaza 170ml", 10, "milk", "images/Taaza_170ml.jpg", 10],
    ["Amul DTM 500ml", 26, "milk", "images/Slim_500ml.jpg", 10],
    ["Amul DTM 1L", 51, "milk", "images/DTM_1L.jpg", 10],
    ["Amul Shakti 5L", 315, "milk", "images/Shakti_5L.jpg", 10],
    ["Amul Shakti 1L", 63, "milk", "images/Shakti_1L.jpg", 10],
    ["Amul Shakti 500ml", 32, "milk", "images/Shakti_500ml.jpg", 10],
    ["Amul Skimmed 1L", 39, "milk", "images/Skimmed_1L.jpg", 10],
    ["Amul Cow Milk 500ml", 30, "milk", "images/CowMilk_500ml.jpg", 10],
    ["Slim n Trim 180ml", 10, "milk", "images/Slim_180ml.jpg", 10],
    ["Dahi Bucket 1kg", 110, "dahi", "images/Bucket_1Kg.jpg", 10],
    ["Dahi 800g", 70, "dahi", "images/Dahi_800g.jpg", 10],
    ["Masti Dahi 200g", 24, "dahi", "images/MastiDahi_200g.jpg", 10],
    ["Masti Dahi 390g", 45, "dahi", "images/MastiDahi_390g.jpg", 10],
    ["Masti Dahi 1Kg", 110, "dahi", "images/MastiDahi_1Kg.jpg", 10],
    ["Masti Tok Doi 85g", 10, "dahi", "images/Tok_doi_85g.jpg", 10],
    ["Masti Tok Doi 200g", 24, "dahi", "images/Tok_doi_200g.jpg", 10],
    ["Masti Tok Doi 400g", 47, "dahi", "images/Tok_doi_400g.jpg", 10],
    ["Mishti Doi 80g", 15, "dahi", "images/Mishti_doi_80g.jpg", 10],
    ["Mishti Doi 200g", 34, "dahi", "images/Mishti_doi_200g.jpg", 10],
    ["Mishti Doi 400g", 65, "dahi", "images/Mishti_doi_400g.jpg", 10],
    ["Meetha Dahi 400g", 40, "dahi", "images/Meetha_Dahi400g.jpg", 10],
    ["Paneer 200gm", 91, "paneer", "images/Paneer_200g.jpg", 10],
    ["Paneer 1kg", 415, "paneer", "images/Paneer_1kg.jpg", 10],
    ["Lassi 150ml", 10, "others", "images/Lassi_150ml.jpg", 10],
    ["Mango Lassi 200ml", 15, "others", "images/Mango_Lassi_200ml.jpg", 10]
  ];
  const insertStmt = db.prepare("INSERT INTO products (name, price, category, image, stock) VALUES (?, ?, ?, ?, ?)");
  const insertMany = db.transaction((products) => {
    for (const p of products) insertStmt.run(p);
  });
  insertMany(defaultProducts);
  console.log("Default products inserted.");
}

function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}${random}`;
}

// ---------- Static Files & HTML Routes ----------
// Serve static files from public directory
app.use(express.static('public'));

// Explicit routes for HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/track-order.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'track-order.html'));
});

app.get('/promo.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'promo.html'));
});

app.get('/ad.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ad.html'));
});

// ---------- API Routes ----------
app.get('/api/products', (req, res) => {
  const products = db.prepare("SELECT * FROM products").all();
  res.json(products);
});

app.post('/api/update-stock', (req, res) => {
  const { productId, newStock } = req.body;
  const stmt = db.prepare("UPDATE products SET stock = ? WHERE id = ?");
  stmt.run(newStock, productId);
  res.json({ success: true });
});

app.post('/api/place-order', (req, res) => {
  const { customer_name, customer_phone, address, city, pincode, landmark, items, total, delivery_slot } = req.body;
  const orderNumber = generateOrderNumber();
  
  const transaction = db.transaction(() => {
    // Check stock
    for (const item of items) {
      const row = db.prepare("SELECT stock FROM products WHERE name = ?").get(item.name);
      if (!row) throw new Error(`Product ${item.name} not found`);
      if (row.stock < item.qty) throw new Error(`Insufficient stock for ${item.name}. Available: ${row.stock}`);
    }
    // Insert order
    const itemsJson = JSON.stringify(items);
    const insertOrder = db.prepare(`INSERT INTO orders (order_number, customer_name, customer_phone, address, city, pincode, landmark, items, total, delivery_slot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertOrder.run(orderNumber, customer_name, customer_phone, address, city, pincode, landmark, itemsJson, total, delivery_slot);
    // Update stock
    const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE name = ?");
    for (const item of items) {
      updateStock.run(item.qty, item.name);
    }
  });
  try {
    transaction();
    res.json({ success: true, orderNumber });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/orders', (req, res) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  res.json(orders);
});

app.post('/api/accept-order', (req, res) => {
  const { orderId } = req.body;
  db.prepare("UPDATE orders SET status = 'accepted' WHERE id = ?").run(orderId);
  res.json({ success: true });
});

app.post('/api/reject-order', (req, res) => {
  const { orderId } = req.body;
  db.prepare("UPDATE orders SET status = 'rejected' WHERE id = ?").run(orderId);
  res.json({ success: true });
});

app.post('/api/deliver-order', (req, res) => {
  const { orderId } = req.body;
  db.prepare("UPDATE orders SET status = 'delivered' WHERE id = ?").run(orderId);
  res.json({ success: true });
});

app.post('/api/update-product', (req, res) => {
  const { id, name, price, category, image, stock } = req.body;
  db.prepare(`UPDATE products SET name = ?, price = ?, category = ?, image = ?, stock = ? WHERE id = ?`)
    .run(name, price, category, image, stock, id);
  res.json({ success: true });
});

app.post('/api/add-product', (req, res) => {
  const { name, price, category, image, stock } = req.body;
  const stmt = db.prepare(`INSERT INTO products (name, price, category, image, stock) VALUES (?, ?, ?, ?, ?)`);
  stmt.run(name, price, category, image || '', stock || 0);
  res.json({ success: true });
});

app.post('/api/order-status', (req, res) => {
  const { orderNumber, phone } = req.body;
  const order = db.prepare("SELECT * FROM orders WHERE order_number = ? AND customer_phone = ?").get(orderNumber, phone);
  if (!order) return res.status(404).json({ success: false, error: 'No order found' });
  let items = [];
  try { items = JSON.parse(order.items); } catch(e) { items = []; }
  res.json({
    success: true,
    orderNumber: order.order_number,
    status: order.status,
    total: order.total,
    delivery_slot: order.delivery_slot,
    created_at: order.created_at,
    items
  });
});

app.post('/api/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'Taj@2025') {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});