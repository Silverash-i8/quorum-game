'use strict';
// QUORUM: four directors of one battery company. Private reports, private bonuses, secret votes.
const K = require('./base');
const { err, money, clamp } = K;

const R = { version: 'quorum-1.0', quarters: 8, start: { cash: 10, orders: 10, carbon: 0, risk: { safety: 3, supply: 3, comply: 3 } }, fixed: 4, creep: 1, conceal: 4, tablePoints: 1,
  incident: { safety: { title: 'Product recall', cash: 8, orders: 3 }, supply: { title: 'Supplier scandal', cash: 5, orders: 2 }, comply: { title: 'Regulator\'s fine', cash: 6, orders: 1 } }, cool: 3, maxIncidents: 3 };
const ROLES = [{ key: 'FD', name: 'Finance Director', end: 'Year-end bonus: 1 point for every £3m of closing cash.' }, { key: 'CE', name: 'Chief Engineer', end: 'Year-end bonus: 1 point for every 5 orders on the book.' },
  { key: 'SC', name: 'Supply Chain Director', end: 'Year-end bonus: 3 points if there is no supplier scandal.' }, { key: 'CO', name: 'Compliance Director', end: 'Year-end bonus: 3 points for no incidents at all, 1 point for one.' }];
const BOTNAME = ['F. Ledger', 'C. Torque', 'S. Freight', 'C. Statute'];
const GAUGES = { safety: 'Safety backlog', supply: 'Supplier risk', comply: 'Compliance risk' };
const routine = 'Nothing unusual in your area this quarter.';
// approve / reject: label, what the board is told (shown), real effects (fx), and personal bonus points by role.
const ITEMS = [
  { id: 'early', title: 'Ship six weeks early', story: 'Our biggest customer will double its order if the new pack ships six weeks ahead of plan.',
    approve: { label: 'Ship early', shown: 'Orders +4', fx: { orders: 4, safety: 3 }, bonus: { CE: 3, FD: 1, SC: 1 } }, reject: { label: 'Keep the test schedule', shown: 'Orders −1', fx: { orders: -1 }, bonus: {} },
    reports: { CE: { material: true, text: 'Three packs in 200 overheated in the final thermal test. The retest that would clear it takes five weeks.' } } },
  { id: 'cheap', title: 'Switch to the cheaper cell supplier', story: 'A new supplier undercuts our audited one by a fifth.',
    approve: { label: 'Switch supplier', shown: 'Cash +£4m', fx: { cash: 4, supply: 3, carbon: 2 }, bonus: { SC: 3, FD: 2 } }, reject: { label: 'Stay with the audited supplier', shown: 'No change', fx: {}, bonus: {} },
    reports: { SC: { material: true, text: 'The new supplier refused our audit visit and has no provenance papers for its cobalt.' } } },
  { id: 'data', title: 'Sell riders\' location data', story: 'An insurer will pay for the GPS trails our smart packs collect.',
    approve: { label: 'Sell the data', shown: 'Cash +£5m', fx: { cash: 5, comply: 3 }, bonus: { FD: 3, CE: 1 } }, reject: { label: 'Turn the insurer down', shown: 'No change', fx: {}, bonus: {} },
    reports: { CO: { material: true, text: 'Customers agreed to battery diagnostics only. Selling location trails breaks the purpose-limitation rule in UK GDPR.' } } },
  { id: 'cyber', title: 'Cut the cyber security budget', story: 'IT security is the largest overhead that has never produced a visible result.',
    approve: { label: 'Cut the budget', shown: 'Cash +£3m', fx: { cash: 3, comply: 2 }, bonus: { FD: 2, SC: 1 } }, reject: { label: 'Keep the budget', shown: 'No change', fx: {}, bonus: {} },
    reports: { CE: { material: true, text: 'Last month\'s penetration test reached the customer database from the factory network. It has not been fixed.' },
      FD: { material: true, text: 'Our cyber insurance is void if the security budget falls below this year\'s level.' } } },
  { id: 'rig', title: 'Buy the end-of-line test rig', story: 'Engineering wants an automated rig that tests every pack before it leaves.',
    approve: { label: 'Buy the rig', shown: 'Cash −£4m', fx: { cash: -4, safety: -3 }, bonus: { CE: 1, CO: 1 } }, reject: { label: 'Not this year', shown: 'No change', fx: {}, bonus: { FD: 2 } },
    reports: { FD: { material: false, text: 'Cash is tight. If cash falls below zero at the end of any quarter the bank calls in the loan and the company is finished.' } } },
  { id: 'latepay', title: 'Pay small suppliers 120 days late', story: 'Finance proposes stretching payment terms for suppliers too small to argue.',
    approve: { label: 'Stretch the terms', shown: 'Cash +£3m', fx: { cash: 3, supply: 2 }, bonus: { FD: 2 } }, reject: { label: 'Pay on time', shown: 'No change', fx: {}, bonus: { SC: 1 } },
    reports: { SC: { material: true, text: 'Two small suppliers will fail without prompt payment. One is the only source of our connectors.' } } },
  { id: 'label', title: 'Print "carbon neutral" on the box', story: 'Marketing says the label would win the city fleet tender this quarter.',
    approve: { label: 'Print the label', shown: 'Orders +3', fx: { orders: 3, comply: 3 }, bonus: { CE: 1, FD: 1, SC: 1 } }, reject: { label: 'Hold the label', shown: 'No change', fx: {}, bonus: {} },
    reports: { CO: { material: true, text: 'The offsets that would make the claim true have not been bought. The CMA Green Claims Code requires claims to be backed by evidence.' },
      FD: { material: true, text: 'The fleet tender has a clawback clause: the full contract value is repayable if any marketing claim is found to be false.' } } },
  { id: 'patent', title: 'Patent the balancing algorithm', story: 'Our cell-balancing method is a trade secret. Filing a patent would publish it and protect it.',
    approve: { label: 'File the patent', shown: 'Cash −£3m, Orders +2', fx: { cash: -3, orders: 2 }, bonus: { CE: 2 } }, reject: { label: 'Keep it secret', shown: 'Orders −1', fx: { orders: -1 }, bonus: { FD: 1 } },
    reports: { CE: { material: false, text: 'A rival\'s job adverts suggest they are six months behind us on the same idea. If they file first we would have to pay them.' } } },
  { id: 'audit', title: 'Fund a supplier audit programme', story: 'Compliance proposes visiting every tier-one and tier-two supplier this year.',
    approve: { label: 'Fund the audits', shown: 'Cash −£3m', fx: { cash: -3, supply: -3 }, bonus: { CO: 1 } }, reject: { label: 'Not this year', shown: 'No change', fx: {}, bonus: { SC: 1, FD: 1 } },
    reports: { SC: { material: false, text: 'A tier-two mine has had two accidents that never reached our reports.' } } },
  { id: 'inspect', title: 'Skip end-of-line inspection this quarter', story: 'The line is behind. Dropping the final inspection would recover the schedule.',
    approve: { label: 'Skip inspection', shown: 'Orders +2, Cash +£1m', fx: { orders: 2, cash: 1, safety: 2 }, bonus: { CE: 2, SC: 1, FD: 1 } }, reject: { label: 'Inspect every pack', shown: 'No change', fx: {}, bonus: {} },
    reports: { CE: { material: true, text: 'The last time inspection was skipped, 2% of packs reached customers with a wiring fault. Producers are liable for defective products under the Consumer Protection Act 1987.' } } },
  { id: 'files', title: 'Take a rival\'s design files', story: 'A job applicant from our main competitor offers to bring their cell-balancing design.',
    approve: { label: 'Take the files', shown: 'Orders +3', fx: { orders: 3, comply: 3 }, bonus: { CE: 3, FD: 1 } }, reject: { label: 'Refuse the files', shown: 'No change', fx: {}, bonus: {} },
    reports: { CO: { material: true, text: 'The applicant is bound by a confidentiality agreement. Using the files is actionable under the Trade Secrets Regulations 2018.' } } },
  { id: 'shift', title: 'Hire temporary staff for the rush order', story: 'A rush order needs either temporary staff or 14-hour night shifts for a month.',
    approve: { label: 'Hire temporary staff', shown: 'Cash −£2m', fx: { cash: -2 }, bonus: { CO: 1 } }, reject: { label: 'Extend the night shift', shown: 'No change', fx: { safety: 2 }, bonus: { SC: 1, FD: 1, CE: 1 } },
    reports: { SC: { material: true, text: 'The night shift\'s error rate doubled in the third week of the last overtime run.' } } },
];
const band = (v) => (v <= 3 ? 'low' : v <= 6 ? 'medium' : 'high');
const item = (g) => ITEMS[g.agenda[g.year]];
const roleOf = (p) => ROLES[p.role];
const riskyOpt = (it) => ['approve', 'reject'].find((o) => Object.keys(GAUGES).some((k) => (it[o].fx[k] || 0) > 0)) || null;

