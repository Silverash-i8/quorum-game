'use strict';
// CHAIN REACTION: four links of one battery supply chain. Hidden stock, delayed deliveries, one shared contract.
const K = require('./base');
const { err, money, half, clamp } = K;

const R = { version: 'chain-1.0', weeks: 10, lead: { sea: 2, air: 1 }, price: [5, 4, 3, 2], mineCost: 1, hold: 0.25, backlog: 0.25, airCost: 0.5, payDelay: 2, overdraft: 0.05,
  start: { stock: 8, cash: 20, trust: 5 }, cost: { nda: 2, audit: 2 }, service: 0.85, carbonBudget: 30, lost: 0.5, defect: 3, maxOrder: 24, eventWeeks: [2, 5, 8], spare: 4,
  scandal: { cash: 3, trust: 2 }, leak: { cash: 3, trust: 1 }, pass: { cash: 4, trust: 4 }, trustPoints: 3 };
// Opening position: cash plus 16 units (8 in stock, 8 on the way) valued at what each link pays for them.
R.startValue = [0, 1, 2, 3].map((t) => R.start.cash + 16 * (t < 3 ? R.price[t + 1] : R.mineCost));
// The links do not earn alike (the Retailer has the steadiest trade), so each is scored against its own profit target.
R.par = [35, 24, 0, 12];
const ROLES = ['Retailer', 'Pack assembler', 'Cell maker', 'Mine'];
const BOTNAME = ['RideOn Retail', 'PackWorks', 'Voltaic Cells', 'Northfield Mine'];
const EVENTS = {
  strike: { title: 'Port strike', text: 'Dockers walk out. Every shipment already on its way arrives one week late.' },
  scandal: { title: 'Labour scandal at the mine', text: 'A newspaper exposes working conditions at the mine. Every company that has not paid for an audit loses ' + R.scandal.trust + ' Trust and pays ' + money(R.scandal.cash) + ' in lost contracts.' },
  leak: { title: 'Data leak', text: 'Shared order data turns up on a rival\'s desk. Every company that shared data without an agreement loses ' + R.leak.trust + ' Trust and pays ' + money(R.leak.cash) + '.' },
  spike: { title: 'Demand spike', text: 'A city launches an e-bike subsidy. Customers want 4 more packs a week for the next two weeks.' },
  defect: { title: 'Defective batch', text: 'One company finds ' + R.defect + ' suspect units in its stock. It must choose, in private, to scrap them or ship them.' },
};
const tiers = (g) => g.players.slice().sort((a, b) => a.role - b.role);

function setup(g) {
  g.players.sort((a, b) => (a.bot ? 1 : 0) - (b.bot ? 1 : 0));
  while (g.players.length < 4) {
    const used = g.players.map((p) => p.colour);
    g.players.push({ id: 'p' + g.nextId++, name: BOTNAME[g.players.length], bot: 'steady', colour: K.COLOURS.find((c) => !used.includes(c)) });
  }
  g.players.forEach((p, i) => Object.assign(p, R.start, { role: i, owed: 0, audited: false, nda: false, sharing: false, sharedEver: false, lateN: 0, passed: 0, defect: 0, hist: [] }));
  g.ship = []; for (let t = 0; t < 4; t++) g.ship.push({ to: t, qty: 4, eta: 0 }, { to: t, qty: 4, eta: 1 });
  g.pay = []; g.carbon = 0; g.delivered = 0; g.asked = 0;
  g.demand = []; for (let w = 0; w < R.weeks; w++) g.demand.push(w < 3 ? 4 : 5 + K.pick(g, 3));
  g.deck = K.shuffle(g, Object.keys(EVENTS)).slice(0, R.eventWeeks.length);
  g.phase = 'order';
}

function check(g, p, s) {
  const o = { order: s.order, freight: s.freight === 'air' ? 'air' : 'sea', pay: s.pay === 'late' ? 'late' : 'ontime',
    action: ['share', 'nda', 'audit'].includes(s.action) ? s.action : 'none', defect: s.defect === 'pass' ? 'pass' : 'scrap' };
  if (!K.int(o.order, 0, R.maxOrder)) return err('Order a whole number of units from 0 to ' + R.maxOrder + '.');
  if (o.action === 'nda' && p.nda) return err('You already have a data-sharing agreement.');
  if (o.action === 'audit' && p.audited) return err('You have already paid for an audit.');
  return { ok: true, sub: o };
}
const lastDemand = (p) => (p.hist.length ? p.hist[p.hist.length - 1].demand : 4);
const dflt = (g, p) => ({ order: clamp(lastDemand(p), 0, R.maxOrder), freight: 'sea', pay: 'ontime', action: 'none', defect: 'scrap' });

