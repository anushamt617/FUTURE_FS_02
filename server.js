require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required. Copy .env.example to .env.');
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters long.');
}
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required to create the initial admin.');
}
if (process.env.ADMIN_PASSWORD.length < 12) {
  throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
}

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  source: { type: String, trim: true, maxlength: 80, default: 'Website contact form' },
  message: { type: String, trim: true, maxlength: 3000, default: '' },
  status: { type: String, enum: ['new', 'contacted', 'converted'], default: 'new' },
  notes: [{
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now }
  }],
  followUpAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin'], default: 'admin' }
}, { timestamps: true });

const Lead = mongoose.model('Lead', leadSchema);
const User = mongoose.model('User', userSchema);

app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

app.use(session({
  name: 'future_crm_session',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60
  }),
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

function cleanString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}
function validObjectId(id) {
  return mongoose.isValidObjectId(id);
}

app.post('/api/contact', async (req, res, next) => {
  try {
    const name = cleanString(req.body.name, 100);
    const email = cleanString(req.body.email, 254).toLowerCase();
    const phone = cleanString(req.body.phone, 30);
    const message = cleanString(req.body.message, 3000);
    if (name.length < 2) return res.status(400).json({ error: 'Please enter a name with at least 2 characters.' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (message.length < 5) return res.status(400).json({ error: 'Please enter a message with at least 5 characters.' });
    const lead = await Lead.create({ name, email, phone, message, source: 'Website contact form' });
    res.status(201).json({ message: 'Thank you. Your enquiry has been submitted.', id: lead._id });
  } catch (error) { next(error); }
});

app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
  try {
    const email = cleanString(req.body.email, 254).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user._id.toString();
      req.session.userName = user.name;
      res.json({ message: 'Logged in successfully.', name: user.name });
    });
  } catch (error) { next(error); }
});

app.post('/api/auth/logout', requireAdmin, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('future_crm_session', { httpOnly: true, sameSite: 'lax', secure: isProduction });
    res.json({ message: 'Logged out.' });
  });
});

app.get('/api/auth/me', requireAdmin, (req, res) => {
  res.json({ name: req.session.userName || 'Administrator' });
});

app.get('/api/leads', requireAdmin, async (req, res, next) => {
  try {
    const filter = {};
    if (['new', 'contacted', 'converted'].includes(req.query.status)) filter.status = req.query.status;
    const search = cleanString(req.query.search, 100);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } }
      ];
    }
    const leads = await Lead.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ leads });
  } catch (error) { next(error); }
});

app.post('/api/leads', requireAdmin, async (req, res, next) => {
  try {
    const name = cleanString(req.body.name, 100);
    const email = cleanString(req.body.email, 254).toLowerCase();
    if (name.length < 2 || !validEmail(email)) {
      return res.status(400).json({ error: 'A valid name and email are required.' });
    }
    const lead = await Lead.create({
      name, email,
      phone: cleanString(req.body.phone, 30),
      source: cleanString(req.body.source, 80) || 'Manually added',
      message: cleanString(req.body.message, 3000)
    });
    res.status(201).json({ lead });
  } catch (error) { next(error); }
});

app.patch('/api/leads/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid lead ID.' });
    const updates = {};
    if (req.body.status !== undefined) {
      if (!['new', 'contacted', 'converted'].includes(req.body.status)) {
        return res.status(400).json({ error: 'Invalid lead status.' });
      }
      updates.status = req.body.status;
    }
    if (req.body.followUpAt !== undefined) {
      if (req.body.followUpAt === null || req.body.followUpAt === '') updates.followUpAt = null;
      else {
        const date = new Date(req.body.followUpAt);
        if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid follow-up date.' });
        updates.followUpAt = date;
      }
    }
    const lead = await Lead.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    res.json({ lead });
  } catch (error) { next(error); }
});

app.post('/api/leads/:id/notes', requireAdmin, async (req, res, next) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid lead ID.' });
    const text = cleanString(req.body.text, 1000);
    if (!text) return res.status(400).json({ error: 'Note cannot be empty.' });
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: { text, createdAt: new Date() } } },
      { new: true, runValidators: true }
    );
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    res.status(201).json({ lead });
  } catch (error) { next(error); }
});

app.delete('/api/leads/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid lead ID.' });
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    res.json({ message: 'Lead deleted.' });
  } catch (error) { next(error); }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'An unexpected server error occurred. Check the server log.' });
});

async function start() {
  await mongoose.connect(process.env.MONGODB_URI);
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const existingAdmin = await User.findOne({ email });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await User.create({
      name: cleanString(process.env.ADMIN_NAME, 100) || 'CRM Administrator',
      email,
      passwordHash
    });
    console.log(`Initial admin account created for ${email}.`);
  } else {
    console.log(`Admin account already exists for ${email}; environment password was not changed.`);
  }
  app.listen(PORT, () => console.log(`CRM running at http://localhost:${PORT}`));
}

start().catch((error) => {
  console.error('Could not start CRM:', error.message);
  process.exit(1);
});
