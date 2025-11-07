require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const db = require('./db');
const ADMIN_ROLES = ['admin', 'super_admin'];

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'please_change_this_secret';

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Helpers
const net = require('net');

function generateTempPassword() {
  return `Adm-${crypto.randomBytes(4).toString('hex')}`;
}

// Email format validation with stricter rules
function isValidEmailFormat(email) {
  const re = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

// Domain validation helper
async function validateDomain(domain) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return { isValid: false, error: 'Invalid domain format', domain };
  }

  try {
    const [mxRecords, aRecords, txtRecords] = await Promise.all([
      dns.resolveMx(domain).catch(() => []),
      dns.resolve(domain).catch(() => []),
      dns.resolveTxt(domain).catch(() => [])
    ]);

    const hasMx = mxRecords && mxRecords.length > 0;
    const hasA = aRecords && aRecords.length > 0;

    return {
      // A domain is valid for email if it has MX or A records.
      isValid: hasMx || hasA,
      hasMX: hasMx,
      hasA: hasA,
      mxRecords: mxRecords || [],
      aRecords: aRecords || [],
      txtRecords: txtRecords || [],
      domain
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message,
      domain
    };
  }
}

// Generate email patterns based on common conventions
async function generateEmailPatterns({ first, last, domain, company }) {
  const F = first.toLowerCase();
  const L = last.toLowerCase();
  const patterns = new Set();

  // Common patterns
  if (F && L) {
    // First + Last variations
    patterns.add(`${F}.${L}@${domain}`);
    patterns.add(`${F}${L}@${domain}`);
    patterns.add(`${L}.${F}@${domain}`);
    patterns.add(`${F}_${L}@${domain}`);
    patterns.add(`${F}-${L}@${domain}`);
    patterns.add(`${F[0]}${L}@${domain}`);
    patterns.add(`${F[0]}.${L}@${domain}`);
    
    // Last + First variations
    patterns.add(`${L}${F}@${domain}`);
    patterns.add(`${L}_${F}@${domain}`);
    patterns.add(`${L[0]}${F}@${domain}`);
    
    // Initial variations
    patterns.add(`${F[0]}${L[0]}@${domain}`);
    patterns.add(`${F[0]}.${L[0]}@${domain}`);
    patterns.add(`${F}${L[0]}@${domain}`);
    patterns.add(`${F}.${L[0]}@${domain}`);
    
    // First name only
    patterns.add(`${F}@${domain}`);

    // Last name only
    patterns.add(`${L}@${domain}`);
    
    // With numbers (for common names)
    patterns.add(`${F}${L}1@${domain}`);
    patterns.add(`${F}.${L}1@${domain}`);
  }

  // Department/Role based (if no name provided or as additional options)
  if (!F && !L || company) {
    const depts = ['info', 'contact', 'sales', 'support', 'admin', 'hello', 'team', 'office'];
    depts.forEach(dept => patterns.add(`${dept}@${domain}`));
    
    if (company) {
      patterns.add(`${company.toLowerCase()}@${domain}`);
      patterns.add(`${company.toLowerCase()}.team@${domain}`);
    }
  }

  return Array.from(patterns);
}

