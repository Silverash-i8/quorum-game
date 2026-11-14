'use strict';
// Server-level tests: rooms, joining, long-poll, timers, privacy, seat recovery, report.
const test = require('node:test'), assert = require('node:assert'), os = require('os'), path = require('path'), fs = require('fs');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cellout-'));
const { server, rooms } = require('../src/server');
let base;
const call = async (method, url, body) => { const r = await fetch(base + url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { j = { text: t }; } j.status = r.status; return j; };
test.before(() => new Promise((ok) => server.listen(0, '127.0.0.1', () => { base = 'http://127.0.0.1:' + server.address().port; ok(); })));
test.after(() => { server.close(); server.closeAllConnections(); });

test('full flow over HTTP', async () => {
  const room = await call('POST', '/api/rooms', {}); assert.equal(room.ok, true); assert.match(room.code, /^[A-HJ-NP-Z]{4}$/);
  const C = '/api/rooms/' + room.code;
  assert.equal((await call('GET', '/api/rooms/ZZZZ')).status, 404);
  assert.equal((await call('GET', C + '/host?key=wrong&v=0')).status, 403);
  const a = await call('POST', C + '/join', { name: 'Alpha' }), b = await call('POST', C + '/join', { name: 'Beta' });
  assert.equal(a.ok && b.ok, true);
  assert.equal((await call('POST', C + '/join', { name: 'alpha' })).ok, false);
  assert.equal((await call('GET', C + '/player?pid=' + a.pid + '&token=bad&v=0')).status, 403);
  assert.equal((await call('POST', C + '/host', { key: room.hostKey, cmd: 'addBot' })).ok, true);
  let h = await call('GET', C + '/host?key=' + room.hostKey + '&v=0');
  assert.equal(h.state.players.length, 3); assert.equal(h.state.players[2].bot, true);

  // long-poll: resolves when something changes
  const t0 = Date.now(); const waiting = call('GET', C + '/host?key=' + room.hostKey + '&v=' + h.v);
  await new Promise((ok) => setTimeout(ok, 150));
  assert.equal((await call('POST', C + '/host', { key: room.hostKey, cmd: 'start' })).ok, true);
  h = await waiting; assert.ok(Date.now() - t0 < 3000); assert.equal(h.state.phase, 'news');
  assert.equal((await call('POST', C + '/join', { name: 'Late' })).ok, false, 'no new companies after the start');

  await call('POST', C + '/host', { key: room.hostKey, cmd: 'continue' });
  let pa = await call('GET', C + '/player?pid=' + a.pid + '&token=' + a.token + '&v=0');
  assert.equal(pa.state.phase, 'dilemma'); assert.equal(pa.state.me.cash, 12);
  assert.equal(pa.state.players.find((p) => p.bot).done, true, 'bots decide at once');
  assert.ok(pa.state.remainingMs > 80000 && pa.state.remainingMs <= 90000);
  assert.equal((await call('POST', C + '/act', { pid: a.pid, token: 'bad', sub: { choice: 'proper' } })).status, 403);
  assert.equal((await call('POST', C + '/act', { pid: a.pid, token: a.token, sub: { choice: 'x' } })).ok, false);
  await call('POST', C + '/act', { pid: a.pid, token: a.token, sub: { choice: 'shortcut' } });
  await call('POST', C + '/act', { pid: b.pid, token: b.token, sub: { choice: 'proper' } });
  h = await call('GET', C + '/host?key=' + room.hostKey + '&v=0');
  assert.equal(h.state.phase, 'dilemmaReveal'); assert.equal(h.state.dilemmaReveal.shortcut >= 1, true);
  assert.ok(!JSON.stringify(h.state).includes('"cash"'), 'host screen never shows cash');
  const pb = await call('GET', C + '/player?pid=' + b.pid + '&token=' + b.token + '&v=0');
  assert.equal(pb.state.me.skeletons, 0); assert.ok(!JSON.stringify(pb.state.players).includes('skeletons'));

  // timer: an unanswered decision closes itself
  rooms.get(room.code).timerSec = 1;
  await call('POST', C + '/host', { key: room.hostKey, cmd: 'continue' });
  h = await call('GET', C + '/host?key=' + room.hostKey + '&v=0'); assert.equal(h.state.phase, 'boardroom');
  await new Promise((ok) => setTimeout(ok, 1400));
  h = await call('GET', C + '/host?key=' + room.hostKey + '&v=0'); assert.equal(h.state.phase, 'boardroomReveal', 'timer closed the round');
  rooms.get(room.code).timerSec = 0;

  // seat recovery by company name when the phone lost its link
  rooms.get(room.code).seen[b.pid] = 0;
  const again = await call('POST', C + '/join', { name: 'beta' }); assert.equal(again.ok, true); assert.equal(again.pid, b.pid); assert.notEqual(again.token, b.token);
  assert.equal((await call('GET', C + '/player?pid=' + b.pid + '&token=' + b.token + '&v=0')).status, 403, 'old link stops working');

  // play to the end using defaults (host closes each round)
  for (let i = 0; i < 80; i++) { h = await call('GET', C + '/host?key=' + room.hostKey + '&v=0'); if (h.state.phase === 'final') break; await call('POST', C + '/host', { key: room.hostKey, cmd: 'continue' }); }
  assert.equal(h.state.phase, 'final'); assert.equal(h.state.final.scores.length, 3);
  const rep = await fetch(base + C + '/report.csv?key=' + room.hostKey); const text = await rep.text();
  assert.equal(rep.status, 200); assert.equal(text.split('\r\n').filter((l) => l.startsWith('"Alpha"')).length, 5, 'five yearly rows per company');
  assert.equal((await fetch(base + C + '/report.csv?key=nope')).status, 403);
});

test('static pages and join redirect', async () => {
  for (const p of ['/', '/host', '/play', '/instructions', '/datasheet', '/styles.css', '/app.js', '/vendor/qrcode.js', '/fonts/barlow-latin-400-normal.woff2']) assert.equal((await fetch(base + p)).status, 200, p);
  const r = await fetch(base + '/j/abcd', { redirect: 'manual' }); assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/play?room=ABCD');
  assert.equal((await fetch(base + '/../src/server.js')).status, 404);
  assert.notEqual((await fetch(base + '/%2e%2e/src/engine.js')).status, 200);
  assert.notEqual((await fetch(base + '/..%2fsrc%2fengine.js')).status, 200);
});
