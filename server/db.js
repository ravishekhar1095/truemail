require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');

const DEFAULT_FILE_DB = path.join(__dirname, '..', 'data', 'app.db');
const databaseUrl = process.env.TURSO_DATABASE_URL || `file:${DEFAULT_FILE_DB}`;

if (databaseUrl.startsWith('file:')) {
  const filePath = databaseUrl.replace('file:', '');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const client = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined
});

const initPromise = initialize();

async function initialize() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      email TEXT NOT NULL UNIQUE,
      credits_left INTEGER DEFAULT 5,
      credits_used INTEGER DEFAULT 0,
      account_status TEXT DEFAULT 'active',
      role TEXT DEFAULT 'user',
      plan TEXT DEFAULT 'free',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT,
      credits INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_reason ON transactions(reason);`,
    `CREATE TABLE IF NOT EXISTS email_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      operation_type TEXT NOT NULL,
      input_data TEXT NOT NULL,
      results TEXT NOT NULL,
      credits_used INTEGER DEFAULT 1,
      success INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_email_history_user_id ON email_history(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_email_history_operation ON email_history(operation_type);`,
    `CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      monthly_credits INTEGER NOT NULL,
      price_monthly REAL,
      features TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );`,
    `INSERT INTO plans (name, monthly_credits, price_monthly, features)
      VALUES
        ('free', 5, 0.0, '{"features":["basic_search","email_verify"]}'),
        ('starter', 20, 9.99, '{"features":["basic_search","email_verify","advanced_patterns"]}'),
        ('pro', 100, 29.99, '{"features":["basic_search","email_verify","advanced_patterns","bulk_search","api_access"]}'),
        ('enterprise', 999999, 299.99, '{"features":["basic_search","email_verify","advanced_patterns","bulk_search","api_access","dedicated_support"]}')
      ON CONFLICT(name) DO NOTHING;`
  ];

  for (const sql of statements) {
    await client.execute(sql);
  }

  await ensureSuperAdmin();
}

async function ensureSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@truemail.io';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
  const username = process.env.SUPER_ADMIN_USERNAME || 'superadmin';

  const passwordHash = bcrypt.hashSync(password, 10);

  const result = await client.execute({
    sql: `INSERT INTO users (
            username, password, first_name, last_name, email,
            credits_left, credits_used, account_status, role, plan,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 'active', 'super_admin', 'enterprise',
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(email) DO NOTHING;`,
    args: [username, passwordHash, 'Super', 'Admin', email, 10000]
  });

  if (result.rowsAffected > 0) {
    console.log(`[bootstrap] Created super admin user ${email} with default password. Please rotate via environment variables.`);
  }
}

async function execute(sql, args = []) {
  await initPromise;
  return client.execute({ sql, args });
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    credits_left: Number(row.credits_left ?? 0),
    credits_used: Number(row.credits_used ?? 0),
    account_status: row.account_status,
    role: row.role,
    plan: row.plan,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapUserSummary(row) {
  const nameParts = [row.first_name, row.last_name].filter(Boolean);
  const name = nameParts.join(' ').trim() || row.username;
  return {
    id: row.id,
    username: row.username,
    name,
    email: row.email,
    credits: Number(row.credits_left ?? 0),
    credits_left: Number(row.credits_left ?? 0),
    credits_used: Number(row.credits_used ?? 0),
    active: row.account_status === 'active',
    account_status: row.account_status,
    role: row.role,
    plan: row.plan,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function createUser({ username, email, passwordHash, first_name = null, last_name = null, credits_left = 5 }) {
  const result = await execute(
    `INSERT INTO users (
      username, password, first_name, last_name, email,
      credits_left, credits_used, account_status, role, plan,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 'active', 'user', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    [username, passwordHash, first_name, last_name, email, credits_left]
  );
  const id = Number(result.lastInsertRowid);
  return findUserById(id);
}

async function findUserByEmail(email) {
  const { rows } = await execute(
    `SELECT id, username, password, first_name, last_name, email, credits_left, credits_used,
            account_status, role, plan, created_at, updated_at
     FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1;`,
    [email]
  );
  return mapUser(rows[0]);
}

async function findUserById(id) {
  const { rows } = await execute(
    `SELECT id, username, password, first_name, last_name, email, credits_left, credits_used,
            account_status, role, plan, created_at, updated_at
     FROM users WHERE id = ? LIMIT 1;`,
    [id]
  );
  return mapUser(rows[0]);
}

