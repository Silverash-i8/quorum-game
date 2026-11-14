'use strict';
// QUORUM: six directors of one battery company. Private reports, personal bonuses, secret votes.
const K = require('./base');
const { err, money, clamp } = K;

const R = { version: 'quorum-2.0', seats: 6, quarters: 8, start: { cash: 12, orders: 12, risk: { safety: 3, supply: 3, data: 3, conduct: 3 } }, fixed: 4, creep: 1, conceal: 4, tablePoints: 1,
  incident: { safety: { title: 'Product recall', cash: 8, orders: 3 }, supply: { title: 'Supplier scandal', cash: 5, orders: 2 }, data: { title: 'Data breach', cash: 6, orders: 2 }, conduct: { title: 'Regulator\'s fine', cash: 6, orders: 1 } },
  cool: 3, maxIncidents: 3, checkEvery: 2, shareOf: 4, review: { quarters: [4, 8], cash: 10, orders: 14 } };
const GAUGES = { safety: { name: 'Safety backlog', owner: 'CE', chip: 'Safety testing' }, supply: { name: 'Supplier risk', owner: 'SC', chip: 'Supplier audits' }, data: { name: 'Data risk', owner: 'IT', chip: 'Cyber security' }, conduct: { name: 'Conduct risk', owner: 'CO', chip: 'Compliance training' } };
const ROLES = [
  { key: 'FD', name: 'Finance Director', cares: 'cash in the bank', end: '1 point for every £5m of closing cash' },
  { key: 'CE', name: 'Chief Engineer', cares: 'safe, well-tested products', end: '3 points if there is no product recall all year' },
  { key: 'SD', name: 'Sales Director', cares: 'a full order book', end: '2 points for every 5 orders on the book at the end' },
  { key: 'CO', name: 'Compliance Director', cares: 'a clean record', end: '3 points for no incidents all year, 1 point for only one' },
  { key: 'SC', name: 'Supply Chain Director', cares: 'reliable, audited suppliers', end: '3 points if there is no supplier scandal all year' },
  { key: 'IT', name: 'Data and IT Director', cares: 'secure systems and data', end: '3 points if there is no data breach all year' },
];
const ROLE = Object.fromEntries(ROLES.map((r, i) => [r.key, i]));
const BOTNAME = ['F. Ledger', 'C. Torque', 'S. Pitch', 'C. Statute', 'S. Freight', 'D. Cipher'];
const ROUTINE = { FD: 'Finance has nothing unusual to report on this item.', CE: 'Engineering has nothing unusual to report on this item.', SD: 'Sales has nothing unusual to report on this item.',
  CO: 'Compliance has nothing unusual to report on this item.', SC: 'Supply chain has nothing unusual to report on this item.', IT: 'IT has nothing unusual to report on this item.' };
