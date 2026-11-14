'use strict';
// QUORUM game server. No dependencies: Node's http module, JSON API with long-polling, static files.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
// A game offers an engine (E) and a bot runner (B). The server could host several; this project ships one.
const GAMES = { quorum: require('./quorum') };
const E = GAMES.quorum.E;
const eng = (r) => GAMES[r.game].E, botsOf = (r) => GAMES[r.game].B;

const PORT = +process.env.PORT || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const PUB = path.join(__dirname, '..', 'public');
const POLL_MS = 25000, ROOM_TTL_MS = 24 * 3600 * 1000, SEEN_MS = 12000;
const TIMERS = [0, 45, 90, 180];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.json': 'application/json' };
const PAGES = { '/': 'index.html', '/host': 'host.html', '/play': 'play.html', '/quorum/host': 'host.html', '/quorum/play': 'play.html' };

const rooms = new Map();

// ---------- persistence (so a restart does not lose a game in progress)
const SAVE = path.join(DATA_DIR, 'rooms.json');
let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const out = [...rooms.values()].map((r) => ({ code: r.code, game: r.game, hostKey: r.hostKey, g: r.g, tokens: r.tokens, timerSec: r.timerSec, created: r.created, touched: r.touched }));
      fs.writeFileSync(SAVE + '.tmp', JSON.stringify(out)); fs.renameSync(SAVE + '.tmp', SAVE);
    } catch (e) { console.error('Could not save games:', e.message); }
  }, 400);
}
function load() {
  try {
    for (const r of JSON.parse(fs.readFileSync(SAVE, 'utf8'))) {
      r.game = r.game || 'quorum';
      if (Date.now() - r.touched > ROOM_TTL_MS || !GAMES[r.game] || r.g.rules !== eng(r).R.version) continue;
      rooms.set(r.code, Object.assign(r, { v: 1, waiters: new Set(), seen: {}, polls: {}, deadline: 0, timer: null }));
      armTimer(rooms.get(r.code));
    }
    if (rooms.size) console.log('Restored ' + rooms.size + ' game(s) from disk.');
  } catch (e) { /* first run */ }
}

// ---------- rooms
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += A[crypto.randomInt(A.length)]; if (!rooms.has(c)) return c; }
}
function createRoom(game) {
  const r = { code: newCode(), game, hostKey: crypto.randomBytes(12).toString('hex'), g: GAMES[game].E.newGame(crypto.randomInt(0xFFFFFFFF)), tokens: {}, timerSec: 90,
    created: Date.now(), touched: Date.now(), v: 1, waiters: new Set(), seen: {}, polls: {}, deadline: 0, timer: null };
  rooms.set(r.code, r); save();
  return r;
}
function connected(r, pid) { return (r.polls[pid] || 0) > 0 || Date.now() - (r.seen[pid] || 0) < SEEN_MS; }
function armTimer(r) {
  if (r.timer) { clearTimeout(r.timer); r.timer = null; }
  r.deadline = 0;
  if (!eng(r).DECISION.includes(r.g.phase) || !r.timerSec) return;
  const key = r.g.phase + ':' + r.g.year;
  r.deadline = Date.now() + r.timerSec * 1000;
  r.timer = setTimeout(() => {
    r.timer = null;
    if (r.g.phase + ':' + r.g.year !== key) return;
    eng(r).advance(r.g); changed(r, key);
  }, r.timerSec * 1000);
}
// Call after every change to a room. prevKey is the phase key before the change.
function changed(r, prevKey) {
  botsOf(r).run(r.g);
  const key = r.g.phase + ':' + r.g.year;
  if (key !== prevKey) armTimer(r);
  r.v++; r.touched = Date.now(); save();
  for (const w of [...r.waiters]) w.send();
}
function viewFor(r, who) {
  const s = who.host ? eng(r).hostView(r.g) : eng(r).playerView(r.g, who.pid);
  s.code = r.code; s.timerSec = r.timerSec; s.remainingMs = r.deadline ? Math.max(0, r.deadline - Date.now()) : null;
  for (const p of s.players) p.online = p.bot || connected(r, p.id);
  if (who.host) s.timers = TIMERS;
  return { v: r.v, state: s };
}