// Enhanced SMTP verification with proper handshake and response parsing
async function checkEmailValidity(email, mxHost) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let hasError = false;
    let buffer = '';
    let stage = 0;
    const stages = ['CONN', 'HELO', 'MAIL', 'RCPT', 'QUIT'];
    let timeout;

    function resetTimeout() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log('SMTP timeout at stage:', stages[stage]);
        socket.destroy();
        resolve({ valid: false, reason: 'Timeout at ' + stages[stage] });
      }, 7000); // 7 second timeout per stage
    }

    function processNext() {
      stage++;
      switch(stage) {
        case 1: // After connection (220)
          socket.write(`HELO ${require('os').hostname()}\r\n`);
          break;
        case 2: // After HELO (250)
          socket.write(`MAIL FROM:<verifier@example.org>\r\n`);
          break;
        case 3: // After MAIL FROM (250)
          socket.write(`RCPT TO:<${email}>\r\n`);
          break;
        case 4: // After RCPT TO
          socket.write('QUIT\r\n');
          break;
        default:
          socket.end();
          break;
      }
      resetTimeout();
    }

    // Set up connection timeout
    resetTimeout();

    // Connect to SMTP server
    socket.connect(25, mxHost, () => {
      console.log('Connected to SMTP server:', mxHost);
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      
      // Process complete lines
      while (buffer.includes('\r\n')) {
        const lineEnd = buffer.indexOf('\r\n');
        const line = buffer.substring(0, lineEnd);
        buffer = buffer.substring(lineEnd + 2);
      
        console.log(`SMTP ${stages[stage]} <`, line);
        
        // Parse SMTP response code
        const code = parseInt(line.substr(0, 3));
        const isLastLineOfResponse = line.charAt(3) === ' ';

        if (!isLastLineOfResponse) continue; // Wait for the final line of a multi-line response
        
        switch(stage) {
          case 0: // Expect 220 (Service ready)
            if (code === 220) processNext();
            else { hasError = true; resolve({ valid: false, reason: `Unexpected connection response (${code}): ${line}` }); }
            break;
            
          case 1: // Expect 250 (HELO ok)
            if (code === 250) processNext();
            else { hasError = true; resolve({ valid: false, reason: `HELO failed (${code}): ${line}` }); }
            break;
            
          case 2: // Expect 250 (MAIL FROM ok)
            if (code === 250) processNext();
            else { hasError = true; resolve({ valid: false, reason: `MAIL FROM failed (${code}): ${line}` }); }
            break;
            
          case 3: // Check RCPT TO response
            if (code === 250) {
              resolve({ valid: true, reason: 'Mailbox exists' });
            } else if (code === 550 || code === 553 || code === 501 || code === 554) {
              resolve({ valid: false, reason: `Invalid mailbox or recipient rejected (${code}): ${line}` });
            } else if (code === 551 || code === 571 || (code >= 400 && code < 500)) {
              resolve({ valid: false, reason: `Invalid mailbox (${code}): ${line}` });
            } else {
              resolve({ valid: false, reason: `Unexpected response (${code}): ${line}` });
            }
            processNext();
            break;
        }
        
        if (hasError) {
          socket.destroy();
          return;
        }
      }
    });

    socket.on('error', (err) => {
      console.error('SMTP connection error:', err.message);
      resolve({ valid: false, reason: `Connection error: ${err.message}` });
      if (timeout) clearTimeout(timeout);
      socket.destroy();
    });

    socket.on('timeout', () => {
      console.log('SMTP connection timeout');
      resolve({ valid: false, reason: 'Connection timeout' });
      socket.destroy();
      if (timeout) clearTimeout(timeout);
    });

    socket.on('end', () => {
      if (timeout) clearTimeout(timeout);
      if (!hasError && stage < 4) {
        resolve({ valid: false, reason: 'Unexpected connection end' });
      }
    });
  });
}

// Admin routes
app.get('/api/user/role', authMiddleware, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role || 'user',
    account_status: req.user.account_status
  });
});