function setup(g) {
  g.players.sort((a, b) => (a.bot ? 1 : 0) - (b.bot ? 1 : 0));
  while (g.players.length < 4) { const used = g.players.map((p) => p.colour); g.players.push({ id: 'p' + g.nextId++, name: BOTNAME[g.players.length], bot: 'straight', colour: K.COLOURS.find((c) => !used.includes(c)) }); }
  g.players.forEach((p, i) => Object.assign(p, { role: i, bonus: 0, integrity: 0, penalty: 0, tabledN: 0, log: [] }));
  g.co = JSON.parse(JSON.stringify(R.start)); g.co.incidents = 0; g.co.kinds = [];
  g.agenda = K.shuffle(g, ITEMS.map((_, i) => i)).slice(0, R.quarters);
  g.passed = []; g.cur = { subs: {}, tabled: {} }; g.phase = 'brief';
}
const report = (g, p) => item(g).reports[roleOf(p).key] || { material: false, text: routine };

function resolveVote(g, subs) {
  const it = item(g), co = g.co, votes = { approve: 0, reject: 0 }, chips = { safety: 0, supply: 0, comply: 0, reserve: 0 };
  for (const p of g.players) { votes[subs[p.id].vote]++; chips[subs[p.id].chip]++; }
  const chair = g.players.find((p) => p.role === g.year % 4), tie = votes.approve === votes.reject;
  const opt = tie ? subs[chair.id].vote : votes.approve > votes.reject ? 'approve' : 'reject', o = it[opt];
  for (const k of Object.keys(o.fx)) { if (GAUGES[k]) co.risk[k] += o.fx[k]; else co[k] += o.fx[k]; }
  const bonuses = [];
  for (const p of g.players) { const b = o.bonus[roleOf(p).key] || 0; if (b) { p.bonus += b; bonuses.push({ pid: p.id, n: b }); } p.log.push({ q: g.year + 1, item: it.title, vote: subs[p.id].vote, chip: subs[p.id].chip, tabled: !!g.cur.tabled[p.id], passed: opt }); }
  g.passed.push({ q: g.year, id: it.id, title: it.title, opt, tabled: Object.assign({}, g.cur.tabled), punished: {} });
  for (const k of Object.keys(GAUGES)) co.risk[k] = clamp(co.risk[k] + R.creep - chips[k], 0, 10);
  const trading = Math.floor(co.orders / 2) - R.fixed;
  co.cash += trading + chips.reserve;
  const incidents = [];
  if (g.year % 2 === 1) for (const k of Object.keys(GAUGES)) {
    if (1 + K.pick(g, 10) > co.risk[k] - 2) continue;
    const def = R.incident[k], inquiry = [];
    co.cash -= def.cash; co.orders = Math.max(0, co.orders - def.orders); co.risk[k] = Math.max(0, co.risk[k] - R.cool); co.incidents++; co.kinds.push(k);
    for (const h of g.passed) { const hi = ITEMS.find((x) => x.id === h.id); if (!((hi[h.opt].fx[k] || 0) > 0)) continue;
      for (const p of g.players) { const rp = hi.reports[roleOf(p).key]; if (rp && rp.material && !h.tabled[p.id] && !h.punished[p.id]) { h.punished[p.id] = true; p.penalty += R.conceal; inquiry.push({ pid: p.id, title: h.title }); } } }
    incidents.push({ key: k, title: def.title, cash: def.cash, orders: def.orders, inquiry });
  }
  const lost = co.cash < 0 ? 'The company ran out of cash and the bank called in its loan.' : co.incidents >= R.maxIncidents ? 'After ' + co.incidents + ' serious incidents the regulator withdrew the company\'s licence.' : null;
  g.cur.result = { opt, label: o.label, shown: o.shown, votes, casting: tie ? chair.id : null, chips, trading, bonuses, incidents, lost };
  if (lost) { g.lost = lost; }
  g.phase = 'result';
}
function finish(g) {
  const co = g.co, value = co.cash + co.orders, audit = [];
  // Year-end audit: every board paper is read. A report kept back on a risky decision the board then took is always found.
  for (const h of g.passed) { const hi = ITEMS.find((x) => x.id === h.id); if (riskyOpt(hi) !== h.opt) continue;
    for (const p of g.players) { const rp = hi.reports[roleOf(p).key]; if (rp && rp.material && !h.tabled[p.id] && !h.punished[p.id]) { h.punished[p.id] = true; p.penalty += R.conceal; audit.push({ pid: p.id, title: h.title }); } } }
  const endBonus = (p) => [Math.max(0, Math.floor(co.cash / 3)), Math.floor(co.orders / 5), co.kinds.includes('supply') ? 0 : 3, co.incidents === 0 ? 3 : co.incidents === 1 ? 1 : 0][p.role];
  const scores = g.players.map((p) => { const share = g.lost ? 0 : Math.max(0, Math.round(value / 4)), end = g.lost ? 0 : endBonus(p);
    return { pid: p.id, share, bonus: g.lost ? 0 : p.bonus, end, integrity: p.integrity, penalty: p.penalty, total: g.lost ? 0 : share + p.bonus + end + p.integrity - p.penalty }; }).sort((a, b) => b.total - a.total || b.integrity - a.integrity);
  g.final = { lost: g.lost || null, audit, value, cash: co.cash, orders: co.orders, incidents: co.incidents, scores, winner: g.lost ? null : scores[0].pid };
  g.phase = 'final';
}

