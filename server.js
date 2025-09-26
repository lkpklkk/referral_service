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

const db = new Database('db.sqlite');

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
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
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

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(row.email);
  if (!user) {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    db.prepare(
      'INSERT INTO users (email, code, verified) VALUES (?, ?, 1)'
    ).run(row.email, code);
    user = { email: row.email, code };
  } else {
    db.prepare('UPDATE users SET verified = 1 WHERE email = ?').run(row.email);
  }

  const referralBase = process.env.FORM_URL || '';
  const referralLink = referralBase
    ? `${referralBase}?referral=${user.code}`
    : `${user.code}`;

  res.render('verify-success', {
    referralLink,
    userCode: user.code,
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server running on port 3000');
});