function resolve(g, subs) {
  const w = g.year, T = tiers(g), S = T.map((p) => subs[p.id]), notes = T.map(() => []), open = T.map((p) => p.cash);
  g.pay = g.pay.filter((x) => { if (x.due > w) return true; T[x.from].cash -= x.amt; T[x.to].cash += x.amt; notes[x.from].push('Paid a late invoice of ' + money(x.amt)); return false; });
  const arrived = [0, 0, 0, 0];
  g.ship = g.ship.filter((x) => { if (x.eta > w) return true; T[x.to].stock += x.qty; arrived[x.to] += x.qty; return false; });
  T.forEach((p, t) => {
    const s = S[t];
    if (p.defect) {
      if (s.defect === 'pass') { p.passed++; notes[t].push('Shipped the suspect batch as if nothing was wrong'); }
      else { const n = Math.min(p.defect, p.stock); p.stock -= n; p.trust += 1; notes[t].push('Scrapped ' + n + ' suspect units. Trust +1'); }
      p.defect = 0;
    }
    if (s.action === 'nda') { p.cash -= R.cost.nda; p.nda = true; p.trust += 1; notes[t].push('Signed a data-sharing agreement for ' + money(R.cost.nda) + '. Trust +1'); }
    if (s.action === 'audit') { p.cash -= R.cost.audit; p.audited = true; p.trust += 2; notes[t].push('Paid ' + money(R.cost.audit) + ' for a supplier audit. Trust +2'); }
    if (s.action === 'share') { if (!p.nda && !p.sharedEver) { p.trust += 1; notes[t].push('Shared your order data for the first time. Trust +1'); } p.sharedEver = true; }
    p.sharing = p.nda || s.action === 'share';
  });
  const demand = [g.demand[w], S[0].order, S[1].order, S[2].order], shipped = [0, 0, 0, 0];
  T.forEach((p, t) => {
    const want = demand[t] + (t ? p.owed : 0), q = Math.min(p.stock, want);
    p.stock -= q; shipped[t] = q;
    if (t === 0) { p.cash += q * R.price[0] - (want - q) * R.lost; g.delivered += q; g.asked += demand[0]; if (want > q) notes[0].push((want - q) + ' customers went away empty-handed: ' + money(-(want - q) * R.lost)); return; }
    p.owed = want - q;
    if (!q) return;
    const b = T[t - 1], bs = S[t - 1], amt = q * R.price[t];
    g.ship.push({ to: t - 1, qty: q, eta: w + R.lead[bs.freight] });
    if (bs.freight === 'air') { b.cash -= q * R.airCost; g.carbon += q; notes[t - 1].push('Air freight for ' + q + ' units: ' + money(q * R.airCost) + ' and ' + q + ' carbon'); }
    if (bs.pay === 'late') { g.pay.push({ from: t - 1, to: t, amt, due: w + R.payDelay }); b.trust -= 1; b.lateN++; notes[t - 1].push('Held back ' + money(amt) + ' owed to your supplier. Trust −1'); notes[t].push('Your customer has not paid ' + money(amt) + ' for this week\'s shipment'); }
    else { b.cash -= amt; p.cash += amt; }
  });
  const m = T[3], ms = S[3];
  if (ms.order) {
    m.cash -= ms.order * R.mineCost; g.ship.push({ to: 3, qty: ms.order, eta: w + R.lead[ms.freight] });
    if (ms.freight === 'air') { m.cash -= ms.order * R.airCost; g.carbon += ms.order; notes[3].push('Rush extraction of ' + ms.order + ' units: ' + money(ms.order * R.airCost) + ' and ' + ms.order + ' carbon'); }
  }
  let event = null;
  const ei = R.eventWeeks.indexOf(w);
  if (ei >= 0) {
    const id = g.deck[ei], hits = [];
    if (id === 'strike') g.ship.forEach((x) => { x.eta += 1; });
    if (id === 'scandal') T.forEach((p, t) => { if (!p.audited) { p.trust -= R.scandal.trust; p.cash -= R.scandal.cash; hits.push(p.id); notes[t].push('Labour scandal: no audit on file. ' + money(-R.scandal.cash) + ', Trust −' + R.scandal.trust); } });
    if (id === 'leak') T.forEach((p, t) => { if (p.sharedEver && !p.nda) { p.trust -= R.leak.trust; p.cash -= R.leak.cash; hits.push(p.id); notes[t].push('Data leak: you shared without an agreement. ' + money(-R.leak.cash) + ', Trust −' + R.leak.trust); } });
    if (id === 'spike') for (const k of [w + 1, w + 2]) if (k < R.weeks) g.demand[k] += 4;
    if (id === 'defect' && w + 1 < R.weeks) { const v = T[K.pick(g, 4)]; v.defect = R.defect; }
    event = { id, title: EVENTS[id].title, text: EVENTS[id].text, hits };
  }
  T.forEach((p, t) => {
    const hold = p.stock * R.hold, pen = p.owed * R.backlog;
    p.cash -= hold + pen;
    let interest = 0; if (p.cash < 0) { interest = Math.ceil(-p.cash * R.overdraft * 2) / 2; p.cash -= interest; }
    p.cash = half(p.cash); p.trust = clamp(p.trust, 0, 10);
    p.hist.push({ week: w + 1, demand: demand[t], order: S[t].order, freight: S[t].freight, pay: S[t].pay, action: S[t].action, arrived: arrived[t], shipped: shipped[t], stock: p.stock, owed: p.owed,
      open: open[t], cash: p.cash, hold, penalty: pen, interest, trust: p.trust, notes: notes[t] });
  });
  g.cur.reveal = { week: w + 1, demand: demand[0], delivered: shipped[0], event };
  g.phase = 'week';
}

