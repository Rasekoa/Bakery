require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

let pool;
(async function initDb() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sweet_crust_bakery',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    console.log('Connected to MySQL');
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
})();

function validateOrderInput(order) {
  const { order_id, customer_name, product_ordered, quantity, order_date, status } = order;
  if (!order_id || !customer_name || !product_ordered || !quantity || !order_date) return false;
  if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) return false;
  if (status && !['Pending', 'Completed'].includes(status)) return false;
  return true;
}

app.post('/api/orders', async (req, res) => {
  try {
    const o = req.body;
    if (!validateOrderInput(o)) return res.status(400).json({ error: 'Invalid input' });

    const sql = `
      INSERT INTO orders (order_id, customer_name, product_ordered, quantity, order_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [o.order_id, o.customer_name, o.product_ordered, Number(o.quantity), o.order_date, o.status || 'Pending'];

    await pool.query(sql, params);
    res.json({ success: true, message: 'Order added successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Order ID already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/orders/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    const { customer_name, product_ordered, quantity, order_date, status } = req.body;

    await pool.query(
      'UPDATE orders SET customer_name = ?, product_ordered = ?, quantity = ?, order_date = ?, status = ? WHERE order_id = ?',
      [customer_name, product_ordered, quantity, order_date, status, order_id]
    );

    res.json({ success: true, message: 'Order updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/orders/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    await pool.query('DELETE FROM orders WHERE order_id = ?', [order_id]);
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/orders/:order_id/status', async (req, res) => {
  try {
    const { order_id } = req.params;
    const { status } = req.body;
    if (!['Pending', 'Completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    await pool.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, order_id]);
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
