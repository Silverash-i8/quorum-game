'use strict';
(function () {
  const { $, esc, money, plural, store, api, poll, pips, dot, SEG, SUP, clock } = App;
  const root = $('#app');
  let code = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  let seat = null, state = null, link = 'ok', err = '', busy = false, sheet = false, deadlineAt = 0;
  let draft = null, draftKey = '', editing = false;

  // ---------- joining
  function joinScreen(msg) {
    root.innerHTML = '<div class="landing"><div class="wordmark" style="font-size:4.2rem">Cell Out</div><form class="card stack" id="join" novalidate>' +
      '<h2 style="font-size:1.8rem">Join the game</h2>' +
      '<div><label class="field" for="code">Game code on the big screen</label><input type="text" id="code" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" value="' + esc(code) + '" style="text-transform:uppercase;letter-spacing:.2em;font-size:1.5rem"></div>' +
      '<div><label class="field" for="name">Your company name</label><input type="text" id="name" maxlength="16" autocomplete="off" placeholder="For example VoltWorks"></div>' +
      (msg ? '<div class="error" role="alert">' + esc(msg) + '</div>' : '') +
      '<button class="btn wide" type="submit">Join</button></form></div>';
    const f = $('#join'), saved = store.get('cellout.lastName');
    if (saved) $('#name').value = saved;
    (code ? $('#name') : $('#code')).focus();
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); if (busy) return;
      const c = $('#code').value.toUpperCase().replace(/[^A-Z]/g, ''), name = $('#name').value.trim();
      if (c.length !== 4) return joinScreen('The game code is the four letters on the big screen.');
      if (!name) { code = c; return joinScreen('Enter a company name.'); }
      busy = true; const r = await api('POST', '/api/rooms/' + c + '/join', { name }); busy = false; code = c;
      if (!r.ok) return joinScreen(r.error);
      seat = { pid: r.pid, token: r.token }; store.set('cellout.seat.' + code, seat); store.set('cellout.lastName', name);
      history.replaceState(null, '', '/play?room=' + code);
      startGame();
    });
  }
  function startGame() {
    root.innerHTML = '<div class="landing"><p>Connecting…</p></div>';
    poll((v) => '/api/rooms/' + code + '/player?pid=' + seat.pid + '&token=' + seat.token + '&v=' + v, (s) => {
      state = s; deadlineAt = s.remainingMs === null ? 0 : Date.now() + s.remainingMs;
      const k = s.phase + ':' + s.year;
      if (k !== draftKey) { draftKey = k; draft = null; editing = false; err = ''; window.scrollTo(0, 0); }
      render();
    }, (st) => {
      if (st && st.fatal) { store.del('cellout.seat.' + code); seat = null; state = null; return joinScreen(st.fatal); }
      if (st !== link) { link = st; if (state) render(); }
    });
  }

  // ---------- actions
  async function submit(sub) {
    if (busy) return; busy = true; render();
    const r = await api('POST', '/api/rooms/' + code + '/act', { pid: seat.pid, token: seat.token, sub });
    busy = false;
    if (!r.ok) { err = r.error; render(); return; }
    err = ''; editing = false; state.me.sub = sub; render();
  }
  const me = () => state.me;
  const R = () => state.rules;

  // boardroom helpers
  const OPTIONS = () => [
    { key: 'line', id: 'line', name: 'Build a production line', cost: R().lineCost, fx: '+2 units of capacity every year. ' + money(R().runCost) + ' a year to run.' },
    { key: 'rd-patent', id: 'rd', protect: 'patent', name: 'R&D and patent it', cost: R().cost.rd + R().cost.patent, fx: 'New technology, protected and public. Opens Premium. Worth 2 points.' },
    { key: 'rd-secret', id: 'rd', protect: 'secret', name: 'R&D, keep it secret', cost: R().cost.rd, fx: 'New technology, hidden. Opens Premium. Worth 1 point, but a breach or a rival can take it.' },
    { key: 'qa', id: 'qa', name: 'Quality assurance system', cost: R().cost.qa, fx: 'Permanent. Product recalls no longer hit you.' },
    { key: 'cyber', id: 'cyber', name: 'Cyber security', cost: R().cost.cyber, fx: 'Cyber +1. Level 2 stops breaches and adds ' + money(R().cyberBonus) + ' to each Premium unit.' },
    { key: 'sust', id: 'sust', name: 'Sustainability upgrade', cost: R().cost.sust, fx: 'Sustainability +1. The Green market needs ' + R().greenSust + '.' },
    { key: 'recyc', id: 'recyc', name: 'Recycling partnership', cost: R().cost.recyc, fx: 'Permanent. Sustainability +1 and first place in the LoopCell queue.' },
    { key: 'mkt', id: 'mkt', name: 'Marketing', cost: R().cost.mkt, fx: 'Reputation +1. Reputation decides who is served first.' },
  ];
  function boardSim(d) {
    const m = me(), s = { cash: m.cash, debt: m.debt, lines: m.lines, rep: m.rep, sust: m.sust, cyber: m.cyber, qa: m.qa, recyc: m.recyc };
    if (d.loan === 'take') { s.cash += R().loan; s.debt += R().loan; }
    if (d.loan === 'repay') { s.cash -= R().loan; s.debt -= R().loan; }
    for (const a of d.actions) {
      const o = OPTIONS().find((x) => x.key === a); s.cash -= o.cost;
      if (o.id === 'line') s.lines++; if (o.id === 'qa') s.qa = true; if (o.id === 'cyber') s.cyber++; if (o.id === 'sust') s.sust++;
      if (o.id === 'recyc') { s.recyc = true; s.sust = Math.min(10, s.sust + 1); } if (o.id === 'mkt') s.rep++;
    }
    return s;
  }
  function whyNot(o, s, count) {
    if (count >= 2) return 'You already have 2 actions.';
    if (o.id === 'line' && s.lines >= R().maxLines) return 'You already have ' + R().maxLines + ' lines.';
    if (o.id === 'qa' && s.qa) return 'You already have this.';
    if (o.id === 'recyc' && s.recyc) return 'You already have this.';
    if (o.id === 'cyber' && s.cyber >= 3) return 'Cyber is already at its maximum.';
    if (o.id === 'sust' && s.sust >= 10) return 'Sustainability is already 10.';
    if (o.id === 'mkt' && s.rep >= 10) return 'Reputation is already 10.';
    if (s.cash < o.cost) return 'You are ' + money(o.cost - s.cash) + ' short.';
    return '';
  }
  function supplyCost(d) {
    const pr = state.price, pv = pr.valley, pl = me().loopPrice;
    const list = d.valley * pv + d.nordic * pr.nordic + d.loop * pl;
    const max = d.valley * pv + d.nordic * (d.fallback ? Math.max(pr.nordic, pv) : pr.nordic) + d.loop * (d.fallback ? Math.max(pl, pv) : pl);
    return { list, max };
  }

  // ---------- pieces
  function head() {
    const m = me();
    if (state.phase === 'lobby') return '<header class="p-head"><div class="row"><div class="co">' + dot(m.colour) + '<span>' + esc(m.name) + '</span></div><span class="soft">Game ' + esc(state.code) + '</span></div></header>';
    return '<header class="p-head"><div class="row"><div class="co">' + dot(m.colour) + '<span>' + esc(m.name) + '</span></div>' +
      '<div class="cash num" aria-label="Cash">' + money(m.cash) + '</div><button class="btn ghost small" data-sheet>My company</button></div>' +
      '<div class="stats"><span>Rep <b>' + m.rep + '</b> ' + pips('rep', m.rep, 10) + '</span><span>Sust <b>' + m.sust + '</b> ' + pips('sust', m.sust, 10) + '</span><span>Cyber <b>' + m.cyber + '</b></span>' +
      (m.debt ? '<span>Debt <b>' + money(m.debt) + '</b></span>' : '') + (m.skeletons ? '<span>Skeletons <b>' + m.skeletons + '</b></span>' : '') + '</div></header>';
  }
  function waiting(text) { return '<div class="card flat center"><p>' + text + '</p></div>'; }
  function locked(summary) {
    const left = state.players.filter((p) => !p.done).length;
    return '<div class="card locked"><div class="display">Locked in</div><p style="margin:.5rem 0 1rem">' + summary + '</p><p class="soft">Waiting for ' + plural(left, 'other company', 'other companies') + '.</p>' +
      '<button class="btn ghost" data-edit style="margin-top:1rem">Change my choice</button></div>';
  }
  function marketCard() {
    const d = state.demand, pr = state.price, m = me();
    const row = (id, ok, need) => '<tr><td><b>' + SEG[id] + '</b></td><td class="r num">' + d[id] + '</td><td class="r num">' + money(pr[id] + (id === 'premium' && m.cyber >= R().cyberData ? R().cyberBonus : 0)) + '</td><td>' + (ok ? '<span class="tag mint">You can sell</span>' : '<span class="tag red">' + need + '</span>') + '</td></tr>';
    return '<div class="card"><h3>Customers this year</h3><table><thead><tr><th>Market</th><th class="r">Wants</th><th class="r">Pays</th><th></th></tr></thead><tbody>' +
      row('premium', m.premiumOk, 'Needs a technology') + row('green', m.greenOk, 'Needs Sust ' + R().greenSust) + row('budget', true, '') + '</tbody></table>' +
      '<p class="soft" style="margin-top:.4rem">Shared between ' + plural(state.players.length, 'company', 'companies') + '. Unsold units clear at ' + money(R().clearance) + '.</p></div>';
  }
  function notes(from) {
    const n = (me().notes || []).slice(from || 0);
    return n.length ? '<ul class="note-list">' + n.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '';
  }
  function accounts(h) {
    const ln = (a, b, cls) => '<div class="ln ' + (cls || '') + '"><span>' + a + '</span><span class="num">' + b + '</span></div>';
    const sold = ['premium', 'green', 'budget'].filter((k) => h.sold[k]).map((k) => h.sold[k] + ' ' + SEG[k]).join(', ') || 'nothing sold';
    return '<div class="lines">' + ln('Cash at start of year', money(h.open)) +
      ln('Sales (' + sold + ')', '+' + money(h.sales)) + (h.clearance ? ln('Clearance of ' + plural(h.cleared, 'unsold unit'), '+' + money(h.clearance)) : '') + (h.other ? ln('Other income', '+' + money(h.other)) : '') +
      ln('Cells', money(-h.cells)) + ln('Running the lines', money(-h.running)) + ln('Investments', money(-h.invest)) + (h.interest ? ln('Loan interest', money(-h.interest)) : '') + (h.incidents ? ln('Fines and incidents', money(-h.incidents)) : '') +
      ln('Profit before tax', money(h.pbt), 'total') + ln('Tax', money(-h.tax)) + (h.capex ? ln('New production line', money(-h.capex)) : '') + (h.loanIn ? ln('Loans taken', '+' + money(h.loanIn)) : '') + (h.loanOut ? ln('Loans repaid', money(-h.loanOut)) : '') +
      ln('Cash at end of year', money(h.close), 'total') + ln('Debt ' + money(h.debt) + ', ' + plural(h.lines, 'line') + ' worth ' + money(3 * h.lines), 'Net worth ' + money(h.netWorth), 'sub') + '</div>';
  }
  function sheetView() {
    const m = me(), H = m.hist || [];
    // Same rows, in the same order, as the paper datasheet, so copying is line by line.
    const rows = [['Units made', (h) => h.units], ['Sold to Premium', (h) => h.sold.premium], ['Sold to Green', (h) => h.sold.green], ['Sold to Budget', (h) => h.sold.budget],
      ['Sales, including clearance and other income', (h) => h.sales + h.clearance + h.other], ['Cell costs', (h) => h.cells], ['Running the lines', (h) => h.running], ['Investments', (h) => h.invest], ['Loan interest', (h) => h.interest], ['Fines and incidents', (h) => h.incidents],
      ['Profit before tax', (h) => h.pbt], ['Tax', (h) => h.tax], ['Cash at end of year', (h) => h.close], ['Debt', (h) => h.debt], ['Production lines', (h) => h.lines], ['Net worth', (h) => h.netWorth],
      ['Reputation', (h) => h.rep], ['Sustainability', (h) => h.sust], ['Cyber', (h) => h.cyber], ['Patents', (h) => h.patents], ['Trade secrets', (h) => h.secrets], ['Valley cells, running total', (h) => h.valleyTotal]];
    return '<div class="sheet" role="dialog" aria-label="My company"><div class="row"><h2 class="grow">' + esc(m.name) + '</h2><button class="btn small" data-sheet>Close</button></div>' +
      '<p style="margin:.6rem 0"><b>Now:</b> cash ' + money(m.cash) + ', debt ' + money(m.debt) + ', ' + plural(m.lines, 'line') + ' (' + m.capacity + ' units a year), net worth ' + money(m.netWorth) + '.</p>' +
      '<p style="margin:.6rem 0">' + (m.qa ? '<span class="tag yellow">QA system</span> ' : '') + (m.recyc ? '<span class="tag mint">Recycling partner</span> ' : '') + '<span class="tag violet">' + plural(m.patents, 'patent') + '</span> <span class="tag violet">' + plural(m.secrets, 'trade secret') + '</span> ' + (m.skeletons ? '<span class="tag red">' + plural(m.skeletons, 'Skeleton') + ' hidden</span>' : '<span class="tag">No Skeletons</span>') + '</p>' +
      '<h3 style="margin:1rem 0 .4rem">Datasheet</h3>' + (H.length ? '<div class="scroll-x"><table><thead><tr><th></th>' + H.map((h) => '<th class="r">' + h.year + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr><td>' + r[0] + '</td>' + H.map((h) => '<td class="r num">' + r[1](h) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><p class="soft" style="margin-top:.5rem">Money in \u00a3m. Copy each column to your paper datasheet at the end of the year.</p>' : '<p class="soft">Your first row appears after the first year’s sales.</p>') + '</div>';
  }

  // ---------- phases
  function body() {
    const s = state, m = me(), y = s.yearLabel;
    switch (s.phase) {
      case 'lobby':
        return { main: '<h1>You are in</h1><div class="card"><p>You run <b>' + esc(m.name) + '</b>, a battery-pack maker. Five years, 2027 to 2031.</p><p style="margin-top:.6rem">The winner has the highest <b>Enterprise Score</b>: net worth, plus Reputation, Sustainability, patents and trade secrets. The richest company does not always win.</p></div>' +
          '<div class="card"><h3>Each year</h3><ol class="note-list"><li>News: what the market wants</li><li>A dilemma: do it properly, or take a shortcut</li><li>Boardroom: up to 2 actions</li><li>Buy cells and make packs</li><li>Risk cards</li><li>Sales and accounts</li></ol></div>' + waiting('Waiting for the host to start. ' + plural(s.players.length, 'company has', 'companies have') + ' joined.') };
      case 'news':
        return { main: '<h1>' + y + '</h1><div class="card"><div class="kicker">This year’s news</div><h2>' + esc(s.event.title) + '</h2><p>' + esc(s.event.text) + '</p></div>' + marketCard() + waiting('Look at the big screen. The host will open the dilemma.') };
      case 'dilemma': {
        if (m.sub && !editing) return { main: '<h1>Dilemma</h1>' + locked(m.sub.choice === 'shortcut' ? 'You took the shortcut: <b>' + esc(s.dilemma.shortcut) + '</b>.' : 'You did it properly: <b>' + esc(s.dilemma.proper) + '</b>.') };
        draft = draft || { choice: m.sub ? m.sub.choice : null };
        return { main: '<h1>Dilemma</h1><div class="card"><h2>' + esc(s.dilemma.title) + '</h2><p>' + esc(s.dilemma.story) + '</p></div>' +
          '<div class="card"><button class="choice" data-choice="proper" aria-pressed="' + (draft.choice === 'proper') + '"><b>' + esc(s.dilemma.proper) + '</b><small>Do it properly. Costs ' + money(R().dilemma.proper) + ' now.</small></button>' +
          '<button class="choice" data-choice="shortcut" aria-pressed="' + (draft.choice === 'shortcut') + '"><b>' + esc(s.dilemma.shortcut) + '</b><small>Shortcut. Gain ' + money(R().dilemma.shortcut) + ' now and hide a Skeleton. If it is exposed you pay ' + money(R().skeleton.cash) + ' and lose ' + R().skeleton.rep + ' Reputation.</small></button></div>' +
          '<p class="soft center">Nobody sees your choice. The big screen only shows how many chose each.</p>',
          foot: '<button class="btn wide" data-lock ' + (draft.choice && !busy ? '' : 'disabled') + '>Lock in my choice</button>' };
      }
      case 'dilemmaReveal':
        return { main: '<h1>Dilemma</h1><div class="card"><h2>' + esc(s.dilemma.title) + '</h2>' + notes(0) + '<p class="soft" style="margin-top:.6rem">' + esc(s.dilemma.ref) + '</p></div>' +
          waiting(s.dilemmaReveal.shortcut ? plural(s.dilemmaReveal.shortcut, 'company') + ' took the shortcut this year.' : 'Nobody took the shortcut this year.') };
      case 'boardroom': {
        if (m.sub && !editing) {
          const list = m.sub.actions.map((a) => OPTIONS().find((o) => o.id === a.id && (a.id !== 'rd' || o.protect === a.protect)).name);
          if (m.sub.loan === 'take') list.unshift('Take a ' + money(R().loan) + ' loan'); if (m.sub.loan === 'repay') list.unshift('Repay ' + money(R().loan));
          return { main: '<h1>Boardroom</h1>' + locked(list.length ? list.map((x) => '<b>' + esc(x) + '</b>').join('<br>') : 'No actions this year.') };
        }
        if (!draft) draft = { loan: m.sub ? m.sub.loan : null, actions: m.sub ? m.sub.actions.map((a) => a.id === 'rd' ? 'rd-' + a.protect : a.id) : [] };
        const sim = boardSim(draft), opts = OPTIONS();
        const canTake = m.debt + R().loan <= R().maxDebt, canRepay = m.debt >= R().loan && m.cash >= R().loan;
        let picked = draft.actions.map((k, i) => { const o = opts.find((x) => x.key === k); return '<div class="picked"><span class="grow">' + esc(o.name) + '</span><span class="num">' + money(o.cost) + '</span><button class="btn ghost small" data-unpick="' + i + '" aria-label="Remove ' + esc(o.name) + '">Remove</button></div>'; }).join('');
        if (!picked) picked = '<p class="soft">Nothing chosen yet. You can also lock in with no actions to save cash.</p>';
        const list = opts.map((o) => { const why = whyNot(o, sim, draft.actions.length); return '<div class="act"><span class="nm">' + esc(o.name) + ' <span class="tag">' + money(o.cost) + '</span></span><span class="fx">' + esc(o.fx) + '</span>' +
          '<button class="btn small add" data-pick="' + o.key + '" ' + (why ? 'disabled' : '') + '>Add</button>' + (why && draft.actions.length < 2 ? '<span class="why">' + esc(why) + '</span>' : '') + '</div>'; }).join('');
        return { main: '<h1>Boardroom</h1><div class="card"><h3>Your actions: ' + draft.actions.length + ' of 2</h3>' + picked + '</div>' +
          '<div class="card"><h3>Bank</h3><p class="soft" style="margin-bottom:.5rem">One loan move a year. Interest is ' + s.ratePct + '% a year. Your debt: ' + money(m.debt) + '.</p><div class="seg" role="group" aria-label="Loan">' +
          '<button data-loan="" aria-pressed="' + (!draft.loan) + '">No change</button><button data-loan="take" aria-pressed="' + (draft.loan === 'take') + '" ' + (canTake ? '' : 'disabled') + '>Borrow ' + money(R().loan) + '</button><button data-loan="repay" aria-pressed="' + (draft.loan === 'repay') + '" ' + (canRepay ? '' : 'disabled') + '>Repay ' + money(R().loan) + '</button></div></div>' +
          '<div class="card"><h3>Choose from</h3>' + list + '</div>',
          foot: '<div class="sum"><span>Cash after these moves</span><span class="num">' + money(sim.cash) + '</span></div><div class="sum soft" style="font-weight:500;font-size:.9rem"><span>Cells come next: ' + plural(sim.lines * R().lineCap, 'unit') + ' from Nordic would cost</span><span class="num">' + money(sim.lines * R().lineCap * s.price.nordic) + '</span></div><button class="btn wide" data-lock ' + (busy || sim.cash < 0 ? 'disabled' : '') + '>Lock in ' + plural(draft.actions.length, 'action') + '</button>' };
      }
      case 'boardroomReveal':
        return { main: '<h1>Boardroom</h1><div class="card"><h3>What you did</h3>' + (notes(1) || '<p>No actions this year.</p>') + '</div>' + waiting('Look at the big screen to see the other boards.') };
      case 'supply': {
        const cap = m.capacity;
        if (m.sub && !editing) {
          const t = m.sub.valley + m.sub.nordic + m.sub.loop;
          return { main: '<h1>Cells</h1>' + locked(t ? 'Ordered ' + ['nordic', 'loop', 'valley'].filter((k) => m.sub[k]).map((k) => '<b>' + m.sub[k] + ' ' + SUP[k] + '</b>').join(', ') + '.' + (m.sub.fallback ? ' Valley as back-up.' : '') : 'No cells ordered. You will make nothing this year.') };
        }
        if (!draft) draft = m.sub ? { valley: m.sub.valley, nordic: m.sub.nordic, loop: m.sub.loop, fallback: m.sub.fallback } : { valley: 0, nordic: 0, loop: 0, fallback: false };
        const tot = draft.valley + draft.nordic + draft.loop, c = supplyCost(draft), pr = s.price;
        const rowS = (k, name, tagc, tagt, price, fx) => { const up = { valley: draft.valley, nordic: draft.nordic, loop: draft.loop, fallback: draft.fallback }; up[k]++; const canUp = tot < cap && supplyCost(up).max <= Math.max(0, m.cash);
          return '<div class="sup"><span><b>' + name + '</b> <span class="tag ' + tagc + '">' + tagt + '</span> <span class="tag">' + money(price) + '</span></span><span class="fx">' + fx + '</span>' +
            '<span class="stepper"><button data-step="' + k + '" data-d="-1" aria-label="One fewer ' + name + '" ' + (draft[k] > 0 ? '' : 'disabled') + '>−</button><output aria-label="' + name + ' cells">' + draft[k] + '</output><button data-step="' + k + '" data-d="1" aria-label="One more ' + name + '" ' + (canUp ? '' : 'disabled') + '>+</button></span></div>'; };
        const scarce = draft.nordic + draft.loop > 0;
        const reach = s.demand.budget + (m.premiumOk ? s.demand.premium : 0) + (m.greenOk ? s.demand.green : 0);
        const over = tot > reach ? '<p class="error" style="margin-top:.6rem">Only ' + plural(reach, 'customer') + ' can buy from you this year, and other companies want them too. Extra units clear at ' + money(R().clearance) + '.</p>' : '';
        return { main: '<h1>Cells</h1><div class="card"><h3>Order ' + tot + ' of ' + cap + ' units</h3><p class="soft">Each unit needs one cell order. You have ' + plural(m.lines, 'line') + '.</p>' +
          rowS('nordic', 'Nordic', 'yellow', 'Audited', pr.nordic, s.caps.nordic + ' for everyone. Highest Reputation first.') +
          rowS('loop', 'LoopCell', 'mint', 'Recycled', m.loopPrice, s.caps.loop + ' for everyone. ' + (m.recyc ? 'You are a partner: served first.' : 'Recycling partners first.') + ' Mostly LoopCell: Sust +1.') +
          rowS('valley', 'Valley', 'red', 'Unaudited', pr.valley, 'No limit. +1 Climate each. 1 in 6 chance of an exposé. Mostly Valley: Sust −1.') + over + '</div>' +
          (scarce ? '<div class="card"><h3>If Nordic or LoopCell run out</h3><button class="choice" data-fb="0" aria-pressed="' + (!draft.fallback) + '"><b>Make fewer units</b><small>Missing cells are not replaced and not charged.</small></button><button class="choice" data-fb="1" aria-pressed="' + (!!draft.fallback) + '"><b>Buy Valley instead</b><small>Missing cells are replaced with Valley at ' + money(pr.valley) + '.</small></button></div>' : '') + marketCard(),
          foot: '<div class="sum"><span>' + (c.max > c.list ? 'Cost, up to' : 'Cost') + '</span><span class="num">' + money(c.max) + '</span></div><div class="sum"><span>Cash after</span><span class="num">' + money(m.cash - c.max) + '</span></div><button class="btn wide" data-lock ' + (busy ? 'disabled' : '') + '>' + (tot ? 'Lock in ' + plural(tot, 'cell order') : 'Lock in: make nothing') + '</button>' };
      }
      case 'supplyReveal': {
        const o = m.order, t = o.valley + o.nordic + o.loop;
        return { main: '<h1>Deliveries</h1><div class="card"><h3>' + (t ? plural(t, 'unit') + ' built' : 'Nothing built') + '</h3>' + notes(-1 - (o.expose && o.expose.hit ? 1 : 0) - (o.sust ? 1 : 0)) + '</div>' + waiting('Risk cards are next. Watch the big screen.') };
      }
      case 'risk': {
        const mine = (m.notes || []).filter((n) => /recall|breach|strike|ban|IP race|Whistleblower|flood|Ransomware|Safety award|Press investigation/i.test(n));
        return { main: '<h1>Risk</h1><div class="card ' + (mine.length ? 'risk' : '') + '"><h3>' + (mine.length ? 'You were hit' : 'Nothing hit you') + '</h3>' + (mine.length ? '<ul class="note-list">' + mine.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '<p>Your controls held, or luck was on your side this year.</p>') + '</div>' + waiting('Sales are next.') };
      }
      case 'market': {
        const h = m.hist[m.hist.length - 1];
        return { main: '<h1>' + y + ' accounts</h1><div class="card">' + accounts(h) + '</div><div class="card"><h3>What happened this year</h3><ul class="note-list">' + h.notes.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' + waiting('Copy this year to your datasheet. The host starts the next year.') };
      }
      case 'final': {
        const f = s.final, i = f.scores.findIndex((x) => x.pid === m.id), x = f.scores[i], a = f.audit.find((q) => q.pid === m.id);
        const ln = (k, v) => '<div class="ln"><span>' + k + '</span><span class="num">' + v + '</span></div>';
        return { main: '<h1>' + (i === 0 ? 'You won' : 'You finished ' + ['1st', '2nd', '3rd', '4th', '5th', '6th'][i]) + '</h1><div class="card"><h3>Enterprise Score: ' + x.total + '</h3><div class="lines">' +
          ln('Net worth (cash − debt + lines)', x.parts.netWorth) + ln('Reputation', x.parts.rep) + ln('Sustainability', x.parts.sust) + ln('Patents and trade secrets', x.parts.ip) + (x.parts.climate ? ln('Climate crisis', x.parts.climate) : '') + (x.halved ? ln('Reputation 0: score halved', '÷ 2') : '') +
          '<div class="ln total"><span>Total</span><span class="num">' + x.total + '</span></div></div></div>' +
          '<div class="card' + (a.exposed ? ' risk' : '') + '"><h3>Final audit</h3><p>' + (a.had ? 'You were hiding ' + plural(a.had, 'Skeleton') + '. The auditors found ' + (a.exposed || 'none') + '.' : 'You had nothing to hide.') + '</p></div>' +
          '<button class="btn wide" data-sheet>See my full datasheet</button>' };
      }
    }
    return { main: '' };
  }

  function render() {
    if (!state || !state.me) return;
    const b = body();
    root.innerHTML = '<div class="phone-wrap">' + (link === 'retry' ? '<div class="banner" role="status">Reconnecting to the game…</div>' : '') + head() +
      (state.remainingMs !== null && b.foot ? '<div class="banner" id="ptimer" role="timer"></div>' : '') +
      '<main class="p-main">' + b.main + (err ? '<div class="error" role="alert">' + esc(err) + '</div>' : '') + '</main>' + (b.foot ? '<footer class="p-foot">' + b.foot + '</footer>' : '') + '</div>' + (sheet ? sheetView() : '');
    tick();
  }
  function tick() { const el = $('#ptimer'); if (el) el.textContent = 'Time left: ' + clock(deadlineAt - Date.now()); }
  setInterval(tick, 500);

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t || !state) return;
    const d = t.dataset;
    if ('sheet' in d) { sheet = !sheet; render(); return; }
    if ('edit' in d) { editing = true; draft = null; render(); return; }
    if (d.choice) { draft.choice = d.choice; render(); return; }
    if (d.pick) { if (draft.actions.length < 2) draft.actions.push(d.pick); err = ''; render(); return; }
    if (d.unpick !== undefined) { draft.actions.splice(+d.unpick, 1); render(); return; }
    if (d.loan !== undefined) {
      draft.loan = d.loan || null;
      // dropping a loan can make chosen actions unaffordable: remove from the end until the plan works again
      while (draft.actions.length && boardSim(draft).cash < 0) draft.actions.pop();
      render(); return;
    }
    if (d.step) {
      draft[d.step] = Math.max(0, draft[d.step] + (+d.d));
      if (draft.nordic + draft.loop === 0) draft.fallback = false;
      render(); return;
    }
    if (d.fb !== undefined) {
      draft.fallback = d.fb === '1';
      for (const k of ['valley', 'nordic', 'loop']) while (draft[k] > 0 && supplyCost(draft).max > Math.max(0, me().cash)) draft[k]--;
      render(); return;
    }
    if ('lock' in d) {
      if (state.phase === 'dilemma') return submit({ choice: draft.choice });
      if (state.phase === 'boardroom') return submit({ loan: draft.loan, actions: draft.actions.map((k) => { const o = OPTIONS().find((x) => x.key === k); return o.id === 'rd' ? { id: 'rd', protect: o.protect } : { id: o.id }; }) });
      if (state.phase === 'supply') return submit({ valley: draft.valley, nordic: draft.nordic, loop: draft.loop, fallback: draft.fallback });
    }
  });

  seat = code ? store.get('cellout.seat.' + code) : null;
  if (seat) startGame(); else joinScreen('');
})();
