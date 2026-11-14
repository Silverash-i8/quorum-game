'use strict';
// PATENT PENDING: rival start-ups bid in secret for patents, suppliers, data and carbon quota, then license to each other.
const K = require('./base');
const { err, money, half, clamp } = K;

const R = { version: 'patent-1.0', rounds: 6, start: { cash: 20, debt: 0, rep: 5, quota: 3 }, loan: 5, maxDebt: 10, interest: 0.5, price: [3, 4, 5.5, 7], dataBonus: 0.5,
  unitCost: { spot: 2.5, cheap: 1, cert: 1.5 }, royalties: [0.5, 1, 1.5, 2], reserve: { patent: 3, quota: 2, cheap: 1, cert: 2, clean: 2, grey: 1 },
  claim: { perUse: 3, rep: 2 }, dataAudit: { fine: 4, rep: 2 }, collapse: 3, levy: 0.5, liability: { infringe: 3, grey: 6, cheap: 4 }, patentValue: 4, royaltyMultiple: 2 };
const TECH = { M: 'Motor control', B: 'Battery management', A: 'Rider app' };
const P = (tech) => ({ kind: 'patent', tech, name: 'Patent: ' + TECH[tech], note: 'Use it free for the rest of the game and license it to rivals. Worth ' + money(R.patentValue) + ' at the end.', reserve: R.reserve.patent });
const Q = () => ({ kind: 'quota', name: 'Carbon quota', note: 'Make 1 more unit every round from now on.', reserve: R.reserve.quota });
const SUP = (type) => ({ kind: 'supplier', type, name: type === 'cert' ? 'Supplier contract: certified' : 'Supplier contract: unaudited', note: type === 'cert' ? 'Units cost ' + money(R.unitCost.cert) + ' instead of ' + money(R.unitCost.spot) + '. Audited. Reputation +1.' : 'Units cost ' + money(R.unitCost.cheap) + ' instead of ' + money(R.unitCost.spot) + '. No audit, no questions.', reserve: R.reserve[type] });
const D = (clean) => ({ kind: 'data', clean, name: clean ? 'Customer dataset, with consent trail' : 'Customer dataset, no paperwork', note: 'Every unit sells for ' + money(R.dataBonus) + ' more.' + (clean ? '' : ' Nobody can say where it came from.'), reserve: R.reserve[clean ? 'clean' : 'grey'] });
const LOTS = [[P('M'), Q(), SUP('cheap')], [P('B'), Q(), SUP('cert')], [P('A'), D(false), Q()], [P('M'), D(true), SUP('cert')], [P('B'), P('A'), Q()], [Q(), SUP('cheap'), D(false)]];
const EVENTS = {
  claim: { title: 'Infringement claims', text: 'Patent owners go to court. Every company that used a patent without a licence pays ' + money(R.claim.perUse) + ' for each use to the owner and loses ' + R.claim.rep + ' Reputation.' },
  dataAudit: { title: 'Data protection audit', text: 'The regulator asks where customer data came from. Each dataset with no paperwork is seized: ' + money(R.dataAudit.fine) + ' fine and ' + R.dataAudit.rep + ' Reputation.' },
  collapse: { title: 'Supplier collapse', text: 'The unaudited supplier is shut down overnight. Its customers lose the contract and pay ' + money(R.collapse) + ' for emergency supply.' },
  levy: { title: 'Carbon levy', text: 'A new levy: ' + money(R.levy) + ' on every unit made this round.' },
  quiet: { title: 'A quiet quarter', text: 'No surprises this round.' }, quiet2: { title: 'A quiet quarter', text: 'No surprises this round.' },
};
const BOTNAME = ['Volt & Co', 'Torque Labs', 'Amp Dynamics', 'Sprocket AI'];
const lots = (g) => LOTS[g.year].map((l, i) => Object.assign({ id: 'L' + i }, l));
const owners = (g, tech) => g.players.filter((p) => p.patents.includes(tech));
const unitCost = (p) => R.unitCost[p.supplier];
const techsOf = (p) => [...new Set(p.patents)];

function setup(g) {
  g.players.sort((a, b) => (a.bot ? 1 : 0) - (b.bot ? 1 : 0));
  while (g.players.length < 3) { const used = g.players.map((p) => p.colour); g.players.push({ id: 'p' + g.nextId++, name: BOTNAME[g.players.length], bot: 'builder', colour: K.COLOURS.find((c) => !used.includes(c)) }); }
  g.players.forEach((p) => Object.assign(p, R.start, { patents: [], supplier: 'spot', clean: 0, grey: 0, infringed: [], royaltyIn: 0, licensedOut: false, hist: [] }));
  g.deck = K.shuffle(g, Object.keys(EVENTS)); g.cur = { subs: {} }; g.phase = 'bid';
}