const o = (label, shown, fx, bonus) => ({ label, shown, fx, bonus });
const m = (text) => ({ material: true, text }), n = (text) => ({ material: false, text });
// kind: proposal (approve or reject), choice (pick one of several), crisis (something has already gone wrong).
// Each option: what the board is told (shown), the real effects (fx: cash, orders and the four risk gauges), and personal bonus points by role.
const ITEMS = [
  { id: 'early', kind: 'proposal', title: 'Ship six weeks early', story: 'Our biggest customer will double its order if the new pack ships six weeks ahead of plan.',
    options: [o('Ship early', 'Orders +4', { orders: 4, safety: 3 }, { SD: 3, CE: 2, FD: 1 }), o('Keep the test schedule', 'Orders −1', { orders: -1 }, { CO: 1 })],
    reports: { CE: m('Three packs in 200 overheated in the final thermal test. The retest that would clear the design takes five weeks.'), SD: m('The customer has told us privately that one field failure would end the whole contract.') } },
  { id: 'cheap', kind: 'proposal', title: 'Switch to the cheaper cell supplier', story: 'A new supplier undercuts our audited one by a fifth.',
    options: [o('Switch supplier', 'Cash +£4m', { cash: 4, supply: 3 }, { SC: 3, FD: 2 }), o('Stay with the audited supplier', 'No change', {}, {})],
    reports: { SC: m('The new supplier refused our audit visit and has no provenance papers for its cobalt.') } },
  { id: 'data', kind: 'proposal', title: 'Sell riders\' location data', story: 'An insurer will pay for the GPS trails our smart packs collect.',
    options: [o('Sell the data', 'Cash +£5m', { cash: 5, data: 2, conduct: 2 }, { FD: 3, SD: 2 }), o('Turn the insurer down', 'No change', {}, { IT: 1, CO: 1 })],
    reports: { CO: m('Customers agreed to battery diagnostics only. Selling location trails breaks the purpose-limitation rule in UK GDPR.'), IT: m('The data cannot be made anonymous: nine riders in ten can be identified from where their trail starts each morning.') } },
  { id: 'cyber', kind: 'proposal', title: 'Cut the cyber security budget', story: 'IT security is the largest overhead that has never produced a visible result.',
    options: [o('Cut the budget', 'Cash +£3m', { cash: 3, data: 3 }, { FD: 2, SC: 1 }), o('Keep the budget', 'No change', {}, { IT: 2 })],
    reports: { IT: m('Last month\'s penetration test reached the customer database from the factory network. It has not been fixed.'), FD: m('Our cyber insurance is void if the security budget falls below this year\'s level.') } },
  { id: 'rig', kind: 'proposal', title: 'Buy the end-of-line test rig', story: 'Engineering wants an automated rig that tests every pack before it leaves.',
    options: [o('Buy the rig', 'Cash −£4m', { cash: -4, safety: -3 }, { CE: 2, SD: 1, IT: 1 }), o('Not this year', 'No change', {}, { FD: 2 })],
    reports: { FD: n('Cash is tight. If cash is below zero at the end of any quarter the bank calls in the loan and the company is finished.'), CE: n('The rig would catch the wiring fault behind most of last year\'s warranty returns.') } },
  { id: 'latepay', kind: 'proposal', title: 'Pay small suppliers 120 days late', story: 'Finance proposes stretching payment terms for suppliers too small to argue.',
    options: [o('Stretch the terms', 'Cash +£3m', { cash: 3, supply: 2, conduct: 1 }, { FD: 2 }), o('Pay on time', 'No change', {}, { SC: 2, CO: 1 })],
    reports: { SC: m('Two small suppliers will fail without prompt payment. One is the only source of our connectors.'), FD: m('Our bank loan requires us to report how quickly we pay suppliers. 120 days would breach it.') } },
  { id: 'label', kind: 'proposal', title: 'Print "carbon neutral" on the box', story: 'Marketing says the label would win the city fleet tender this quarter.',
    options: [o('Print the label', 'Orders +3', { orders: 3, conduct: 3 }, { SD: 3, FD: 1 }), o('Hold the label', 'No change', {}, { CO: 1, SC: 1 })],
    reports: { SD: m('The fleet tender has a clawback clause: the whole contract value is repayable if any marketing claim is found to be false.'), SC: m('Our cell supplier\'s carbon figures have never been audited, so we cannot prove the claim. The CMA Green Claims Code requires evidence.') } },
  { id: 'patent', kind: 'proposal', title: 'Patent the balancing algorithm', story: 'Our cell-balancing method is a trade secret. Filing a patent would publish it and protect it.',
    options: [o('File the patent', 'Cash −£3m, Orders +2', { cash: -3, orders: 2 }, { CE: 2, SD: 1 }), o('Keep it secret', 'Orders −1', { orders: -1 }, { FD: 1, IT: 1 })],
    reports: { CE: n('A rival\'s job adverts suggest they are six months behind us on the same idea. If they file first we would have to pay them.'), IT: n('A patent publishes the method for anyone to read. Our secrecy controls have stopped two leaks this year.') } },
  { id: 'audit', kind: 'proposal', title: 'Fund a supplier audit programme', story: 'Compliance proposes visiting every tier-one and tier-two supplier this year.',
    options: [o('Fund the audits', 'Cash −£3m', { cash: -3, supply: -3 }, { SC: 2, CO: 1, SD: 1 }), o('Not this year', 'No change', {}, { FD: 2 })],
    reports: { SC: n('A tier-two mine has had two accidents that never reached our reports.') } },
  { id: 'inspect', kind: 'proposal', title: 'Skip end-of-line inspection this quarter', story: 'The line is behind. Dropping the final inspection would recover the schedule.',
    options: [o('Skip inspection', 'Orders +2, Cash +£1m', { orders: 2, cash: 1, safety: 3 }, { SD: 2, SC: 1, FD: 1 }), o('Inspect every pack', 'No change', {}, { CE: 1, SD: 1 })],
    reports: { CE: m('The last time inspection was skipped, 2% of packs reached customers with a wiring fault. Producers are liable for defective products under the Consumer Protection Act 1987.') } },
  { id: 'files', kind: 'proposal', title: 'Take a rival\'s design files', story: 'A job applicant from our main competitor offers to bring their cell-balancing design on a USB stick.',
    options: [o('Take the files', 'Orders +3', { orders: 3, conduct: 3, data: 1 }, { CE: 3, SD: 1 }), o('Refuse the files', 'No change', {}, { CO: 1, IT: 1 })],
    reports: { CO: m('The applicant is bound by a confidentiality agreement. Using the files is actionable under the Trade Secrets Regulations 2018.'), IT: m('An unknown USB stick on our network is exactly how the last breach at our sister company began.') } },
  { id: 'shift', kind: 'choice', title: 'Staffing the rush order', story: 'A rush order needs either temporary staff or 14-hour night shifts for a month.',
    options: [o('Hire temporary staff', 'Cash −£2m', { cash: -2 }, { CO: 1, CE: 1 }), o('Extend the night shift', 'No cost', { safety: 2, conduct: 1 }, { FD: 1, SC: 1, SD: 1 })],
    reports: { SC: m('The night shift\'s error rate doubled in the third week of the last overtime run. A month of 14-hour shifts also breaks the Working Time Regulations 1998.') } },
  { id: 'grant', kind: 'choice', title: 'A £6m innovation grant has arrived', story: 'The grant can be spent on one thing. Every department has a case.',
    options: [o('Automated test line', 'Safety programme', { safety: -3 }, { CE: 2, SD: 1 }), o('Security overhaul and supplier audits', 'Risk programme', { data: -2, supply: -2 }, { IT: 2, SC: 2 }), o('Bank it', 'Cash +£6m', { cash: 6 }, { FD: 3 })],
    reports: { FD: n('Cash below £5m makes the bank nervous. Below zero at the end of a quarter and the company is finished.'), CE: n('Warranty returns are running at twice last year\'s rate.'), IT: n('Two of our suppliers send us order data over unencrypted email.') } },
  { id: 'breach', kind: 'crisis', title: 'Customer records were copied last night', story: 'A hacker has emailed proof that 400 customer records were taken. Nobody outside the company knows yet.',
    options: [o('Report it and tell customers', 'Cash −£2m, Orders −1', { cash: -2, orders: -1, data: -1 }, { IT: 2, CO: 1 }), o('Fix it quietly', 'No cost', { conduct: 3, data: 1 }, { FD: 1, SD: 2 })],
    reports: { IT: m('The copy included home addresses. UK GDPR Article 33 requires a report to the regulator within 72 hours.'), CO: m('Hiding a breach that should have been reported multiplies the fine when it comes out.') } },
  { id: 'tender', kind: 'proposal', title: 'The fixer and the overseas tender', story: 'A local agent says a "facilitation fee" will win us the largest tender we have ever bid for.',
    options: [o('Pay the fee', 'Orders +5, Cash −£1m', { orders: 5, cash: -1, conduct: 4 }, { SD: 3, FD: 1, CE: 1 }), o('Bid without the agent', 'Orders +1', { orders: 1 }, { CO: 2, SD: 1 })],
    reports: { CO: m('Paying it is bribery. Under section 7 of the Bribery Act 2010 the company is liable for failing to prevent it.'), FD: m('The fee would have to be booked as consultancy with nothing delivered. Our auditors test exactly that.') } },
  { id: 'swollen', kind: 'crisis', title: 'Five packs have swollen in customers\' garages', story: 'Service centres report five swollen packs this month. Nobody has been hurt.',
    options: [o('Recall the batch now', 'Cash −£5m', { cash: -5, safety: -4 }, { CE: 2, SD: 1 }), o('Warn customers and offer inspections', 'Cash −£2m', { cash: -2, safety: -1 }, { SC: 1, IT: 1, CE: 1 }), o('Monitor quietly', 'No cost', { safety: 4 }, { FD: 2, SD: 2 })],
    reports: { CE: m('All five packs came from one cell batch. Six hundred more from that batch are in the field.'), SD: m('Two of the five customers have already posted photographs online.') } },
  { id: 'green', kind: 'choice', title: 'The carbon reduction plan', story: 'Customers are asking for our carbon figures. The board must choose how to respond this year.',
    options: [o('Sign a renewable power contract', 'Cash −£2m, Orders +1', { cash: -2, orders: 1 }, { SC: 2, SD: 1 }), o('Buy cheap offsets and announce net zero', 'Orders +2', { orders: 2, conduct: 2 }, { SD: 2, FD: 1 }), o('Do nothing this year', 'No change', {}, { FD: 1 })],
    reports: { SC: m('The offset broker cannot name a single project behind the credits it is selling.') } },
];
const KEYS = ['A', 'B', 'C'];
const band = (v) => (v <= 3 ? 'low' : v <= 6 ? 'medium' : 'high');
const item = (g) => ITEMS[g.agenda[g.year]];
const roleOf = (p) => ROLES[p.role];
const riskUp = (opt) => Object.keys(GAUGES).reduce((s, k) => s + Math.max(0, opt.fx[k] || 0), 0);
const report = (g, p) => item(g).reports[roleOf(p).key] || { material: false, text: ROUTINE[roleOf(p).key] };
const chairOf = (g) => g.players.find((p) => p.role === g.year % R.seats);
const value = (co) => co.cash + co.orders;
const endBonus = (co, p) => [Math.max(0, Math.floor(co.cash / 5)), co.kinds.includes('safety') ? 0 : 3, Math.floor(co.orders * 2 / 5), co.incidents === 0 ? 3 : co.incidents === 1 ? 1 : 0, co.kinds.includes('supply') ? 0 : 3, co.kinds.includes('data') ? 0 : 3][p.role];
const provisional = (g, p) => Math.max(0, Math.round(value(g.co) / R.shareOf)) + p.bonus + p.team + p.integrity - p.penalty + endBonus(g.co, p);

