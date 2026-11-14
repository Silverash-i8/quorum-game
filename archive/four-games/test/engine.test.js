'use strict';
const test = require('node:test'), assert = require('node:assert');
const E = require('../src/engine'), B = require('../src/bots'), S = require('./sim'), C = require('../src/content');
const R = E.R;

function game(n, seed) { const g = E.newGame(seed || 1); for (let i = 0; i < n; i++) E.addPlayer(g, { name: 'Co' + i }); E.start(g); return g; }
function toPhase(g, phase) { let k = 0; while (g.phase !== phase && k++ < 50) { if (E.DECISION.includes(g.phase)) { for (const id of E.pending(g)) E.submit(g, id, g.phase === 'dilemma' ? { choice: 'proper' } : g.phase === 'boardroom' ? { actions: [] } : { nordic: 0 }); } else E.advance(g); } assert.equal(g.phase, phase); }

test('lobby: names, limits, colours', () => {
  const g = E.newGame(1);
  assert.equal(E.addPlayer(g, { name: '  ' }).ok, false);
  assert.equal(E.addPlayer(g, { name: 'Volt' }).ok, true);
  assert.equal(E.addPlayer(g, { name: 'volt' }).ok, false, 'duplicate names refused');
  assert.equal(E.start(g).ok, false, 'needs 2 players');
  for (let i = 0; i < 5; i++) assert.equal(E.addPlayer(g, { name: 'P' + i }).ok, true);
  assert.equal(E.addPlayer(g, { name: 'seventh' }).ok, false);
  assert.equal(new Set(g.players.map((p) => p.colour)).size, 6);
  assert.equal(E.start(g).ok, true);
  assert.equal(E.addPlayer(g, { name: 'late' }).ok, false);
});

test('starting position and year one set-up', () => {
  const g = game(4);
  assert.equal(g.phase, 'news'); assert.equal(g.year, 0);
  for (const p of g.players) { assert.equal(p.cash, 12); assert.equal(p.debt, 0); assert.equal(p.lines, 1); assert.equal(p.rep, 5); assert.equal(p.sust, 3); assert.equal(p.cyber, 0); }
  assert.equal(g.decks.market.length, 5); assert.equal(g.decks.risk.length, 12); assert.equal(g.decks.dilemma.length, 5);
  assert.equal(new Set(g.decks.dilemma).size, 5);
});

test('dilemma: proper costs 1, shortcut pays 2 and leaves a skeleton', () => {
  const g = game(3); toPhase(g, 'dilemma');
  E.submit(g, 'p1', { choice: 'shortcut' }); E.submit(g, 'p2', { choice: 'proper' });
  assert.equal(g.phase, 'dilemma'); assert.deepEqual(E.pending(g), ['p3']);
  assert.equal(E.submit(g, 'p3', { choice: 'maybe' }).ok, false);
  E.submit(g, 'p3', { choice: 'proper' });
  assert.equal(g.phase, 'dilemmaReveal');
  assert.equal(E.player(g, 'p1').cash, 14); assert.equal(E.player(g, 'p1').skeletons, 1);
  assert.equal(E.player(g, 'p2').cash, 11); assert.equal(E.player(g, 'p2').skeletons, 0);
  assert.deepEqual(g.cur.reveal.dilemma, { proper: 2, shortcut: 1 });
});