function finish(g) {
  const T = tiers(g), why = [];
  for (const x of g.pay) { T[x.from].cash -= x.amt; T[x.to].cash += x.amt; }
  g.pay = [];
  let scrap = 0, recalls = 0;
  T.forEach((p) => { const extra = Math.max(0, p.stock - R.spare); p.scrap = extra; scrap += extra; g.carbon += Math.floor(extra / 2);
    for (let k = 0; k < p.passed; k++) { recalls++; g.delivered = Math.max(0, g.delivered - R.defect); p.cash -= R.pass.cash; p.trust = clamp(p.trust - R.pass.trust, 0, 10); } });
  T.forEach((p, t) => { const cost = t < 3 ? R.price[t + 1] : R.mineCost; p.stockValue = (p.stock + g.ship.filter((x) => x.to === t).reduce((a, x) => a + x.qty, 0)) * cost; });
  const service = g.asked ? g.delivered / g.asked : 1, ok = service >= R.service && g.carbon <= R.carbonBudget;
  if (service < R.service) why.push('Customers received only ' + Math.round(service * 100) + '% of what they ordered. The contract needed ' + Math.round(R.service * 100) + '%.');
  if (g.carbon > R.carbonBudget) why.push('The chain emitted ' + g.carbon + ' carbon against a budget of ' + R.carbonBudget + '.');
  const scores = T.map((p) => ({ pid: p.id, profit: half(p.cash + p.stockValue - R.startValue[p.role]), stockValue: p.stockValue, trust: p.trust, passed: p.passed, lateN: p.lateN, scrap: p.scrap, par: R.par[p.role], total: half(p.cash + p.stockValue - R.startValue[p.role] - R.par[p.role] + R.trustPoints * p.trust) }))
    .sort((a, b) => b.total - a.total || b.trust - a.trust);
  g.final = { service, carbon: g.carbon, budget: R.carbonBudget, ok, why, scrap, recalls, scores, winner: ok ? scores[0].pid : null,
    chart: { demand: g.demand.slice(), series: T.map((p) => ({ pid: p.id, role: ROLES[p.role], colour: p.colour, orders: p.hist.map((h) => h.order) })) } };
  g.phase = 'final';
}

