/**
 * Case Docket Server — Legacy Equities Management
 * Run: node server.js
 * Access from any office computer: http://[this-computer-ip]:3000
 */

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

// ── Database setup ─────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'cases.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS cases (
    id          TEXT PRIMARY KEY,
    tenant      TEXT,
    address     TEXT,
    prop        TEXT,
    cnum        TEXT,
    ctype       TEXT,
    court       TEXT,
    judge       TEXT,
    filed       TEXT,
    hearing     TEXT,
    htime       TEXT,
    status      TEXT DEFAULT 'Filed',
    amount      TEXT,
    vplat       TEXT,
    zid         TEXT,
    zpw         TEXT,
    zlink       TEXT,
    sdate       TEXT,
    smethod     TEXT,
    server_name TEXT,
    rof         TEXT,
    anotes      TEXT,
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id    TEXT,
    action     TEXT,
    user_name  TEXT,
    details    TEXT,
    ts         TEXT DEFAULT (datetime('now'))
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper: log activity ───────────────────────────────────────
function logActivity(caseId, action, user, details) {
  try {
    db.prepare(`INSERT INTO activity_log (case_id, action, user_name, details) VALUES (?,?,?,?)`)
      .run(caseId, action, user || 'Unknown', details || '');
  } catch(e) {}
}

// ── Cases API ──────────────────────────────────────────────────
// GET all cases
app.get('/api/cases', (req, res) => {
  try {
    const cases = db.prepare(`SELECT * FROM cases ORDER BY created_at DESC`).all();
    res.json(cases);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single case
app.get('/api/cases/:id', (req, res) => {
  try {
    const c = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create case
app.post('/api/cases', (req, res) => {
  try {
    const c = req.body;
    db.prepare(`
      INSERT INTO cases (id,tenant,address,prop,cnum,ctype,court,judge,filed,hearing,htime,status,amount,vplat,zid,zpw,zlink,sdate,smethod,server_name,rof,anotes,notes)
      VALUES (@id,@tenant,@address,@prop,@cnum,@ctype,@court,@judge,@filed,@hearing,@htime,@status,@amount,@vplat,@zid,@zpw,@zlink,@sdate,@smethod,@server_name,@rof,@anotes,@notes)
    `).run(c);
    logActivity(c.id, 'created', c._user, `${c.tenant} — ${c.cnum}`);
    res.json({ ok: true, id: c.id });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update case
app.put('/api/cases/:id', (req, res) => {
  try {
    const c = { ...req.body, id: req.params.id };
    db.prepare(`
      UPDATE cases SET
        tenant=@tenant, address=@address, prop=@prop, cnum=@cnum, ctype=@ctype,
        court=@court, judge=@judge, filed=@filed, hearing=@hearing, htime=@htime,
        status=@status, amount=@amount, vplat=@vplat, zid=@zid, zpw=@zpw, zlink=@zlink,
        sdate=@sdate, smethod=@smethod, server_name=@server_name, rof=@rof,
        anotes=@anotes, notes=@notes, updated_at=datetime('now')
      WHERE id=@id
    `).run(c);
    logActivity(c.id, 'updated', c._user, `${c.tenant} — status: ${c.status}`);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE case
app.delete('/api/cases/:id', (req, res) => {
  try {
    const c = db.prepare(`SELECT * FROM cases WHERE id=?`).get(req.params.id);
    db.prepare(`DELETE FROM cases WHERE id=?`).run(req.params.id);
    if (c) logActivity(req.params.id, 'deleted', req.query.user, `${c.tenant} — ${c.cnum}`);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET recent activity log
app.get('/api/activity', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM activity_log ORDER BY ts DESC LIMIT 50`).all();
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET server info (for clients to display connection status)
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, cases: db.prepare(`SELECT COUNT(*) as n FROM cases`).get().n });
});

// ── Export CSV ────────────────────────────────────────────────
app.get('/api/export', (req, res) => {
  try {
    const cases = db.prepare(`SELECT * FROM cases ORDER BY hearing ASC`).all();
    const H = ['Tenant','Address','Property','Case #','Type','Court','Judge','Filed','Hearing','Hearing Time','Status','Amount','Platform','Meeting ID','Passcode','Join Link','Served Date','Service Method','Process Server','Return of Service','Attorney Notes','Notes','Created'];
    const rows = cases.map(c => [
      c.tenant,c.address,c.prop,c.cnum,c.ctype,c.court,c.judge,c.filed,c.hearing,
      c.htime,c.status,c.amount,c.vplat,c.zid,c.zpw,c.zlink,c.sdate,c.smethod,
      c.server_name,c.rof,c.anotes,c.notes,c.created_at
    ].map(v => `"${(v||'').replace(/"/g,'""')}"`));
    const csv = [H.join(','), ...rows.map(r=>r.join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition',`attachment; filename="case-docket-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send('\uFEFF' + csv);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) { localIp = net.address; break; }
    }
  }
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║       Case Docket · Legacy Equities              ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  This computer:  http://localhost:${PORT}            ║`);
  console.log(`║  Office network: http://${localIp}:${PORT}  ║`);
  console.log('║                                                  ║');
  console.log('║  Share the network URL with your team.           ║');
  console.log('║  Press Ctrl+C to stop the server.                ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
});