const spec = {
  id: 'quorum', version: R.version, min: 1, max: 4, setup,
  decide: {
    brief: { check: (g, p, s) => ({ ok: true, sub: { table: s.table === true } }), dflt: () => ({ table: false }),
      resolve(g, subs) { g.cur.tabled = {}; for (const p of g.players) if (subs[p.id].table) { g.cur.tabled[p.id] = true; p.tabledN++; if (report(g, p).material) p.integrity += R.tablePoints; } g.phase = 'vote'; } },
    vote: { check(g, p, s) { if (!['approve', 'reject'].includes(s.vote)) return err('Vote for one of the two options.'); if (!['safety', 'supply', 'comply', 'reserve'].includes(s.chip)) return err('Choose where your department\'s budget goes.'); return { ok: true, sub: { vote: s.vote, chip: s.chip } }; },
      dflt: () => ({ vote: 'reject', chip: 'reserve' }), resolve: resolveVote },
  },
  next: { result(g) { if (g.lost || g.year + 1 >= R.quarters) finish(g); else { g.year++; g.cur = { subs: {}, tabled: {} }; g.phase = 'brief'; } } },
  pub: (g, p) => ({ role: p.role, roleKey: roleOf(p).key, roleName: roleOf(p).name, tabled: g.phase !== 'brief' && !!(g.cur.tabled || {})[p.id] }),
  host(g) {
    const it = item(g), co = g.co, bands = {}; for (const k of Object.keys(GAUGES)) bands[k] = band(co.risk[k]);
    return { quarter: g.year + 1, quarters: R.quarters, co: { cash: co.cash, orders: co.orders, carbon: co.carbon, incidents: co.incidents, bands }, gauges: GAUGES, maxIncidents: R.maxIncidents, chair: g.players.find((p) => p.role === g.year % 4).id, checkNow: g.year % 2 === 1,
      item: { title: it.title, story: it.story, approve: { label: it.approve.label, shown: it.approve.shown }, reject: { label: it.reject.label, shown: it.reject.shown } },
      tabledReports: g.phase === 'brief' ? [] : g.players.filter((p) => g.cur.tabled[p.id]).map((p) => ({ pid: p.id, roleName: roleOf(p).name, text: report(g, p).text })),
      result: g.phase === 'result' ? g.cur.result : null, final: g.final };
  },
  me(g, p) { const it = item(g), k = roleOf(p).key;
    return { role: p.role, roleKey: k, roleName: roleOf(p).name, end: roleOf(p).end, report: report(g, p), bonusIf: { approve: it.approve.bonus[k] || 0, reject: it.reject.bonus[k] || 0 },
      bonus: p.bonus, integrity: p.integrity, penalty: p.penalty, log: p.log, rules: { conceal: R.conceal, tablePoints: R.tablePoints } }; },
  report(g) { const cols = ['director', 'role', 'bot', 'quarter', 'item', 'tabled_report', 'vote', 'budget', 'board_decision']; const rows = [];
    for (const p of g.players) for (const l of p.log) rows.push([p.name, roleOf(p).name, p.bot || '', l.q, l.item, l.tabled, l.vote, l.chip, l.passed]);
    if (g.final) { rows.push([]); rows.push(['company', g.final.lost || 'survived', 'cash', g.final.cash, 'orders', g.final.orders, 'incidents', g.final.incidents]); for (const s of g.final.scores) rows.push(['score', g.players.find((p) => p.id === s.pid).name, s.total, 'share', s.share, 'bonus', s.bonus + s.end, 'integrity', s.integrity, 'penalty', s.penalty]); }
    return { cols, rows }; },
};
const E = K.make(spec);
E.R = Object.assign(E.R, R);