// ---------- http helpers
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function fail(res, code, msg) { json(res, code, { ok: false, error: msg }); }
function readBody(req) {
  return new Promise((resolve) => {
    let b = '', over = false;
    req.on('data', (c) => { b += c; if (b.length > 20000) { over = true; req.destroy(); } });
    req.on('end', () => { if (over) return resolve(null); try { resolve(b ? JSON.parse(b) : {}); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}
function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push('http://' + i.address + (PORT === 80 ? '' : ':' + PORT));
  return out;
}
function csv(r) {
  const rep = eng(r).report(r.g), q = (v) => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';
  return [rep.cols.join(',')].concat(rep.rows.map((row) => row.map(q).join(','))).join('\r\n');
}

// ---------- api
async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // api, rooms, CODE, verb
  if (parts[1] === 'info' && req.method === 'GET') return json(res, 200, { ok: true, publicUrl: PUBLIC_URL, lan: lanUrls(), port: PORT, version: E.R.version, games: Object.keys(GAMES).map((id) => ({ id, title: GAMES[id].title, version: GAMES[id].E.R.version })) });
  if (parts[1] !== 'rooms') return fail(res, 404, 'Not found.');
  if (parts.length === 2 && req.method === 'POST') {
    const game = url.searchParams.get('game') || 'quorum';
    if (!GAMES[game]) return fail(res, 400, 'There is no game called that.');
    const r = createRoom(game); return json(res, 200, { ok: true, code: r.code, game, hostKey: r.hostKey });
  }
  const r = rooms.get(String(parts[2] || '').toUpperCase());
  if (!r) return fail(res, 404, 'No game with that code. Check the four letters on the big screen.');
  const verb = parts[3] || '';
  const q = url.searchParams;

  if (req.method === 'GET' && verb === '') return json(res, 200, { ok: true, code: r.code, game: r.game, phase: r.g.phase, players: r.g.players.length });

  if (req.method === 'GET' && (verb === 'host' || verb === 'player')) {
    let who;
    if (verb === 'host') { if (q.get('key') !== r.hostKey) return fail(res, 403, 'This is not the host link for that game.'); who = { host: true }; }
    else { const pid = q.get('pid'); if (!pid || r.tokens[pid] !== q.get('token')) return fail(res, 403, 'Your seat in this game was not recognised. Join again.'); who = { pid }; }
    const since = +q.get('v') || 0;
    if (who.pid) r.seen[who.pid] = Date.now();
    if (r.v > since) return json(res, 200, Object.assign({ ok: true }, viewFor(r, who)));
    if (who.pid) r.polls[who.pid] = (r.polls[who.pid] || 0) + 1;
    const w = { done: false };
    const finish = () => {
      if (w.done) return false; w.done = true; clearTimeout(w.t); r.waiters.delete(w);
      if (who.pid) { r.polls[who.pid]--; r.seen[who.pid] = Date.now(); }
      return true;
    };
    w.send = () => { if (finish()) json(res, 200, Object.assign({ ok: true }, viewFor(r, who))); };
    w.t = setTimeout(w.send, POLL_MS);
    res.on('close', () => { finish(); });
    r.waiters.add(w);
    return;
  }

  if (req.method === 'GET' && verb === 'report.csv') {
    if (q.get('key') !== r.hostKey) return fail(res, 403, 'Only the host can download the report.');
    const body = csv(r);
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + r.game + '-' + r.code + '.csv"', 'Cache-Control': 'no-store' });
    return res.end(body);
  }

  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
  const body = await readBody(req);
  if (!body) return fail(res, 400, 'That request could not be read.');
  const key = r.g.phase + ':' + r.g.year;

  if (verb === 'join') {
    const name = String(body.name || '').replace(/\s+/g, ' ').trim();
    if (r.g.phase !== 'lobby') {
      // Recover a seat after a phone lost its link: same company name, and nobody currently connected on it.
      const p = r.g.players.find((x) => !x.bot && x.name.toLowerCase() === name.toLowerCase());
      if (!p) return fail(res, 409, 'This game has already started. To rejoin, enter your name exactly as before.');
      if (connected(r, p.id)) return fail(res, 409, 'That seat is being played on another device right now.');
      r.tokens[p.id] = crypto.randomBytes(12).toString('hex'); save();
      return json(res, 200, { ok: true, pid: p.id, token: r.tokens[p.id], rejoined: true });
    }
    const a = eng(r).addPlayer(r.g, { name });
    if (!a.ok) return fail(res, 400, a.error);
    r.tokens[a.player.id] = crypto.randomBytes(12).toString('hex'); r.seen[a.player.id] = Date.now();
    changed(r, key);
    return json(res, 200, { ok: true, pid: a.player.id, token: r.tokens[a.player.id] });
  }

  if (verb === 'act') {
    if (!body.pid || r.tokens[body.pid] !== body.token) return fail(res, 403, 'Your seat in this game was not recognised. Join again.');
    const a = eng(r).submit(r.g, body.pid, body.sub);
    if (!a.ok) return fail(res, 400, a.error);
    changed(r, key);
    return json(res, 200, { ok: true });
  }

  if (verb === 'host') {
    if (body.key !== r.hostKey) return fail(res, 403, 'This is not the host link for that game.');
    let a = { ok: true };
    const E = eng(r), B = botsOf(r);
    if (body.cmd === 'start') a = E.start(r.g);
    else if (body.cmd === 'continue') a = E.advance(r.g);
    else if (body.cmd === 'addBot') {
      const style = B.STYLES.includes(body.style) ? body.style : B.STYLES[r.g.players.filter((p) => p.bot).length % B.STYLES.length];
      let name = B.NAMES[style], n = 2; while (r.g.players.some((p) => p.name === name)) name = B.NAMES[style] + ' ' + n++;
      a = E.addPlayer(r.g, { name, bot: style });
    } else if (body.cmd === 'remove') { a = E.removePlayer(r.g, body.pid); if (a.ok) delete r.tokens[body.pid]; }
    else if (body.cmd === 'timer') { if (!TIMERS.includes(body.sec)) return fail(res, 400, 'Unknown timer setting.'); r.timerSec = body.sec; if (E.DECISION.includes(r.g.phase)) armTimer(r); }
    else return fail(res, 400, 'Unknown command.');
    if (!a.ok) return fail(res, 400, a.error);
    changed(r, key);
    return json(res, 200, { ok: true });
  }
  return fail(res, 404, 'Not found.');
}

// ---------- static files
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  const j = p.match(/^\/j\/([A-Za-z]{4})$/);
  if (j) { res.writeHead(302, { Location: '/play?room=' + j[1].toUpperCase() }); return res.end(); }
  if (PAGES[p]) p = '/' + PAGES[p];
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.woff2' ? 'public, max-age=604800' : 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
  if (url.pathname.startsWith('/api/')) return api(req, res, url).catch((e) => { console.error(e); if (!res.headersSent) fail(res, 500, 'Something went wrong on the game server.'); });
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url);
});

setInterval(() => { for (const [c, r] of rooms) if (Date.now() - r.touched > ROOM_TTL_MS) { if (r.timer) clearTimeout(r.timer); rooms.delete(c); } }, 3600 * 1000).unref();

if (require.main === module) {
  load();
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\nQUORUM is running.\n');
    console.log('  Open this on the laptop:                http://localhost:' + PORT + '/');
    const urls = PUBLIC_URL ? [PUBLIC_URL] : lanUrls();
    for (const u of urls) console.log('  Phones join at:                         ' + u);
    if (!urls.length) console.log('  No network address found. Connect to Wi-Fi or a hotspot so phones can join.');
    console.log('\nPress Ctrl+C to stop.\n');
  });
}
module.exports = { server, rooms, GAMES };