function checkBid(g, p, s) {
  const bids = {}, L = lots(g); let sum = 0;
  for (const l of L) { const b = (s.bids && s.bids[l.id]) || 0; if (!K.int(b, 0, 99)) return err('Bids are whole numbers of £m.'); if (b && b < l.reserve) return err('The lowest bid allowed for "' + l.name + '" is ' + money(l.reserve) + '.'); bids[l.id] = b; sum += b; }
  const loan = s.loan === true;
  if (loan && p.debt + R.loan > R.maxDebt) return err('The bank will not lend you more.');
  if (sum > p.cash + (loan ? R.loan : 0)) return err('Your bids add up to ' + money(sum) + ', more than the ' + money(p.cash + (loan ? R.loan : 0)) + ' you can pay.');
  return { ok: true, sub: { bids, loan } };
}
function resolveBid(g, subs) {
  for (const p of g.players) { p.open = p.cash; p.notes = []; if (subs[p.id].loan) { p.debt += R.loan; p.cash += R.loan; p.notes.push('Borrowed ' + money(R.loan)); } }
  g.cur.auction = lots(g).map((l) => {
    const ranked = g.players.map((p) => ({ p, b: subs[p.id].bids[l.id] || 0, r: K.rnd(g) })).filter((x) => x.b > 0).sort((a, b) => b.b - a.b || b.p.rep - a.p.rep || b.r - a.r);
    const out = { id: l.id, name: l.name, kind: l.kind, bidders: ranked.length, winner: null, price: 0, second: ranked[1] ? ranked[1].b : 0 };
    if (!ranked.length) return out;
    const w = ranked[0].p; out.winner = w.id; out.price = ranked[0].b; w.cash -= out.price; w.notes.push('Won "' + l.name + '" for ' + money(out.price));
    if (l.kind === 'patent') w.patents.push(l.tech);
    if (l.kind === 'quota') w.quota += 1;
    if (l.kind === 'supplier') { w.supplier = l.type; if (l.type === 'cert') w.rep = clamp(w.rep + 1, 0, 10); }
    if (l.kind === 'data') { if (l.clean) w.clean += 1; else w.grey += 1; }
    return out;
  });
  g.phase = 'price';
}
function offersOf(g) {
  const o = {};
  for (const t of Object.keys(TECH)) o[t] = owners(g, t).map((p) => ({ pid: p.id, royalty: (g.cur.royalty[p.id] || {})[t] })).filter((x) => typeof x.royalty === 'number').sort((a, b) => a.royalty - b.royalty);
  return o;
}
function resolveDeal(g, subs) {
  const offers = offersOf(g), rows = [];
  for (const p of g.players) { p.royaltyIn = 0; p.gotLicence = false; }
  for (const p of g.players) {
    const use = subs[p.id].use, own = techsOf(p), have = new Set(own), lic = [], inf = [];
    for (const t of Object.keys(TECH)) { if (have.has(t)) continue; if (use[t] === 'license' && offers[t].length) { lic.push({ t, to: offers[t][0].pid, royalty: offers[t][0].royalty }); have.add(t); } else if (use[t] === 'infringe' && owners(g, t).length) { inf.push({ t, to: owners(g, t)[0].id }); have.add(t); } }
    const units = p.quota, price = R.price[have.size] + (p.clean + p.grey > 0 ? R.dataBonus : 0), sales = units * price, cost = units * unitCost(p);
    let roy = 0;
    for (const l of lic) { const amt = l.royalty * units; roy += amt; const o = g.players.find((x) => x.id === l.to); o.cash += amt; o.royaltyIn += amt; o.gotLicence = true; }
    for (const i of inf) p.infringed.push({ tech: i.t, to: i.to, round: g.year + 1 });
    const interest = p.debt / R.loan * R.interest;
    p.cash += sales - cost - roy - interest;
    if (lic.length) p.notes.push('Licensed ' + lic.map((l) => TECH[l.t]).join(' and ') + ' for ' + money(roy));
    if (inf.length) p.notes.push('Used ' + inf.map((i) => TECH[i.t]).join(' and ') + ' without a licence');
    rows.push({ pid: p.id, units, techs: have.size, own: own.length, licensed: lic.length, price, sales, cost, royaltyPaid: roy, interest, infringedNow: inf.length });
  }
  for (const p of g.players) if (p.gotLicence && !p.licensedOut) { p.licensedOut = true; p.rep = clamp(p.rep + 1, 0, 10); p.notes.push('First licence granted to a rival. Reputation +1'); }
  const id = g.deck[g.year], hits = [];
  if (id === 'claim') for (const p of g.players) { if (!p.infringed.length) continue; for (const u of p.infringed) { const o = g.players.find((x) => x.id === u.to); p.cash -= R.claim.perUse; o.cash += R.claim.perUse; } p.rep = clamp(p.rep - R.claim.rep, 0, 10); p.notes.push('Infringement claim: paid ' + money(R.claim.perUse * p.infringed.length) + ', Reputation −' + R.claim.rep); hits.push(p.id); p.infringed = []; }
  if (id === 'dataAudit') for (const p of g.players) { if (!p.grey) continue; p.cash -= R.dataAudit.fine * p.grey; p.rep = clamp(p.rep - R.dataAudit.rep, 0, 10); p.notes.push('Data audit: ' + p.grey + ' dataset' + (p.grey > 1 ? 's' : '') + ' seized, ' + money(-R.dataAudit.fine * p.grey) + ', Reputation −' + R.dataAudit.rep); p.grey = 0; hits.push(p.id); }
  if (id === 'collapse') for (const p of g.players) { if (p.supplier !== 'cheap') continue; p.supplier = 'spot'; p.cash -= R.collapse; p.notes.push('Supplier collapse: contract lost, ' + money(-R.collapse)); hits.push(p.id); }
  if (id === 'levy') for (const p of g.players) { p.cash -= R.levy * p.quota; p.notes.push('Carbon levy: ' + money(-R.levy * p.quota)); }
  for (const p of g.players) { p.cash = half(p.cash); const row = rows.find((x) => x.pid === p.id); row.royaltyIn = p.royaltyIn; row.cash = p.cash;
    p.hist.push(Object.assign({ round: g.year + 1, open: p.open, debt: p.debt, rep: p.rep, patents: p.patents.length, quota: p.quota, supplier: p.supplier, notes: p.notes }, row)); }
  g.cur.market = { rows, event: { id, title: EVENTS[id].title, text: EVENTS[id].text, hits } };
  g.phase = 'market';
}
function finish(g) {
  const scores = g.players.map((p) => {
    const liab = p.infringed.length * R.liability.infringe + p.grey * R.liability.grey + (p.supplier === 'cheap' ? R.liability.cheap : 0);
    const assets = p.cash - p.debt + p.patents.length * R.patentValue + p.royaltyIn * R.royaltyMultiple, mult = 0.5 + p.rep / 10;
    return { pid: p.id, cash: p.cash, debt: p.debt, patents: p.patents.length, royalty: p.royaltyIn, assets: half(assets), rep: p.rep, mult, liab, found: { infringe: p.infringed.length, grey: p.grey, cheap: p.supplier === 'cheap' }, total: half(assets * mult - liab) };
  }).sort((a, b) => b.total - a.total || b.rep - a.rep);
  g.final = { scores, winner: scores[0].pid }; g.phase = 'final';
}