app.get('/api/admin/dashboard', adminAuthMiddleware, async (req, res) => {
  try {
    const stats = await db.getAdminStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

app.get('/api/admin/users', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    const users = await db.getUsers({ offset, limit, search });
    const total = await db.getUserCount(search);
    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/users/:id/credits', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });
    const result = await db.changeUserCredits(id, amount, reason || 'admin_adjustment');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to modify credits' });
  }
});

app.post('/api/admin/users/:id/status', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const result = await db.updateUserStatus(id, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

app.post('/api/admin/users/:id/reset-password', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    const user = await db.findUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newPassword = (password && String(password).trim()) || generateTempPassword();
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await db.updateUserPassword(id, hash);
    res.json({
      password: newPassword,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.post('/api/admin/users/:id/plan', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { plan } = req.body || {};
    if (!plan) return res.status(400).json({ error: 'Plan is required' });
    const result = await db.updateUserPlan(id, plan);
    res.json(result);
  } catch (error) {
    const message = error.message === 'invalid plan' ? error.message : 'Failed to update user plan';
    res.status(error.message === 'invalid plan' ? 400 : 500).json({ error: message });
  }
});

app.get('/api/admin/verify/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const stats = await db.getVerificationStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch verification stats' });
  }
});

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.findUserById(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.account_status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Admin authentication middleware
async function adminAuthMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.findUserById(payload.userId);
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    if (user.account_status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Auth endpoints
app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const existing = await db.findUserByEmail(email.toLowerCase());
  if (existing) return res.status(400).json({ error: 'email already registered' });
  const hash = bcrypt.hashSync(password, 8);
  // derive username and first/last names
  const username = (email.split('@')[0] || email).replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0,100);
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const first_name = parts[0] || null;
  const last_name = parts.length > 1 ? parts.slice(1).join(' ') : null;
  const user = await db.createUser({ username, email: email.toLowerCase(), passwordHash: hash, first_name, last_name, credits_left: 5 });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, credits_left: user.credits_left } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = await db.findUserByEmail(email.toLowerCase());
  if (!user) return res.status(400).json({ error: 'invalid credentials' });
  if (ADMIN_ROLES.includes(user.role)) {
    return res.status(403).json({ error: 'Admin accounts must sign in through the admin portal.' });
  }
  const ok = bcrypt.compareSync(password, user.password || user.passwordHash || user.password_hash);
  if (!ok) return res.status(400).json({ error: 'invalid credentials' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, credits_left: user.credits_left } });
});

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  try {
    const user = await db.findUserByEmail(email.toLowerCase());
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const ok = bcrypt.compareSync(password, user.password || user.passwordHash || user.password_hash);
    if (!ok) {
      return res.status(403).json({ error: 'Invalid admin credentials' });
    }

    if (user.account_status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Admin login failed' });
  }
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const u = req.user;
  res.json({ id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, credits_left: u.credits_left });
});

app.get('/api/credits', authMiddleware, async (req, res) => {
  res.json({ credits: req.user.credits_left });
});

