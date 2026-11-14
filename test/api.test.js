'use strict';
// The web server: rooms, joining, long-polling views, host commands, static pages.
const test = require('node:test'), assert = require('node:assert'), http = require('http'), os = require('os'), path = require('path'), fs = require('fs');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-'));
const { server } = require('../src/server').create({ env: { DATA_DIR: process.env.DATA_DIR } });
let base;
const call = (method, url, body) => new Promise((resolve, reject) => { const d = body ? JSON.stringify(body) : null;
  const req = http.request(base + url, { method, headers: d ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } : {} }, (res) => { let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) { /* not json */ } resolve({ status: res.statusCode, json: j, text: b, headers: res.headers }); }); });
  req.on('error', reject); if (d) req.write(d); req.end(); });
test.before(() => new Promise((ok) => server.listen(0, '127.0.0.1', () => { base = 'http://127.0.0.1:' + server.address().port; ok(); })));
test.after(() => new Promise((ok) => server.close(ok)));

test('pages, join links and bad paths', async () => {
  for (const p of ['/', '/host', '/play', '/kit.js', '/quorum.js', '/styles.css', '/kit.css']) assert.equal((await call('GET', p)).status, 200, p);
  assert.equal((await call('GET', '/j/ABCD')).headers.location, '/play?room=ABCD');
  assert.notEqual((await call('GET', '/%2e%2e/package.json')).status, 200);
  assert.equal((await call('GET', '/archive/four-games/README.md')).status, 404, 'the archived games are not served');
  const info = (await call('GET', '/api/info')).json; assert.equal(info.games.length, 1); assert.equal(info.games[0].id, 'quorum');
});

test('a full game over the API: join, private views, votes, report', async () => {
  const room = (await call('POST', '/api/rooms')).json; assert.ok(room.ok && room.code.length === 4);
  assert.equal((await call('GET', '/api/rooms/' + room.code + '/host?key=wrong')).status, 403);
  const a = (await call('POST', '/api/rooms/' + room.code + '/join', { name: 'Abdulrahman' })).json, b = (await call('POST', '/api/rooms/' + room.code + '/join', { name: 'Hasham' })).json;
  assert.ok(a.ok && b.ok);
  assert.equal((await call('POST', '/api/rooms/' + room.code + '/join', { name: 'hasham' })).status, 400);
  assert.equal((await call('POST', '/api/rooms/' + room.code + '/host', { key: 'nope', cmd: 'start' })).status, 403);
  assert.ok((await call('POST', '/api/rooms/' + room.code + '/host', { key: room.hostKey, cmd: 'start' })).json.ok);
  const view = async (x) => (await call('GET', '/api/rooms/' + room.code + '/player?pid=' + x.pid + '&token=' + x.token + '&v=0')).json.state;
  let va = await view(a); assert.equal(va.players.length, 6); assert.equal(va.phase, 'brief'); assert.ok(va.me.report.text);
  assert.equal((await call('GET', '/api/rooms/' + room.code + '/player?pid=' + a.pid + '&token=bad&v=0')).status, 403);
  const hostState = async () => (await call('GET', '/api/rooms/' + room.code + '/host?key=' + room.hostKey + '&v=0')).json.state;
  assert.ok(!JSON.stringify(await hostState()).includes(va.me.report.text) || !va.me.report.material);
  let guard = 0;
  for (;;) {
    const hs = await hostState(); if (hs.phase === 'final' || guard++ > 80) break;
    if (hs.decision) for (const x of [a, b]) { const v = await view(x); if (!v.me.sub) { const r = await call('POST', '/api/rooms/' + room.code + '/act', { pid: x.pid, token: x.token, sub: v.phase === 'brief' ? { table: true } : { vote: 'B', chip: 'safety' } }); assert.ok(r.json.ok, JSON.stringify(r.json)); } }
    else assert.ok((await call('POST', '/api/rooms/' + room.code + '/host', { key: room.hostKey, cmd: 'continue' })).json.ok);
  }
  const end = await hostState(); assert.equal(end.phase, 'final'); assert.equal(end.final.scores.length, 6);
  const csv = await call('GET', '/api/rooms/' + room.code + '/report.csv?key=' + room.hostKey); assert.equal(csv.status, 200); assert.ok(csv.text.includes('Abdulrahman') && csv.text.split('\n').length > 20);
  assert.equal((await call('GET', '/api/rooms/' + room.code + '/report.csv?key=x')).status, 403);
});