test('boardroom validation', () => {
  const g = game(3); toPhase(g, 'boardroom'); const p = E.player(g, 'p1'); // cash 11
  assert.equal(E.checkBoardroom(p, { actions: [{ id: 'line' }, { id: 'line' }] }).ok, false, 'two lines cost 12');
  assert.equal(E.checkBoardroom(p, { loan: 'take', actions: [{ id: 'line' }, { id: 'line' }] }).ok, true, 'loan first makes it affordable');
  assert.equal(E.checkBoardroom(p, { actions: [{ id: 'qa' }, { id: 'qa' }] }).ok, false);
  assert.equal(E.checkBoardroom(p, { actions: [{ id: 'recyc' }, { id: 'recyc' }] }).ok, false);
  assert.equal(E.checkBoardroom(p, { actions: [{ id: 'mkt' }, { id: 'mkt' }, { id: 'mkt' }] }).ok, false, 'max two actions');
  assert.equal(E.checkBoardroom(p, { loan: 'repay', actions: [] }).ok, false, 'nothing to repay');
  assert.equal(E.checkBoardroom(p, { actions: [{ id: 'nope' }] }).ok, false);
  p.debt = 15; assert.equal(E.checkBoardroom(p, { loan: 'take', actions: [] }).ok, false, 'debt cap'); p.debt = 0;
  const c = E.checkBoardroom(p, { actions: [{ id: 'rd', protect: 'patent' }, { id: 'cyber' }] });
  assert.equal(c.ok, true); assert.equal(c.after.cash, 11 - 3 - 1);
  E.submit(g, 'p1', { actions: [{ id: 'rd', protect: 'patent' }, { id: 'recyc' }] });
  E.submit(g, 'p2', { actions: [{ id: 'rd', protect: 'secret' }] }); E.submit(g, 'p3', { loan: 'take', actions: [{ id: 'line' }] });
  assert.equal(g.phase, 'boardroomReveal');
  assert.equal(p.patents, 1); assert.equal(p.recyc, true); assert.equal(p.sust, 4); assert.equal(p.cash, 11 - 3 - 3);
  const p2 = E.player(g, 'p2'), p3 = E.player(g, 'p3');
  assert.equal(p2.secrets, 1); assert.equal(p2.cash, 9);
  assert.equal(p3.lines, 2); assert.equal(p3.debt, 5); assert.equal(p3.cash, 10);
  assert.deepEqual(g.cur.reveal.boardroom.p2, ['Ran R&D'], 'trade secrets are not announced');
  assert.deepEqual(g.cur.reveal.boardroom.p1, ['Filed a patent', 'Signed a recycling partnership']);
});

test('supply: limits, priority by reputation, recycling partners first, fallback', () => {
  const g = game(4); toPhase(g, 'supply');
  const [a, b, c, d] = g.players;
  for (const p of g.players) { p.lines = 4; p.cash = 40; }
  a.rep = 9; b.rep = 7; c.rep = 3; d.rep = 3; d.recyc = true;
  assert.equal(E.checkSupply(g, a, { nordic: 9 }).ok, false, 'capacity 8');
  assert.equal(E.checkSupply(g, a, { nordic: 1.5 }).ok, false);
  assert.equal(E.checkSupply(g, a, { nordic: -1 }).ok, false);
  c.cash = 3; assert.equal(E.checkSupply(g, c, { nordic: 2 }).ok, false, 'cannot afford'); c.cash = 40;
  g.cur.caps = { nordic: 8, loop: 2 }; g.cur.price.valley = 1; g.cur.price.nordic = 2;
  E.submit(g, a.id, { nordic: 5, loop: 1 });
  E.submit(g, b.id, { nordic: 5, fallback: true });
  E.submit(g, c.id, { nordic: 2, valley: 1, fallback: false });
  E.submit(g, d.id, { loop: 2, fallback: true });
  assert.equal(g.phase, 'supplyReveal');
  const o = g.cur.reveal.supply.orders;
  assert.equal(o[d.id].loop, 2, 'recycling partner served first even on low reputation');
  assert.equal(o[a.id].loop, 0); assert.equal(o[a.id].short, 1);
  assert.equal(o[a.id].nordic, 5); assert.equal(o[b.id].nordic, 3);
  assert.equal(o[b.id].valley, 2); assert.equal(o[b.id].swapped, 2);
  assert.equal(o[c.id].nordic, 0); assert.equal(o[c.id].short, 2); assert.equal(o[c.id].valley, 1);
  assert.equal(g.climate, 3);
  assert.equal(c.led.cells, 1); assert.equal(b.led.cells, 3 * 2 + 2 * 1);
  assert.equal(o[c.id].sust, -1, 'all Valley: sustainability falls'); assert.equal(o[d.id].sust, 1, 'all recycled: sustainability rises');
  assert.equal(o[b.id].sust, 0);
});

