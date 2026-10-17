const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const firebaseAdmin = require('firebase-admin');
const path = require('path');
const sourcePortfolio = require('./portfolio-data.json');

dotenv.config();

function configuredValue(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized && !normalized.startsWith('REPLACE_WITH_') ? normalized : '';
}

const app = express();
const PORT = process.env.PORT || 3000;
const emailUser = configuredValue(process.env.EMAIL_USER) || sourcePortfolio.email;
const emailPassword = configuredValue(process.env.EMAIL_PASSWORD);
const adminEmail = configuredValue(process.env.ADMIN_EMAIL).toLowerCase();
const emailConfigured = Boolean(emailUser && emailPassword && emailPassword !== 'your_app_password_here');
const firebaseWebConfig = {
  apiKey: configuredValue(process.env.FIREBASE_API_KEY),
  authDomain: configuredValue(process.env.FIREBASE_AUTH_DOMAIN),
  projectId: configuredValue(process.env.FIREBASE_PROJECT_ID),
  appId: configuredValue(process.env.FIREBASE_APP_ID),
  messagingSenderId: configuredValue(process.env.FIREBASE_MESSAGING_SENDER_ID)
};
let db = null;

try {
  const serviceAccountJson = configuredValue(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert(serviceAccount) });
    db = firebaseAdmin.firestore();
  }
} catch (error) {
  console.error('Firebase Admin could not be initialized:', error.message);
}

const transporter = emailConfigured
  ? nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: { user: emailUser, pass: emailPassword }
    })
  : null;

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cors({
  origin: process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*'
    ? process.env.CORS_ORIGIN
    : true
}));
app.use(express.static(path.join(__dirname, '.')));

async function getPortfolio() {
  if (!db) return sourcePortfolio;
  const snapshot = await db.collection('site').doc('portfolio').get();
  return snapshot.exists ? snapshot.data().content : sourcePortfolio;
}

function requireFirebaseUser(req, res, next) {
  const match = (req.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: 'Sign in to continue.' });
  if (!db) return res.status(503).json({ error: 'Account storage is not configured on this server.' });

  firebaseAdmin.auth().verifyIdToken(match[1], true)
    .then((decodedToken) => {
      if (!decodedToken.email || !decodedToken.email_verified) {
        return res.status(403).json({ error: 'Verify your email before continuing.' });
      }
      req.authenticatedUser = decodedToken;
      next();
    })
    .catch((error) => {
      console.error('Firebase token verification failed:', error.message);
      res.status(401).json({ error: 'Your sign-in session is invalid or expired. Please sign in again.' });
    });
}

function requireSuperAdmin(req, res, next) {
  if (!adminEmail) return res.status(503).json({ error: 'The super-admin email is not configured on this server.' });
  if ((req.authenticatedUser.email || '').toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: 'Only the configured super-admin account can make website changes.' });
  }
  next();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validatePortfolio(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return 'Portfolio data must be a JSON object.';
  if (!Array.isArray(content.projects) || content.projects.length > 100) return 'Projects must be an array with at most 100 entries.';

  const ids = new Set();
  for (const project of content.projects) {
    if (!project || typeof project !== 'object') return 'Every project must be an object.';
    if (!project.id || !project.name || !project.category || !project.status || !project.description || !Array.isArray(project.tech)) {
      return 'Each project needs an id, name, category, status, description, and technology array.';
    }
    if (ids.has(project.id)) return `Project id "${project.id}" is repeated.`;
    ids.add(project.id);
    if (!project.repoUrl && !project.href) return `Project ${project.name} needs a GitHub repository URL or live project URL.`;
    for (const key of ['repoUrl', 'href', 'previewUrl']) {
      if (project[key] && (!/^https:\/\//i.test(project[key]) || project[key].length > 500)) {
        return `Project ${project.name} has an invalid ${key}. Use an https URL or an empty string.`;
      }
    }
    if (project.repoUrl && !/^https:\/\/github\.com\/Linxvicky2049\/[^/]+\/?$/i.test(project.repoUrl)) {
      return `Project ${project.name} must link to a repository owned by Linxvicky2049.`;
    }
  }
  return '';
}

async function sendUpdateNotices(content) {
  if (!db || !transporter) return { sent: 0, configured: false };
  const subscriberSnapshot = await db.collection('subscribers').get();
  const recipients = subscriberSnapshot.docs
    .map((document) => document.data())
    .filter((subscriber) => subscriber.verified && subscriber.updatesEnabled && subscriber.email);
  if (!recipients.length) return { sent: 0, configured: true };

  const safeName = escapeHtml(content.name || sourcePortfolio.name);
  const safeTitle = escapeHtml(content.title || 'New portfolio update');
  const portfolioUrl = escapeHtml(content.siteUrl || sourcePortfolio.siteUrl);
  const results = await Promise.allSettled(recipients.map((subscriber) => transporter.sendMail({
    from: emailUser,
    to: subscriber.email,
    subject: `BLACKSUN portfolio update: ${safeTitle}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>${safeName} updated the BLACKSUN portfolio</h2><p>There is new work and information on the site.</p><p><a href="${portfolioUrl}">View the portfolio</a></p><p>To stop these notifications, sign in to the site and turn off email updates.</p></div>`
  })));
  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length) console.error(`${failed.length} portfolio update emails failed to send.`);
  return { sent: results.length - failed.length, configured: true, failed: failed.length };
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    portfolio: sourcePortfolio.name,
    emailConfigured: Boolean(transporter),
    authConfigured: Boolean(firebaseWebConfig.apiKey && firebaseWebConfig.authDomain && firebaseWebConfig.projectId && firebaseWebConfig.appId),
    adminConfigured: Boolean(db && adminEmail)
  });
});