async function changeCredits(userId, delta, reason = '') {
  const tx = await client.transaction('write');
  try {
    await initPromise;
    const userRes = await tx.execute({
      sql: 'SELECT credits_left, credits_used FROM users WHERE id = ?;',
      args: [userId]
    });
    if (!userRes.rows.length) {
      throw new Error('user not found');
    }

    const user = userRes.rows[0];
    const currentCredits = Number(user.credits_left ?? 0);
    const newCredits = currentCredits + Number(delta);
    if (newCredits < 0) {
      throw new Error('insufficient credits');
    }

    const currentUsed = Number(user.credits_used ?? 0);
    const additionalUsage = delta < 0 ? Math.abs(delta) : 0;
    const newCreditsUsed = currentUsed + additionalUsage;

    await tx.execute({
      sql: `UPDATE users
            SET credits_left = ?, credits_used = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?;`,
      args: [newCredits, newCreditsUsed, userId]
    });

    await tx.execute({
      sql: `INSERT INTO transactions (user_id, delta, reason, credits)
            VALUES (?, ?, ?, ?);`,
      args: [userId, delta, reason, newCredits]
    });

    await tx.commit();
    return { credits: newCredits, credits_used: newCreditsUsed };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function createTransaction(record) {
  const result = await execute(
    `INSERT INTO transactions (user_id, delta, reason, credits)
     VALUES (?, ?, ?, ?);`,
    [record.userId, record.delta, record.reason, record.credits]
  );
  return {
    id: Number(result.lastInsertRowid),
    ...record
  };
}

async function getAdminStats() {
  const [
    { rows: totalRows },
    { rows: activeRows },
    { rows: generateRows },
    { rows: verifyRows },
    { rows: creditRows },
    { rows: revenueRows }
  ] = await Promise.all([
    execute(`SELECT COUNT(*) AS totalUsers FROM users;`),
    execute(`SELECT COUNT(DISTINCT user_id) AS activeToday
             FROM transactions
             WHERE DATE(created_at) = DATE('now');`),
    execute(`SELECT COUNT(*) AS emailsFound FROM transactions WHERE reason = 'generate';`),
    execute(`SELECT COUNT(*) AS verifications FROM transactions WHERE reason = 'verify';`),
    execute(`SELECT
              COALESCE(SUM(credits_used), 0) AS creditsUsed,
              COALESCE(SUM(credits_left), 0) AS creditsRemaining
            FROM users;`),
    execute(`SELECT COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) AS creditsPurchased
             FROM transactions;`)
  ]);

  const emailsFound = Number(generateRows[0]?.emailsFound ?? 0);
  const verifications = Number(verifyRows[0]?.verifications ?? 0);

  return {
    totalUsers: Number(totalRows[0]?.totalUsers ?? 0),
    activeToday: Number(activeRows[0]?.activeToday ?? 0),
    emailsFound,
    verifications,
    totalOperations: emailsFound + verifications,
    totalCreditsUsed: Number(creditRows[0]?.creditsUsed ?? 0),
    totalCreditsRemaining: Number(creditRows[0]?.creditsRemaining ?? 0),
    totalRevenue: Number(revenueRows[0]?.creditsPurchased ?? 0)
  };
}

async function getUsers({ offset = 0, limit = 10, search = '' } = {}) {
  const args = [];
  let where = '';

  if (search) {
    where = 'WHERE LOWER(username) LIKE ? OR LOWER(email) LIKE ?';
    const term = `%${search.toLowerCase()}%`;
    args.push(term, term);
  }

  args.push(Number(limit), Number(offset));

  const { rows } = await execute(
    `SELECT id, username, first_name, last_name, email, credits_left, credits_used,
            account_status, role, plan, created_at, updated_at
     FROM users
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?;`,
    args
  );

  return rows.map(mapUserSummary);
}

async function getUserCount(search = '') {
  if (!search) {
    const { rows } = await execute(`SELECT COUNT(*) AS total FROM users;`);
    return Number(rows[0]?.total ?? 0);
  }

  const term = `%${search.toLowerCase()}%`;
  const { rows } = await execute(
    `SELECT COUNT(*) AS total
     FROM users
     WHERE LOWER(username) LIKE ? OR LOWER(email) LIKE ?;`,
    [term, term]
  );

  return Number(rows[0]?.total ?? 0);
}

async function changeUserCredits(userId, amount, reason = 'admin_adjustment') {
  const result = await changeCredits(userId, Number(amount), reason);
  const user = await findUserById(userId);
  return { ...result, user };
}

async function updateUserStatus(userId, status) {
  const normalized = typeof status === 'boolean'
    ? (status ? 'active' : 'suspended')
    : String(status).toLowerCase();

  const finalStatus = ['active', 'suspended', 'deleted'].includes(normalized)
    ? normalized
    : (normalized === 'inactive' ? 'suspended' : 'active');

  await execute(
    `UPDATE users
     SET account_status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?;`,
    [finalStatus, userId]
  );

  return findUserById(userId);
}

async function getVerificationStats() {
  const { rows: totals } = await execute(
    `SELECT reason, COUNT(*) AS count
     FROM transactions
     WHERE reason IN ('generate', 'verify')
     GROUP BY reason;`
  );

  const summary = {
    generate: 0,
    verify: 0
  };
  for (const row of totals) {
    if (row.reason === 'generate' || row.reason === 'verify') {
      summary[row.reason] = Number(row.count ?? 0);
    }
  }

  const { rows: daily } = await execute(
    `SELECT DATE(created_at) AS day, COUNT(*) AS total
     FROM transactions
     WHERE reason IN ('generate', 'verify')
       AND DATE(created_at) >= DATE('now', '-30 day')
     GROUP BY day
     ORDER BY day DESC;`
  );

  return {
    totals: summary,
    daily: daily.map(row => ({
      day: row.day,
      total: Number(row.total ?? 0)
    }))
  };
}

module.exports = {
  client,
  initialize,
  createUser,
  findUserByEmail,
  findUserById,
  changeCredits,
  createTransaction,
  getAdminStats,
  getUsers,
  getUserCount,
  changeUserCredits,
  updateUserStatus,
  getVerificationStats
};
