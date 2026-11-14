'use strict';
// Balance simulation: plays full games with the real engine and the scripted bots.
const E = require('../src/engine'), B = require('../src/bots');
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function play(styles, seed, hook) {
  const r = rng(seed * 7919 + 13), g = E.newGame(seed);
  const order = styles.slice(); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  order.forEach((s, i) => E.addPlayer(g, { name: s + i, bot: s }));
  E.start(g);
  let guard = 0;
  while (g.phase !== 'final' && guard++ < 500) {
    if (E.DECISION.includes(g.phase)) B.run(g, r); else E.advance(g);
    if (hook) hook(g);
  }
  return g;
}
function evaluate(tag, styles, N) {
  const agg = {}, wins = {}; let crisis = 0, lead = 0, clim = 0;
  for (let i = 0; i < N; i++) {
    const g = play(styles, i + 1);
    const best = g.final.scores[0].total; clim += g.climate; if (g.final.crisis) crisis++;
    const y2 = {};
    for (const s of g.final.scores) {
      const p = E.player(g, s.pid), a = agg[p.bot] || (agg[p.bot] = { n: 0, cash: 0, debt: 0, rep: 0, sust: 0, score: 0 });
      a.n++; a.cash += s.cash; a.debt += s.debt; a.rep += s.rep; a.sust += s.sust; a.score += s.total;
      if (s.total === best) wins[p.bot] = (wins[p.bot] || 0) + 1 / styles.filter((x) => x === p.bot).length;
      y2[p.bot] = Math.max(y2[p.bot] === undefined ? -99 : y2[p.bot], p.hist[1].netWorth);
      a.nw = (a.nw || 0) + E.netWorth(p);
    }
    if (Object.keys(y2).sort((a, b) => y2[b] - y2[a])[0] === 'cost') lead++;
  }
  const out = { tag, climate: +(clim / N).toFixed(1), crisisPct: Math.round(100 * crisis / N), costRichestY2Pct: Math.round(100 * lead / N), rows: {} };
  for (const k of Object.keys(agg)) { const a = agg[k]; out.rows[k] = { winPct: +(100 * (wins[k] || 0) / N).toFixed(1), cash: +(a.cash / a.n).toFixed(1), debt: +(a.debt / a.n).toFixed(1), rep: +(a.rep / a.n).toFixed(1), sust: +(a.sust / a.n).toFixed(1), score: +(a.score / a.n).toFixed(1), nw: +(a.nw / a.n).toFixed(1) }; }
  return out;
}
function show(o) {
  console.log(`== ${o.tag} | climate ${o.climate}, crisis ${o.crisisPct}%, cost-leader highest net worth after Y2 ${o.costRichestY2Pct}%`);
  for (const [k, r] of Object.entries(o.rows).sort((a, b) => b[1].winPct - a[1].winPct)) console.log(`   ${k.padEnd(12)} win ${String(r.winPct).padStart(5)}%  cash ${r.cash}  debt ${r.debt}  rep ${r.rep}  sust ${r.sust}  net worth ${r.nw}  score ${r.score}`);
}
module.exports = { play, evaluate, show, rng };
if (require.main === module) {
  const N = +process.argv[2] || 3000;
  show(evaluate('4 players', ['cost', 'responsible', 'tech', 'balanced'], N));
  show(evaluate('3 players', ['cost', 'responsible', 'tech'], N));
  show(evaluate('4 players, two cost leaders', ['cost', 'cost', 'responsible', 'tech'], N));
}
