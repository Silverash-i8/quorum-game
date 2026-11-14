'use strict';
(() => {
  const { money, chip, choice, stepper, esc, name } = Kit;
  const SUP = { spot: 'spot market', cheap: 'unaudited contract', cert: 'certified contract' };
  const letters = (p) => (p.patents.length ? p.patents.map((t) => '<span class="tag violet">' + t + '</span>').join(' ') : '<span>no patents</span>');
  function sold(s) { return '<div class="card"><h3>Under the hammer</h3><table><thead><tr><th>Lot</th><th>Won by</th><th class="r">Paid</th><th class="r">Bidders</th></tr></thead><tbody>' + s.auction.map((a) => '<tr><td>' + esc(a.name) + '</td><td>' + (a.winner ? chip(s, a.winner) : '<span class="soft">no bids</span>') + '</td><td class="r">' + (a.winner ? money(a.price) : '') + '</td><td class="r">' + a.bidders + '</td></tr>').join('') + '</tbody></table></div>'; }
  function offers(s) { const rows = Object.keys(s.tech).map((t) => { const own = s.players.filter((p) => p.patents.includes(t)); if (!own.length) return '<tr><td>' + esc(s.tech[t]) + '</td><td class="soft" colspan="2">not patented yet</td></tr>';
    return '<tr><td>' + esc(s.tech[t]) + '</td><td>' + own.map((p) => chip(s, p.id)).join(' ') + '</td><td>' + (s.offers[t].length ? s.offers[t].map((o) => esc(name(s, o.pid)) + ': ' + money(o.royalty) + ' a unit').join(', ') : 'refuses to license') + '</td></tr>'; }).join('');
    return '<div class="card"><h3>Licences on offer</h3><table><thead><tr><th>Technology</th><th>Patent held by</th><th>Royalty</th></tr></thead><tbody>' + rows + '</tbody></table></div>'; }
  Kit.register({
    title: 'Patent Pending', tagline: 'Bid in secret. License, or copy and hope nobody sues.',
    how: ['You run a start-up building e-bike drive systems for six rounds. The more technologies your product uses, the more each unit sells for.', 'Each round starts with a sealed-bid auction: patents, carbon quota, supplier contracts and customer data. The highest bid wins and pays what it bid.',
      'Patent owners then set a royalty. Everyone else chooses for each technology: pay for a licence, go without, or use it without a licence.', 'At the end a buyer inspects every company. Valuation is cash and patents, scaled by Reputation, minus every hidden liability it finds. Highest valuation wins.'],
    lobbyNote: 'Three or four companies. Empty seats up to three are filled by bots when you start.',
    progress: (s) => (s.phase === 'final' ? 'Final result' : 'Round ' + s.round + ' of ' + s.rounds), sideTitle: 'Companies',
    meter: (s, p) => '<span>Rep <b>' + p.rep + '</b></span><span>' + letters(p) + '</span><span>' + p.quota + ' units</span><span>' + SUP[p.supplier] + '</span>' + (p.data ? '<span>data</span>' : ''),
    nextLabel: (s) => (s.round >= s.rounds ? 'Run the due diligence' : 'Next round'),
    host(s) {
      if (s.phase === 'bid') return '<h1>Round ' + s.round + ': the lots</h1><p class="lede">Bid in secret on your phones. The highest bid wins each lot and pays what it bid. A tie goes to the higher Reputation.</p><div class="grid3">' +
        s.lots.map((l) => '<div class="card"><div class="kicker">Lowest bid ' + money(l.reserve) + '</div><h3>' + esc(l.name) + '</h3><p>' + esc(l.note) + '</p></div>').join('') + '</div>';
      if (s.phase === 'price') return '<h1>Sold</h1><p class="lede">Patent owners are now setting the royalty they will charge rivals this round.</p>' + sold(s);
      if (s.phase === 'deal') return '<h1>License, or copy?</h1><p class="lede">For each technology you do not own: pay the royalty, go without, or use it without a licence and hope nobody sues.</p>' + offers(s) + sold(s);
      if (s.phase === 'market') { const m = s.market, e = m.event;
        return '<h1>Round ' + s.round + ' sales</h1><div class="card"><table><thead><tr><th>Company</th><th class="r">Units</th><th class="r">Technologies</th><th class="r">Price a unit</th><th class="r">Sales</th><th class="r">Royalties earned</th></tr></thead><tbody>' +
          m.rows.map((r) => '<tr><td>' + chip(s, r.pid) + '</td><td class="r">' + r.units + '</td><td class="r">' + r.techs + '</td><td class="r">' + money(r.price) + '</td><td class="r">' + money(r.sales) + '</td><td class="r">' + (r.royaltyIn ? money(r.royaltyIn) : '') + '</td></tr>').join('') + '</tbody></table>' +
          '<p class="soft" style="margin-top:.5rem">Technologies counts patents, licences and anything used without a licence. The screen does not say which.</p></div>' +
          '<div class="card' + (e.hits.length ? ' risk' : '') + '"><div class="kicker">Event</div><h2>' + esc(e.title) + '</h2><p>' + esc(e.text) + '</p>' + (e.hits.length ? '<div class="row" style="margin-top:.6rem">' + e.hits.map((id) => chip(s, id)).join('') + '<b>hit</b></div>' : '') + '</div>'; }
      const f = s.final, rows = f.scores.map((x, i) => '<tr><td>' + (i + 1) + '</td><td>' + chip(s, x.pid) + '</td><td class="r">' + money(x.assets) + '</td><td class="r">× ' + x.mult.toFixed(1) + '</td><td class="r">' + (x.liab ? money(-x.liab) : 'none') + '</td><td class="r"><b>' + money(x.total) + '</b></td></tr>').join('');
      const found = f.scores.filter((x) => x.liab).map((x) => '<div class="row" style="margin-top:.3rem">' + chip(s, x.pid) + '<span>' + [x.found.infringe ? x.found.infringe + ' unlicensed use' + (x.found.infringe > 1 ? 's' : '') + ' of a rival\'s patent' : '', x.found.grey ? x.found.grey + ' dataset' + (x.found.grey > 1 ? 's' : '') + ' with no consent trail' : '', x.found.cheap ? 'an unaudited supplier' : ''].filter(Boolean).join(', ') + '</span></div>').join('');
      return '<div class="soft">Highest valuation</div><div class="k-big">' + esc(name(s, f.winner)) + '</div><p class="lede">The buyer values each company at its cash and patents, scaled by Reputation, less every liability found in due diligence.</p>' +
        '<div class="card"><table><thead><tr><th></th><th>Company</th><th class="r">Cash, patents, royalties</th><th class="r">Reputation</th><th class="r">Liabilities</th><th class="r">Valuation</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="card' + (found ? ' risk' : '') + '"><h3>What due diligence found</h3>' + (found || '<p>Nothing hidden in any company.</p>') + '</div>';
    },
    headBig: (s) => money(s.me.cash),
    head: (s) => '<span>Rep <b>' + s.me.rep + '</b></span><span>Makes <b>' + s.me.quota + '</b> units</span><span>Patents <b>' + (s.me.patents.join(' ') || 'none') + '</b></span>' + (s.me.debt ? '<span>Debt <b>' + money(s.me.debt) + '</b></span>' : ''),
    draft(s) { const d = { loan: false }; if (s.phase === 'bid') for (const l of s.lots) d['b_' + l.id] = 0;
      if (s.me.sub) { const u = s.me.sub; if (u.bids) { for (const k of Object.keys(u.bids)) d['b_' + k] = u.bids[k]; d.loan = u.loan; } if (u.royalty) for (const k of Object.keys(u.royalty)) d['r_' + k] = u.royalty[k]; if (u.use) for (const k of Object.keys(u.use)) d['u_' + k] = u.use[k]; }
      return d; },
    idle: (s) => (s.phase === 'price' && !s.me.patents.length) || (s.phase === 'deal' && !Object.keys(s.me.avail).length),
    ready(s, d) { const m = s.me;
      if (s.phase === 'bid') { let sum = 0; for (const l of s.lots) { const b = d['b_' + l.id] || 0; if (b && b < l.reserve) return 'Lowest bid for "' + l.name + '" is ' + money(l.reserve); sum += b; } const can = m.cash + (d.loan ? m.rules.loan : 0); return sum > can ? 'Bids of ' + money(sum) + ' are more than your ' + money(can) : true; }
      if (s.phase === 'price') return [...new Set(m.patents)].every((t) => d['r_' + t] !== undefined) ? true : 'Set a royalty for each patent';
      return Object.keys(m.avail).every((t) => d['u_' + t]) ? true : 'Choose for each technology'; },
    sub(s, d) { if (s.phase === 'bid') return { bids: Object.fromEntries(s.lots.map((l) => [l.id, d['b_' + l.id] || 0])), loan: !!d.loan };
      if (s.phase === 'price') return { royalty: Object.fromEntries([...new Set(s.me.patents)].map((t) => [t, d['r_' + t]])) };
      return { use: Object.fromEntries(Object.keys(s.me.avail).map((t) => [t, d['u_' + t]])) }; },
    submitLabel: (s) => (s.phase === 'bid' ? 'Seal my bids' : 'Lock in'),
    play(s, d) {
      const m = s.me, R = m.rules;
      if (s.phase === 'bid') { const sum = s.lots.reduce((a, l) => a + (d['b_' + l.id] || 0), 0);
        return '<h1>Round ' + s.round + ' auction</h1><div class="card">' + s.lots.map((l) => '<div class="k-lot"><div><b>' + esc(l.name) + '</b><small>' + esc(l.note) + ' Lowest bid ' + money(l.reserve) + '.</small></div>' + stepper('b_' + l.id, d, 0, 60) + '</div>').join('') +
          '<div class="lines" style="margin-top:.6rem"><div class="ln total"><span>Total bids</span><span>' + money(sum) + ' of ' + money(m.cash + (d.loan ? R.loan : 0)) + '</span></div></div></div>' +
          (m.canLoan ? '<div class="card"><h3>Borrow from the bank?</h3><div class="k-two">' + choice('loan', false, 'No loan', '', d) + choice('loan', true, 'Borrow ' + money(R.loan), money(R.interest) + ' interest every round', d) + '</div></div>' : '') +
          '<div class="card flat"><p>You make ' + m.quota + ' units a round at ' + money(m.unitCost) + ' each. A unit sells for ' + R.price.map((p, i) => money(p) + ' with ' + i).join(', ') + ' technologies.</p></div>'; }
      if (s.phase === 'price') { const own = [...new Set(m.patents)];
        if (!own.length) return '<h1>Sold</h1><div class="card"><p>You hold no patents, so there is nothing for you to price. Watch the big screen.</p></div>';
        return '<h1>Set your royalties</h1>' + own.map((t) => '<div class="card"><h3>' + esc(s.tech[t]) + '</h3><p class="soft">What rivals pay you for every unit they make with it this round.</p><div class="k-three" style="margin-top:.6rem">' + R.royalties.map((r) => choice('r_' + t, r, money(r), '', d)).join('') + choice('r_' + t, 'refuse', 'Refuse', '', d) + '</div></div>').join('') +
          '<div class="card flat"><p>A fair price brings income every round, and your first licence to a rival earns 1 Reputation. Refuse, and rivals may simply copy you.</p></div>'; }
      if (s.phase === 'deal') { const ts = Object.keys(m.avail);
        if (!ts.length) return '<h1>Nothing to license</h1><div class="card"><p>There is no technology on offer that you do not already own. Watch the big screen.</p></div>';
        return '<h1>License, or copy?</h1>' + ts.map((t) => { const o = m.avail[t];
          return '<div class="card"><h3>' + esc(s.tech[t]) + '</h3>' + (o ? choice('u_' + t, 'license', 'Pay ' + esc(name(s, o.pid)) + ' for a licence', money(o.royalty) + ' a unit, so ' + money(o.royalty * m.quota) + ' this round', d) : '<p class="soft">The owner refuses to license it.</p>') +
            choice('u_' + t, 'none', 'Go without', 'Your product is worth less', d) + choice('u_' + t, 'infringe', 'Use it without a licence', 'Free today. A liability of ' + money(R.liability.infringe) + ' each time, if it is found', d) + '</div>'; }).join('') +
          '<div class="card flat"><p>A unit sells for ' + R.price.map((p, i) => money(p) + ' with ' + i).join(', ') + ' technologies. You own ' + new Set(m.patents).size + ' and make ' + m.quota + ' units.</p></div>'; }
      if (s.phase === 'market') { const h = m.hist[m.hist.length - 1];
        return '<h1>Round ' + h.round + ' accounts</h1><div class="card"><div class="lines"><div class="ln"><span>' + h.units + ' units at ' + money(h.price) + '</span><b>' + money(h.sales) + '</b></div><div class="ln sub"><span>Cost of making them</span><span>' + money(-h.cost) + '</span></div>' +
          (h.royaltyPaid ? '<div class="ln sub"><span>Royalties paid</span><span>' + money(-h.royaltyPaid) + '</span></div>' : '') + (h.royaltyIn ? '<div class="ln sub"><span>Royalties earned</span><span>' + money(h.royaltyIn) + '</span></div>' : '') + (h.interest ? '<div class="ln sub"><span>Loan interest</span><span>' + money(-h.interest) + '</span></div>' : '') +
          '<div class="ln total"><span>Cash</span><span>' + money(h.open) + ' → ' + money(h.cash) + '</span></div></div></div>' + (h.notes.length ? '<div class="card"><h3>What happened</h3><ul class="note-list">' + h.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div>' : '') +
          (m.infringed || m.grey || m.supplier === 'cheap' ? '<div class="k-secret card"><div class="kicker">Only you can see this</div>Hidden liabilities: ' + [m.infringed ? m.infringed + ' unlicensed use' + (m.infringed > 1 ? 's' : '') : '', m.grey ? m.grey + ' dataset with no paperwork' : '', m.supplier === 'cheap' ? 'an unaudited supplier' : ''].filter(Boolean).join(', ') + '.</div>' : ''); }
      const f = s.final, x = f.scores.find((q) => q.pid === m.id), rank = f.scores.findIndex((q) => q.pid === m.id) + 1;
      return '<h1>' + (f.winner === m.id ? 'You win' : 'Due diligence') + '</h1><div class="card"><div class="lines"><div class="ln"><span>Cash less debt</span><b>' + money(x.cash - x.debt) + '</b></div><div class="ln"><span>' + x.patents + ' patent' + (x.patents === 1 ? '' : 's') + ' at ' + money(R.patentValue) + '</span><b>' + money(x.patents * R.patentValue) + '</b></div>' +
        '<div class="ln"><span>Royalty income × ' + R.royaltyMultiple + '</span><b>' + money(x.royalty * R.royaltyMultiple) + '</b></div><div class="ln"><span>Reputation ' + x.rep + '</span><b>× ' + x.mult.toFixed(1) + '</b></div><div class="ln"><span>Liabilities found</span><b>' + money(-x.liab) + '</b></div>' +
        '<div class="ln total"><span>Valuation, ' + rank + (['st', 'nd', 'rd'][rank - 1] || 'th') + ' of ' + f.scores.length + '</span><span>' + money(x.total) + '</span></div></div></div>';
    },
  });
})();
