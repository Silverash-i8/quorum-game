'use strict';
// CELL OUT rules engine. Pure functions over a plain-JSON game state, so the
// same code runs the live server, the unit tests and the balance simulation.
const C = require('./content');

const R = {
  version: 'web-1.1',
  years: 5, firstYear: 2027, minPlayers: 2, maxPlayers: 6,
  start: { cash: 12, debt: 0, lines: 1, rep: 5, sust: 3, cyber: 0 },
  lineCost: 6, lineValue: 3, lineCap: 2, maxLines: 4, runCost: 1,
  loan: 5, maxDebt: 15, ratePct: 10, rateShockPct: 15, taxBand: 4,
  cost: { rd: 2, patent: 1, qa: 2, cyber: 1, sust: 3, recyc: 3, mkt: 1 },
  dilemma: { proper: 1, shortcut: 2 },
  price: { budget: 3.5, premium: 5.5, green: 5, cyberBonus: 0.5, clearance: 1.5, subsidy: 0.5 },
  cell: { valley: 1, nordic: 2, loop: 1.5, loopPartner: 1.5, cobalt: 0.5 },
  levy: [0, 0.5, 1, 1.5], climateSteps: [10, 20, 30], crisisPenalty: 5, polluterPenalty: 5,
  greenSust: 5, cyberData: 2,
  skeleton: { rep: 2, cash: 5, yearOn: 2, whistleOn: 3, auditOn: 3 },
  recall: { cash: 3, rep: 1 }, breach: { cash: 2, rep: 1 }, ransom: 2, passport: 1, flood: { on: 2, units: 1 },
  score: { rep: 1, sust: 1, patent: 2, secret: 1 },
  tables: {
    4: { budget: [7, 7, 6, 5, 4], premium: [2, 2, 3, 4, 5], green: [1, 3, 5, 7, 9], nordic: [8, 9, 10, 11, 12], loop: [2, 3, 4, 5, 6] },
    3: { budget: [6, 6, 5, 4, 4], premium: [2, 3, 4, 4, 5], green: [1, 2, 3, 4, 5], nordic: [6, 7, 8, 8, 9], loop: [2, 2, 3, 4, 4] },
  },
};

const DECISION = ['dilemma', 'boardroom', 'supply'];