function setup(g) {
  g.players.sort((a, b) => (a.bot ? 1 : 0) - (b.bot ? 1 : 0));
  while (g.players.length < R.seats) { const used = g.players.map((p) => p.colour); g.players.push({ id: 'p' + g.nextId++, name: BOTNAME[g.players.length], bot: 'straight', colour: K.COLOURS.find((c) => !used.includes(c)) }); }
  const seats = K.shuffle(g, ROLES.map((_, i) => i));
  g.players.forEach((p, i) => Object.assign(p, { role: seats[i], bonus: 0, team: 0, integrity: 0, penalty: 0, tabledN: 0, log: [] }));
  g.co = JSON.parse(JSON.stringify(R.start)); g.co.incidents = 0; g.co.kinds = [];
  g.agenda = K.shuffle(g, ITEMS.map((_, i) => i)).slice(0, R.quarters);
  g.passed = []; g.history = []; g.cur = { subs: {}, tabled: {} }; g.phase = 'brief';
}

function resolveVote(g, subs) {
  const it = item(g), co = g.co, before = { cash: co.cash, orders: co.orders, bands: bandsOf(co) }, chair = chairOf(g);
  const votes = it.options.map(() => 0), chips = { safety: 0, supply: 0, data: 0, conduct: 0, reserve: 0 };
  for (const p of g.players) { votes[KEYS.indexOf(subs[p.id].vote)]++; chips[subs[p.id].chip]++; }
  const top = Math.max(...votes), leaders = votes.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0), ci = KEYS.indexOf(subs[chair.id].vote);
  // Most votes wins. A tie is settled by the chair's own vote; if the chair backed neither, the more cautious option stands.
  const win = leaders.length === 1 ? leaders[0] : leaders.includes(ci) ? ci : leaders.slice().sort((a, b) => riskUp(it.options[a]) - riskUp(it.options[b]) || a - b)[0];
  const opt = it.options[win];
  for (const k of Object.keys(opt.fx)) { if (GAUGES[k]) co.risk[k] += opt.fx[k]; else co[k] += opt.fx[k]; }
  co.orders = Math.max(0, co.orders);
  const bonuses = [];
  for (const p of g.players) { const b = opt.bonus[roleOf(p).key] || 0; if (b) { p.bonus += b; bonuses.push({ pid: p.id, n: b }); }
    p.log.push({ q: g.year + 1, item: it.title, vote: it.options[KEYS.indexOf(subs[p.id].vote)].label, chip: subs[p.id].chip, tabled: !!g.cur.tabled[p.id], passed: opt.label, bonus: b }); }
  g.passed.push({ q: g.year, id: it.id, title: it.title, win, tabled: Object.assign({}, g.cur.tabled), punished: {} });
  for (const k of Object.keys(GAUGES)) co.risk[k] = clamp(co.risk[k] + R.creep - chips[k], 0, 10);
  const trading = Math.floor(co.orders / 2) - R.fixed;
  co.cash += trading + chips.reserve;
  const incidents = [];
  if ((g.year + 1) % R.checkEvery === 0) for (const k of Object.keys(GAUGES)) {
    if (1 + K.pick(g, 10) > co.risk[k] - 2) continue;
    const def = R.incident[k], inquiry = [];
    co.cash -= def.cash; co.orders = Math.max(0, co.orders - def.orders); co.risk[k] = Math.max(0, co.risk[k] - R.cool); co.incidents++; co.kinds.push(k);
    for (const h of g.passed) { const hi = ITEMS.find((x) => x.id === h.id); if (!((hi.options[h.win].fx[k] || 0) > 0)) continue;
      for (const p of g.players) { const rp = hi.reports[roleOf(p).key]; if (rp && rp.material && !h.tabled[p.id] && !h.punished[p.id]) { h.punished[p.id] = true; p.penalty += R.conceal; inquiry.push({ pid: p.id, title: h.title }); } } }
    incidents.push({ key: k, title: def.title, gauge: GAUGES[k].name, cash: def.cash, orders: def.orders, inquiry });
  }
  // Half-year and year-end reviews: targets the whole board earns together.
  let review = null;
  if (R.review.quarters.includes(g.year + 1)) {
    const since = g.history.slice(-(R.checkEvery * 2 - 1)).reduce((s, h) => s + h.incidents, 0) + incidents.length;
    const targets = [{ label: 'No serious incident in the last four quarters', met: since === 0 }, { label: 'Cash of at least ' + money(R.review.cash), met: co.cash >= R.review.cash }, { label: 'At least ' + R.review.orders + ' orders on the book', met: co.orders >= R.review.orders }];
    const points = targets.filter((t) => t.met).length;
    for (const p of g.players) p.team += points;
    review = { title: g.year + 1 === R.quarters ? 'Year-end review' : 'Half-year review', targets, points };
  }
  const lost = co.cash < 0 ? 'The company ran out of cash and the bank called in its loan.' : co.incidents >= R.maxIncidents ? 'After ' + co.incidents + ' serious incidents the regulator withdrew the company\'s licence.' : null;
  g.cur.result = { win: KEYS[win], label: opt.label, shown: opt.shown, votes, casting: leaders.length > 1 && leaders.includes(ci) ? chair.id : null, tiedCautious: leaders.length > 1 && !leaders.includes(ci), chips, trading, bonuses, incidents, review, lost,
    delta: { cash: co.cash - before.cash, orders: co.orders - before.orders }, bandsBefore: before.bands };
  g.history.push({ q: g.year + 1, title: it.title, label: opt.label, votes: votes.slice(), cash: co.cash, orders: co.orders, incidents: incidents.length, incidentTitles: incidents.map((i) => i.title) });
  if (lost) g.lost = lost;
  g.phase = 'result';
}
function finish(g) {
  const co = g.co, audit = [];
  // Year-end audit: every board paper is read. A report kept back on a risky decision the board then took is always found.
  for (const h of g.passed) { const hi = ITEMS.find((x) => x.id === h.id); if (!riskUp(hi.options[h.win])) continue;
    for (const p of g.players) { const rp = hi.reports[roleOf(p).key]; if (rp && rp.material && !h.tabled[p.id] && !h.punished[p.id]) { h.punished[p.id] = true; p.penalty += R.conceal; audit.push({ pid: p.id, title: h.title }); } } }
  const scores = g.players.map((p) => { const share = g.lost ? 0 : Math.max(0, Math.round(value(co) / R.shareOf)), end = g.lost ? 0 : endBonus(co, p);
    return { pid: p.id, share, bonus: g.lost ? 0 : p.bonus, team: g.lost ? 0 : p.team, end, integrity: p.integrity, penalty: p.penalty, total: g.lost ? 0 : share + p.bonus + p.team + end + p.integrity - p.penalty }; }).sort((a, b) => b.total - a.total || b.integrity - a.integrity);
  g.final = { lost: g.lost || null, audit, value: value(co), cash: co.cash, orders: co.orders, incidents: co.incidents, scores, winner: g.lost ? null : scores[0].pid };
  g.phase = 'final';
}
const bandsOf = (co) => Object.fromEntries(Object.keys(GAUGES).map((k) => [k, band(co.risk[k])]));
// What everyone may know about an option: the stated effect, which risk areas it touches, and whose bonus rides on it.
const optionView = (g, it, opt, i) => ({ key: KEYS[i], label: opt.label, shown: opt.shown, touches: Object.keys(GAUGES).filter((k) => opt.fx[k]).map((k) => GAUGES[k].name),
  stakes: Object.keys(opt.bonus).filter((k) => opt.bonus[k] > 0).map((k) => ROLES[ROLE[k]].name) });

