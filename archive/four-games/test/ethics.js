'use strict';
// Do shortcuts pay? One seat plays a fixed strategy and a fixed dilemma policy against the other practice bots.
// Run: node test/ethics.js 800     (games per cell; the table is the evidence that doing it properly wins)
const E = require('../src/engine'), B = require('../src/bots'), S = require('./sim');
const POLICIES = {
  proper: () => false,              // never takes the shortcut
  early: (y) => y === 0,            // only in the first year
  first2: (y) => y <= 1,            // first two years
  last: (y) => y === 4,             // only in the last year
  late: (y) => y >= 3,              // last two years
  half: (y, r) => r() < 0.5,        // a coin flip each year
  always: () => true,               // every year
};
function play(opponents, focalStyle, policy, seed) {
  const r = S.rng(seed * 7919 + 13), g = E.newGame(seed);
  const seats = opponents.map((s) => ({ s, focal: false })).concat([{ s: focalStyle, focal: true }]);
  for (let i = seats.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [seats[i], seats[j]] = [seats[j], seats[i]]; }
  let focal = null;
  seats.forEach((o, i) => { E.addPlayer(g, { name: o.s + i, bot: o.s === 'cost' && o.focal ? 'costclean' : o.s }); if (o.focal) focal = g.players[g.players.length - 1]; });
  E.start(g);
  let guard = 0;
  while (g.phase !== 'final' && guard++ < 500) {
    if (E.DECISION.includes(g.phase)) {
      if (g.phase === 'dilemma' && !g.cur.subs[focal.id]) E.submit(g, focal.id, { choice: POLICIES[policy](g.year, r) ? 'shortcut' : 'proper' });
      B.run(g, r);
    } else E.advance(g);
  }
  const mine = g.final.scores.find((x) => x.pid === focal.id);
  return { score: mine.total, win: mine.total === g.final.scores[0].total ? 1 : 0 };
}
function table(N, policies) {
  const out = [];
  for (const all of [['responsible', 'tech', 'cost', 'balanced'], ['responsible', 'tech', 'cost']]) {
    for (const s of all) {
      const row = { players: all.length, style: s, cells: {} };
      for (const pol of policies || Object.keys(POLICIES)) {
        let sc = 0, w = 0;
        for (let i = 1; i <= N; i++) { const o = play(all.filter((x) => x !== s), s, pol, i); sc += o.score; w += o.win; }
        row.cells[pol] = { score: +(sc / N).toFixed(1), winPct: Math.round(100 * w / N) };
      }
      out.push(row);
    }
  }
  return out;
}
module.exports = { table, play, POLICIES };
if (require.main === module) {
  const N = +process.argv[2] || 800;
  console.log('Average Enterprise Score (and win %) for one seat, by how often it takes the dilemma shortcut. ' + N + ' games per cell, rules ' + E.R.version + '.');
  for (const r of table(N)) console.log(r.players + 'p ' + r.style.padEnd(12) + Object.entries(r.cells).map(([k, c]) => k + ' ' + c.score + ' (' + c.winPct + '%)').join('  |  '));
}