const spec = {
  id: 'chain', version: R.version, min: 1, max: 4, setup,
  decide: { order: { check, dflt, resolve } },
  next: { week(g) { if (g.year + 1 >= R.weeks) finish(g); else { g.year++; g.phase = 'order'; } } },
  pub: (g, p) => ({ role: p.role, roleName: ROLES[p.role], trust: p.trust }),
  host: (g) => ({ week: g.year + 1, weeks: R.weeks, service: g.asked ? g.delivered / g.asked : null, target: R.service, carbon: g.carbon, budget: R.carbonBudget,
    reveal: g.phase === 'week' ? g.cur.reveal : null, final: g.final, events: EVENTS, eventWeeks: R.eventWeeks.map((x) => x + 1) }),
  me(g, p) {
    const T = tiers(g), down = p.role > 0 ? T[p.role - 1] : null, up = p.role < 3 ? T[p.role + 1] : null;
    return { role: p.role, roleName: ROLES[p.role], customer: down ? down.name : 'the public', supplier: up ? up.name : null, stock: p.stock, cash: p.cash, owed: p.owed, trust: p.trust,
      audited: p.audited, nda: p.nda, defect: p.defect, onOrder: up ? up.owed : 0, lastDemand: lastDemand(p), demandNow: p.role === 0 && g.phase === 'order' ? g.demand[g.year] : null,
      incoming: g.ship.filter((x) => x.to === p.role).map((x) => ({ inWeeks: Math.max(0, x.eta - g.year), qty: x.qty })).sort((a, b) => a.inWeeks - b.inWeeks),
      unpaid: g.pay.filter((x) => x.from === p.role).reduce((s, x) => s + x.amt, 0), awaited: g.pay.filter((x) => x.to === p.role).reduce((s, x) => s + x.amt, 0),
      shared: down && down.sharing ? { name: down.name, stock: down.stock, demand: down.hist.map((h) => h.demand) } : null,
      par: R.par[p.role], sell: R.price[p.role], buy: p.role < 3 ? R.price[p.role + 1] : R.mineCost, hist: p.hist, rules: R };
  },
  report(g) {
    const cols = ['company', 'role', 'bot', 'week', 'demand', 'order', 'freight', 'pay', 'action', 'arrived', 'shipped', 'stock', 'owed', 'open', 'cash', 'hold', 'penalty', 'interest', 'trust'];
    const rows = []; for (const p of tiers(g)) for (const h of p.hist) rows.push(cols.map((c) => (c === 'company' ? p.name : c === 'role' ? ROLES[p.role] : c === 'bot' ? p.bot || '' : h[c])));
    if (g.final) { rows.push([]); rows.push(['service', Math.round(g.final.service * 1000) / 10 + '%', 'carbon', g.final.carbon, 'contract kept', g.final.ok]); for (const s of g.final.scores) rows.push(['score', g.players.find((p) => p.id === s.pid).name, s.total, 'profit', s.profit, 'trust', s.trust]); }
    return { cols, rows };
  },
};
const E = K.make(spec);
E.R = Object.assign(E.R, R);

function decide(g, p) {
  const w = g.year, T = tiers(g), avgOf = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 4);
  const obs = p.hist.slice(-3).map((h) => h.demand); if (p.role === 0) obs.push(g.demand[w]);
  let avg = avgOf(obs);
  const down = p.role > 0 ? T[p.role - 1] : null;
  if (down && down.sharing && down.hist.length) avg = (avg + avgOf(down.hist.slice(-3).map((h) => h.demand))) / 2;
  const pipe = g.ship.filter((x) => x.to === p.role).reduce((s, x) => s + x.qty, 0), onOrder = p.role < 3 ? T[p.role + 1].owed : 0;
  // Steady: replace what was asked for and close half the gap to a three-week cover. Panic: chase the last order and forget what is already on its way.
  let order = avg + (avg * 3 + 2 - (p.stock + pipe + onOrder - p.owed)) / 2;
  if (p.bot === 'panic') order = lastDemand(p) * 4 + 4 + p.owed - (p.stock + pipe - p.owed);
  const clean = p.bot !== 'squeezer';
  return { order: clamp(Math.round(order), 0, R.maxOrder), freight: clean && p.owed > 5 && g.carbon + Math.round(order) <= R.carbonBudget - 12 ? 'air' : 'sea', pay: clean ? 'ontime' : 'late',
    action: !clean ? 'none' : !p.audited && w >= 1 && p.cash > 8 ? 'audit' : !p.nda && w >= 2 && p.cash > 8 ? 'nda' : 'none', defect: clean ? 'scrap' : 'pass' };
}
const B = K.bots(E, decide, ['steady', 'panic', 'squeezer'], { steady: 'SteadyCo', panic: 'PanicWorks', squeezer: 'Squeeze Ltd' });
module.exports = { E, B, ROLES, EVENTS, title: 'Chain Reaction' };
