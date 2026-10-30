const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('portfolio:' + ADMIN_PASSWORD).digest('hex');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 1024);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------------- Tiny JSON database ----------------
const DEFAULT_DB = {
  profile: {
    name: 'Your Name',
    tagline: 'Video Editor & Colorist',
    bio: 'I cut stories that keep people watching — commercials, music videos, YouTube content and short-form reels. Pacing, sound design and color, delivered on time.',
    email: 'hello@example.com',
    phone: '',
    instagram: '',
    youtube: '',
    showreelId: null,
  },
  videos: [],
  collections: [],
};

function loadDb() {
  try {
    return { ...DEFAULT_DB, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } catch {
    return structuredClone(DEFAULT_DB);
  }
}

let db = loadDb();

function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const id = (n = 8) => crypto.randomBytes(n).toString('base64url').slice(0, n + 2);

// ---------------- Auth (signed cookie) ----------------
function sign(value) {
  return value + '.' + crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

function verify(token) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const expected = sign(token.slice(0, i));
  if (expected.length !== token.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))) return false;
  const expires = Number(token.slice(0, i).split(':')[1]);
  return expires > Date.now();
}

function getCookie(req, name) {
  const match = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function requireAdmin(req, res, next) {
  if (verify(getCookie(req, 'admin'))) return next();
  res.status(401).json({ error: 'Not logged in' });
}

// ---------------- Uploads ----------------
const VIDEO_EXT = ['.mp4', '.mov', '.webm', '.m4v', '.mkv'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + id(6) + path.extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = file.fieldname === 'video'
      ? file.mimetype.startsWith('video/') || VIDEO_EXT.includes(ext)
      : file.mimetype.startsWith('image/') || IMAGE_EXT.includes(ext);
    cb(ok ? null : new Error(`Invalid file type for ${file.fieldname}`), ok);
  },
});

function removeUpload(filename) {
  if (!filename) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(filename)), () => {});
}

// ---------------- App ----------------
const app = express();
app.use(express.json());

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', acceptRanges: true }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const publicVideo = (v) => ({ ...v, url: '/uploads/' + v.file, thumbUrl: v.thumb ? '/uploads/' + v.thumb : null });

// Public portfolio
app.get('/api/portfolio', (req, res) => {
  const videos = db.videos.filter((v) => v.visible !== false).sort((a, b) => b.featured - a.featured || b.createdAt - a.createdAt);
  res.json({ profile: db.profile, videos: videos.map(publicVideo) });
});

app.get('/api/videos/:id', (req, res) => {
  const v = db.videos.find((x) => x.id === req.params.id);
  if (!v) return res.status(404).json({ error: 'Video not found' });
  v.views = (v.views || 0) + 1;
  saveDb();
  res.json({ profile: db.profile, video: publicVideo(v) });
});

app.get('/api/collections/:id', (req, res) => {
  const c = db.collections.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Link not found' });
  c.views = (c.views || 0) + 1;
  c.lastViewedAt = Date.now();
  saveDb();
  const videos = c.videoIds.map((vid) => db.videos.find((v) => v.id === vid)).filter(Boolean).map(publicVideo);
  res.json({ profile: db.profile, collection: { id: c.id, title: c.title, clientName: c.clientName, message: c.message, allowDownload: c.allowDownload }, videos });
});

