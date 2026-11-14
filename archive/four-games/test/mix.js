'use strict';
// Fairer balance check: every seat gets a random strategy (repeats allowed), so strategies compete with copies of themselves.
const S = require('./sim'), E = require('../src/engine');
function mix(n, N, pool) {
  pool = pool || ['responsible', 'tech', 'cost', 'balanced'];
  const a = {}; let crisis = 0, tot = 0, ahead = 0, aheadN = 0;
  for (let i = 1; i <= N; i++) {
    const r = S.rng(i * 31 + n), styles = []; for (let k = 0; k < n; k++) styles.push(pool[Math.floor(r() * pool.length)]);
    const g = S.play(styles, i); if (g.final.crisis) crisis++; tot++;
    const best = g.final.scores[0].total, nb = g.final.scores.filter((s) => s.total === best).length;
    for (const s of g.final.scores) { const p = E.player(g, s.pid), x = a[p.bot] || (a[p.bot] = { seats: 0, wins: 0, score: 0, nw: 0, rep: 0 }); x.seats++; x.score += s.total; x.nw += E.netWorth(p); x.rep += s.rep; if (s.total === best) x.wins += 1 / nb; }
    if (styles.includes('cost') && styles.some((s) => s !== 'cost')) { aheadN++; const y2 = g.players.map((p) => [p.bot, p.hist[1].netWorth]).sort((x, y) => y[1] - x[1]); if (y2[0][0] === 'cost') ahead++; }
  }
  const rows = {}; for (const k of Object.keys(a)) rows[k] = { winPerSeat: +(100 * a[k].wins / a[k].seats).toFixed(1), score: +(a[k].score / a[k].seats).toFixed(1), netWorth: +(a[k].nw / a[k].seats).toFixed(1), rep: +(a[k].rep / a[k].seats).toFixed(1) };
  return { n, games: N, fairShare: +(100 / n).toFixed(1), crisisPct: Math.round(100 * crisis / tot), costAheadY2Pct: Math.round(100 * ahead / Math.max(1, aheadN)), rows };
}
module.exports = { mix };
if (require.main === module) {
  const N = +process.argv[2] || 4000;
  for (const n of [3, 4]) { const o = mix(n, N); console.log(`== ${n} players, random strategy per seat, ${N} games | fair share ${o.fairShare}% | crisis ${o.crisisPct}% | a cost leader has top net worth after Y2 in ${o.costAheadY2Pct}% of games with one`);
    for (const [k, r] of Object.entries(o.rows).sort((x, y) => y[1].winPerSeat - x[1].winPerSeat)) console.log(`   ${k.padEnd(12)} wins ${String(r.winPerSeat).padStart(5)}% per seat  score ${r.score}  net worth ${r.netWorth}  rep ${r.rep}`); }
}
