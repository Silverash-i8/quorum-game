'use strict';
// Balance check for QUORUM. Run: node test/sim-quorum.js 500
const { E, B, ROLES } = require('../src/games/quorum');
function play(styles, seed) { const g = E.newGame(seed); styles.forEach((s, i) => E.addPlayer(g, { name: s + i, bot: s })); E.start(g); let k = 0; while (g.phase !== 'final' && k++ < 200) { if (E.DECISION.includes(g.phase)) B.run(g); else E.advance(g); } return g; }
function evaluate(styles, N) {
  let lost = 0, inc = 0, cash = 0; const by = {};
  for (let i = 1; i <= N; i++) { const g = play(styles, i), f = g.final; lost += f.lost ? 1 : 0; inc += f.incidents; cash += f.cash;
    for (const s of f.scores) { const p = E.player(g, s.pid), k = ROLES[p.role].key + ' (' + p.bot + ')', a = by[k] || (by[k] = { n: 0, total: 0, bonus: 0, integ: 0, pen: 0, win: 0 }); a.n++; a.total += s.total; a.bonus += s.bonus + s.end; a.integ += s.integrity; a.pen += s.penalty; if (f.winner === s.pid) a.win++; } }
  console.log('== ' + styles.join(', ') + ' | company lost ' + Math.round(100 * lost / N) + '% | incidents ' + (inc / N).toFixed(2) + ' | closing cash ' + (cash / N).toFixed(1));
  for (const [k, a] of Object.entries(by)) console.log('   ' + k.padEnd(16) + ' score ' + (a.total / a.n).toFixed(1) + '  bonus ' + (a.bonus / a.n).toFixed(1) + '  integrity ' + (a.integ / a.n).toFixed(1) + '  penalties ' + (a.pen / a.n).toFixed(1) + '  wins ' + Math.round(100 * a.win / N) + '%');
}
module.exports = { play, evaluate };
if (require.main === module) { const N = +process.argv[2] || 500; const s = 'straight', h = 'hunter';
  evaluate([s, s, s, s], N); evaluate([h, h, h, h], N); evaluate([h, s, s, s], N); evaluate([s, h, s, s], N); evaluate([s, s, h, s], N); evaluate([s, s, s, h], N); evaluate([h, h, s, s], N); console.log('bot errors', B.run.errors.length, B.run.errors.slice(0, 3)); }
