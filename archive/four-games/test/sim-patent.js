'use strict';
// Balance check for PATENT PENDING. Run: node test/sim-patent.js 500
const { E, B } = require('../src/games/patent');
const base = require('./sim');
function play(styles, seed) { const r = base.rng(seed * 31 + 7), g = E.newGame(seed); styles.forEach((s, i) => E.addPlayer(g, { name: s + i, bot: s })); E.start(g); let k = 0; while (g.phase !== 'final' && k++ < 200) { if (E.DECISION.includes(g.phase)) B.run(g, r); else E.advance(g); } return g; }
function evaluate(styles, N) {
  const by = {};
  for (let i = 1; i <= N; i++) { const g = play(styles, i), f = g.final;
    for (const s of f.scores) { const p = E.player(g, s.pid), a = by[p.bot] || (by[p.bot] = { n: 0, total: 0, assets: 0, rep: 0, liab: 0, pat: 0, win: 0 }); a.n++; a.total += s.total; a.assets += s.assets; a.rep += s.rep; a.liab += s.liab; a.pat += s.patents; if (f.winner === s.pid) a.win += 1; } }
  console.log('== ' + styles.join(', '));
  for (const [k, a] of Object.entries(by)) console.log('   ' + k.padEnd(10) + ' valuation ' + (a.total / a.n).toFixed(1) + '  assets ' + (a.assets / a.n).toFixed(1) + '  rep ' + (a.rep / a.n).toFixed(1) + '  liabilities ' + (a.liab / a.n).toFixed(1) + '  patents ' + (a.pat / a.n).toFixed(1) + '  wins ' + Math.round(100 * a.win / N) + '% of games (' + styles.filter((x) => x === k).length + ' seat' + (styles.filter((x) => x === k).length > 1 ? 's' : '') + ')');
}
module.exports = { play, evaluate };
if (require.main === module) { const N = +process.argv[2] || 500; const b = 'builder', l = 'landlord', p = 'pirate';
  evaluate([b, b, b, b], N); evaluate([b, l, p], N); evaluate([b, l, p, b], N); evaluate([p, p, b, l], N); evaluate([b, b, p], N); evaluate([l, l, b, p], N); console.log('bot errors', B.run.errors.length, B.run.errors.slice(0, 3)); }
