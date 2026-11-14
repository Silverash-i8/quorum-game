'use strict';
// QUORUM game server. No dependencies: Node's http module, a JSON API with long-polling, and static files.
// Nothing about a game is kept only in this process: every request loads the room from the store, changes it, and
// saves it back (see store.js). That is what lets the same code run on a laptop and on a host such as Vercel.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const Store = require('./store');
const GAMES = { quorum: require('./quorum') };

const PUB = path.join(__dirname, '..', 'public');
const POLL_MS = 20000, ONLINE_MS = 20000, PRESENCE_MS = 6000, TIMERS = [0, 45, 90, 180];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const PAGES = { '/': 'index.html', '/host': 'host.html', '/play': 'play.html', '/quorum/host': 'host.html', '/quorum/play': 'play.html' };
const NOROOM = 'No game with that code. Check the four letters on the big screen.';
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const eng = (r) => GAMES[r.game].E, botsOf = (r) => GAMES[r.game].B;
const phaseKey = (r) => r.g.phase + ':' + r.g.year;

function create(opts) {
  opts = opts || {};
  const env = opts.env || process.env, PORT = +(opts.port !== undefined ? opts.port : env.PORT) || 3000, PUBLIC_URL = (env.PUBLIC_URL || '').replace(/\/+$/, '');
  const store = opts.store || Store.create(env, env.DATA_DIR || path.join(__dirname, '..', 'data'));

  // ---------- same-process wake-ups, so a change reaches waiting phones at once when they share this copy of the server
  const waiting = new Map();
  function wake(code) { const s = waiting.get(code); if (s) for (const f of [...s]) f(); }
  function signal(code, ms) { return new Promise((ok) => { let set = waiting.get(code); if (!set) waiting.set(code, set = new Set());
    const done = () => { clearTimeout(t); set.delete(done); if (!set.size) waiting.delete(code); ok(); }; const t = setTimeout(done, ms); set.add(done); }); }

  // ---------- load, change, save. fn returns { error, status } to refuse, { skip: true } to leave the room as it is.
  function afterChange(r, prevKey) {
    botsOf(r).run(r.g);
    if (phaseKey(r) !== prevKey || r.rearm) { r.deadline = eng(r).DECISION.includes(r.g.phase) && r.timerSec ? Date.now() + r.timerSec * 1000 : 0; delete r.rearm; }
    r.v++; r.touched = Date.now();
  }
  async function mutate(code, fn) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const r = await store.get(code);
      if (!r) return { status: 404, error: NOROOM };
      const prev = r.v, key = phaseKey(r), out = fn(r) || {};
      if (out.error || out.skip) return out;
      afterChange(r, key);
      if (await store.put(code, prev, r)) { wake(code); return out; }
      await sleep(30 + 40 * attempt + Math.floor(Math.random() * 40)); // someone else saved first: read their version and try again
    }
    return { status: 503, error: 'The game is busy. Try that again.' };
  }
  // A decision round whose time is up is closed by whichever request notices first.
  const enforce = (code) => mutate(code, (r) => { if (!(r.deadline && Date.now() >= r.deadline && eng(r).DECISION.includes(r.g.phase))) return { skip: true }; eng(r).advance(r.g); return {}; });
  async function createRoom(game) {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    for (let tries = 0; tries < 50; tries++) {
      let code = ''; for (let i = 0; i < 4; i++) code += A[crypto.randomInt(A.length)];
      if (await store.meta(code)) continue;
      const r = { code, game, hostKey: crypto.randomBytes(12).toString('hex'), g: GAMES[game].E.newGame(crypto.randomInt(0xFFFFFFFF)), tokens: {}, timerSec: 90, created: Date.now(), touched: Date.now(), v: 1, deadline: 0 };
      if (await store.put(code, 0, r)) return r;
    }
    throw new Error('Could not find a free game code.');
  }
  // Which phones are connected right now, as one short string. The host screen sends back the one it is showing, so a
  // phone that drops out or comes back is noticed even when nothing else in the game has changed.
  const present = (r, seen, now) => r.g.players.filter((p) => !p.bot && now - (seen[p.id] || 0) < ONLINE_MS).map((p) => p.id).sort().join(',');
  async function viewFor(r, who, seenNow) {
    const s = who.host ? eng(r).hostView(r.g) : eng(r).playerView(r.g, who.pid), seen = seenNow || await store.seen(r.code), now = Date.now();
    s.code = r.code; s.timerSec = r.timerSec; s.remainingMs = r.deadline ? Math.max(0, r.deadline - now) : null;
    for (const p of s.players) p.online = !!p.bot || now - (seen[p.id] || 0) < ONLINE_MS;
    if (who.host) s.timers = TIMERS;
    return { ok: true, v: r.v, on: present(r, seen, now), state: s };
  }

  // ---------- http helpers
  function json(res, code, obj) { if (res.writableEnded) return; const body = JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) }); res.end(body); }
  const fail = (res, code, msg) => json(res, code, { ok: false, error: msg });
  const reply = (res, out) => (out.error ? fail(res, out.status || 400, out.error) : json(res, 200, Object.assign({ ok: true }, out.body || {})));
  function readBody(req) { return new Promise((resolve) => { let b = '', over = false;
    req.on('data', (c) => { b += c; if (b.length > 20000) { over = true; req.destroy(); } });
    req.on('end', () => { if (over) return resolve(null); try { resolve(b ? JSON.parse(b) : {}); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null)); }); }
  // Addresses phones on the same network could use. A hosted copy has none: its only address is the public one in the browser.
  function lanUrls() { const out = []; if (env.VERCEL) return out;
    for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.')) out.push('http://' + i.address + (PORT === 80 ? '' : ':' + PORT));
    return out; }
  function csv(r) { const rep = eng(r).report(r.g), q = (v) => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';
    return [rep.cols.join(',')].concat(rep.rows.map((row) => row.map(q).join(','))).join('\r\n'); }

  // ---------- api
  async function api(req, res, url) {
    const parts = url.pathname.split('/').filter(Boolean), q = url.searchParams; // api, rooms, CODE, verb
    if (parts[1] === 'info' && req.method === 'GET') return json(res, 200, { ok: true, publicUrl: PUBLIC_URL, lan: lanUrls(), port: PORT, store: store.kind, version: GAMES.quorum.E.R.version, games: Object.keys(GAMES).map((id) => ({ id, title: GAMES[id].title, version: GAMES[id].E.R.version })) });
    if (parts[1] !== 'rooms') return fail(res, 404, 'Not found.');
    if (parts.length === 2 && req.method === 'POST') {
      const game = q.get('game') || 'quorum';
      if (!GAMES[game]) return fail(res, 400, 'There is no game called that.');
      const r = await createRoom(game); return json(res, 200, { ok: true, code: r.code, game, hostKey: r.hostKey });
    }
    const code = String(parts[2] || '').toUpperCase(), verb = parts[3] || '';
    if (!/^[A-Z]{4}$/.test(code)) return fail(res, 404, NOROOM);

    if (req.method === 'GET') {
      let r = await store.get(code);
      if (!r) return fail(res, 404, NOROOM);
      if (verb === '') return json(res, 200, { ok: true, code: r.code, game: r.game, phase: r.g.phase, players: r.g.players.length });
      if (verb === 'report.csv') {
        if (q.get('key') !== r.hostKey) return fail(res, 403, 'Only the host can download the report.');
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + r.game + '-' + r.code + '.csv"', 'Cache-Control': 'no-store' });
        return res.end(csv(r));
      }
      if (verb !== 'host' && verb !== 'player') return fail(res, 404, 'Not found.');
      let who;
      if (verb === 'host') { if (q.get('key') !== r.hostKey) return fail(res, 403, 'This is not the host link for that game.'); who = { host: true }; }
      else { const pid = q.get('pid'); if (!pid || r.tokens[pid] !== q.get('token')) return fail(res, 403, 'Your seat in this game was not recognised. Join again.'); who = { pid }; }
      // Long poll: answer at once if there is news, otherwise wait for a change, a deadline, or 20 seconds.
      const since = +q.get('v') || 0, end = Date.now() + POLL_MS;
      const shown = who.host && q.has('on') ? q.get('on') : null; let gone = false, m = { v: r.v, deadline: r.deadline || 0 }, look = 0;
      res.on('close', () => { gone = true; wake(code); });
      for (let guard = 0; guard < 400 && !gone; guard++) {
        if (who.pid) await store.touch(code, who.pid);
        if (m.deadline && Date.now() >= m.deadline) { await enforce(code); m = await store.meta(code); if (!m) return fail(res, 404, NOROOM); if (m.deadline && Date.now() >= m.deadline) m.deadline = 0; continue; }
        if (m.v > since) { r = await store.get(code); if (!r) return fail(res, 404, NOROOM); return json(res, 200, await viewFor(r, who)); }
        if (shown !== null && Date.now() >= look) { look = Date.now() + PRESENCE_MS; const seen = await store.seen(code);
          if (present(r, seen, Date.now()) !== shown) { r = await store.get(code); if (!r) return fail(res, 404, NOROOM); return json(res, 200, await viewFor(r, who, seen)); } }
        const left = end - Date.now();
        if (left <= 0) return json(res, 200, { ok: true, v: since });
        await signal(code, Math.max(50, Math.min(store.interval, left, m.deadline ? m.deadline - Date.now() + 20 : Infinity)));
        m = await store.meta(code); if (!m) return fail(res, 404, NOROOM);
      }
      return;
    }

    if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
    const body = await readBody(req);
    if (!body) return fail(res, 400, 'That request could not be read.');

    if (verb === 'join') {
      const name = String(body.name || '').replace(/\s+/g, ' ').trim(), seen = await store.seen(code), token = crypto.randomBytes(12).toString('hex');
      const out = await mutate(code, (r) => {
        if (r.g.phase !== 'lobby') { // recover a seat after a phone lost its link: same name, and nobody currently connected on it
          const p = r.g.players.find((x) => !x.bot && x.name.toLowerCase() === name.toLowerCase());
          if (!p) return { status: 409, error: 'This game has already started. To rejoin, enter your name exactly as before.' };
          if (Date.now() - (seen[p.id] || 0) < ONLINE_MS) return { status: 409, error: 'That seat is being played on another device right now.' };
          r.tokens[p.id] = token; return { body: { pid: p.id, token, rejoined: true } };
        }
        const a = eng(r).addPlayer(r.g, { name });
        if (!a.ok) return { error: a.error };
        r.tokens[a.player.id] = token; return { body: { pid: a.player.id, token } };
      });
      if (!out.error) await store.touch(code, out.body.pid);
      return reply(res, out);
    }
    if (verb === 'act') return reply(res, await mutate(code, (r) => {
      if (!body.pid || r.tokens[body.pid] !== body.token) return { status: 403, error: 'Your seat in this game was not recognised. Join again.' };
      const a = eng(r).submit(r.g, body.pid, body.sub); return a.ok ? {} : { error: a.error };
    }));
    if (verb === 'host') return reply(res, await mutate(code, (r) => {
      if (body.key !== r.hostKey) return { status: 403, error: 'This is not the host link for that game.' };
      const E = eng(r), B = botsOf(r); let a = { ok: true };
      if (body.cmd === 'start') a = E.start(r.g);
      else if (body.cmd === 'continue') a = E.advance(r.g);
      else if (body.cmd === 'addBot') {
        const style = B.STYLES.includes(body.style) ? body.style : B.STYLES[r.g.players.filter((p) => p.bot).length % B.STYLES.length];
        let name = B.NAMES[style], n = 2; while (r.g.players.some((p) => p.name === name)) name = B.NAMES[style] + ' ' + n++;
        a = E.addPlayer(r.g, { name, bot: style });
      } else if (body.cmd === 'remove') { a = E.removePlayer(r.g, body.pid); if (a.ok) delete r.tokens[body.pid]; }
      else if (body.cmd === 'timer') { if (!TIMERS.includes(body.sec)) return { error: 'Unknown timer setting.' }; r.timerSec = body.sec; r.rearm = true; }
      else return { error: 'Unknown command.' };
      return a.ok ? {} : { error: a.error };
    }));
    return fail(res, 404, 'Not found.');
  }

  // ---------- static files
  function serveStatic(req, res, url) {
    let p; try { p = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400); return res.end(); }
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
    let url; try { url = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
    if (url.pathname.startsWith('/api/')) return api(req, res, url).catch((e) => { console.error(e); if (!res.headersSent) fail(res, 500, 'Something went wrong on the game server.'); });
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, url);
  });
  const sweeper = setInterval(() => store.sweep(), 3600 * 1000); sweeper.unref();
  return { server, store, PORT, PUBLIC_URL, lanUrls, mutate };
}

if (require.main === module) {
  const app = create(), restored = app.store.load((r) => GAMES[r.game] && r.g.rules === GAMES[r.game].E.R.version);
  if (restored) console.log('Restored ' + restored + ' game(s) from disk.');
  app.server.listen(app.PORT, '0.0.0.0', () => {
    console.log('\nQUORUM is running. Games are kept in ' + (app.store.kind === 'redis' ? 'the hosted database.' : 'this computer\'s memory and saved to disk.') + '\n');
    console.log('  Open this on the laptop:                http://localhost:' + app.PORT + '/');
    const urls = app.PUBLIC_URL ? [app.PUBLIC_URL] : app.lanUrls();
    for (const u of urls) console.log('  Phones join at:                         ' + u);
    console.log('\nPress Ctrl+C to stop.\n');
  });
  process.on('SIGTERM', () => app.server.close(() => process.exit(0)));
}
module.exports = { create, GAMES };