// ---------- helpers
function rnd(g) {
  g.rng = (g.rng + 0x6D2B79F5) >>> 0;
  let t = g.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function d6(g) { return 1 + Math.floor(rnd(g) * 6); }
function shuffle(g, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(g) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function clamp(p) {
  p.rep = Math.max(0, Math.min(10, p.rep));
  p.sust = Math.max(0, Math.min(10, p.sust));
  p.cyber = Math.max(0, Math.min(3, p.cyber));
}
function money(x) { return (x < 0 ? '−' : '') + '£' + Math.abs(x) + 'm'; }
function tables(n) {
  if (R.tables[n]) return R.tables[n];
  const b = R.tables[4], s = n / 4, sc = (a) => a.map((v) => Math.max(1, Math.round(v * s)));
  return { budget: sc(b.budget), premium: sc(b.premium), green: sc(b.green), nordic: sc(b.nordic), loop: sc(b.loop) };
}
function climateSteps(n) {
  if (n === 3 || n === 4) return R.climateSteps.slice();
  return R.climateSteps.map((v) => Math.round(v * n / 4));
}
function levyLevel(g) { return climateSteps(g.players.length).filter((s) => g.climate >= s).length; }
function player(g, pid) { return g.players.find((p) => p.id === pid); }
function techs(p) { return p.patents + p.secrets; }
function capacity(p) { return p.lines * R.lineCap; }
function netWorth(p) { return p.cash - p.debt + R.lineValue * p.lines; }

// ---------- lifecycle
function newGame(seed) {
  const s = (seed === undefined ? Math.floor(Math.random() * 0xFFFFFFFF) : seed) >>> 0;
  return { rules: R.version, seed: s, rng: s, phase: 'lobby', year: -1, players: [], climate: 0, nextId: 1, cur: null, decks: null, final: null };
}
function addPlayer(g, opts) {
  if (g.phase !== 'lobby') return { ok: false, error: 'The game has already started.' };
  if (g.players.length >= R.maxPlayers) return { ok: false, error: 'This game is full (6 companies).' };
  let name = String((opts && opts.name) || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (!name) return { ok: false, error: 'Enter a company name.' };
  if (g.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'That company name is taken. Pick another.' };
  const used = g.players.map((p) => p.colour);
  const colour = C.COMPANY_COLOURS.find((c) => !used.includes(c)) || C.COMPANY_COLOURS[0];
  const p = { id: 'p' + g.nextId++, name, colour, bot: (opts && opts.bot) || null };
  g.players.push(p);
  return { ok: true, player: p };
}
function removePlayer(g, pid) {
  if (g.phase !== 'lobby') return { ok: false, error: 'Companies can only be removed before the game starts.' };
  const i = g.players.findIndex((p) => p.id === pid);
  if (i < 0) return { ok: false, error: 'No such company.' };
  g.players.splice(i, 1);
  return { ok: true };
}
function start(g) {
  if (g.phase !== 'lobby') return { ok: false, error: 'The game has already started.' };
  if (g.players.length < R.minPlayers) return { ok: false, error: 'At least 2 companies are needed. The game is designed for 3 or 4.' };
  g.decks = {
    market: shuffle(g, C.MARKET).slice(0, R.years).map((c) => c.id),
    risk: shuffle(g, C.RISK.map((c, i) => i)),
    dilemma: shuffle(g, C.DILEMMAS.map((c, i) => i)).slice(0, R.years),
  };
  for (const p of g.players) Object.assign(p, R.start, { qa: false, recyc: false, patents: 0, secrets: 0, skeletons: 0, valleyTotal: 0, hist: [], led: null });
  beginYear(g, 0);
  return { ok: true };
}

function newLedger(p) {
  return { open: p.cash, loanIn: 0, loanOut: 0, other: 0, ethics: 0, capex: 0, invest: 0, cells: 0, incidents: 0,
    sales: 0, clearance: 0, running: 0, interest: 0, tax: 0, emergency: 0, pbt: 0,
    cellsBought: { valley: 0, nordic: 0, loop: 0 }, units: 0, lost: 0, sold: { premium: 0, green: 0, budget: 0 }, cleared: 0,
    avgCost: 0, notes: [] };
}
function beginYear(g, y) {
  g.year = y;
  const n = g.players.length, T = tables(n), ev = g.decks.market[y];
  const level = levyLevel(g), cobalt = ev === 'cobalt' ? R.cell.cobalt : 0;
  const prio = {};
  shuffle(g, g.players.map((p) => p.id)).forEach((id, i) => { prio[id] = i; });
  g.cur = {
    event: ev, level,
    demand: {
      premium: T.premium[y],
      green: T.green[y] + level,
      budget: Math.max(0, T.budget[y] + (ev === 'recession' ? -2 : ev === 'boom' ? 2 : 0)),
    },
    caps: { nordic: T.nordic[y], loop: T.loop[y] },
    price: {
      valley: R.cell.valley + R.levy[level] + cobalt, nordic: R.cell.nordic + cobalt,
      loop: R.cell.loop, loopPartner: R.cell.loopPartner,
      premium: R.price.premium, green: R.price.green + (ev === 'subsidy' ? R.price.subsidy : 0), budget: R.price.budget,
    },
    ratePct: ev === 'rate' ? R.rateShockPct : R.ratePct,
    dilemma: g.decks.dilemma[y], prio, subs: {}, reveal: {},
  };
  for (const p of g.players) p.led = newLedger(p);
  g.phase = 'news';
}

// ---------- validation
function checkDilemma(sub) {
  if (!sub || (sub.choice !== 'proper' && sub.choice !== 'shortcut')) return { ok: false, error: 'Choose one of the two options.' };
  return { ok: true, sub: { choice: sub.choice } };
}
function checkBoardroom(p, sub) {
  sub = sub || {};
  const loan = sub.loan === 'take' || sub.loan === 'repay' ? sub.loan : null;
  const acts = Array.isArray(sub.actions) ? sub.actions : [];
  if (acts.length > 2) return { ok: false, error: 'You can take at most 2 actions a year.' };
  const s = { cash: p.cash, debt: p.debt, lines: p.lines, rep: p.rep, sust: p.sust, cyber: p.cyber, qa: p.qa, recyc: p.recyc };
  if (loan === 'take') {
    if (s.debt + R.loan > R.maxDebt) return { ok: false, error: 'Your debt cannot go above ' + money(R.maxDebt) + '.' };
    s.debt += R.loan; s.cash += R.loan;
  } else if (loan === 'repay') {
    if (s.debt < R.loan) return { ok: false, error: 'You have no loan to repay.' };
    if (s.cash < R.loan) return { ok: false, error: 'You need ' + money(R.loan) + ' in cash to repay a loan.' };
    s.debt -= R.loan; s.cash -= R.loan;
  }
  const clean = [], pub = [];
  for (const a of acts) {
    const id = a && a.id;
    let cost;
    if (id === 'line') {
      if (s.lines >= R.maxLines) return { ok: false, error: 'You already have ' + R.maxLines + ' production lines.' };
      cost = R.lineCost; s.lines++; clean.push({ id }); pub.push('Built a production line');
    } else if (id === 'rd') {
      const protect = a.protect === 'patent' ? 'patent' : 'secret';
      cost = R.cost.rd + (protect === 'patent' ? R.cost.patent : 0);
      clean.push({ id, protect }); pub.push(protect === 'patent' ? 'Filed a patent' : 'Ran R&D');
    } else if (id === 'qa') {
      if (s.qa) return { ok: false, error: 'You already have a QA system.' };
      cost = R.cost.qa; s.qa = true; clean.push({ id }); pub.push('Installed a QA system');
    } else if (id === 'cyber') {
      if (s.cyber >= 3) return { ok: false, error: 'Cyber security is already at its maximum of 3.' };
      cost = R.cost.cyber; s.cyber++; clean.push({ id }); pub.push('Upgraded cyber security');
    } else if (id === 'sust') {
      if (s.sust >= 10) return { ok: false, error: 'Sustainability is already 10.' };
      cost = R.cost.sust; s.sust++; clean.push({ id }); pub.push('Upgraded sustainability');
    } else if (id === 'recyc') {
      if (s.recyc) return { ok: false, error: 'You already have a recycling partnership.' };
      cost = R.cost.recyc; s.recyc = true; s.sust = Math.min(10, s.sust + 1); clean.push({ id }); pub.push('Signed a recycling partnership');
    } else if (id === 'mkt') {
      if (s.rep >= 10) return { ok: false, error: 'Reputation is already 10.' };
      cost = R.cost.mkt; s.rep++; clean.push({ id }); pub.push('Ran a marketing campaign');
    } else return { ok: false, error: 'Unknown action.' };
    if (s.cash < cost) return { ok: false, error: 'Not enough cash for that. You would be ' + money(cost - s.cash) + ' short.' };
    s.cash -= cost;
  }
  return { ok: true, sub: { loan, actions: clean }, pub, after: s };
}
function loopPrice(g, p) { return p.recyc ? g.cur.price.loopPartner : g.cur.price.loop; }
function supplyMaxCost(g, p, sub) {
  const pr = g.cur.price, pv = pr.valley, pl = loopPrice(g, p);
  return sub.valley * pv + sub.nordic * (sub.fallback ? Math.max(pr.nordic, pv) : pr.nordic) + sub.loop * (sub.fallback ? Math.max(pl, pv) : pl);
}
function checkSupply(g, p, sub) {
  sub = sub || {};
  const q = {};
  for (const k of ['valley', 'nordic', 'loop']) {
    const v = sub[k] === undefined ? 0 : sub[k];
    if (!Number.isInteger(v) || v < 0 || v > 99) return { ok: false, error: 'Order whole numbers of cells.' };
    q[k] = v;
  }
  q.fallback = !!sub.fallback;
  const tot = q.valley + q.nordic + q.loop;
  if (tot > capacity(p)) return { ok: false, error: 'Your ' + p.lines + (p.lines === 1 ? ' line makes' : ' lines make') + ' at most ' + capacity(p) + ' units a year.' };
  const max = supplyMaxCost(g, p, q);
  if (max > Math.max(0, p.cash)) return { ok: false, error: 'That order could cost ' + money(max) + ' and you have ' + money(p.cash) + '.' };
  return { ok: true, sub: q };
}

// ---------- submissions
function submit(g, pid, sub) {
  const p = player(g, pid);
  if (!p) return { ok: false, error: 'You are not in this game.' };
  if (!DECISION.includes(g.phase)) return { ok: false, error: 'Nothing to decide right now.' };
  const chk = g.phase === 'dilemma' ? checkDilemma(sub) : g.phase === 'boardroom' ? checkBoardroom(p, sub) : checkSupply(g, p, sub);
  if (!chk.ok) return chk;
  g.cur.subs[pid] = chk.sub;
  if (g.players.every((q) => g.cur.subs[q.id])) resolveDecision(g);
  return { ok: true };
}
function pending(g) {
  if (!DECISION.includes(g.phase)) return [];
  return g.players.filter((p) => !g.cur.subs[p.id]).map((p) => p.id);
}
function defaultSub(g, p) {
  if (g.phase === 'dilemma') return { choice: 'proper' };
  if (g.phase === 'boardroom') return { loan: null, actions: [] };
  const afford = Math.floor(Math.max(0, p.cash) / g.cur.price.nordic);
  return { valley: 0, nordic: Math.min(capacity(p), afford), loop: 0, fallback: false };
}
function resolveDecision(g) {
  for (const p of g.players) if (!g.cur.subs[p.id]) { g.cur.subs[p.id] = defaultSub(g, p); g.cur.subs[p.id].auto = true; }
  if (g.phase === 'dilemma') resolveDilemma(g);
  else if (g.phase === 'boardroom') resolveBoardroom(g);
  else resolveSupply(g);
  g.cur.subs = {};
}
function advance(g) {
  switch (g.phase) {
    case 'news': g.phase = 'dilemma'; return { ok: true };
    case 'dilemma': case 'boardroom': case 'supply': resolveDecision(g); return { ok: true };
    case 'dilemmaReveal': g.phase = 'boardroom'; return { ok: true };
    case 'boardroomReveal': g.phase = 'supply'; return { ok: true };
    case 'supplyReveal': resolveRisk(g); return { ok: true };
    case 'risk': resolveMarket(g); return { ok: true };
    case 'market':
      if (g.year < R.years - 1) beginYear(g, g.year + 1); else finish(g);
      return { ok: true };
    default: return { ok: false, error: 'Nothing to continue.' };
  }
}

// ---------- phase resolution
function resolveDilemma(g) {
  let proper = 0, shortcut = 0;
  for (const p of g.players) {
    if (g.cur.subs[p.id].choice === 'shortcut') {
      shortcut++; p.cash += R.dilemma.shortcut; p.led.other += R.dilemma.shortcut; p.skeletons++;
      p.led.notes.push('Dilemma: took the shortcut, +' + money(R.dilemma.shortcut) + ' and 1 Skeleton');
    } else {
      proper++; p.cash -= R.dilemma.proper; p.led.ethics += R.dilemma.proper;
      p.led.notes.push('Dilemma: did it properly, paid ' + money(R.dilemma.proper));
    }
  }
  g.cur.reveal.dilemma = { proper, shortcut };
  g.phase = 'dilemmaReveal';
}
function resolveBoardroom(g) {
  const out = {};
  for (const p of g.players) {
    let chk = checkBoardroom(p, g.cur.subs[p.id]);
    if (!chk.ok) chk = checkBoardroom(p, { loan: null, actions: [] });
    const sub = chk.sub;
    if (sub.loan === 'take') { p.debt += R.loan; p.cash += R.loan; p.led.loanIn += R.loan; p.led.notes.push('Took a ' + money(R.loan) + ' loan'); }
    if (sub.loan === 'repay') { p.debt -= R.loan; p.cash -= R.loan; p.led.loanOut += R.loan; p.led.notes.push('Repaid ' + money(R.loan) + ' of debt'); }
    for (const a of sub.actions) {
      if (a.id === 'line') { p.lines++; p.cash -= R.lineCost; p.led.capex += R.lineCost; p.led.notes.push('Built a production line for ' + money(R.lineCost)); }
      else if (a.id === 'rd') {
        const cost = R.cost.rd + (a.protect === 'patent' ? R.cost.patent : 0);
        p.cash -= cost; p.led.invest += cost;
        if (a.protect === 'patent') { p.patents++; p.led.notes.push('R&D: new technology, patented for ' + money(cost)); }
        else { p.secrets++; p.led.notes.push('R&D: new technology kept as a trade secret for ' + money(cost)); }
      } else {
        const cost = R.cost[a.id]; p.cash -= cost; p.led.invest += cost;
        if (a.id === 'qa') { p.qa = true; p.led.notes.push('Installed a QA system for ' + money(cost)); }
        if (a.id === 'cyber') { p.cyber++; p.led.notes.push('Cyber security raised to ' + p.cyber + ' for ' + money(cost)); }
        if (a.id === 'sust') { p.sust++; p.led.notes.push('Sustainability upgrade for ' + money(cost)); }
        if (a.id === 'recyc') { p.recyc = true; p.sust++; p.led.notes.push('Recycling partnership signed for ' + money(cost)); }
        if (a.id === 'mkt') { p.rep++; p.led.notes.push('Marketing campaign for ' + money(cost)); }
      }
    }
    clamp(p);
    out[p.id] = chk.pub;
  }
  g.cur.reveal.boardroom = out;
  g.phase = 'boardroomReveal';
}
function resolveSupply(g) {
  const pr = g.cur.price, subs = {}, got = {};
  for (const p of g.players) {
    let chk = checkSupply(g, p, g.cur.subs[p.id]);
    if (!chk.ok) chk = { sub: { valley: 0, nordic: 0, loop: 0, fallback: false } };
    subs[p.id] = chk.sub; got[p.id] = { valley: chk.sub.valley, nordic: 0, loop: 0, short: 0, swapped: 0 };
  }
  const prio = g.cur.prio;
  const byRep = (a, b) => b.rep - a.rep || b.sust - a.sust || prio[a.id] - prio[b.id];
  let left = g.cur.caps.loop;
  for (const p of g.players.slice().sort((a, b) => (b.recyc - a.recyc) || byRep(a, b))) {
    const k = Math.min(subs[p.id].loop, left); got[p.id].loop = k; left -= k;
  }
  left = g.cur.caps.nordic;
  for (const p of g.players.slice().sort(byRep)) {
    const k = Math.min(subs[p.id].nordic, left); got[p.id].nordic = k; left -= k;
  }
  const climateBefore = g.climate, out = {};
  for (const p of g.players) {
    const s = subs[p.id], o = got[p.id];
    const missed = (s.loop - o.loop) + (s.nordic - o.nordic);
    if (missed > 0) { if (s.fallback) { o.valley += missed; o.swapped = missed; } else o.short = missed; }
    const tot = o.valley + o.nordic + o.loop;
    const cost = o.valley * pr.valley + o.nordic * pr.nordic + o.loop * loopPrice(g, p);
    p.cash -= cost; p.led.cells += cost;
    p.led.cellsBought = { valley: o.valley, nordic: o.nordic, loop: o.loop };
    p.led.units = tot; p.led.avgCost = tot ? cost / tot : 0;
    if (tot) p.led.notes.push('Bought ' + tot + ' cell orders for ' + money(cost) + (o.swapped ? ' (' + o.swapped + ' switched to Valley)' : '') + (o.short ? ' (' + o.short + ' not available)' : ''));
    else p.led.notes.push('Bought no cells this year' + (o.short ? ' (' + o.short + ' not available)' : ''));
    g.climate += o.valley; p.valleyTotal += o.valley;
    o.expose = null; o.sust = 0;
    if (o.valley > 0) {
      const roll = d6(g), hit = roll <= 1;
      o.expose = { roll, hit };
      if (hit) { p.rep -= 1; p.led.notes.push('Supply-chain exposé at Valley Cells: Reputation −1'); }
    }
    if (tot && o.valley * 2 > tot) { o.sust = -1; p.sust -= 1; p.led.notes.push('Mostly Valley cells: Sustainability −1'); }
    else if (tot && o.loop * 2 >= tot) { o.sust = 1; p.sust += 1; p.led.notes.push('Mostly recycled cells: Sustainability +1'); }
    clamp(p);
    out[p.id] = o;
  }
  g.cur.reveal.supply = { orders: out, climateBefore, climateAfter: g.climate };
  g.phase = 'supplyReveal';
}
function exposeSkeleton(p, why) {
  p.skeletons--; p.rep -= R.skeleton.rep; p.cash -= R.skeleton.cash;
  if (p.led) { p.led.incidents += R.skeleton.cash; p.led.notes.push(why + ': a Skeleton was exposed, paid ' + money(R.skeleton.cash) + ', Reputation −' + R.skeleton.rep); }
  clamp(p);
}
function resolveRisk(g) {
  const cards = [];
  for (let i = 0; i < 2; i++) {
    const def = C.RISK[g.decks.risk[g.year * 2 + i]];
    const hits = [];
    const hit = (p, msg) => hits.push({ pid: p.id, msg });
    for (const p of g.players) {
      const b = p.led.cellsBought, tot = b.valley + b.nordic + b.loop;
      if (def.id === 'recall' && !p.qa && b.valley > 0) {
        p.cash -= R.recall.cash; p.rep -= R.recall.rep; p.led.incidents += R.recall.cash;
        p.led.notes.push('Product recall: paid ' + money(R.recall.cash) + ', Reputation −1'); hit(p, 'pays ' + money(R.recall.cash) + ', Reputation −1');
      }
      if (def.id === 'breach' && (p.cyber === 0 || (p.cyber < R.cyberData && p.secrets > 0))) {
        const lost = p.secrets;
        p.cash -= R.breach.cash; p.rep -= R.breach.rep; p.led.incidents += R.breach.cash; p.secrets = 0;
        p.led.notes.push('Data breach: fined ' + money(R.breach.cash) + ', Reputation −1' + (lost ? ', ' + lost + ' trade secret' + (lost > 1 ? 's' : '') + ' leaked' : ''));
        hit(p, 'fined ' + money(R.breach.cash) + ', Reputation −1' + (lost ? ', trade secrets leaked' : ''));
      }
      if ((def.id === 'strike' && tot && b.nordic === tot) || (def.id === 'ban' && tot && b.valley === tot)) {
        const lose = Math.min(p.led.units, Math.ceil(p.led.units / 2));
        if (lose > 0) { p.led.units -= lose; p.led.lost += lose; p.led.notes.push(def.title + ': lost ' + lose + ' unit' + (lose > 1 ? 's' : '') + ' (single-sourced)'); hit(p, 'loses ' + lose + ' unit' + (lose > 1 ? 's' : '')); }
      }
      if (def.id === 'iprace' && p.secrets > 0) {
        let kept = 0, lost = 0;
        while (p.secrets > 0) {
          p.secrets--;
          if (p.cash >= R.cost.patent) { p.cash -= R.cost.patent; p.led.invest += R.cost.patent; p.patents++; kept++; } else lost++;
        }
        p.led.notes.push('IP race: ' + (kept ? kept + ' trade secret' + (kept > 1 ? 's' : '') + ' patented for ' + money(kept * R.cost.patent) : '') + (kept && lost ? ', ' : '') + (lost ? lost + ' lost to a rival' : ''));
        hit(p, (kept ? 'patents ' + kept + ' secret' + (kept > 1 ? 's' : '') : '') + (kept && lost ? ', ' : '') + (lost ? 'loses ' + lost : ''));
      }
      if (def.id === 'whistle' && p.skeletons > 0) {
        let n = 0; const have = p.skeletons;
        for (let k = 0; k < have; k++) if (d6(g) <= R.skeleton.whistleOn) { exposeSkeleton(p, 'Whistleblower'); n++; }
        if (n) hit(p, n + ' Skeleton' + (n > 1 ? 's' : '') + ' exposed: pays ' + money(n * R.skeleton.cash) + ', Reputation −' + n * R.skeleton.rep);
      }
      if (def.id === 'flood') {
        const roll = d6(g);
        if (roll <= R.flood.on && p.led.units > 0) {
          const lose = Math.min(p.led.units, R.flood.units);
          p.led.units -= lose; p.led.lost += lose;
          p.led.notes.push('Factory flood: lost ' + lose + ' unit' + (lose === 1 ? '' : 's')); hit(p, 'rolls a ' + roll + ' and loses ' + lose + ' unit' + (lose === 1 ? '' : 's'));
        }
      }
      if (def.id === 'ransom' && p.cyber === 0) {
        p.cash -= R.ransom; p.led.incidents += R.ransom; p.led.notes.push('Ransomware: paid ' + money(R.ransom) + ' to recover'); hit(p, 'pays ' + money(R.ransom));
      }
      clamp(p);
    }
    if (def.id === 'award') {
      const qa = g.players.filter((p) => p.qa);
      if (qa.length) {
        const top = Math.max(...qa.map((p) => p.rep));
        for (const p of qa.filter((q) => q.rep === top)) { p.rep += 1; clamp(p); p.led.notes.push('Safety award: Reputation +1'); hit(p, 'wins the award: Reputation +1'); }
      }
    }
    cards.push({ id: def.id, title: def.title, text: def.text, hits });
  }
  const exposed = [];
  for (const p of g.players) {
    let n = 0; const have = p.skeletons;
    for (let k = 0; k < have; k++) if (d6(g) <= R.skeleton.yearOn) { exposeSkeleton(p, 'Press investigation'); n++; }
    if (n) exposed.push({ pid: p.id, n, cash: n * R.skeleton.cash, rep: n * R.skeleton.rep });
  }
  g.cur.reveal.risk = { cards, exposed };
  g.phase = 'risk';
}
function resolveMarket(g) {
  const d = g.cur.demand, pr = g.cur.price, prio = g.cur.prio;
  const left = {}; for (const p of g.players) left[p.id] = p.led.units;
  const rep = (a, b) => b.rep - a.rep || prio[a.id] - prio[b.id];
  const segs = [
    { id: 'premium', ok: (p) => techs(p) >= 1, sort: (a, b) => techs(b) - techs(a) || rep(a, b), price: (p) => pr.premium + (p.cyber >= R.cyberData ? R.price.cyberBonus : 0) },
    { id: 'green', ok: (p) => p.sust >= R.greenSust, sort: (a, b) => b.sust - a.sust || rep(a, b), price: () => pr.green },
    { id: 'budget', ok: () => true, sort: (a, b) => a.led.avgCost - b.led.avgCost || rep(a, b), price: () => pr.budget },
  ];
  const market = [];
  for (const s of segs) {
    // Customers are shared out one unit at a time, best-placed company first, until demand or stock runs out.
    let dem = d[s.id]; const sold = {}, order = g.players.filter(s.ok).sort(s.sort);
    let moved = true;
    while (dem > 0 && moved) {
      moved = false;
      for (const p of order) {
        if (dem > 0 && left[p.id] > 0) { dem--; left[p.id]--; sold[p.id] = (sold[p.id] || 0) + 1; moved = true; }
      }
    }
    const sales = [];
    for (const p of order) if (sold[p.id]) { p.led.sold[s.id] = sold[p.id]; p.led.sales += sold[p.id] * s.price(p); sales.push({ pid: p.id, units: sold[p.id] }); }
    market.push({ id: s.id, demand: d[s.id], unmet: dem, sales });
  }
  const emergency = [];
  for (const p of g.players) {
    const L = p.led;
    L.cleared = left[p.id]; L.clearance = L.cleared * R.price.clearance;
    L.running = p.lines * R.runCost;
    L.interest = Math.ceil(p.debt * g.cur.ratePct / 50) / 2;
    if (g.cur.event === 'passport' && p.cyber === 0) { L.incidents += R.passport; p.cash -= R.passport; L.notes.push('Battery passport: paid ' + money(R.passport) + ' to comply by hand'); }
    L.pbt = L.sales + L.clearance + L.other - L.cells - L.running - L.invest - L.ethics - L.interest - L.incidents;
    L.tax = Math.floor(Math.max(0, L.pbt) / R.taxBand);
    p.cash += L.sales + L.clearance - L.running - L.interest - L.tax;
    if (p.cash < 0) {
      const k = Math.ceil(-p.cash / R.loan) * R.loan;
      p.debt += k; p.cash += k; L.emergency = k; p.rep -= 1; clamp(p);
      L.notes.push('Ran out of cash: emergency loan of ' + money(k) + ', Reputation −1'); emergency.push(p.id);
    }
    p.hist.push({
      year: R.firstYear + g.year, open: L.open, loanIn: L.loanIn + L.emergency, loanOut: L.loanOut,
      sales: L.sales, clearance: L.clearance, other: L.other, cells: L.cells, running: L.running,
      invest: L.invest + L.ethics, capex: L.capex, interest: L.interest, incidents: L.incidents, pbt: L.pbt, tax: L.tax,
      close: p.cash, debt: p.debt, lines: p.lines, netWorth: netWorth(p),
      units: L.units + L.lost, lost: L.lost, sold: Object.assign({}, L.sold), cleared: L.cleared,
      cells_valley: L.cellsBought.valley, cells_nordic: L.cellsBought.nordic, cells_loop: L.cellsBought.loop,
      rep: p.rep, sust: p.sust, cyber: p.cyber, patents: p.patents, secrets: p.secrets, skeletons: p.skeletons, valleyTotal: p.valleyTotal,
      notes: L.notes.slice(),
    });
  }
  g.cur.reveal.market = { segments: market, emergency };
  g.phase = 'market';
}
function finish(g) {
  const audit = [];
  for (const p of g.players) {
    let n = 0; const have = p.skeletons; p.led = null;
    for (let k = 0; k < have; k++) if (d6(g) <= R.skeleton.auditOn) { exposeSkeleton(p, 'Audit'); n++; }
    audit.push({ pid: p.id, had: have, exposed: n, cash: n * R.skeleton.cash, rep: n * R.skeleton.rep });
  }
  const crisis = g.climate >= climateSteps(g.players.length)[2];
  const worst = Math.max(...g.players.map((p) => p.valleyTotal));
  const polluters = crisis && worst > 0 ? g.players.filter((p) => p.valleyTotal === worst).map((p) => p.id) : [];
  const scores = g.players.map((p) => {
    const parts = { netWorth: netWorth(p), rep: R.score.rep * p.rep, sust: R.score.sust * p.sust, ip: R.score.patent * p.patents + R.score.secret * p.secrets,
      climate: crisis ? -(R.crisisPenalty + (polluters.includes(p.id) ? R.polluterPenalty : 0)) : 0 };
    let total = parts.netWorth + parts.rep + parts.sust + parts.ip + parts.climate;
    const halved = p.rep === 0;
    if (halved) total = total / 2;
    return { pid: p.id, parts, halved, total, cash: p.cash, debt: p.debt, lines: p.lines, rep: p.rep, sust: p.sust, patents: p.patents, secrets: p.secrets,
      skeletonsLeft: p.skeletons, valleyTotal: p.valleyTotal };
  });
  scores.sort((a, b) => b.total - a.total || b.rep - a.rep);
  g.final = { audit, crisis, polluters, scores, winner: scores[0].pid };
  g.cur = null;
  g.phase = 'final';
}

// ---------- views
function pub(g, p) {
  const o = { id: p.id, name: p.name, colour: p.colour, bot: !!p.bot };
  if (g.phase !== 'lobby') Object.assign(o, { rep: p.rep, sust: p.sust, cyber: p.cyber, lines: p.lines, patents: p.patents, qa: p.qa, recyc: p.recyc, valleyTotal: p.valleyTotal });
  if (DECISION.includes(g.phase)) o.done = !!g.cur.subs[p.id];
  return o;
}
function common(g) {
  const v = { phase: g.phase, year: g.year, yearLabel: g.year >= 0 ? R.firstYear + g.year : null, years: R.years, firstYear: R.firstYear,
    climate: g.climate, climateSteps: climateSteps(Math.max(g.players.length, 2)), players: g.players.map((p) => pub(g, p)) };
  if (g.cur) {
    const ev = C.MARKET.find((c) => c.id === g.cur.event), dl = C.DILEMMAS[g.cur.dilemma];
    v.event = { id: ev.id, title: ev.title, text: ev.text };
    v.level = g.cur.level; v.demand = g.cur.demand; v.caps = g.cur.caps; v.price = g.cur.price; v.ratePct = g.cur.ratePct;
    const seen = ['dilemma', 'dilemmaReveal', 'boardroom', 'boardroomReveal', 'supply', 'supplyReveal', 'risk', 'market'].includes(g.phase);
    if (seen) v.dilemma = { title: dl.title, story: dl.story, proper: dl.proper, shortcut: dl.shortcut };
    const rv = g.cur.reveal;
    if (rv.dilemma && g.phase !== 'dilemma') { v.dilemma.ref = dl.ref; v.dilemmaReveal = rv.dilemma; }
    if (rv.boardroom) v.boardroomReveal = rv.boardroom;
    if (rv.supply) v.supplyReveal = rv.supply;
    if (rv.risk) v.riskReveal = rv.risk;
    if (rv.market) v.marketReveal = rv.market;
  }
  if (g.final) v.final = g.final;
  return v;
}
function hostView(g) { return common(g); }
function playerView(g, pid) {
  const p = player(g, pid);
  const v = common(g);
  if (!p) { v.me = null; return v; }
  const me = { id: p.id, name: p.name, colour: p.colour };
  if (g.phase !== 'lobby') {
    Object.assign(me, { cash: p.cash, debt: p.debt, lines: p.lines, rep: p.rep, sust: p.sust, cyber: p.cyber, qa: p.qa, recyc: p.recyc,
      patents: p.patents, secrets: p.secrets, skeletons: p.skeletons, capacity: capacity(p), netWorth: netWorth(p), hist: p.hist });
    if (p.led) me.notes = p.led.notes;
    if (g.cur) {
      me.sub = g.cur.subs[pid] || null;
      me.loopPrice = loopPrice(g, p);
      me.greenOk = p.sust >= R.greenSust; me.premiumOk = techs(p) >= 1;
      if (g.cur.reveal.supply) me.order = g.cur.reveal.supply.orders[pid];
    }
  }
  v.me = me;
  v.rules = { cost: R.cost, lineCost: R.lineCost, maxLines: R.maxLines, lineCap: R.lineCap, loan: R.loan, maxDebt: R.maxDebt,
    dilemma: R.dilemma, skeleton: R.skeleton, greenSust: R.greenSust, cyberData: R.cyberData, cyberBonus: R.price.cyberBonus, clearance: R.price.clearance, runCost: R.runCost };
  v.actions = C.ACTIONS; v.suppliers = C.SUPPLIERS;
  return v;
}

module.exports = { R, DECISION, newGame, addPlayer, removePlayer, start, submit, pending, advance, hostView, playerView,
  checkBoardroom, checkSupply, supplyMaxCost, loopPrice, tables, climateSteps, levyLevel, capacity, techs, netWorth, money, player };