const spec = {
  id: 'patent', version: R.version, min: 1, max: 4, setup,
  decide: {
    bid: { check: checkBid, dflt: (g) => ({ bids: Object.fromEntries(lots(g).map((l) => [l.id, 0])), loan: false }), resolve: resolveBid },
    price: {
      check(g, p, s) { const royalty = {}; for (const t of techsOf(p)) { const v = s.royalty && s.royalty[t]; if (v !== 'refuse' && !R.royalties.includes(v)) return err('Set a royalty for ' + TECH[t] + ', or refuse to license it.'); royalty[t] = v; } return { ok: true, sub: { royalty } }; },
      dflt: (g, p) => ({ royalty: Object.fromEntries(techsOf(p).map((t) => [t, 1])) }), auto: (g, p) => (p.patents.length ? null : { royalty: {} }),
      resolve(g, subs) { g.cur.royalty = {}; for (const p of g.players) g.cur.royalty[p.id] = subs[p.id].royalty; g.phase = 'deal'; },
    },
    deal: {
      check(g, p, s) { const use = {}, offers = offersOf(g); for (const t of Object.keys(TECH)) { if (p.patents.includes(t)) continue; const v = (s.use && s.use[t]) || 'none'; if (!['none', 'license', 'infringe'].includes(v)) return err('Choose what to do about ' + TECH[t] + '.');
        if (v === 'license' && !offers[t].length) return err('Nobody is offering a licence for ' + TECH[t] + '.'); if (v === 'infringe' && !owners(g, t).length) return err('Nobody has patented ' + TECH[t] + ' yet.'); use[t] = v; } return { ok: true, sub: { use } }; },
      dflt: () => ({ use: {} }), auto: (g, p) => (Object.keys(TECH).some((t) => !p.patents.includes(t) && owners(g, t).length) ? null : { use: {} }), resolve: resolveDeal,
    },
  },
  next: { market(g) { if (g.year + 1 >= R.rounds) finish(g); else { g.year++; g.cur = { subs: {} }; g.phase = 'bid'; } } },
  pub: (g, p) => ({ rep: p.rep, patents: p.patents.slice(), quota: p.quota, supplier: p.supplier, data: p.clean + p.grey > 0 }),
  host(g) {
    return { round: g.year + 1, rounds: R.rounds, tech: TECH, lots: lots(g), auction: g.phase === 'bid' ? null : g.cur.auction, offers: ['deal', 'market'].includes(g.phase) ? offersOf(g) : null,
      // The big screen shows how many technologies each product uses, never whether they were licensed or copied.
      market: g.phase === 'market' ? { event: g.cur.market.event, rows: g.cur.market.rows.map((r) => ({ pid: r.pid, units: r.units, techs: r.techs, price: r.price, sales: r.sales, royaltyIn: r.royaltyIn })) } : null, final: g.final, liability: R.liability };
  },
  me(g, p) {
    const avail = {}; if (g.phase === 'deal') { const o = offersOf(g); for (const t of Object.keys(TECH)) if (!p.patents.includes(t) && owners(g, t).length) avail[t] = o[t][0] || null; }
    return { cash: p.cash, debt: p.debt, rep: p.rep, patents: p.patents.slice(), quota: p.quota, supplier: p.supplier, unitCost: unitCost(p), clean: p.clean, grey: p.grey, infringed: p.infringed.length, canLoan: p.debt + R.loan <= R.maxDebt,
      avail, hist: p.hist, rules: R };
  },
  report(g) { const cols = ['company', 'bot', 'round', 'open', 'units', 'techs', 'own', 'licensed', 'infringedNow', 'price', 'sales', 'cost', 'royaltyPaid', 'royaltyIn', 'interest', 'cash', 'debt', 'rep', 'patents', 'quota', 'supplier']; const rows = [];
    for (const p of g.players) for (const h of p.hist) rows.push(cols.map((c) => (c === 'company' ? p.name : c === 'bot' ? p.bot || '' : h[c])));
    if (g.final) { rows.push([]); for (const s of g.final.scores) rows.push(['valuation', g.players.find((p) => p.id === s.pid).name, s.total, 'assets', s.assets, 'reputation', s.rep, 'liabilities', s.liab]); }
    return { cols, rows }; },
};
const E = K.make(spec);
E.R = Object.assign(E.R, R);

