'use strict';
(() => {
  const { money, pct, chip, gauge, stat, choice, stepper, esc, dot } = Kit;
  const ROLE_ORDER = (s) => s.players.slice().sort((a, b) => b.role - a.role);
  function chainRow(s) { return '<div class="row" style="gap:.4rem">' + ROLE_ORDER(s).map((p) => '<span class="chip">' + dot(p.colour) + esc(p.roleName) + '</span><b>→</b>').join('') + '<span class="tag yellow">Customers</span></div>'; }
  function meters(s) {
    const sv = s.service === null ? 1 : s.service;
    return '<div class="grid3"><div class="card">' + stat(s.service === null ? '–' : pct(sv), 'of customer orders delivered. The contract needs ' + pct(s.target)) + '<div style="margin-top:.6rem">' + gauge(sv, 1, sv < s.target ? 'bad' : '', s.target) + '</div></div>' +
      '<div class="card">' + stat(s.carbon + ' / ' + s.budget, 'carbon used of the chain\'s budget') + '<div style="margin-top:.6rem">' + gauge(s.carbon, s.budget, s.carbon > s.budget ? 'bad' : s.carbon > s.budget * 0.7 ? 'warn' : '') + '</div></div>' +
      '<div class="card">' + stat(s.eventWeeks.filter((w) => w >= s.week).length, 'events still to come, in weeks ' + s.eventWeeks.join(', ')) + '</div></div>';
  }
  function chart(f) {
    const W = 900, H = 330, L = 46, B = 34, T = 14, n = f.demand.length, max = Math.max(8, ...f.demand, ...f.series.flatMap((x) => x.orders));
    const x = (i) => L + i * (W - L - 12) / (n - 1), y = (v) => T + (H - T - B) * (1 - v / max), line = (a) => a.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
    let g = ''; for (let v = 0; v <= max; v += Math.ceil(max / 5)) g += '<line x1="' + L + '" x2="' + (W - 12) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#DDE2F5"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="13" fill="#4A5378">' + v + '</text>';
    for (let i = 0; i < n; i++) g += '<text x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="13" fill="#4A5378">' + (i + 1) + '</text>';
    const lines = f.series.map((sr) => '<path d="' + line(sr.orders) + '" fill="none" stroke="' + esc(sr.colour) + '" stroke-width="4" stroke-linejoin="round"/>').join('');
    return '<svg class="k-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Orders placed each week by every link in the chain, against customer demand">' + g + lines +
      '<path d="' + line(f.demand) + '" fill="none" stroke="#0C1230" stroke-width="4" stroke-dasharray="3 7" stroke-linecap="round"/></svg>' +
      '<div class="legend" style="margin-top:.5rem"><span><i style="background:#0C1230"></i>What customers wanted</span>' + f.series.map((sr) => '<span><i style="background:' + esc(sr.colour) + '"></i>' + esc(sr.role) + ' ordered</span>').join('') + '</div>';
  }
  Kit.register({
    title: 'Chain Reaction', tagline: 'Four links, one supply chain, and nobody can see anyone else\'s stock.',
    how: ['You are one link in an e-bike battery supply chain: Mine, Cell maker, Pack assembler or Retailer.', 'Each week you order from the link above you. Deliveries take two weeks by sea, or one week by air at extra cost and carbon.',
      'The chain keeps its contract only if customers get 85% of what they order and the chain stays inside its carbon budget. If not, nobody wins.', 'If the contract is kept, the winner is the best Partner Score: profit against your role\'s target, plus 3 points for every point of Trust.'],
    lobbyNote: 'This game always has four links. Empty seats are filled by bots when you start; the first to join is the Retailer.',
    progress: (s) => (s.phase === 'final' ? 'Final result' : 'Week ' + s.week + ' of ' + s.weeks), sideTitle: 'The chain',
    meter: (s, p) => '<span>' + esc(p.roleName) + '</span><span>Trust <b>' + p.trust + '</b></span>',
    nextLabel: (s) => (s.week >= s.weeks ? 'Reveal the result' : 'Start week ' + (s.week + 1)),
    host(s) {
      if (s.phase === 'order') return '<h1>Week ' + s.week + '</h1><p class="lede">Everyone is ordering in secret. Only the Retailer can see what customers want this week.</p>' + meters(s) + '<div class="card flat"><h3>Goods flow this way</h3>' + chainRow(s) + '</div>';
      if (s.phase === 'week') { const r = s.reveal, e = r.event;
        return '<h1>Week ' + r.week + ' results</h1><p class="lede">Customers wanted <b>' + r.demand + '</b> packs and received <b>' + r.delivered + '</b>.</p>' +
          (e ? '<div class="card risk"><div class="kicker">Event</div><h2>' + esc(e.title) + '</h2><p>' + esc(e.text) + '</p>' + (e.hits.length ? '<div class="row" style="margin-top:.6rem">' + e.hits.map((id) => chip(s, id)).join('') + '<b>hit</b></div>' : '') + '</div>' : '') + meters(s); }
      const f = s.final, rows = f.scores.map((x, i) => { const p = s.players.find((q) => q.id === x.pid); return '<tr><td>' + (i + 1) + '</td><td>' + chip(s, x.pid) + '</td><td>' + esc(p.roleName) + '</td><td class="r">' + money(x.profit) + '</td><td class="r">' + money(x.par) + '</td><td class="r">' + x.trust + '</td><td class="r"><b>' + x.total + '</b></td></tr>'; }).join('');
      return '<div class="soft">' + (f.ok ? 'Contract kept. Best partner' : 'Contract lost') + '</div><div class="k-big">' + (f.ok ? esc(Kit.name(s, f.winner)) : 'Nobody wins') + '</div>' +
        '<p class="lede">' + (f.ok ? 'Customers received ' + pct(f.service) + ' of their orders and the chain used ' + f.carbon + ' of ' + f.budget + ' carbon.' : f.why.map(esc).join(' ')) + (f.recalls ? ' ' + f.recalls + ' suspect batch' + (f.recalls > 1 ? 'es were' : ' was') + ' shipped and recalled.' : '') + '</p>' +
        '<div class="card"><h3>The bullwhip: what each link ordered</h3>' + chart(f.chart) + '<p class="soft" style="margin-top:.5rem">A small change in what customers want grows into big swings further up the chain, because each link guesses from the orders it receives.</p></div>' +
        '<div class="card"><table><thead><tr><th></th><th>Company</th><th>Link</th><th class="r">Profit</th><th class="r">Target</th><th class="r">Trust</th><th class="r">Partner Score</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    },
    headBig: (s) => money(s.me.cash),
    head: (s) => '<span>' + esc(s.me.roleName) + '</span><span>Stock <b>' + s.me.stock + '</b></span><span>Trust <b>' + s.me.trust + '</b></span>',
    draft: (s) => Object.assign({ order: Math.min(24, s.me.demandNow !== null ? s.me.demandNow : s.me.lastDemand), freight: 'sea', pay: 'ontime', action: 'none', defect: 'scrap' }, s.me.sub || {}),
    sub: (s, d) => d,
    submitLabel: () => 'Lock in this week',
    play(s, d) {
      const m = s.me, R = m.rules, mine = m.role === 3;
      if (s.phase === 'order') {
        const now = m.incoming.filter((x) => x.inWeeks === 0).reduce((a, x) => a + x.qty, 0), later = m.incoming.filter((x) => x.inWeeks > 0);
        return '<h1>Week ' + s.week + '</h1>' +
          '<div class="card"><h3>' + (m.role === 0 ? 'Customers want ' + m.demandNow + ' packs this week' : esc(m.customer) + ' ordered ' + m.lastDemand + ' last week') + '</h3><div class="k-kv">' +
          '<span>In your stock now</span><b>' + m.stock + '</b><span>Arriving this week</span><b>' + now + '</b>' + later.map((x) => '<span>Arriving in ' + x.inWeeks + ' week' + (x.inWeeks > 1 ? 's' : '') + '</span><b>' + x.qty + '</b>').join('') +
          (m.supplier ? '<span>Ordered, but ' + esc(m.supplier) + ' has not shipped</span><b>' + m.onOrder + '</b>' : '') + (m.role ? '<span>You still owe ' + esc(m.customer) + '</span><b>' + m.owed + '</b>' : '') +
          (m.unpaid ? '<span>Invoices you are holding back</span><b>' + money(m.unpaid) + '</b>' : '') + (m.awaited ? '<span>Your customer owes you</span><b>' + money(m.awaited) + '</b>' : '') + '</div>' +
          '<p class="soft" style="margin-top:.5rem">You sell at ' + money(m.sell) + ' and ' + (mine ? 'extract' : 'buy') + ' at ' + money(m.buy) + ' a unit. Stock costs ' + money(R.hold) + ' a unit each week; ' + (m.role ? 'units you owe cost ' + money(R.backlog) : 'a customer turned away costs ' + money(R.lost)) + '.</p></div>' +
          (m.shared ? '<div class="k-secret card"><div class="kicker">Shared with you by ' + esc(m.shared.name) + '</div>They hold <b>' + m.shared.stock + '</b> units. Their own customer asked for: <b>' + (m.shared.demand.join(', ') || 'nothing yet') + '</b>.</div>' : '') +
          (m.defect ? '<div class="card risk"><h3>' + m.defect + ' suspect units in your stock</h3><p>Quality control flagged a batch. Nobody else knows.</p><div style="margin-top:.6rem">' + choice('defect', 'scrap', 'Scrap the batch', 'You lose ' + m.defect + ' units. Trust +1.', d) + choice('defect', 'pass', 'Ship them anyway', 'Nothing happens now.', d) + '</div></div>' : '') +
          '<div class="card"><h3>' + (mine ? 'How much to extract' : 'Order from ' + esc(m.supplier)) + '</h3><div class="row" style="justify-content:space-between"><span>Units</span>' + stepper('order', d, 0, R.maxOrder) + '</div>' +
          '<div class="k-two" style="margin-top:.7rem">' + choice('freight', 'sea', mine ? 'Normal pace' : 'Sea freight', 'Arrives in 2 weeks', d) + choice('freight', 'air', mine ? 'Rush job' : 'Air freight', '1 week. ' + money(R.airCost) + ' and 1 carbon a unit', d) + '</div></div>' +
          (mine ? '' : '<div class="card"><h3>Pay ' + esc(m.supplier) + '</h3><div class="k-two">' + choice('pay', 'ontime', 'On delivery', 'As agreed', d) + choice('pay', 'late', 'Two weeks late', 'Keeps your cash. Trust −1', d) + '</div></div>') +
          '<div class="card"><h3>One extra move</h3>' + choice('action', 'none', 'Nothing this week', '', d) + choice('action', 'share', 'Share my order data', 'Your supplier sees your stock and orders. Free, but can leak.', d) +
          (m.nda ? '' : choice('action', 'nda', 'Sign a data-sharing agreement', money(R.cost.nda) + ' once. Shares safely every week. Trust +1', d)) + (m.audited ? '' : choice('action', 'audit', mine ? 'Pay for an independent audit' : 'Audit my supplier', money(R.cost.audit) + ' once. Trust +2', d)) + '</div>';
      }
      const h = m.hist[m.hist.length - 1];
      if (s.phase === 'week') return '<h1>Week ' + h.week + ' results</h1><div class="card"><div class="lines"><div class="ln"><span>You were asked for</span><b>' + h.demand + '</b></div><div class="ln"><span>You shipped</span><b>' + h.shipped + '</b></div>' +
        '<div class="ln"><span>Arrived into your stock</span><b>' + h.arrived + '</b></div><div class="ln"><span>Stock at the end of the week</span><b>' + h.stock + '</b></div>' + (m.role ? '<div class="ln"><span>Still owed to your customer</span><b>' + h.owed + '</b></div>' : '') +
        '<div class="ln sub"><span>Cost of holding stock</span><span>' + money(-h.hold) + '</span></div>' + (h.penalty ? '<div class="ln sub"><span>Cost of late orders</span><span>' + money(-h.penalty) + '</span></div>' : '') + (h.interest ? '<div class="ln sub"><span>Overdraft interest</span><span>' + money(-h.interest) + '</span></div>' : '') +
        '<div class="ln total"><span>Cash</span><span>' + money(h.open) + ' → ' + money(h.cash) + '</span></div></div></div>' + (h.notes.length ? '<div class="card"><h3>What happened</h3><ul class="note-list">' + h.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div>' : '');
      const f = s.final, x = f.scores.find((q) => q.pid === m.id), rank = f.scores.findIndex((q) => q.pid === m.id) + 1;
      return '<h1>' + (f.ok ? (f.winner === m.id ? 'You win' : 'Contract kept') : 'Contract lost') + '</h1><div class="card"><div class="lines"><div class="ln"><span>Profit, with stock valued at cost</span><b>' + money(x.profit) + '</b></div><div class="ln"><span>Target for a ' + esc(m.roleName) + '</span><b>' + money(-x.par) + '</b></div>' +
        '<div class="ln"><span>Trust ' + x.trust + ' × 3</span><b>' + x.trust * 3 + '</b></div><div class="ln total"><span>Partner Score, ' + rank + (['st', 'nd', 'rd'][rank - 1] || 'th') + ' of 4</span><span>' + x.total + '</span></div></div></div>' +
        '<div class="card flat"><p>' + (f.ok ? 'The chain delivered ' + pct(f.service) + ' of customer orders.' : esc(f.why.join(' ')) + ' Nobody wins when the chain fails.') + ' Look at the big screen to see how the orders grew along the chain.</p></div>';
    },
  });
})();
