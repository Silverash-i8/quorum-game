'use strict';
// Balance check for CHAIN REACTION. Run: node test/sim-chain.js 500
const { E, B, ROLES } = require('../src/games/chain');
function play(styles, seed) { const g = E.newGame(seed); styles.forEach((s, i) => E.addPlayer(g, { name: s + i, bot: s })); E.start(g); let k = 0; while (g.phase !== 'final' && k++ < 200) { if (E.DECISION.includes(g.phase)) B.run(g); else E.advance(g); } return g; }
function evaluate(styles, N) {
  let ok = 0, svc = 0, carbon = 0; const by = {};
  for (let i = 1; i <= N; i++) { const g = play(styles, i), f = g.final; ok += f.ok ? 1 : 0; svc += f.service; carbon += f.carbon;
    for (const s of f.scores) { const p = E.player(g, s.pid), k = ROLES[p.role] + ' (' + p.bot + ')', a = by[k] || (by[k] = { n: 0, total: 0, profit: 0, trust: 0, win: 0 }); a.n++; a.total += s.total; a.profit += s.profit; a.trust += s.trust; if (f.winner === s.pid) a.win++; } }
  console.log('== ' + styles.join(', ') + ' | contract kept ' + Math.round(100 * ok / N) + '% | service ' + Math.round(100 * svc / N) + '% | carbon ' + (carbon / N).toFixed(1));
  for (const [k, a] of Object.entries(by)) console.log('   ' + k.padEnd(28) + ' score ' + (a.total / a.n).toFixed(1) + '  profit ' + (a.profit / a.n).toFixed(1) + '  trust ' + (a.trust / a.n).toFixed(1) + '  wins ' + Math.round(100 * a.win / N) + '%');
}
module.exports = { play, evaluate };
if (require.main === module) { const N = +process.argv[2] || 500;
  evaluate(['steady', 'steady', 'steady', 'steady'], N); evaluate(['panic', 'panic', 'panic', 'panic'], N); evaluate(['steady', 'panic', 'steady', 'panic'], N);
  evaluate(['squeezer', 'steady', 'steady', 'steady'], N); evaluate(['steady', 'squeezer', 'steady', 'steady'], N); evaluate(['steady', 'steady', 'squeezer', 'steady'], N); console.log('bot errors', B.run.errors.length, B.run.errors.slice(0, 3)); }
