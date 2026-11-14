'use strict';
const test = require('node:test'), assert = require('node:assert');
const { E, B, ITEMS, ROLES, KEYS, GAUGES } = require('../src/quorum');
const S = require('./sim');
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const finite = (o, path) => { for (const [k, v] of Object.entries(o)) { if (typeof v === 'number') assert.ok(Number.isFinite(v), path + '.' + k + ' is not a number'); else if (v && typeof v === 'object') finite(v, path + '.' + k); } };
const board = (n, seed) => { const g = E.newGame(seed || 3); for (let k = 0; k < n; k++) E.addPlayer(g, { name: 'D' + k }); E.start(g); return g; };
const seat = (g, key) => g.players.find((p) => ROLES[p.role].key === key);
const setItem = (g, id) => { g.agenda[g.year] = ITEMS.findIndex((x) => x.id === id); };

test('the board always has six seats, one of each, and bots fill the empty ones', () => {
  const g = E.newGame(1);
  assert.equal(E.start(g).ok, false);
  assert.equal(E.addPlayer(g, { name: '' }).ok, false);
  assert.equal(E.addPlayer(g, { name: 'Ada' }).ok, true);
  assert.equal(E.addPlayer(g, { name: 'ada' }).ok, false);
  assert.equal(E.start(g).ok, true);
  assert.equal(g.players.length, 6); assert.equal(g.players.filter((p) => !p.bot).length, 1);
  assert.deepEqual(g.players.map((p) => p.role).sort(), [0, 1, 2, 3, 4, 5]);
  const full = E.newGame(2); for (let k = 0; k < 6; k++) assert.equal(E.addPlayer(full, { name: 'P' + k }).ok, true);
  assert.equal(E.addPlayer(full, { name: 'seventh' }).ok, false);
});

test('every agenda item is well formed and every seat has reports that matter', () => {
  const counts = Object.fromEntries(ROLES.map((r) => [r.key, 0])), staked = Object.fromEntries(ROLES.map((r) => [r.key, 0]));
  assert.ok(ITEMS.length >= 16);
  for (const it of ITEMS) {
    assert.ok(it.options.length >= 2 && it.options.length <= 3, it.id);
    assert.ok(['proposal', 'choice', 'crisis'].includes(it.kind));
    for (const o of it.options) { for (const k of Object.keys(o.fx)) assert.ok(['cash', 'orders'].includes(k) || GAUGES[k], it.id + ' has an unknown effect ' + k); for (const k of Object.keys(o.bonus)) { assert.ok(counts[k] !== undefined); staked[k]++; } }
    assert.ok(it.options.filter((o) => Object.values(o.bonus).filter((b) => b > 0).length >= 2).length >= 1, it.id + ' should pay more than one director on at least one option');
    for (const [k, r] of Object.entries(it.reports)) { assert.ok(counts[k] !== undefined); if (r.material) { counts[k]++; assert.ok(it.options.some((o) => Object.keys(GAUGES).some((x) => (o.fx[x] || 0) > 0)), it.id + ': a report can only matter if an option carries risk'); } }
  }
  for (const k of Object.keys(counts)) { assert.ok(counts[k] >= 3, k + ' needs at least three reports that matter, has ' + counts[k]); assert.ok(staked[k] >= 8, k + ' needs bonuses on at least eight options'); }
});

test('400 games played by bots finish with sane numbers', () => {
  const before = B.run.errors.length;
  for (let i = 1; i <= 400; i++) {
    const r = rng(i), g = E.newGame(i), n = 1 + Math.floor(r() * 6);
    for (let k = 0; k < n; k++) E.addPlayer(g, { name: 'B' + k, bot: B.STYLES[Math.floor(r() * B.STYLES.length)] });
    E.start(g);
    let guard = 0;
    while (g.phase !== 'final' && guard++ < 300) { if (E.DECISION.includes(g.phase)) B.run(g, r); else assert.ok(E.advance(g).ok); finite(g.players, 'players'); finite(E.hostView(g), 'host'); finite(E.playerView(g, g.players[0].id), 'player'); }
    assert.equal(g.phase, 'final'); finite(g.final, 'final'); assert.equal(g.final.scores.length, 6);
    for (const s of g.final.scores) assert.equal(s.total, g.final.lost ? 0 : s.share + s.bonus + s.team + s.end + s.integrity - s.penalty);
    JSON.parse(JSON.stringify(g));
    assert.ok(E.report(g).rows.length > 10);
  }
  assert.deepEqual(B.run.errors.slice(before), []);
});

test('rubbish and missing answers never break a game', () => {
  const junk = [undefined, null, {}, [], 'x', 7, { vote: 'maybe' }, { vote: 'C', chip: 'safety' }, { vote: 'A' }, { table: 'yes' }, { chip: 'me' }, { vote: 'A', chip: 'reserve', extra: 1e9 }];
  for (let i = 1; i <= 80; i++) {
    const r = rng(1000 + i), g = board(6, i);
    let guard = 0;
    while (g.phase !== 'final' && guard++ < 400) { if (E.DECISION.includes(g.phase)) { for (const pid of E.pending(g)) assert.equal(typeof E.submit(g, pid, junk[Math.floor(r() * junk.length)]).ok, 'boolean'); E.advance(g); } else E.advance(g); finite(g.players, 'players'); }
    assert.equal(g.phase, 'final');
  }
});

