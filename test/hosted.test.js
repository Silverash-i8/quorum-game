'use strict';
// The hosted set-up: games kept in a Redis database over its REST API, and more than one copy of the server running.
// A small stand-in for the database runs inside the test, so nothing here touches the internet.
const test = require('node:test'), assert = require('node:assert'), http = require('http');
const { create } = require('../src/server'), Store = require('../src/store');

function fakeRedis() {
  const kv = new Map(), hashes = new Map(); let commands = 0;
  const run = (c) => { commands++; const op = String(c[0]).toUpperCase();
    if (op === 'GET') return kv.has(c[1]) ? kv.get(c[1]) : null;
    if (op === 'SET') { if (c.includes('NX') && kv.has(c[1])) return null; kv.set(c[1], String(c[2])); return 'OK'; }
    if (op === 'HSET') { if (!hashes.has(c[1])) hashes.set(c[1], new Map()); hashes.get(c[1]).set(c[2], String(c[3])); return 1; }
    if (op === 'HGETALL') return [...(hashes.get(c[1]) || new Map())].flat();
    if (op === 'EXPIRE') return 1;
    throw new Error('the stand-in database does not know ' + op); };
  const server = http.createServer((req, res) => { let b = ''; req.on('data', (x) => { b += x; }); req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== 'Bearer secret') { res.statusCode = 401; return res.end('{"error":"unauthorised"}'); }
    try { const body = JSON.parse(b); res.end(JSON.stringify(req.url === '/pipeline' ? body.map((c) => ({ result: run(c) })) : { result: run(body) })); } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); } }); });
  return { server, kv, count: () => commands };
}
const listen = (s) => new Promise((ok) => s.listen(0, '127.0.0.1', () => ok('http://127.0.0.1:' + s.address().port)));
const call = (base, method, url, body) => new Promise((resolve, reject) => { const d = body ? JSON.stringify(body) : null;
  const req = http.request(base + url, { method, headers: d ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } : {} }, (res) => { let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) { /* not json */ } resolve({ status: res.statusCode, json: j, text: b }); }); });
  req.on('error', reject); if (d) req.write(d); req.end(); });

let db, dbUrl, A, B, a, b;
test.before(async () => {
  db = fakeRedis(); dbUrl = await listen(db.server);
  const env = { KV_REST_API_URL: dbUrl, KV_REST_API_TOKEN: 'secret' };
  A = create({ env, port: 0 }); B = create({ env, port: 0 }); // two copies of the server, one database
  a = await listen(A.server); b = await listen(B.server);
});
test.after(() => { for (const s of [A.server, B.server, db.server]) { s.closeAllConnections(); s.close(); } });