test('market shares demand one unit at a time and accounts add up', () => {
  const g = game(3, 7); toPhase(g, 'supply');
  const [a, b, c] = g.players;
  a.patents = 1; a.cyber = 2; b.sust = 6; c.debt = 10;
  for (const p of g.players) { p.lines = 2; p.led.open += 20 - p.cash; p.cash = 20; p.qa = true; p.cyber = Math.max(p.cyber, 2); }
  g.cur.caps = { nordic: 20, loop: 0 };
  E.submit(g, a.id, { nordic: 4 }); E.submit(g, b.id, { nordic: 4 }); E.submit(g, c.id, { valley: 4 });
  g.decks.risk = g.decks.risk.map(() => C.RISK.findIndex((r) => r.id === 'award')); // harmless cards
  E.advance(g); assert.equal(g.phase, 'risk');
  g.cur.demand = { premium: 3, green: 2, budget: 5 }; g.cur.event = 'steady'; g.cur.ratePct = 10;
  E.advance(g); assert.equal(g.phase, 'market');
  const seg = Object.fromEntries(g.cur.reveal.market.segments.map((s) => [s.id, s]));
  assert.deepEqual(seg.premium.sales, [{ pid: a.id, units: 3 }]);
  assert.deepEqual(seg.green.sales, [{ pid: b.id, units: 2 }]);
  const bud = Object.fromEntries(seg.budget.sales.map((s) => [s.pid, s.units]));
  assert.equal(bud[c.id], 2, 'cheapest cells first in each round'); assert.equal(bud[a.id] + bud[b.id] + bud[c.id], 5);
  const h = a.hist[0];
  assert.equal(h.sold.premium, 3); assert.equal(h.sales, 3 * 6 + bud[a.id] * 3.5, 'premium earns 0.5 more at Cyber 2');
  for (const p of g.players) {
    const r = p.hist[0];
    assert.equal(r.sold.premium + r.sold.green + r.sold.budget + r.cleared, r.units - r.lost);
    const close = r.open + r.loanIn - r.loanOut + r.sales + r.clearance + r.other - r.cells - r.running - r.invest - r.capex - r.interest - r.incidents - r.tax;
    assert.equal(close, r.close, 'cash identity');
    assert.equal(r.tax, Math.floor(Math.max(0, r.pbt) / 4));
  }
  assert.equal(c.hist[0].interest, 1, '10% of 10');
});

test('interest rounds up to the next half and rate shock is 15%', () => {
  const g = game(2, 3); toPhase(g, 'risk');
  g.players[0].debt = 5; g.players[1].debt = 15; g.cur.ratePct = 15; g.cur.event = 'rate';
  E.advance(g);
  assert.equal(g.players[0].hist[0].interest, 1); assert.equal(g.players[1].hist[0].interest, 2.5);
});

test('emergency loan when cash runs out', () => {
  const g = game(2, 3); toPhase(g, 'risk');
  const p = g.players[0]; p.cash = -3.5; const rep = p.rep;
  E.advance(g);
  assert.ok(p.cash >= 0); assert.equal(p.debt % 5, 0); assert.ok(p.debt >= 5); assert.equal(p.rep, rep - 1);
  assert.ok(g.cur.reveal.market.emergency.includes(p.id));
});

test('risk cards hit only the unprotected', () => {
  const idx = (id) => C.RISK.findIndex((r) => r.id === id);
  const setup = (cards) => { const g = game(3, 11); toPhase(g, 'supplyReveal'); g.decks.risk = g.decks.risk.map((_, i) => idx(cards[i % 2])); for (const p of g.players) { p.cash = 20; p.skeletons = 0; } return g; };
  let g = setup(['recall', 'ransom']); let [a, b, c] = g.players;
  a.led.cellsBought.valley = 2; b.led.cellsBought.valley = 2; b.qa = true; c.cyber = 1;
  E.advance(g);
  assert.equal(a.cash, 20 - 3 - 2); assert.equal(a.rep, 4); assert.equal(b.cash, 20 - 2); assert.equal(b.rep, 5); assert.equal(c.cash, 20);
  g = setup(['breach', 'iprace']); [a, b, c] = g.players;
  a.cyber = 1; a.secrets = 2; b.cyber = 2; b.secrets = 1; c.cyber = 1; c.secrets = 0;
  E.advance(g);
  assert.equal(a.secrets, 0); assert.equal(a.patents, 0); assert.equal(a.cash, 18); assert.equal(a.rep, 4);
  assert.equal(b.secrets, 0); assert.equal(b.patents, 1); assert.equal(b.cash, 19); assert.equal(b.rep, 5);
  assert.equal(c.cash, 20); assert.equal(c.rep, 5);
  g = setup(['strike', 'ban']); [a, b, c] = g.players;
  a.led.cellsBought = { valley: 0, nordic: 3, loop: 0 }; a.led.units = 3;
  b.led.cellsBought = { valley: 4, nordic: 0, loop: 0 }; b.led.units = 4;
  c.led.cellsBought = { valley: 2, nordic: 2, loop: 0 }; c.led.units = 4;
  E.advance(g);
  assert.equal(a.led.units, 1); assert.equal(b.led.units, 2); assert.equal(c.led.units, 4, 'dual sourcing is safe');
  g = setup(['award', 'award']); [a, b, c] = g.players; a.qa = true; a.rep = 6; b.qa = true; b.rep = 4;
  E.advance(g);
  assert.equal(a.rep, 8); assert.equal(b.rep, 4); assert.equal(c.rep, 5);
});

