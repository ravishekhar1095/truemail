require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'verify_db',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function createUser({ username, email, passwordHash, first_name = null, last_name = null, credits_left = 5 }) {
  const sql = `INSERT INTO users (username, password, first_name, last_name, email, credits_left, credits_used, account_status, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 'active', 'user', NOW(), NOW())`;
  const params = [username, passwordHash, first_name, last_name, email, credits_left];
  const [res] = await pool.execute(sql, params);
  const id = res.insertId;
  return findUserById(id);
}

async function findUserByEmail(email) {
  const sql = `SELECT * FROM users WHERE email = ? LIMIT 1`;
  const [rows] = await pool.execute(sql, [email]);
  return rows[0] || null;
}

async function findUserById(id) {
  const sql = `SELECT * FROM users WHERE id = ? LIMIT 1`;
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
}

async function changeCredits(userId, delta, reason = '') {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT credits_left, credits_used FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!rows || rows.length === 0) throw new Error('user not found');
    const user = rows[0];
    const newCredits = (user.credits_left || 0) + delta;
    if (newCredits < 0) throw new Error('insufficient credits');
    const newCreditsUsed = (user.credits_used || 0) + (delta < 0 ? Math.abs(delta) : 0);
    await conn.execute('UPDATE users SET credits_left = ?, credits_used = ?, updated_at = NOW() WHERE id = ?', [newCredits, newCreditsUsed, userId]);
    await conn.execute(`CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      delta INT NOT NULL,
      reason VARCHAR(191),
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      credits INT,
      INDEX(user_id)
    )`);
    const [res] = await conn.execute('INSERT INTO transactions (user_id, delta, reason, credits) VALUES (?, ?, ?, ?)', [userId, delta, reason, newCredits]);
    await conn.commit();
    return { credits: newCredits, recordId: res.insertId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function createTransaction(record) {
  const sql = 'INSERT INTO transactions (user_id, delta, reason, credits) VALUES (?, ?, ?, ?)';
  const params = [record.userId, record.delta, record.reason, record.credits];
  const [res] = await pool.execute(sql, params);
  return { id: res.insertId, ...record };
}

module.exports = {
  pool,
  createUser,
  findUserByEmail,
  findUserById,
  changeCredits,
  createTransaction
};