// Admin
app.post('/api/admin/login', (req, res) => {
  const pw = String(req.body?.password || '');
  const a = crypto.createHash('sha256').update(pw).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Wrong password' });
  const token = sign('admin:' + (Date.now() + 7 * 24 * 3600 * 1000));
  res.setHeader('Set-Cookie', `admin=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 3600}`);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'admin=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => res.json({ loggedIn: verify(getCookie(req, 'admin')) }));

app.get('/api/admin/data', requireAdmin, (req, res) => {
  res.json({
    profile: db.profile,
    videos: [...db.videos].sort((a, b) => b.createdAt - a.createdAt).map(publicVideo),
    collections: [...db.collections].sort((a, b) => b.createdAt - a.createdAt),
  });
});

app.post('/api/admin/videos', requireAdmin, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumb', maxCount: 1 }]), (req, res) => {
  const videoFile = req.files?.video?.[0];
  if (!videoFile) return res.status(400).json({ error: 'Please choose a video file' });
  const b = req.body;
  const video = {
    id: id(8),
    title: (b.title || videoFile.originalname.replace(/\.[^.]+$/, '')).slice(0, 120),
    category: (b.category || 'Other').slice(0, 40),
    client: (b.client || '').slice(0, 80),
    description: (b.description || '').slice(0, 1000),
    tools: (b.tools || '').slice(0, 120),
    file: videoFile.filename,
    size: videoFile.size,
    thumb: req.files?.thumb?.[0]?.filename || null,
    featured: b.featured === 'true',
    visible: b.visible !== 'false',
    views: 0,
    createdAt: Date.now(),
  };
  db.videos.push(video);
  saveDb();
  res.json(publicVideo(video));
});

app.patch('/api/admin/videos/:id', requireAdmin, upload.single('thumb'), (req, res) => {
  const v = db.videos.find((x) => x.id === req.params.id);
  if (!v) return res.status(404).json({ error: 'Video not found' });
  for (const key of ['title', 'category', 'client', 'description', 'tools']) {
    if (typeof req.body[key] === 'string') v[key] = req.body[key];
  }
  for (const key of ['featured', 'visible']) {
    if (req.body[key] !== undefined) v[key] = req.body[key] === true || req.body[key] === 'true';
  }
  if (req.file) {
    removeUpload(v.thumb);
    v.thumb = req.file.filename;
  }
  saveDb();
  res.json(publicVideo(v));
});

app.delete('/api/admin/videos/:id', requireAdmin, (req, res) => {
  const v = db.videos.find((x) => x.id === req.params.id);
  if (!v) return res.status(404).json({ error: 'Video not found' });
  removeUpload(v.file);
  removeUpload(v.thumb);
  db.videos = db.videos.filter((x) => x.id !== v.id);
  db.collections.forEach((c) => (c.videoIds = c.videoIds.filter((x) => x !== v.id)));
  if (db.profile.showreelId === v.id) db.profile.showreelId = null;
  saveDb();
  res.json({ ok: true });
});

app.put('/api/admin/profile', requireAdmin, (req, res) => {
  for (const key of Object.keys(DEFAULT_DB.profile)) {
    if (req.body[key] !== undefined) db.profile[key] = req.body[key];
  }
  saveDb();
  res.json(db.profile);
});

app.post('/api/admin/collections', requireAdmin, (req, res) => {
  const { title, clientName, message, videoIds, allowDownload } = req.body || {};
  const ids = (Array.isArray(videoIds) ? videoIds : []).filter((vid) => db.videos.some((v) => v.id === vid));
  if (!ids.length) return res.status(400).json({ error: 'Select at least one video' });
  const c = {
    id: id(10),
    title: (title || 'Selected work').slice(0, 120),
    clientName: (clientName || '').slice(0, 80),
    message: (message || '').slice(0, 1000),
    videoIds: ids,
    allowDownload: !!allowDownload,
    views: 0,
    lastViewedAt: null,
    createdAt: Date.now(),
  };
  db.collections.push(c);
  saveDb();
  res.json(c);
});

app.delete('/api/admin/collections/:id', requireAdmin, (req, res) => {
  db.collections = db.collections.filter((c) => c.id !== req.params.id);
  saveDb();
  res.json({ ok: true });
});

// Pretty share URLs
app.get('/v/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'watch.html')));
app.get('/c/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'client.html')));

app.use((err, req, res, next) => {
  const msg = err.code === 'LIMIT_FILE_SIZE' ? `File too large (max ${MAX_UPLOAD_MB} MB)` : err.message;
  res.status(400).json({ error: msg });
});

app.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
  console.log(`Admin panel:        http://localhost:${PORT}/admin`);
  if (!process.env.ADMIN_PASSWORD) console.log('Using default admin password "admin123" — set ADMIN_PASSWORD to change it.');
});
