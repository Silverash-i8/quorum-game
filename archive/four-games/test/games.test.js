'use strict';
// Tests for the three smaller games: full games with bots, random valid and invalid moves, and what each screen is allowed to see.
const test = require('node:test'), assert = require('node:assert');
const GAMES = { chain: require('../src/games/chain'), quorum: require('../src/games/quorum'), patent: require('../src/games/patent') };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const finite = (o, path) => { for (const [k, v] of Object.entries(o)) { if (typeof v === 'number') assert.ok(Number.isFinite(v), path + '.' + k + ' is not a number'); else if (v && typeof v === 'object') finite(v, path + '.' + k); } };

for (const [id, G] of Object.entries(GAMES)) {
  const { E, B } = G;
  test(id + ': lobby rules and automatic bot seats', () => {
    const g = E.newGame(1);
    assert.equal(E.start(g).ok, false);
    assert.equal(E.addPlayer(g, { name: '' }).ok, false);
    assert.equal(E.addPlayer(g, { name: 'Ada' }).ok, true);
    assert.equal(E.addPlayer(g, { name: 'ada' }).ok, false);
    assert.equal(E.start(g).ok, true);
    assert.ok(g.players.length >= 3 && g.players.length <= 4);
    assert.equal(g.players.filter((p) => !p.bot).length, 1);
    assert.equal(E.addPlayer(g, { name: 'Late' }).ok, false);
    assert.ok(E.DECISION.includes(g.phase));
  });
  test(id + ': 300 games played by bots finish with sane numbers', () => {
    const before = B.run.errors.length;
    for (let i = 1; i <= 300; i++) {
      const r = rng(i), g = E.newGame(i), n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) E.addPlayer(g, { name: 'B' + k, bot: B.STYLES[Math.floor(r() * B.STYLES.length)] });
      E.start(g);
      let guard = 0;
      while (g.phase !== 'final' && guard++ < 300) { if (E.DECISION.includes(g.phase)) B.run(g, r); else assert.ok(E.advance(g).ok); finite(g.players, 'players'); }
      assert.equal(g.phase, 'final', 'game ' + i + ' did not finish');
      finite(g.final, 'final'); assert.equal(g.final.scores.length, g.players.length);
      JSON.parse(JSON.stringify(g)); // state must survive being saved to disk
      const rep = E.report(g); assert.ok(rep.cols.length > 5 && rep.rows.length > 5);
    }
    assert.deepEqual(B.run.errors.slice(before), []);
  });
  test(id + ': rubbish and missing answers never break a game', () => {
    const junk = [undefined, null, {}, [], 'x', 7, { order: -3 }, { order: 1e9 }, { vote: 'maybe' }, { bids: { L0: -5 } }, { bids: { L0: 2.5 } }, { bids: 'all' }, { royalty: { M: 99 } }, { use: { M: 'steal' } }, { table: 'yes' }, { chip: 'me' }];
    for (let i = 1; i <= 60; i++) {
      const r = rng(1000 + i), g = E.newGame(i);
      for (let k = 0; k < 4; k++) E.addPlayer(g, { name: 'P' + k });
      E.start(g);
      let guard = 0;
      while (g.phase !== 'final' && guard++ < 400) {
        if (E.DECISION.includes(g.phase)) { for (const pid of E.pending(g)) { const x = E.submit(g, pid, junk[Math.floor(r() * junk.length)]); assert.equal(typeof x.ok, 'boolean'); } E.advance(g); } // the timer closes the round with defaults
        else E.advance(g);
        finite(g.players, 'players');
      }
      assert.equal(g.phase, 'final');
    }
    assert.equal(E.submit(E.newGame(1), 'p1', {}).ok, false);
  });
}