const spec = {
  id: 'quorum', version: R.version, min: 1, max: R.seats, setup,
  decide: {
    brief: { check: (g, p, s) => ({ ok: true, sub: { table: s.table === true } }), dflt: () => ({ table: false }),
      resolve(g, subs) { g.cur.tabled = {}; for (const p of g.players) if (subs[p.id].table) { g.cur.tabled[p.id] = true; p.tabledN++; if (report(g, p).material) p.integrity += R.tablePoints; } g.phase = 'vote'; } },
    vote: { check(g, p, s) { const it = item(g); if (!KEYS.slice(0, it.options.length).includes(s.vote)) return err('Vote for one of the options.'); if (!['safety', 'supply', 'data', 'conduct', 'reserve'].includes(s.chip)) return err('Choose where your department\'s budget goes.'); return { ok: true, sub: { vote: s.vote, chip: s.chip } }; },
      dflt: (g) => { const it = item(g); return { vote: KEYS[it.options.map((x, i) => i).sort((a, b) => riskUp(it.options[a]) - riskUp(it.options[b]) || b - a)[0]], chip: 'reserve' }; }, resolve: resolveVote },
  },
  next: { result(g) { if (g.lost || g.year + 1 >= R.quarters) finish(g); else { g.year++; g.cur = { subs: {}, tabled: {} }; g.phase = 'brief'; } } },
  pub: (g, p) => ({ role: p.role, roleKey: roleOf(p).key, roleName: roleOf(p).name, tabled: g.phase !== 'brief' && !!(g.cur.tabled || {})[p.id], tabledN: p.tabledN, bonus: p.bonus + p.team, penalty: p.penalty, provisional: g.lost ? 0 : provisional(g, p) }),
  host(g) {
    const it = item(g), co = g.co, left = R.checkEvery - 1 - (g.year % R.checkEvery);
    return { quarter: g.year + 1, quarters: R.quarters, co: { cash: co.cash, orders: co.orders, incidents: co.incidents, bands: bandsOf(co), value: value(co) },
      gauges: Object.fromEntries(Object.keys(GAUGES).map((k) => [k, { name: GAUGES[k].name, chip: GAUGES[k].chip, owner: ROLES[ROLE[GAUGES[k].owner]].name, incident: R.incident[k] }])),
      maxIncidents: R.maxIncidents, checkIn: left, chair: chairOf(g).id, review: R.review, fixed: R.fixed,
      item: { kind: it.kind, title: it.title, story: it.story, options: it.options.map((x, i) => optionView(g, it, x, i)), reportsHeld: g.players.filter((p) => report(g, p).material).length },
      tabledReports: g.phase === 'brief' ? [] : g.players.filter((p) => g.cur.tabled[p.id]).map((p) => ({ pid: p.id, roleName: roleOf(p).name, text: report(g, p).text, material: report(g, p).material })),
      result: g.phase === 'result' ? g.cur.result : null, history: g.history, final: g.final };
  },
  me(g, p) { const it = item(g), k = roleOf(p).key, co = g.co;
    return { role: p.role, roleKey: k, roleName: roleOf(p).name, cares: roleOf(p).cares, end: roleOf(p).end, endNow: endBonus(co, p), report: report(g, p), bonusIf: Object.fromEntries(it.options.map((x, i) => [KEYS[i], x.bonus[k] || 0])),
      bonus: p.bonus, team: p.team, integrity: p.integrity, penalty: p.penalty, share: Math.max(0, Math.round(value(co) / R.shareOf)), log: p.log, rules: { conceal: R.conceal, tablePoints: R.tablePoints, shareOf: R.shareOf } }; },
  report(g) { const cols = ['director', 'seat', 'bot', 'quarter', 'item', 'tabled_report', 'vote', 'budget', 'board_decision', 'bonus_from_vote']; const rows = [];
    for (const p of g.players) for (const l of p.log) rows.push([p.name, roleOf(p).name, p.bot || '', l.q, l.item, l.tabled, l.vote, l.chip, l.passed, l.bonus]);
    rows.push([]); rows.push(['quarter', 'item', 'decision', 'votes', 'cash', 'orders', 'incidents']); for (const h of g.history) rows.push([h.q, h.title, h.label, h.votes.join('-'), h.cash, h.orders, h.incidentTitles.join(' + ')]);
    if (g.final) { rows.push([]); rows.push(['company', g.final.lost || 'survived', 'cash', g.final.cash, 'orders', g.final.orders, 'incidents', g.final.incidents]); for (const s of g.final.scores) rows.push(['score', g.players.find((p) => p.id === s.pid).name, s.total, 'share', s.share, 'vote_bonus', s.bonus, 'team_bonus', s.team, 'year_end_bonus', s.end, 'integrity', s.integrity, 'penalty', s.penalty]); }
    return { cols, rows }; },
};
const E = K.make(spec);
E.R = Object.assign(E.R, R);