// straight: tables what matters and votes for the company. hunter: hides reports that threaten its bonus and votes for its bonus.
function decide(g, p) {
  const it = item(g), k = roleOf(p).key, rp = report(g, p), risky = riskyOpt(it), mine = (o) => it[o].bonus[k] || 0, want = mine('approve') > mine('reject') ? 'approve' : mine('reject') > mine('approve') ? 'reject' : null;
  if (g.phase === 'brief') return { table: p.bot === 'hunter' ? rp.material && want !== risky : rp.material };
  const known = (rp.material && rp.text !== routine) || g.players.some((q) => g.cur.tabled[q.id] && report(g, q).material);
  const safe = risky === 'approve' ? 'reject' : 'approve';
  let vote = p.bot === 'hunter' ? (want || safe) : (known || !risky ? safe : want || 'reject');
  if (p.bot !== 'hunter' && !risky) vote = g.co.cash + (it.approve.fx.cash || 0) < 4 ? 'reject' : 'approve';
  const worst = Object.keys(GAUGES).sort((a, b) => g.co.risk[b] - g.co.risk[a])[0];
  const chip = p.bot === 'hunter' ? (k === 'FD' ? 'reserve' : k === 'CE' ? 'safety' : k === 'SC' ? 'supply' : 'comply') : g.co.cash < 5 ? 'reserve' : worst;
  return { vote, chip };
}
const B = K.bots(E, decide, ['straight', 'hunter'], { straight: 'A. Straight', hunter: 'B. Hunter' });
module.exports = { E, B, ROLES, ITEMS, GAUGES, title: 'Quorum' };
