import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const db = new Database(process.env.DB_PATH || 'db.sqlite');

// DB setup
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  code TEXT,
  verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  clicked_count INTEGER DEFAULT 0,
  submitted_count INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tokens (
  email TEXT,
  token TEXT,
  expires_at TEXT
);
`);

const ensureColumn = (table, column, definition) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((col) => col.name === column);
  if (!exists) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
};

ensureColumn('users', 'clicked_count', 'INTEGER DEFAULT 0');
ensureColumn('users', 'submitted_count', 'INTEGER DEFAULT 0');

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static landing page
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.render('index');
});

// Create transporter (Gmail app password or Brevo SMTP)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  logger: true,
  debug: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.on('log', (info) => {
  if (info && info.type) {
    console.log('Nodemailer log:', info);
  }
});

transporter.on('error', (error) => {
  console.error('Nodemailer error:', error);
});

// Generate verification token
app.post('/generate', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const token = crypto.randomBytes(16).toString('hex');
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  db.prepare('DELETE FROM tokens WHERE email = ?').run(email);
  db.prepare(
    'INSERT INTO tokens (email, token, expires_at) VALUES (?, ?, ?)'
  ).run(email, token, expires);

  const link = `${process.env.BASE_URL}/verify?token=${token}`;
  transporter.sendMail({
    from: `"Snowboard Survey" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verify your email to get your referral link',
    text: `Click here to verify: ${link}`,
    html: `<p>Click here to verify: <a href="${link}">${link}</a></p>`,
  });

  res.json({ message: 'Check your inbox for verification link' });
});

// Verify token
app.get('/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');

  const row = db
    .prepare('SELECT email, expires_at FROM tokens WHERE token = ?')
    .get(token);
  if (!row) return res.status(400).send('Invalid token');
  if (new Date(row.expires_at) < new Date())
    return res.status(400).send('Token expired!');

  const existingUser = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(row.email);
  if (!existingUser) {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    db.prepare(
      'INSERT INTO users (email, code, verified) VALUES (?, ?, 1)'
    ).run(row.email, code);
  } else {
    db.prepare('UPDATE users SET verified = 1 WHERE email = ?').run(row.email);
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(row.email);
  if (!user) {
    return res.status(500).send('Unable to load referral data');
  }

  const clickCount = user.clicked_count ?? 0;

  const formUrl = process.env.FORM_URL || '';
  const baseUrl =
    (process.env.BASE_URL && process.env.BASE_URL.replace(/\/$/, '')) ||
    `${req.protocol}://${req.get('host')}`;
  const referralLink = `${baseUrl}/r/${user.code}`;

  res.render('verify-success', {
    referralLink,
    userCode: user.code,
    formUrl,
    clickCount,
  });
});

app.get('/r/:code', (req, res) => {
  const { code } = req.params;

  const user = db
    .prepare(
      'SELECT email, clicked_count FROM users WHERE code = ? AND verified = 1'
    )
    .get(code);
  if (!user) {
    return res.status(404).send('Unknown referral code');
  }

  db.prepare(
    'UPDATE users SET clicked_count = COALESCE(clicked_count, 0) + 1 WHERE code = ?'
  ).run(code);

  const targetForm = process.env.FORM_URL;
  if (!targetForm) {
    return res.redirect('/');
  }

  try {
    const url = new URL(targetForm);
    url.searchParams.set('referral', code);
    return res.redirect(url.toString());
  } catch (error) {
    console.error('Invalid FORM_URL provided', error);
    return res.redirect(targetForm);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server running on port 3000');
});