test('final scoring: formula, halving, crisis and biggest polluter', () => {
  const g = game(3, 5); g.year = 4; toPhase(g, 'market');
  const [a, b, c] = g.players;
  Object.assign(a, { cash: 20, debt: 5, lines: 2, rep: 8, sust: 6, patents: 2, secrets: 1, skeletons: 0, valleyTotal: 0 });
  Object.assign(b, { cash: 30, debt: 0, lines: 3, rep: 0, sust: 0, patents: 0, secrets: 0, skeletons: 0, valleyTotal: 12 });
  Object.assign(c, { cash: 10, debt: 0, lines: 1, rep: 5, sust: 3, patents: 0, secrets: 0, skeletons: 0, valleyTotal: 4 });
  g.climate = 30;
  E.advance(g); assert.equal(g.phase, 'final');
  const sc = Object.fromEntries(g.final.scores.map((s) => [s.pid, s]));
  assert.equal(sc[a.id].total, (20 - 5 + 6) + 8 + 6 + 5 - 5);
  assert.equal(sc[b.id].total, ((30 + 9) + 0 + 0 + 0 - 10) / 2); assert.equal(sc[b.id].halved, true);
  assert.equal(sc[c.id].total, (10 + 3) + 5 + 3 - 5);
  assert.deepEqual(g.final.polluters, [b.id]); assert.equal(g.final.winner, a.id);
});

test('views keep private information private', () => {
  const g = S.play(['cost', 'tech', 'responsible'], 9, null); // finished game for shape
  const g2 = game(3, 2); toPhase(g2, 'boardroom');
  g2.players[0].secrets = 2; g2.players[0].skeletons = 1;
  const hv = JSON.stringify(E.hostView(g2));
  for (const k of ['"cash"', '"secrets"', '"skeletons"', '"debt"', '"hist"']) assert.ok(!hv.includes(k), 'host view leaks ' + k);
  const pv = E.playerView(g2, 'p2');
  assert.equal(pv.me.id, 'p2'); assert.ok('cash' in pv.me);
  const others = JSON.stringify(pv.players);
  for (const k of ['"cash"', '"secrets"', '"skeletons"']) assert.ok(!others.includes(k));
  E.submit(g2, 'p1', { actions: [{ id: 'mkt' }] });
  assert.equal(E.playerView(g2, 'p2').players[0].done, true);
  assert.equal(E.playerView(g2, 'p2').me.sub, null, 'cannot see what another company chose');
  assert.ok(g.final.scores.length === 3);
});

test('same seed and same choices give the same game', () => {
  const a = S.play(['cost', 'tech', 'responsible', 'balanced'], 42), b = S.play(['cost', 'tech', 'responsible', 'balanced'], 42);
  assert.deepEqual(a.final, b.final);
});