// builder: pays for what it uses. landlord: buys patents to rent them out. pirate: bids low, copies, buys the cheap and the grey.
function decide(g, p, rand) {
  const left = R.rounds - g.year, style = p.bot;
  if (g.phase === 'bid') {
    const bids = {}; let budget = Math.max(0, p.cash - 2 * unitCost(p) * p.quota * 0.4);
    for (const l of lots(g)) {
      let v = 0;
      if (l.kind === 'patent') v = (p.patents.includes(l.tech) ? 1.2 : 1.3 * p.quota * 0.7) * left * (style === 'landlord' ? 1.2 : style === 'pirate' ? 0.4 : 0.8);
      if (l.kind === 'quota') v = 2 * left * 0.6;
      if (l.kind === 'supplier') v = l.type === 'cert' ? (p.supplier === 'cert' || style === 'pirate' ? 0 : (unitCost(p) - R.unitCost.cert) * p.quota * left * 0.6) : (style === 'pirate' && p.supplier !== 'cheap' ? (unitCost(p) - R.unitCost.cheap) * p.quota * left * 0.5 : 0);
      if (l.kind === 'data') v = p.clean + p.grey > 0 ? 0 : l.clean ? (style === 'pirate' ? 0 : R.dataBonus * p.quota * left * 0.9) : (style === 'pirate' ? R.dataBonus * p.quota * left * 0.9 : 0);
      let b = Math.floor(v * (0.6 + 0.4 * rand())); if (b < l.reserve) b = 0; b = Math.min(b, Math.floor(budget)); if (b < l.reserve) b = 0;
      bids[l.id] = b; budget -= b;
    }
    return { bids, loan: false };
  }
  if (g.phase === 'price') return { royalty: Object.fromEntries(techsOf(p).map((t) => [t, style === 'landlord' ? 1.5 : style === 'pirate' ? 2 : 1])) };
  const use = {}, offers = offersOf(g); let n = techsOf(p).length;
  for (const t of Object.keys(TECH)) { if (p.patents.includes(t) || !owners(g, t).length) continue; const gain = R.price[n + 1] - R.price[n];
    if (style === 'pirate') { use[t] = 'infringe'; n++; } else if (offers[t].length && offers[t][0].royalty <= gain) { use[t] = 'license'; n++; } else use[t] = 'none'; }
  return { use };
}
const B = K.bots(E, decide, ['builder', 'landlord', 'pirate'], { builder: 'Builder Co', landlord: 'Landlord IP', pirate: 'Copycat Ltd' });
module.exports = { E, B, TECH, EVENTS, title: 'Patent Pending' };
