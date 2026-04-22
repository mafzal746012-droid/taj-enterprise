const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ---------- Database path for Railway persistent volume ----------
const dataDir = process.env.DATA_PATH || './';
const dbPath = path.join(dataDir, 'database.sqlite');
console.log(`Using database at: ${dbPath}`);

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// ---------- Create tables ----------
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    price REAL,
    category TEXT,
    image TEXT,
    stock INTEGER DEFAULT 10
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
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
  )`);

  // Add order_number column if not exists (for old databases)
  db.run("ALTER TABLE orders ADD COLUMN order_number TEXT", (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.log("Note: order_number column may already exist.");
    }
  });
});

// ---------- Insert default products if empty ----------
db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
  if (row.count === 0) {
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
    const stmt = db.prepare("INSERT INTO products (name, price, category, image, stock) VALUES (?, ?, ?, ?, ?)");
    defaultProducts.forEach(p => stmt.run(p));
    stmt.finalize();
    console.log("Default products inserted.");
  }
});

// ---------- Helper: generate order number ----------
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

// ---------- API Routes ----------

// Get all products
app.get('/api/products', (req, res) => {
  db.all("SELECT * FROM products", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Update stock only (simple)
app.post('/api/update-stock', (req, res) => {
  const { productId, newStock } = req.body;
  db.run("UPDATE products SET stock = ? WHERE id = ?", [newStock, productId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Place order with transaction (atomic stock check & update)
app.post('/api/place-order', (req, res) => {
  const { customer_name, customer_phone, address, city, pincode, landmark, items, total, delivery_slot } = req.body;
  const orderNumber = generateOrderNumber();

  db.run("BEGIN IMMEDIATE", (err) => {
    if (err) return res.status(500).json({ error: "Database busy, please try again" });

    let checkQueries = items.map(item => {
      return new Promise((resolve, reject) => {
        db.get("SELECT stock FROM products WHERE name = ?", [item.name], (err, row) => {
          if (err) reject(err);
          else if (!row) reject(new Error(`Product ${item.name} not found`));
          else if (row.stock < item.qty) reject(new Error(`Insufficient stock for ${item.name}. Available: ${row.stock}`));
          else resolve();
        });
      });
    });

    Promise.all(checkQueries)
      .then(() => {
        const itemsJson = JSON.stringify(items);
        db.run(`INSERT INTO orders (order_number, customer_name, customer_phone, address, city, pincode, landmark, items, total, delivery_slot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderNumber, customer_name, customer_phone, address, city, pincode, landmark, itemsJson, total, delivery_slot],
          function(err) {
            if (err) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: err.message });
            }
            let updatePromises = items.map(item => {
              return new Promise((resolve, reject) => {
                db.run("UPDATE products SET stock = stock - ? WHERE name = ?", [item.qty, item.name], (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
            });
            Promise.all(updatePromises)
              .then(() => {
                db.run("COMMIT", (err) => {
                  if (err) return res.status(500).json({ error: "Commit failed" });
                  res.json({ success: true, orderNumber: orderNumber });
                });
              })
              .catch(err => {
                db.run("ROLLBACK");
                res.status(500).json({ error: err.message });
              });
          });
      })
      .catch(err => {
        db.run("ROLLBACK");
        res.status(400).json({ success: false, error: err.message });
      });
  });
});

// Get all orders
app.get('/api/orders', (req, res) => {
  db.all("SELECT * FROM orders ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Accept order
app.post('/api/accept-order', (req, res) => {
  const { orderId } = req.body;
  db.run("UPDATE orders SET status = 'accepted' WHERE id = ?", [orderId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Reject order
app.post('/api/reject-order', (req, res) => {
  const { orderId } = req.body;
  db.run("UPDATE orders SET status = 'rejected' WHERE id = ?", [orderId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Mark order as delivered
app.post('/api/deliver-order', (req, res) => {
  const { orderId } = req.body;
  db.run("UPDATE orders SET status = 'delivered' WHERE id = ?", [orderId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Update product details (full edit)
app.post('/api/update-product', (req, res) => {
  const { id, name, price, category, image, stock } = req.body;
  if (!id) return res.status(400).json({ error: 'Product ID required' });
  db.run(
    `UPDATE products SET name = ?, price = ?, category = ?, image = ?, stock = ? WHERE id = ?`,
    [name, price, category, image, stock, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Add new product
app.post('/api/add-product', (req, res) => {
  const { name, price, category, image, stock } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Name, price and category are required' });
  }
  db.run(
    `INSERT INTO products (name, price, category, image, stock) VALUES (?, ?, ?, ?, ?)`,
    [name, price, category, image || '', stock || 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Customer order status check
app.post('/api/order-status', (req, res) => {
  const { orderNumber, phone } = req.body;
  if (!orderNumber || !phone) {
    return res.status(400).json({ success: false, error: 'Order number and phone required' });
  }
  db.get("SELECT * FROM orders WHERE order_number = ? AND customer_phone = ?", [orderNumber, phone], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!row) return res.status(404).json({ success: false, error: 'No order found with those details' });
    let items = [];
    try { items = JSON.parse(row.items); } catch(e) { items = []; }
    res.json({
      success: true,
      orderNumber: row.order_number,
      status: row.status,
      total: row.total,
      delivery_slot: row.delivery_slot,
      created_at: row.created_at,
      items: items
    });
  });
});

// Admin login (hardcoded – change credentials as needed)
app.post('/api/admin-login', (req, res) => {
  const { username, password } = req.body;
  // You can change these or use environment variables
  if (username === 'admin' && password === 'Taj@2025') {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});