// straight: tables what matters and votes for the company. hunter: hides reports that threaten its bonus and votes for its bonus.
function decide(g, p) {
  const it = item(g), k = roleOf(p).key, rp = report(g, p), idx = it.options.map((_, i) => i), mine = (i) => it.options[i].bonus[k] || 0;
  const best = idx.slice().sort((a, b) => mine(b) - mine(a))[0], want = idx.every((i) => i === best || mine(i) < mine(best)) && mine(best) > 0 ? best : null;
  if (g.phase === 'brief') return { table: p.bot === 'hunter' ? rp.material && (want === null || !riskUp(it.options[want])) : rp.material };
  const known = rp.material || g.players.some((q) => g.cur.tabled[q.id] && report(g, q).material);
  const worth = (i) => { const f = it.options[i].fx; return (f.cash || 0) + (f.orders || 0) - 2 * Object.keys(GAUGES).reduce((s, x) => s + (f[x] || 0), 0); };
  const afford = idx.filter((i) => g.co.cash + (it.options[i].fx.cash || 0) >= 3), pool = afford.length ? afford : idx;
  const safe = pool.filter((i) => !riskUp(it.options[i])), prudent = (safe.length ? safe : pool).slice().sort((a, b) => worth(b) - worth(a))[0];
  // A director with nothing on the table goes by what the board has been told: the option that looks best for cash and orders.
  const looks = (i) => (it.options[i].fx.cash || 0) + (it.options[i].fx.orders || 0), blind = pool.slice().sort((a, b) => looks(b) - looks(a) || a - b)[0];
  const vote = p.bot === 'hunter' ? (want !== null ? want : known ? prudent : blind) : known ? prudent : want !== null ? want : blind;
  const worst = Object.keys(GAUGES).sort((a, b) => g.co.risk[b] - g.co.risk[a])[0], own = Object.keys(GAUGES).find((x) => GAUGES[x].owner === k);
  return { vote: KEYS[vote], chip: p.bot === 'hunter' ? (k === 'FD' || k === 'SD' ? 'reserve' : own) : g.co.cash < 6 ? 'reserve' : own && g.co.risk[own] >= 3 ? own : worst };
}
const B = K.bots(E, decide, ['straight', 'hunter'], { straight: 'A. Straight', hunter: 'B. Hunter' });
module.exports = { E, B, ROLES, ITEMS, GAUGES, KEYS, title: 'Quorum' };