test('the store is chosen from the environment', () => {
  assert.equal(Store.create({}, null).kind, 'memory');
  assert.equal(Store.create({ UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' }, null).kind, 'redis');
  assert.equal(A.store.kind, 'redis');
});

test('two copies of the server can never both save the same version of a game', async () => {
  const room = (await call(a, 'POST', '/api/rooms')).json;
  const names = ['Ada', 'Bo', 'Cy', 'Di', 'Ed', 'Flo'];
  const results = await Promise.all(names.map((nm, i) => call(i % 2 ? a : b, 'POST', '/api/rooms/' + room.code + '/join', { name: nm })));
  assert.ok(results.every((r) => r.json && r.json.ok), JSON.stringify(results.map((r) => r.json)));
  assert.equal(new Set(results.map((r) => r.json.pid)).size, 6, 'six joins at once must give six different seats');
  const saved = JSON.parse(db.kv.get('quorum:room:' + room.code));
  assert.equal(saved.g.players.length, 6); assert.equal(saved.v, 7);
  assert.equal((await call(b, 'POST', '/api/rooms/' + room.code + '/join', { name: 'Seventh' })).status, 400);
});

test('a whole game played across two copies of the server, with nothing kept in either', async () => {
  const room = (await call(a, 'POST', '/api/rooms')).json;
  const p1 = (await call(a, 'POST', '/api/rooms/' + room.code + '/join', { name: 'Abdulrahman' })).json, p2 = (await call(b, 'POST', '/api/rooms/' + room.code + '/join', { name: 'Hasham' })).json;
  assert.ok((await call(b, 'POST', '/api/rooms/' + room.code + '/host', { key: room.hostKey, cmd: 'start' })).json.ok, 'started on copy B though created on copy A');
  const view = async (base, x, v) => (await call(base, 'GET', '/api/rooms/' + room.code + '/player?pid=' + x.pid + '&token=' + x.token + '&v=' + (v || 0))).json;
  const host = async (base) => (await call(base, 'GET', '/api/rooms/' + room.code + '/host?key=' + room.hostKey + '&v=0')).json.state;
  // a phone waiting on copy A hears about a move made through copy B
  const before = await view(a, p1), waiting = view(a, p1, before.v), t0 = Date.now();
  assert.ok((await call(b, 'POST', '/api/rooms/' + room.code + '/act', { pid: p2.pid, token: p2.token, sub: { table: true } })).json.ok);
  const after = await waiting; assert.ok(after.v > before.v && after.state, 'the waiting phone got the new state'); assert.ok(Date.now() - t0 < 5000);
  assert.equal(after.state.players.find((p) => p.id === p2.pid).done, true);
  let guard = 0, flip = 0;
  for (;;) {
    const hs = await host(flip++ % 2 ? a : b); if (hs.phase === 'final' || guard++ > 90) break;
    if (hs.decision) for (const x of [p1, p2]) { const base = flip++ % 2 ? a : b, v = await view(base, x); if (v.state.decision && !v.state.me.sub) { const r = await call(base, 'POST', '/api/rooms/' + room.code + '/act', { pid: x.pid, token: x.token, sub: v.state.phase === 'brief' ? { table: true } : { vote: 'B', chip: 'safety' } }); assert.ok(r.json.ok, JSON.stringify(r.json) + ' in ' + v.state.phase); } }
    else assert.ok((await call(flip++ % 2 ? a : b, 'POST', '/api/rooms/' + room.code + '/host', { key: room.hostKey, cmd: 'continue' })).json.ok);
  }
  const end = await host(a); assert.equal(end.phase, 'final'); assert.equal(end.final.scores.length, 6);
  // a brand new copy of the server, started after the game, can still serve it
  const C = create({ env: { KV_REST_API_URL: dbUrl, KV_REST_API_TOKEN: 'secret' }, port: 0 }), c = await listen(C.server);
  assert.equal((await host(c)).phase, 'final'); assert.ok((await call(c, 'GET', '/api/rooms/' + room.code + '/report.csv?key=' + room.hostKey)).text.includes('Abdulrahman'));
  C.server.closeAllConnections(); C.server.close();
});

test('a round timer runs out even if the copy of the server that set it has gone', async () => {
  const room = (await call(a, 'POST', '/api/rooms')).json, p = (await call(a, 'POST', '/api/rooms/' + room.code + '/join', { name: 'Solo' })).json;
  await call(a, 'POST', '/api/rooms/' + room.code + '/host', { key: room.hostKey, cmd: 'start' });
  const saved = JSON.parse(db.kv.get('quorum:room:' + room.code)); assert.ok(saved.deadline > Date.now(), 'a deadline is stored with the game');
  // pretend 90 seconds have passed by moving the stored deadline into the past, then ask the other copy
  saved.deadline = Date.now() - 1000; db.kv.set('quorum:room:' + room.code, JSON.stringify(saved)); db.kv.set('quorum:meta:' + room.code, saved.v + ':' + saved.deadline);
  const s = (await call(b, 'GET', '/api/rooms/' + room.code + '/player?pid=' + p.pid + '&token=' + p.token + '&v=' + saved.v)).json;
  assert.equal(s.state.phase, 'vote', 'the brief round was closed for the player who did not answer');
});

test('a quiet game costs few database commands', async () => {
  const room = (await call(a, 'POST', '/api/rooms')).json, p = (await call(a, 'POST', '/api/rooms/' + room.code + '/join', { name: 'Idle' })).json;
  const v = (await call(a, 'GET', '/api/rooms/' + room.code + '/player?pid=' + p.pid + '&token=' + p.token + '&v=0')).json.v, n0 = db.count();
  const wait = call(a, 'GET', '/api/rooms/' + room.code + '/player?pid=' + p.pid + '&token=' + p.token + '&v=' + v);
  await new Promise((ok) => setTimeout(ok, 4200)); const used = db.count() - n0;
  assert.ok(used <= 6, 'one waiting phone used ' + used + ' commands in four seconds');
  await call(a, 'POST', '/api/rooms/' + room.code + '/host', { key: room.hostKey, cmd: 'addBot' }); const got = await wait; assert.ok(got.json ? got.json.state : got.state, JSON.stringify(got).slice(0, 300));
});