app.get('/api/auth-config', (req, res) => {
  res.json({
    firebase: firebaseWebConfig,
    adminConfigured: Boolean(db && adminEmail),
    adminEmail,
    emailConfigured: Boolean(transporter)
  });
});

app.get('/api/portfolio', async (req, res, next) => {
  try {
    res.json(await getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.get('/api/contact-info', async (req, res, next) => {
  try {
    const portfolio = await getPortfolio();
    res.json({
      email: portfolio.email,
      phone1: portfolio.phone,
      phone2: portfolio.alternatePhone,
      company: portfolio.company
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const portfolio = await getPortfolio();
    const body = req.body || {};
    const fields = ['name', 'email', 'subject', 'message'];
    const values = Object.fromEntries(fields.map((field) => [
      field,
      typeof body[field] === 'string' ? body[field].trim() : ''
    ]));
    const { name, email, subject, message } = values;
    if (fields.some((field) => !values[field])) return res.status(400).json({ error: 'All fields are required.' });
    if (name.length > 120 || subject.length > 160 || message.length > 5000 || email.length > 254) {
      return res.status(400).json({ error: 'One or more fields exceed the allowed length.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!transporter) {
      return res.status(503).json({
        error: 'Email delivery is not configured on this server yet.',
        mailto: `mailto:${portfolio.email}?subject=${encodeURIComponent(subject)}`
      });
    }

    await transporter.sendMail({
      from: emailUser,
      to: portfolio.email,
      replyTo: email,
      subject: `New Portfolio Contact: ${subject}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>New message from the BLACKSUN portfolio</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Subject:</strong> ${escapeHtml(subject)}</p><div style="background:#f5f7fb;padding:16px;border-left:4px solid #baff35"><p><strong>Message:</strong></p><p>${escapeHtml(message).replace(/\r?\n/g, '<br>')}</p></div></div>`
    });
    res.json({ success: true, message: 'Message sent successfully. I will get back to you soon.', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      error: 'The message could not be sent right now. Please email me directly.',
      mailto: `mailto:${sourcePortfolio.email}`
    });
  }
});

app.post('/api/subscriptions', accountLimiter, requireFirebaseUser, async (req, res) => {
  const { uid, email, email_verified: emailVerified } = req.authenticatedUser;
  if (!email || !emailVerified) return res.status(403).json({ error: 'Verify your email before managing update subscriptions.' });
  if (typeof req.body?.updatesEnabled !== 'boolean') return res.status(400).json({ error: 'Choose whether to receive email updates.' });
  try {
    await db.collection('subscribers').doc(uid).set({
      email,
      verified: true,
      updatesEnabled: req.body.updatesEnabled,
      updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    res.json({ success: true, updatesEnabled: req.body.updatesEnabled });
  } catch (error) {
    console.error('Subscription update failed:', error);
    res.status(500).json({ error: 'Could not update email preferences. Please try again.' });
  }
});

app.get('/api/subscriptions', accountLimiter, requireFirebaseUser, async (req, res) => {
  try {
    const subscription = await db.collection('subscribers').doc(req.authenticatedUser.uid).get();
    res.json({ updatesEnabled: subscription.exists && subscription.data().updatesEnabled === true });
  } catch (error) {
    console.error('Subscription preference lookup failed:', error);
    res.status(500).json({ error: 'Could not load email preferences.' });
  }
});

app.get('/api/admin/portfolio', adminLimiter, requireFirebaseUser, requireSuperAdmin, async (req, res, next) => {
  try {
    res.json(await getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/portfolio', adminLimiter, requireFirebaseUser, requireSuperAdmin, async (req, res) => {
  const content = req.body?.content;
  const validationError = validatePortfolio(content);
  if (validationError) return res.status(400).json({ error: validationError });
  try {
    await db.collection('site').doc('portfolio').set({
      content,
      updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.authenticatedUser.email
    });
    const notifications = await sendUpdateNotices(content);
    res.json({ success: true, message: 'Portfolio changes saved.', notifications });
  } catch (error) {
    console.error('Portfolio update failed:', error);
    res.status(500).json({ error: 'Could not save the portfolio changes. Please try again.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.url, message: 'The requested resource does not exist.' });
});

app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong.'
  });
});

app.listen(PORT, () => {
  console.log(`BLACKSUN portfolio server running on port ${PORT}`);
});

module.exports = app;