test('a private report is seen only by its director until it is tabled', () => {
  const g = board(6); setItem(g, 'early'); const ce = seat(g, 'CE'), sd = seat(g, 'SD');
  assert.ok(E.playerView(g, ce.id).me.report.material);
  assert.ok(!JSON.stringify(E.hostView(g)).includes('overheated'));
  for (const p of g.players) assert.equal(JSON.stringify(E.playerView(g, p.id)).includes('overheated'), p.id === ce.id);
  assert.equal(E.hostView(g).item.reportsHeld, 2, 'the screen says how many reports matter, not whose');
  for (const p of g.players) E.submit(g, p.id, { table: p.id === sd.id });
  assert.equal(g.phase, 'vote');
  const hv = E.hostView(g); assert.equal(hv.tabledReports.length, 1); assert.equal(hv.tabledReports[0].pid, sd.id); assert.ok(!JSON.stringify(hv).includes('overheated'));
  assert.equal(sd.integrity, 1); assert.equal(ce.integrity, 0);
});

test('everyone sees what an option touches and who has a bonus on it, but not the size of the risk', () => {
  const g = board(6); setItem(g, 'early'); const fd = seat(g, 'FD'), v = E.playerView(g, fd.id), a = v.item.options[0];
  assert.deepEqual(a.touches, ['Safety backlog']); assert.deepEqual(a.stakes.sort(), ['Chief Engineer', 'Finance Director', 'Sales Director']);
  assert.equal(v.me.bonusIf.A, 1); assert.equal(v.me.bonusIf.B, 0);
  assert.ok(!JSON.stringify(v.item).includes('"fx"') && !JSON.stringify(v.item).includes('"bonus"'), 'real effects and bonus sizes stay off the wire');
  assert.ok(v.co.bands.safety && v.history && v.players.every((p) => Number.isFinite(p.provisional)), 'live stats reach every phone');
});

test('most votes wins, the chair settles a tie, and several directors are paid by one decision', () => {
  const g = board(6); setItem(g, 'early');
  for (const p of g.players) E.submit(g, p.id, { table: true });
  const chair = g.players.find((p) => p.role === 0);
  g.players.forEach((p, i) => E.submit(g, p.id, { vote: p.id === chair.id ? 'A' : (g.players.filter((q) => q.id !== chair.id).indexOf(p) < 2 ? 'A' : 'B'), chip: 'safety' }));
  assert.equal(g.phase, 'result'); const r = g.cur.result;
  assert.deepEqual(r.votes, [3, 3]); assert.equal(r.win, 'A'); assert.equal(r.casting, chair.id);
  assert.equal(r.bonuses.length, 3); assert.equal(seat(g, 'SD').bonus, 3); assert.equal(seat(g, 'CE').bonus, 2); assert.equal(seat(g, 'FD').bonus, 1);
  assert.equal(g.co.orders, 16);
});

test('three-way choices are decided by the most votes', () => {
  const g = board(6); setItem(g, 'grant');
  for (const p of g.players) E.submit(g, p.id, { table: false });
  assert.equal(E.submit(g, g.players[0].id, { vote: 'D', chip: 'reserve' }).ok, false);
  g.players.forEach((p, i) => E.submit(g, p.id, { vote: i < 3 ? 'B' : i < 5 ? 'C' : 'A', chip: 'reserve' }));
  assert.equal(g.cur.result.win, 'B'); assert.deepEqual(g.cur.result.votes, [1, 3, 2]);
  assert.equal(seat(g, 'IT').bonus, 2); assert.equal(seat(g, 'SC').bonus, 2);
});

test('hiding a report that matters is always found by the year-end audit', () => {
  const g = board(6); setItem(g, 'early'); const ce = seat(g, 'CE'), sd = seat(g, 'SD');
  for (const p of g.players) E.submit(g, p.id, { table: p.id === sd.id });
  for (const p of g.players) E.submit(g, p.id, { vote: 'A', chip: 'safety' });
  let guard = 0; while (g.phase !== 'final' && guard++ < 100) { if (E.DECISION.includes(g.phase)) { const it = ITEMS[g.agenda[g.year]]; for (const p of g.players) E.submit(g, p.id, g.phase === 'brief' ? { table: true } : { vote: KEYS[it.options.findIndex((o) => !Object.keys(GAUGES).some((x) => (o.fx[x] || 0) > 0))], chip: 'safety' }); } else E.advance(g); }
  assert.equal(ce.penalty, E.R.conceal); assert.equal(sd.penalty, 0);
});

test('the board reviews pay every director the same', () => {
  const g = board(6); let guard = 0, seen = 0;
  while (g.phase !== 'final' && guard++ < 100) { if (E.DECISION.includes(g.phase)) B.run(g); for (const p of g.players) if (E.DECISION.includes(g.phase)) E.forceDefault(g, p.id);
    if (g.phase === 'result') { const rv = g.cur.result.review; if (rv) { seen++; assert.equal(rv.targets.length, 3); assert.equal(rv.points, rv.targets.filter((t) => t.met).length); } E.advance(g); } }
  assert.ok(seen >= 1); assert.equal(new Set(g.players.map((p) => p.team)).size, 1);
});

test('honest boards survive, bonus-hunting boards often do not, and a lone hunter does not come out ahead', () => {
  const s = 'straight', h = 'hunter';
  const honest = S.evaluate([s, s, s, s, s, s], 300, true), greedy = S.evaluate([h, h, h, h, h, h], 300, true), lone = S.evaluate([h, s, s, s, s, s], 400, true);
  assert.ok(honest.lostPct <= 5, 'honest boards lost ' + honest.lostPct + '%');
  assert.ok(greedy.lostPct >= 20, 'bonus-hunting boards lost only ' + greedy.lostPct + '%');
  const avg = (a) => a.total / a.n;
  assert.ok(avg(lone.style.hunter) <= avg(lone.style.straight) + 0.5, 'a lone hunter averaged ' + avg(lone.style.hunter).toFixed(1) + ' against ' + avg(lone.style.straight).toFixed(1));
});