app.post('/api/credits/add', authMiddleware, async (req, res) => {
  const { amount } = req.body || {};
  const n = Number(amount) || 0;
  if (n <= 0) return res.status(400).json({ error: 'amount must be positive' });
  try {
    const r = await db.changeCredits(req.user.id, n, 'purchase');
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware to consume credits for actions (cost per request)
async function consumeCredits(req, res, next) {
  const cost = Number(req.consumeCost || 1);
  try {
    await db.changeCredits(req.user.id, -cost, req.consumeReason || 'usage');
    // refresh user
    req.user = await db.findUserById(req.user.id);
    next();
  } catch (err) {
    return res.status(402).json({ error: 'insufficient credits' });
  }
}

// Generate possible emails from names and domain (costs 1 credit)
app.post('/api/generate', authMiddleware, async (req, res, next) => {
  req.consumeCost = 1;
  req.consumeReason = 'generate';
  next();
}, consumeCredits, async (req, res) => {
  const { first = '', last = '', domain = '', company = '' } = req.body || {};
  if (!domain) return res.status(400).json({ error: 'domain is required' });

  try {
    // First verify if the domain exists and has MX records
    const domainInfo = await validateDomain(domain);
    if (!domainInfo.isValid) {
      return res.status(400).json({ error: 'Invalid or non-existent domain' });
    }

    // Generate email patterns based on company conventions
    const patterns = await generateEmailPatterns({
      first: first.trim(),
      last: last.trim(),
      domain: domain.toLowerCase(),
      company: company.trim()
    });

    const valid_emails = [];
    const other_patterns = [];

    // If domain has an MX record, try to validate each pattern
    if (domainInfo.hasMX && domainInfo.mxRecords.length > 0) {
      const mxHost = domainInfo.mxRecords[0].exchange;
      for (const email of patterns) {
        const check = await checkEmailValidity(email, mxHost);
        if (check.valid) {
          valid_emails.push(email);
        } else {
          other_patterns.push(email);
        }
      }
    } else {
      // If no MX record, return all patterns as unverified
      other_patterns.push(...patterns);
    }

    res.json({ 
      valid_emails,
      other_patterns,
      domain_info: domainInfo,
      credits_left: req.user.credits_left 
    });
  } catch (error) {
    console.error('Email generation error:', error);
    res.status(500).json({ error: 'Failed to generate email addresses' });
  }
});

// Verify endpoint: comprehensive email verification (costs 1 credit)
app.post('/api/verify', authMiddleware, async (req, res, next) => {
  req.consumeCost = 1;
  req.consumeReason = 'verify';
  next();
}, consumeCredits, async (req, res) => {
  const { email, deep = false } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  const result = {
    email,
    formatValid: false,
    disposable: false,
    role_based: false,
    domain: {
      valid: false,
      hasA: false,
      hasMX: false,
      hasSPF: false,
      hasDMARC: false,
      records: {}
    },
    mailbox: {
      exists: null,
      full: null,
      disabled: null,
      catch_all: null
    },
    score: 0,
    suggestion: null,
    info: []
  };

  try {
    // Step 1: Basic format validation
    result.formatValid = isValidEmailFormat(email);
    if (!result.formatValid) {
      result.info.push('Invalid email format');
      return res.json(Object.assign(result, { credits_left: req.user.credits_left }));
    }

    // Step 2: Extract and validate domain
    const domain = email.split('@').pop();
    const localPart = email.split('@')[0];

    // Step 3: Check for role-based email
    const rolePatterns = /^(admin|administrator|webmaster|info|contact|support|sales|marketing|help|mail|office|hr|hiring|jobs|team|no-reply|noreply)$/i;
    result.role_based = rolePatterns.test(localPart);
    if (result.role_based) {
      result.info.push('Role-based email detected');
    }

    // Step 4: Comprehensive domain validation
    const domainInfo = await validateDomain(domain);
    result.domain = {
      valid: domainInfo.isValid,
      hasA: domainInfo.hasA,
      hasMX: domainInfo.hasMX,
      records: {
        mx: domainInfo.mxRecords || [],
        a: domainInfo.aRecords || [],
        txt: domainInfo.txtRecords || []
      }
    };

    // Step 5: Check for SPF and DMARC records
    const txtRecords = domainInfo.txtRecords.flat();
    result.domain.hasSPF = txtRecords.some(record => record.includes('v=spf1'));
    result.domain.hasDMARC = txtRecords.some(record => record.includes('v=DMARC1'));

    if (!result.domain.valid) {
      result.info.push('Invalid or non-existent domain');
      return res.json(Object.assign(result, { credits_left: req.user.credits_left }));
    }

    // Step 6: Deep verification (if requested and domain has MX)
    if (deep && result.domain.hasMX) {
      const mxHost = result.domain.records.mx[0].exchange;
      
      // Check if mailbox exists
      const mailboxCheck = await checkEmailValidity(email, mxHost);
      result.mailbox.exists = mailboxCheck.valid;
      
      // Check for catch-all
      if (mailboxCheck.valid) {
        const randomEmail = `test${Date.now()}@${domain}`;
        const catchAllCheck = await checkEmailValidity(randomEmail, mxHost);
        result.mailbox.catch_all = catchAllCheck.valid;
      }
    }

    // Step 7: Calculate confidence score (0-100)
    let score = 0;
    score += result.formatValid ? 20 : 0;
    score += result.domain.hasMX ? 20 : 0;
    score += result.domain.hasSPF ? 10 : 0;
    score += result.domain.hasDMARC ? 10 : 0;
    score += result.mailbox.exists === true ? 40 : 0;
    score -= result.role_based ? 10 : 0;
    score -= result.mailbox.catch_all === true ? 10 : 0;
    result.score = Math.max(0, Math.min(100, score));

    // Step 8: Provide suggestions if score is low
    if (score < 50) {
      const suggestion = [];
      if (!result.domain.hasMX) suggestion.push('Domain has no mail server');
      if (result.role_based) suggestion.push('Consider using a personal email');
      if (!result.domain.hasSPF) suggestion.push('Domain lacks SPF record');
      if (!result.domain.hasDMARC) suggestion.push('Domain lacks DMARC record');
      if (suggestion.length > 0) {
        result.suggestion = suggestion.join('. ');
      }
    }

    res.json(Object.assign(result, { 
      credits_left: req.user.credits_left,
      verified_at: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      error: 'Email verification failed',
      details: error.message,
      credits_left: req.user.credits_left
    });
  }
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Email Hunter replica (with auth) listening on http://localhost:${PORT}`);
});
