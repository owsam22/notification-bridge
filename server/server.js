// server/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3456;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database helpers ───
function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { apps: {}, notifications: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ─── API: Get notifications for a specific app ───
// This is what the script tag calls
app.get('/api/notifications/:appId', (req, res) => {
  const { appId } = req.params;
  const db = readDB();
  const now = new Date();

  const appNotifications = db.notifications.filter(n => {
    // Must target this app
    if (!n.targetApps.includes(appId) && !n.targetApps.includes('*')) {
      return false;
    }
    // Must be active
    if (!n.active) return false;
    // Check schedule
    if (n.startDate && new Date(n.startDate) > now) return false;
    if (n.endDate && new Date(n.endDate) < now) return false;
    return true;
  }).map(n => ({
    id: n.id,
    title: n.title,
    message: n.message,
    link: n.link,
    linkText: n.linkText,
    type: n.type,           // info, success, warning, promo
    position: n.position,   // bottom-right, top-right, center, etc.
    delay: n.delay,         // seconds before showing
    frequency: n.frequency, // once, session, always, every-x-hours
    frequencyHours: n.frequencyHours,
    theme: n.theme,         // light, dark, custom
    customColors: n.customColors,
    icon: n.icon,
    priority: n.priority
  }));

  // Sort by priority
  appNotifications.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  res.json(appNotifications);
});

// ─── API: Register a new app ───
app.post('/api/apps', (req, res) => {
  const { name, description, url } = req.body;
  const db = readDB();
  const appId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

  db.apps[appId] = {
    id: appId,
    name,
    description: description || '',
    url: url || '',
    createdAt: new Date().toISOString()
  };

  writeDB(db);
  res.json({ appId, scriptTag: `<script src="http://localhost:${PORT}/nb.js?app=${appId}" defer><\/script>` });
});

// ─── API: Get all apps ───
app.get('/api/apps', (req, res) => {
  const db = readDB();
  res.json(db.apps);
});

// ─── API: Delete an app ───
app.delete('/api/apps/:appId', (req, res) => {
  const db = readDB();
  delete db.apps[req.params.appId];
  writeDB(db);
  res.json({ success: true });
});

// ─── API: Create notification ───
app.post('/api/notifications', (req, res) => {
  const db = readDB();
  const notification = {
    id: uuidv4(),
    title: req.body.title || 'Notification',
    message: req.body.message || '',
    link: req.body.link || '',
    linkText: req.body.linkText || 'Check it out →',
    type: req.body.type || 'info',
    position: req.body.position || 'bottom-right',
    delay: req.body.delay || 2,
    frequency: req.body.frequency || 'once',  // once | session | always | every-x-hours
    frequencyHours: req.body.frequencyHours || 24,
    targetApps: req.body.targetApps || ['*'],  // array of appIds or ['*'] for all
    active: req.body.active !== false,
    startDate: req.body.startDate || null,
    endDate: req.body.endDate || null,
    theme: req.body.theme || 'dark',
    customColors: req.body.customColors || null,
    icon: req.body.icon || null,
    priority: req.body.priority || 0,
    createdAt: new Date().toISOString()
  };

  db.notifications.push(notification);
  writeDB(db);
  res.json(notification);
});

// ─── API: Get all notifications ───
app.get('/api/notifications', (req, res) => {
  const db = readDB();
  res.json(db.notifications);
});

// ─── API: Update notification ───
app.put('/api/notifications/:id', (req, res) => {
  const db = readDB();
  const idx = db.notifications.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  db.notifications[idx] = { ...db.notifications[idx], ...req.body };
  writeDB(db);
  res.json(db.notifications[idx]);
});

// ─── API: Delete notification ───
app.delete('/api/notifications/:id', (req, res) => {
  const db = readDB();
  db.notifications = db.notifications.filter(n => n.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// ─── Serve dashboard ───
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`\n🔔 NotifyBridge running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`\n📋 Script tag format:`);
  console.log(`   <script src="http://localhost:${PORT}/nb.js?app=YOUR_APP_ID" defer><\/script>\n`);
});