test('chain: the host screen never shows stock or cash, and a player sees only their own', () => {
  const { E, B } = GAMES.chain, g = E.newGame(5); E.addPlayer(g, { name: 'Human' }); E.start(g); B.run(g);
  E.submit(g, 'p1', { order: 6, freight: 'air', pay: 'late', action: 'audit' }); assert.equal(g.phase, 'week');
  const hv = JSON.stringify(E.hostView(g)); for (const k of ['"stock"', '"cash"', '"owed"', '"hist"']) assert.ok(!hv.includes(k), 'host view leaks ' + k);
  const pv = E.playerView(g, 'p1'); assert.equal(pv.me.stock, g.players[0].stock); assert.ok(!JSON.stringify(pv.players).includes('"stock"'));
  assert.equal(pv.me.audited, true); assert.equal(pv.me.hist.length, 1);
});
test('chain: goods ordered by sea arrive two weeks later, by air one week later', () => {
  const { E } = GAMES.chain;
  for (const [freight, lead] of [['sea', 2], ['air', 1]]) {
    const g = E.newGame(9); for (let k = 0; k < 4; k++) E.addPlayer(g, { name: 'P' + k }); E.start(g);
    for (const p of g.players) E.submit(g, p.id, { order: p.role === 0 ? 5 : 0, freight, pay: 'ontime', action: 'none' });
    const mine = g.ship.filter((x) => x.to === 0 && x.qty === 5); assert.equal(mine.length, 1); assert.equal(mine[0].eta, lead);
    assert.equal(g.carbon, freight === 'air' ? 5 : 0);
  }
});
test('quorum: reports are private until tabled, and hiding a material report is punished at the audit', () => {
  const { E, ITEMS } = GAMES.quorum, g = E.newGame(3); for (let k = 0; k < 4; k++) E.addPlayer(g, { name: 'D' + k }); E.start(g);
  g.agenda[0] = ITEMS.findIndex((x) => x.id === 'early'); // the Chief Engineer (seat 1) holds the material report
  const ce = g.players.find((p) => p.role === 1);
  assert.ok(E.playerView(g, ce.id).me.report.material); assert.ok(!JSON.stringify(E.hostView(g)).includes('overheated'));
  for (const p of g.players) assert.equal(JSON.stringify(E.playerView(g, p.id)).includes('overheated'), p.id === ce.id);
  for (const p of g.players) E.submit(g, p.id, { table: false });
  assert.equal(g.phase, 'vote'); assert.equal(E.hostView(g).tabledReports.length, 0);
  for (const p of g.players) E.submit(g, p.id, { vote: 'approve', chip: 'reserve' });
  assert.equal(g.cur.result.opt, 'approve'); assert.equal(ce.bonus, 3);
  let guard = 0; while (g.phase !== 'final' && guard++ < 100) { if (E.DECISION.includes(g.phase)) { for (const p of g.players) E.submit(g, p.id, g.phase === 'brief' ? { table: true } : { vote: 'reject', chip: 'safety' }); } else E.advance(g); }
  assert.ok(ce.penalty >= E.R.conceal, 'the concealed report must cost the Chief Engineer');
});
test('patent: sealed bids, licences and hidden liabilities', () => {
  const { E } = GAMES.patent, g = E.newGame(4); for (let k = 0; k < 3; k++) E.addPlayer(g, { name: 'S' + k }); E.start(g);
  const [a, b, c] = g.players;
  assert.equal(E.submit(g, a.id, { bids: { L0: 2 } }).ok, false, 'below the lowest bid');
  assert.equal(E.submit(g, a.id, { bids: { L0: 30 } }).ok, false, 'more than cash');
  E.submit(g, a.id, { bids: { L0: 8 } }); E.submit(g, b.id, { bids: { L0: 5 } });
  assert.ok(!JSON.stringify(E.playerView(g, c.id)).includes('"bids"') || !JSON.stringify(E.playerView(g, c.id).players).includes('bids'), 'bids stay sealed');
  E.submit(g, c.id, { bids: {} });
  assert.equal(g.phase, 'price'); assert.deepEqual(a.patents, ['M']); assert.equal(a.cash, 12); assert.equal(b.cash, 20);
  E.submit(g, a.id, { royalty: { M: 1 } }); assert.equal(g.phase, 'deal');
  E.submit(g, b.id, { use: { M: 'license' } }); E.submit(g, c.id, { use: { M: 'infringe' } });
  assert.equal(g.phase, 'market');
  assert.equal(a.royaltyIn, 3); assert.equal(c.infringed.length + (g.cur.market.event.id === 'claim' ? 1 : 0), 1);
  assert.ok(!JSON.stringify(E.hostView(g)).includes('infringed'), 'the big screen does not say who copied');
});
