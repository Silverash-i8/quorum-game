'use strict';
// Scripted companies. Used to fill empty seats, for solo practice and for the balance simulation.
const E = require('./engine');

const PLANS = {
  responsible: [['qa', 'sust'], ['recyc', 'line'], ['sust', 'cyber'], ['line', 'mkt'], ['mkt', 'sust']],
  tech: [['rd', 'cyber'], ['rd', 'line'], ['cyber', 'qa'], ['line', 'rd'], ['mkt', 'rd']],
  cost: [['line', 'qa'], ['rds', 'line'], ['rds', 'cyber'], ['cyber', 'mkt'], ['mkt', 'mkt']],
  balanced: [['qa', 'rds'], ['line', 'sust'], ['cyber', 'sust'], ['line', 'cyber'], ['mkt', 'mkt']],
};
// Simulation-only checks: the same plans with a fixed dilemma policy.
// hypocrite and opportunist always take the shortcut; costclean is the cost leader without any shortcuts.
const ALIAS = { hypocrite: 'responsible', opportunist: 'tech', costclean: 'cost' };
const style = (p) => ALIAS[p.bot] || p.bot;
for (const k of Object.keys(ALIAS)) PLANS[k] = PLANS[ALIAS[k]];
const NAMES = { responsible: 'GreenCell', tech: 'IonForge', cost: 'CheapVolt', balanced: 'AmpWorks' };
const STYLES = ['responsible', 'tech', 'cost', 'balanced'];

function act(id) { return id === 'rd' ? { id, protect: 'patent' } : id === 'rds' ? { id: 'rd', protect: 'secret' } : { id }; }

function boardroom(g, p, rand) {
  if (p.bot === 'random') {
    const ids = ['line', 'rd', 'qa', 'cyber', 'sust', 'recyc', 'mkt'];
    for (let tries = 0; tries < 20; tries++) {
      const n = Math.floor(rand() * 3), actions = [];
      for (let i = 0; i < n; i++) { const id = ids[Math.floor(rand() * ids.length)]; actions.push(id === 'rd' ? { id, protect: rand() < 0.5 ? 'patent' : 'secret' } : { id }); }
      const loan = rand() < 0.2 ? 'take' : rand() < 0.1 ? 'repay' : null;
      if (E.checkBoardroom(p, { loan, actions }).ok) return { loan, actions };
    }
    return { loan: null, actions: [] };
  }
  const plan = PLANS[p.bot][g.year] || [];
  const planCost = plan.reduce((s, id) => s + (id === 'line' ? E.R.lineCost : id === 'rd' ? E.R.cost.rd + E.R.cost.patent : id === 'rds' ? E.R.cost.rd : E.R.cost[id]), 0);
  // Keep enough cash back to buy this year's cells: a company that cannot produce cannot earn.
  const unit = style(p) === 'cost' ? g.cur.price.valley : g.cur.price.nordic;
  const reserve = (lines) => Math.min(lines * E.R.lineCap, share(g)) * unit;
  let loan = null;
  const canBorrow = p.debt + E.R.loan <= E.R.maxDebt;
  if (plan.includes('line') && p.lines < E.R.maxLines && p.cash - planCost < reserve(p.lines) && canBorrow && p.debt === 0) loan = 'take';
  else if (p.cash < reserve(p.lines) && canBorrow && p.debt < 10) loan = 'take';
  else if (p.debt >= E.R.loan && p.cash - planCost >= E.R.loan + reserve(p.lines) + 2) loan = 'repay';
  const actions = [];
  for (const id of plan) {
    for (const cand of [id, 'mkt', 'cyber']) {
      const chk = E.checkBoardroom(p, { loan, actions: actions.concat([act(cand)]) });
      if (chk.ok && chk.after.cash >= reserve(p.lines)) { actions.push(act(cand)); break; }
    }
  }
  return { loan, actions };
}

function share(g) { const d = g.cur.demand; return Math.ceil((d.premium + d.green + d.budget) / g.players.length) + 2; }

function supply(g, p, rand) {
  const caps = g.cur.caps;
  let need = Math.min(E.capacity(p), share(g));
  for (; need >= 0; need--) {
    let sub;
    if (p.bot === 'random') {
      const v = Math.floor(rand() * (need + 1)), l = Math.floor(rand() * (need - v + 1));
      sub = { valley: v, loop: l, nordic: need - v - l, fallback: rand() < 0.5 };
    } else if (style(p) === 'cost') sub = { valley: need, nordic: 0, loop: 0, fallback: false };
    else if (style(p) === 'tech') sub = { valley: 0, nordic: need, loop: 0, fallback: true };
    else if (p.bot === 'balanced') { const nd = Math.min(need, Math.floor(caps.nordic / g.players.length)); sub = { valley: need - nd, nordic: nd, loop: 0, fallback: true }; }
    else { const l = Math.min(need, caps.loop); sub = { valley: 0, loop: l, nordic: need - l, fallback: false }; }
    if (E.checkSupply(g, p, sub).ok) return sub;
  }
  return { valley: 0, nordic: 0, loop: 0, fallback: false };
}

function decide(g, p, rand) {
  rand = rand || Math.random;
  if (g.phase === 'dilemma') {
    if (p.bot === 'random') return { choice: rand() < 0.5 ? 'shortcut' : 'proper' };
    // The cost leader is the corner-cutter of the four practice bots: it takes the shortcut half the time.
    return { choice: ['hypocrite', 'opportunist'].includes(p.bot) || (p.bot === 'cost' && rand() < 0.5) ? 'shortcut' : 'proper' };
  }
  if (g.phase === 'boardroom') return boardroom(g, p, rand);
  if (g.phase === 'supply') return supply(g, p, rand);
  return null;
}

// Submit for every bot that has not yet decided. Safe to call after any state change.
function run(g, rand) {
  let guard = 0;
  while (E.DECISION.includes(g.phase) && guard++ < 50) {
    const todo = g.players.filter((p) => p.bot && !g.cur.subs[p.id]);
    if (!todo.length) break;
    const phase = g.phase;
    for (const p of todo) {
      if (g.phase !== phase) break;
      const r = E.submit(g, p.id, decide(g, p, rand));
      if (!r.ok) E.submit(g, p.id, phase === 'dilemma' ? { choice: 'proper' } : phase === 'boardroom' ? { loan: null, actions: [] } : { valley: 0, nordic: 0, loop: 0, fallback: false });
    }
    if (g.phase === phase) break;
  }
}

module.exports = { decide, run, NAMES, STYLES, PLANS };