test('fuzz: 600 random games keep every invariant', () => {
  for (let i = 1; i <= 600; i++) {
    const n = 2 + (i % 5), styles = []; for (let k = 0; k < n; k++) styles.push(i % 3 === 0 ? B.STYLES[(i + k) % 4] : 'random');
    let lastYear = -1;
    const g = S.play(styles, i, (g) => {
      for (const p of g.players) {
        for (const k of ['cash', 'debt', 'rep', 'sust', 'cyber', 'lines', 'patents', 'secrets', 'skeletons']) assert.ok(Number.isFinite(p[k]), k + ' not finite');
        assert.ok(p.rep >= 0 && p.rep <= 10 && p.sust >= 0 && p.sust <= 10 && p.cyber >= 0 && p.cyber <= 3 && p.lines >= 1 && p.lines <= 4);
        assert.ok(p.debt >= 0 && p.debt % 5 === 0); assert.ok(p.secrets >= 0 && p.patents >= 0 && p.skeletons >= 0);
        assert.equal((p.cash * 2) % 1, 0, 'cash is in half-millions');
      }
      if (g.phase === 'supplyReveal') {
        const o = Object.values(g.cur.reveal.supply.orders);
        assert.ok(o.reduce((s, x) => s + x.nordic, 0) <= g.cur.caps.nordic); assert.ok(o.reduce((s, x) => s + x.loop, 0) <= g.cur.caps.loop);
      }
      if (g.phase === 'market' && g.year !== lastYear) {
        lastYear = g.year;
        for (const s of g.cur.reveal.market.segments) assert.ok(s.sales.reduce((x, y) => x + y.units, 0) + s.unmet === s.demand);
        for (const p of g.players) {
          const r = p.hist[p.hist.length - 1];
          const close = r.open + r.loanIn - r.loanOut + r.sales + r.clearance + r.other - r.cells - r.running - r.invest - r.capex - r.interest - r.incidents - r.tax;
          assert.equal(close, r.close, 'cash identity, seed ' + i);
          assert.ok(r.close >= 0, 'never ends a year below zero');
          assert.equal(r.sold.premium + r.sold.green + r.sold.budget + r.cleared, r.units - r.lost);
        }
      }
    });
    assert.equal(g.phase, 'final');
    for (const p of g.players) assert.equal(p.hist.length, 5);
    const t = g.final.scores.map((s) => s.total); assert.deepEqual(t, t.slice().sort((x, y) => y - x));
  }
});

test('an exposed Skeleton costs what the rules say, in the press investigation and at the audit', () => {
  const g = game(3, 21); toPhase(g, 'supplyReveal');
  const p = g.players[0]; const award = C.RISK.findIndex((c) => c.id === 'award'); g.decks.risk = g.decks.risk.map(() => award); // a card that touches nobody here
  for (const q of g.players) { q.skeletons = 0; q.cash = 100; q.rep = 10; }
  p.skeletons = 40; const before = p.cash;
  E.advance(g);
  assert.equal(g.phase, 'risk');
  const e = g.cur.reveal.risk.exposed.find((x) => x.pid === p.id);
  assert.ok(e && e.n > 0 && e.n < 40, 'some but not all of 40 Skeletons should be exposed');
  assert.equal(e.cash, e.n * E.R.skeleton.cash); assert.equal(e.rep, e.n * E.R.skeleton.rep);
  assert.equal(p.skeletons, 40 - e.n); assert.equal(before - p.cash, e.cash); assert.equal(p.rep, Math.max(0, 10 - e.rep));
  // Roughly yearOn in 6 are exposed.
  assert.ok(Math.abs(e.n / 40 - E.R.skeleton.yearOn / 6) < 0.25);
});

test('the card and instruction text match the Skeleton rules', () => {
  const words = (n) => (n <= 1 ? '1' : n === 2 ? '1 or 2' : Array.from({ length: n - 1 }, (_, i) => i + 1).join(', ') + ' or ' + n);
  const whistle = C.RISK.find((c) => c.id === 'whistle');
  assert.ok(whistle.text.includes('exposed on a ' + words(E.R.skeleton.whistleOn) + '.'), whistle.text);
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'instructions.html'), 'utf8');
  assert.ok(html.includes('On a ' + words(E.R.skeleton.yearOn) + ' it is exposed: you pay ' + E.money(E.R.skeleton.cash) + ' and lose ' + E.R.skeleton.rep + ' Reputation.'), 'instructions are out of date: run node scripts/build-docs.js');
  assert.ok(html.includes('Rules version ' + E.R.version), 'instructions are out of date: run node scripts/build-docs.js');
});

test('shortcuts do not pay: for every strategy, never taking one beats taking one often', () => {
  const T = require('./ethics');
  for (const r of T.table(150, ['proper', 'half', 'always'])) {
    const c = r.cells, tag = r.players + 'p ' + r.style + ' ' + JSON.stringify(c);
    assert.ok(c.proper.score >= c.always.score + 5, 'always taking the shortcut should lose clearly: ' + tag);
    assert.ok(c.proper.score >= c.half.score + 1, 'taking the shortcut half the time should lose: ' + tag);
  }
});
