'use strict';
(async function () {
  const { $, esc, money, plural, store, api, poll, pips, dot, qrSvg, SEG, SUP, clock } = App;
  const root = $('#app');
  const STEPS = ['News', 'Dilemma', 'Boardroom', 'Cells', 'Risk', 'Market'];
  const STEP_OF = { news: 0, dilemma: 1, dilemmaReveal: 1, boardroom: 2, boardroomReveal: 2, supply: 3, supplyReveal: 3, risk: 4, market: 5 };
  const NEXT = { news: 'Open the dilemma', dilemmaReveal: 'Go to the boardroom', boardroomReveal: 'Open the cell market', supplyReveal: 'Draw the risk cards', risk: 'Sell the packs' };
  let code = new URLSearchParams(location.search).get('room'), key = null, state = null, joinBase = location.origin, deadlineAt = 0, busy = false, editAddr = false, flash = '';

  function fatal(title, text) {
    root.innerHTML = '<div class="landing"><div class="wordmark">Cell Out</div><div class="card stack"><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><a class="btn" href="/host">Host a new game</a></div></div>';
  }
  if (code) { code = code.toUpperCase(); key = store.get('cellout.host.' + code); if (!key) return fatal('This browser is not the host of game ' + code, 'The host screen only works in the browser that created the game. You can start a new one.'); }
  else {
    const r = await api('POST', '/api/rooms', {});
    if (!r.ok) return fatal('Could not start a game', r.error);
    code = r.code; key = r.hostKey; store.set('cellout.host.' + code, key);
    history.replaceState(null, '', '/host?room=' + code);
  }
  const info = await api('GET', '/api/info');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  joinBase = store.get('cellout.joinBase.' + code) || (!local ? location.origin : (info.ok && (info.publicUrl || info.lan[0])) || location.origin);

  const nameOf = (pid) => { const p = state.players.find((x) => x.id === pid); return p ? p.name : '?'; };
  const chip = (pid, extra) => { const p = state.players.find((x) => x.id === pid); return '<span class="chip ' + (extra || '') + '">' + dot(p.colour) + esc(p.name) + '</span>'; };
  const joinUrl = () => joinBase.replace(/\/+$/, '') + '/j/' + code;
  const shortUrl = () => joinBase.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  async function cmd(body) {
    if (busy) return; busy = true;
    const r = await api('POST', '/api/rooms/' + code + '/host', Object.assign({ key }, body));
    busy = false;
    flash = r.ok ? '' : r.error;
    if (!r.ok) render();
  }

  // ---------- pieces
  function pack() {
    let h = '<div class="pack" role="img" aria-label="Year ' + state.yearLabel + ', ' + (state.year + 1) + ' of ' + state.years + '">';
    for (let i = 0; i < state.years; i++) h += '<div class="cell ' + (state.phase === 'final' || i < state.year ? 'past' : i === state.year ? 'now' : '') + '">' + (state.firstYear + i) + '</div>';
    return h + '</div>';
  }
  function climate() {
    const st = state.climateSteps, max = st[2] * 1.15, pct = (v) => Math.min(100, 100 * v / max);
    const level = st.filter((s) => state.climate >= s).length;
    const txt = level === 3 ? 'Climate crisis' : level === 0 ? 'No carbon levy yet' : 'Carbon levy on Valley cells: ' + money([0, 0.5, 1, 1.5][level]);
    return '<div class="card flat"><h3>Climate track: ' + state.climate + '</h3>' +
      '<div class="climate"><div class="fill" style="width:' + pct(state.climate) + '%"></div>' + st.map((s) => '<div class="tick" style="left:' + pct(s) + '%"></div>').join('') + '</div>' +
      '<div class="climate-scale soft">' + st.map((s, i) => '<span style="left:' + pct(s) + '%">' + (i === 2 ? 'crisis ' : '') + s + '</span>').join('') + '</div>' +
      '<p class="soft" style="margin-top:.3rem">' + txt + '. Every Valley cell adds 1.</p></div>';
  }
  function companies() {
    const deciding = ['dilemma', 'boardroom', 'supply'].includes(state.phase);
    let h = '<div class="card flat"><h3>Companies</h3>';
    for (const p of state.players) {
      h += '<div class="co-row"><div class="name">' + dot(p.colour) + '<span class="t">' + esc(p.name) + '</span>' + (p.bot ? ' <span class="soft" style="font-weight:500">bot</span>' : '') + '</div>' +
        '<div class="badges">' + (p.qa ? '<span class="tag yellow">QA</span>' : '') + (p.recyc ? '<span class="tag mint">Recycler</span>' : '') + (deciding ? (p.done ? '<span class="tag">Locked in</span>' : '') : '') + '</div>' +
        '<div class="meters"><span>Rep ' + pips('rep', p.rep, 10) + ' ' + p.rep + '</span><span>Sust ' + pips('sust', p.sust, 10) + ' ' + p.sust + '</span>' +
        '<span>Cyber ' + pips('cyber', p.cyber, 3) + '</span><span>' + plural(p.lines, 'line') + '</span><span>' + plural(p.patents, 'patent') + '</span><span>' + p.valleyTotal + ' Valley cells</span></div></div>';
    }
    return h + '</div>';
  }
  function waitlist() {
    return '<div class="waitlist">' + state.players.map((p) => '<span class="chip ' + (p.done ? 'done' : 'waiting') + '">' + dot(p.colour) + esc(p.name) + (p.done ? ' ✓' : '') + '</span>').join('') + '</div>';
  }
  function customers() {
    const d = state.demand, pr = state.price;
    return '<div class="card"><h3>Customers this year</h3><table><thead><tr><th>Market</th><th class="r">Wants</th><th class="r">Pays per unit</th><th>Who can sell</th></tr></thead><tbody>' +
      '<tr><td><b>Premium</b></td><td class="r num">' + d.premium + '</td><td class="r num">' + money(pr.premium) + '</td><td>Needs a technology. ' + money(0.5).replace('£', '+£') + ' with Cyber 2</td></tr>' +
      '<tr><td><b>Green</b></td><td class="r num">' + d.green + '</td><td class="r num">' + money(pr.green) + '</td><td>Needs Sustainability 5</td></tr>' +
      '<tr><td><b>Budget</b></td><td class="r num">' + d.budget + '</td><td class="r num">' + money(pr.budget) + '</td><td>Open to all. Cheapest cells first</td></tr>' +
      '</tbody></table><p class="soft" style="margin-top:.4rem">Unsold units are cleared at ' + money(1.5) + ' each, below cost.</p></div>';
  }
  function suppliers() {
    const pr = state.price, c = state.caps;
    return '<div class="card"><h3>Cell suppliers</h3><table><thead><tr><th>Supplier</th><th class="r">Price</th><th class="r">Available</th><th>Catch</th></tr></thead><tbody>' +
      '<tr><td><b>Valley Cells</b><br><span class="soft">Unaudited</span></td><td class="r num">' + money(pr.valley) + '</td><td class="r">No limit</td><td>+1 Climate per cell. Risk of an exposé and recalls</td></tr>' +
      '<tr><td><b>Nordic Cells</b><br><span class="soft">Audited</span></td><td class="r num">' + money(pr.nordic) + '</td><td class="r num">' + c.nordic + '</td><td>Highest Reputation is served first</td></tr>' +
      '<tr><td><b>LoopCell</b><br><span class="soft">Recycled</span></td><td class="r num">' + money(pr.loop) + '</td><td class="r num">' + c.loop + '</td><td>Recycling partners first. Mostly LoopCell: Sustainability +1</td></tr>' +
      '</tbody></table></div>';
  }

  // ---------- phases
  function lobby() {
    const humans = state.players.filter((p) => !p.bot).length;
    let seats = state.players.map((p) => '<div class="seat">' + dot(p.colour) + '<span class="grow">' + esc(p.name) + (p.bot ? ' <span class="soft" style="font-weight:500">practice bot</span>' : '') + '</span><button class="btn ghost small" data-remove="' + p.id + '" aria-label="Remove ' + esc(p.name) + '">Remove</button></div>').join('');
    if (!state.players.length) seats = '<p class="soft">No companies yet. Scan the code with a phone camera, or open the address in a phone browser.</p>';
    const timers = state.timers.map((t) => '<button data-timer="' + t + '" aria-pressed="' + (state.timerSec === t) + '">' + (t === 0 ? 'No limit' : t < 60 ? t + ' s' : t === 90 ? '90 s' : (t / 60) + ' min') + '</button>').join('');
    return '<div class="lobby"><div class="stack"><div class="card joincard"><div class="qr">' + qrSvg(joinUrl()) + '</div><div class="stack">' +
      '<div><div class="kicker">Join on your phone</div><div class="url">' + esc(shortUrl()) + '</div></div>' +
      '<div><div class="kicker">Game code</div><div class="code">' + code + '</div></div></div></div>' +
      (editAddr ? '<div class="card stack"><label class="field" for="addr">Address phones should open</label><input type="text" id="addr" value="' + esc(joinBase) + '" autocomplete="off" spellcheck="false"><p class="soft">Use the laptop’s Wi-Fi address with the port, for example http://192.168.1.20:3000. Phones must be on the same Wi-Fi or hotspot as this laptop.</p><div class="row"><button class="btn" data-saveaddr>Use this address</button><button class="btn ghost" data-canceladdr>Cancel</button></div></div>'
        : '<p class="soft">Phones must be on the same Wi-Fi or hotspot as this laptop. <button class="btn ghost small" data-editaddr>Change the address</button></p>') +
      '</div><div class="stack"><div class="card"><h2>Companies in the game: ' + state.players.length + '</h2>' + seats + '</div>' +
      '<div class="card stack"><div class="row"><span class="grow"><b>Time for each decision</b></span><span class="seg" role="group" aria-label="Time for each decision">' + timers + '</span></div>' +
      '<div class="row"><button class="btn ghost" data-addbot ' + (state.players.length >= 6 ? 'disabled' : '') + '>Add a practice bot</button><span class="grow"></span>' +
      '<button class="btn" data-start ' + (state.players.length < 2 ? 'disabled' : '') + '>Start the game</button></div>' +
      '<p class="soft">Designed for 3 or 4 companies. ' + (humans < 3 ? 'Bots can fill empty seats.' : '') + '</p></div></div></div>';
  }
  function stage() {
    const s = state, y = s.yearLabel;
    switch (s.phase) {
      case 'news':
        return '<h1>' + y + ': ' + esc(s.event.title) + '</h1><p class="lede">' + esc(s.event.text) + '</p><div class="grid2">' + customers() + suppliers() + '</div>';
      case 'dilemma':
        return '<h1>Boardroom dilemma</h1><div class="card"><h2>' + esc(s.dilemma.title) + '</h2><p style="font-size:1.25rem">' + esc(s.dilemma.story) + '</p>' +
          '<div class="grid2" style="margin-top:1rem"><div><span class="tag mint">Do it properly</span><p style="margin-top:.3rem"><b>' + esc(s.dilemma.proper) + '.</b> Costs ' + money(1) + ' now.</p></div>' +
          '<div><span class="tag red">Shortcut</span><p style="margin-top:.3rem"><b>' + esc(s.dilemma.shortcut) + '.</b> Gain ' + money(2) + ' now and hide a Skeleton.</p></div></div></div>' +
          '<p class="lede">Decide in secret on your phone.</p>' + waitlist();
      case 'dilemmaReveal': {
        const r = s.dilemmaReveal;
        return '<h1>' + esc(s.dilemma.title) + '</h1><div class="reveal-count seq"><div class="card"><div class="n" style="color:#0B8A63">' + r.proper + '</div><h3>did it properly</h3></div>' +
          '<div class="card"><div class="n" style="color:#D9342C">' + r.shortcut + '</div><h3>took the shortcut</h3></div></div>' +
          '<div class="card"><div class="kicker">What the rules say</div><p style="font-size:1.15rem">' + esc(s.dilemma.ref) + '</p></div>' +
          '<p class="lede">' + (r.shortcut ? 'Nobody knows who. A Skeleton can be exposed by the press in any year, and by the audit at the end.' : 'A clean table this year. No new Skeletons.') + '</p>';
      }
      case 'boardroom':
        return '<h1>Boardroom</h1><p class="lede">Choose up to 2 actions on your phone. You can also take or repay one ' + money(5) + ' loan.</p>' +
          '<div class="card"><table><thead><tr><th>Action</th><th class="r">Cost</th><th>What it does</th></tr></thead><tbody>' +
          '<tr><td><b>Build a production line</b></td><td class="r num">' + money(6) + '</td><td>+2 units of capacity every year. ' + money(1) + ' a year to run</td></tr>' +
          '<tr><td><b>Research and development</b></td><td class="r num">' + money(2) + '</td><td>A new technology opens the Premium market. Patent it for ' + money(1) + ' more, or keep it secret</td></tr>' +
          '<tr><td><b>Quality assurance system</b></td><td class="r num">' + money(2) + '</td><td>Product recalls no longer hit you</td></tr>' +
          '<tr><td><b>Cyber security</b></td><td class="r num">' + money(1) + '</td><td>Cyber +1. Level 2 stops breaches and earns more on Premium</td></tr>' +
          '<tr><td><b>Sustainability upgrade</b></td><td class="r num">' + money(3) + '</td><td>Sustainability +1. The Green market needs 5</td></tr>' +
          '<tr><td><b>Recycling partnership</b></td><td class="r num">' + money(3) + '</td><td>Sustainability +1 and first place in the LoopCell queue</td></tr>' +
          '<tr><td><b>Marketing</b></td><td class="r num">' + money(1) + '</td><td>Reputation +1</td></tr></tbody></table></div>' + waitlist();
      case 'boardroomReveal':
        return '<h1>What the boards decided</h1><div class="grid2">' + s.players.map((p) => { const a = s.boardroomReveal[p.id] || []; return '<div class="card"><div class="row">' + chip(p.id) + '</div>' + (a.length ? '<ul class="note-list" style="margin-top:.5rem">' + a.map((x) => '<li><b>' + esc(x) + '</b></li>').join('') + '</ul>' : '<p class="soft" style="margin-top:.5rem">No public moves this year.</p>') + '</div>'; }).join('') + '</div>' +
          '<p class="lede">Patents are public. Trade secrets show only as R&D, and loans stay private.</p>';
      case 'supply':
        return '<h1>Cell market</h1><p class="lede">Order cells on your phone. Each unit you make needs one cell order.</p><div class="grid2">' + suppliers() + customers() + '</div>' + waitlist();
      case 'supplyReveal': {
        const r = s.supplyReveal; let rows = '';
        for (const p of s.players) {
          const o = r.orders[p.id], tot = o.valley + o.nordic + o.loop, notes = [];
          if (o.swapped) notes.push('<span class="tag red">' + o.swapped + ' switched to Valley</span>');
          if (o.short) notes.push('<span class="tag">' + o.short + ' not available</span>');
          if (o.expose && o.expose.hit) notes.push('<span class="tag red">Exposé: Reputation −1</span>');
          if (o.sust === 1) notes.push('<span class="tag mint">Sustainability +1</span>');
          if (o.sust === -1) notes.push('<span class="tag red">Sustainability −1</span>');
          const parts = ['valley', 'nordic', 'loop'].filter((k) => o[k]).map((k) => o[k] + ' ' + SUP[k]).join(', ') || 'No cells';
          rows += '<tr><td>' + chip(p.id) + '</td><td style="width:32%"><div class="cellbar" style="width:' + Math.max(8, tot * 12.5) + '%">' + ['valley', 'nordic', 'loop'].map((k) => o[k] ? '<i class="' + k + '" style="flex:' + o[k] + '"></i>' : '').join('') + '</div></td><td>' + parts + '</td><td>' + notes.join(' ') + '</td></tr>';
        }
        return '<h1>Deliveries</h1><div class="card"><table><tbody>' + rows + '</tbody></table><div class="legend" style="margin-top:.7rem"><span><i style="background:var(--red)"></i>Valley</span><span><i style="background:var(--cobalt)"></i>Nordic</span><span><i style="background:var(--mint)"></i>LoopCell</span></div></div>' +
          '<p class="lede">Climate track: ' + r.climateBefore + ' to ' + r.climateAfter + '.' + (r.climateAfter > r.climateBefore ? ' Valley cells added ' + (r.climateAfter - r.climateBefore) + '.' : ' No Valley cells this year.') + '</p>';
      }
      case 'risk': {
        const r = s.riskReveal;
        const cards = r.cards.map((c) => '<div class="card risk"><div class="kicker">Risk card</div><h2>' + esc(c.title) + '</h2><p>' + esc(c.text) + '</p><div style="margin-top:.6rem">' +
          (c.hits.length ? c.hits.map((h) => '<div class="row" style="margin-top:.3rem">' + chip(h.pid) + '<b>' + esc(h.msg) + '</b></div>').join('') : '<span class="tag mint">No company was hit</span>') + '</div></div>').join('');
        const press = '<div class="card risk"><div class="kicker">Press investigation</div><h2>Skeletons</h2><div>' +
          (r.exposed.length ? r.exposed.map((e) => '<div class="row" style="margin-top:.3rem">' + chip(e.pid) + '<b>' + plural(e.n, 'Skeleton') + ' exposed: pays ' + money(e.cash) + ', Reputation −' + e.rep + '</b></div>').join('') : '<span class="tag mint">The press found nothing this year</span>') + '</div></div>';
        return '<h1>Risk</h1><div class="stack seq">' + cards + press + '</div>';
      }
      case 'market': {
        const r = s.marketReveal;
        const segs = r.segments.map((g) => '<div class="card"><h3>' + SEG[g.id] + '</h3><p class="soft">' + plural(g.demand, 'unit') + ' wanted at ' + money(s.price[g.id]) + '</p><div style="margin-top:.5rem">' +
          (g.sales.length ? g.sales.map((x) => '<div class="row" style="margin-top:.3rem">' + chip(x.pid) + '<b class="num">' + plural(x.units, 'unit') + '</b></div>').join('') : '<p><b>Nobody could sell here.</b></p>') +
          (g.unmet ? '<p class="soft" style="margin-top:.4rem">' + plural(g.unmet, 'customer') + ' left without a pack.</p>' : '') + '</div></div>').join('');
        return '<h1>' + y + ' sales</h1><div class="grid3">' + segs + '</div>' +
          (r.emergency.length ? '<div class="card risk"><h3>Emergency loans</h3><div class="row">' + r.emergency.map((id) => chip(id)).join('') + '</div><p>Ran out of cash: ' + money(5) + ' forced loan and Reputation −1.</p></div>' : '') +
          '<p class="lede">Your year-end accounts are on your phone. Copy them to your datasheet.</p>';
      }
      case 'final': return final();
    }
    return '';
  }
  function final() {
    const f = state.final, top = f.scores[0], max = Math.max(1, ...f.scores.map((x) => x.parts.netWorth + x.parts.rep + x.parts.sust + x.parts.ip));
    const rich = f.scores.slice().sort((a, b) => b.parts.netWorth - a.parts.netWorth)[0];
    const rows = f.scores.map((x, i) => {
      const w = (v) => Math.max(0, 100 * v / max);
      return '<tr><td class="num"><b>' + (i + 1) + '</b></td><td>' + chip(x.pid) + '</td><td style="width:30%"><div class="scorebar"><i class="nw" style="width:' + w(x.parts.netWorth) + '%"></i><i class="rp" style="width:' + w(x.parts.rep) + '%"></i><i class="su" style="width:' + w(x.parts.sust) + '%"></i><i class="ip" style="width:' + w(x.parts.ip) + '%"></i></div></td>' +
        '<td class="r num">' + x.parts.netWorth + '</td><td class="r num">' + x.parts.rep + '</td><td class="r num">' + x.parts.sust + '</td><td class="r num">' + x.parts.ip + '</td><td class="r num">' + (x.parts.climate || 0) + '</td>' +
        '<td class="r num"><b>' + x.total + '</b>' + (x.halved ? ' <span class="tag red">halved</span>' : '') + '</td></tr>';
    }).join('');
    const audit = f.audit.filter((a) => a.had > 0);
    const lesson = rich.pid !== top.pid ? 'The richest company was ' + esc(nameOf(rich.pid)) + ' with a net worth of ' + money(rich.parts.netWorth) + ', but it did not win.' : esc(nameOf(top.pid)) + ' was also the richest company, with a net worth of ' + money(top.parts.netWorth) + '.';
    return '<div class="seq stack"><div><p class="lede">Winner on Enterprise Score</p><div class="winner-name">' + esc(nameOf(top.pid)) + '</div><p class="lede">' + top.total + ' points. ' + lesson + '</p></div>' +
      '<div class="card"><table><thead><tr><th></th><th>Company</th><th></th><th class="r">Net worth</th><th class="r">Reputation</th><th class="r">Sustainability</th><th class="r">Patents and secrets</th><th class="r">Climate</th><th class="r">Score</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="legend" style="margin-top:.7rem"><span><i style="background:var(--cobalt)"></i>Net worth</span><span><i style="background:var(--label-deep)"></i>Reputation</span><span><i style="background:var(--mint)"></i>Sustainability</span><span><i style="background:var(--violet)"></i>Patents and secrets</span></div></div>' +
      '<div class="grid2"><div class="card risk"><h3>Final audit</h3>' + (audit.length ? audit.map((a) => '<div class="row" style="margin-top:.3rem">' + chip(a.pid) + '<span>hid ' + plural(a.had, 'Skeleton') + ': <b>' + (a.exposed ? a.exposed + ' exposed, pays ' + money(a.cash) + ', Reputation −' + a.rep : 'none found') + '</b></span></div>').join('') : '<p>No company was hiding a Skeleton at the end.</p>') + '</div>' +
      '<div class="card' + (f.crisis ? ' risk' : '') + '"><h3>Climate track: ' + state.climate + '</h3>' + (f.crisis ? '<p><b>Climate crisis.</b> Every company loses 5 points. The biggest buyer of Valley cells loses 5 more: ' + f.polluters.map((id) => esc(nameOf(id))).join(', ') + '.</p>' : '<p>The industry stayed below the crisis line of ' + state.climateSteps[2] + '. No penalty.</p>') + '</div></div></div>';
  }

  function render() {
    if (!state) { root.innerHTML = '<div class="landing"><div class="wordmark">Cell Out</div><p>Setting up the game…</p></div>'; return; }
    const s = state, deciding = ['dilemma', 'boardroom', 'supply'].includes(s.phase);
    let top = '<header class="topbar"><div class="wordmark">Cell Out</div>' + (s.year >= 0 ? pack() : '') + '<span class="grow"></span>' +
      (s.phase !== 'lobby' ? '<div class="join-mini"><div><div class="soft">' + esc(shortUrl()) + '</div><div class="code">' + code + '</div></div><div class="qr">' + qrSvg(joinUrl()) + '</div></div>' : '') + '</header>';
    let body, foot;
    if (s.phase === 'lobby') {
      body = '<main>' + lobby() + '</main>';
      foot = '<footer class="footbar"><a class="btn ghost small" href="/instructions" target="_blank" rel="noopener">Player instructions</a><a class="btn ghost small" href="/datasheet" target="_blank" rel="noopener">Blank datasheet</a><span class="grow"></span>' + (flash ? '<span class="error">' + esc(flash) + '</span>' : '') + '</footer>';
    } else {
      const step = STEP_OF[s.phase];
      body = '<main class="stage-grid"><section class="stage" aria-live="polite">' + stage() + '</section>' + (s.phase === 'final' ? '' : '<aside class="side">' + climate() + companies() + '</aside>') + '</main>';
      if (s.phase === 'final') body = '<main class="stage">' + stage() + '</main>';
      let btn;
      if (s.phase === 'final') btn = '<a class="btn ghost" href="/api/rooms/' + code + '/report.csv?key=' + key + '">Download the game report</a><a class="btn" href="/host">Host a new game</a>';
      else if (deciding) { const left = s.players.filter((p) => !p.done).length; btn = '<span class="soft">Waiting for ' + plural(left, 'company', 'companies') + '</span><button class="btn ghost" data-continue>Close this round now</button>'; }
      else btn = '<button class="btn" data-continue>' + (s.phase === 'market' ? (s.year < s.years - 1 ? 'Start ' + (s.yearLabel + 1) : 'Run the final audit') : NEXT[s.phase]) + '</button>';
      foot = '<footer class="footbar">' + (s.phase === 'final' ? '<span class="grow"></span>' : '<div class="steps" aria-label="Steps in a year">' + STEPS.map((n, i) => '<span class="' + (i === step ? 'now' : i < step ? 'past' : '') + '">' + n + '</span>').join('') + '</div>') +
        (flash ? '<span class="error">' + esc(flash) + '</span>' : '') + (deciding && s.remainingMs !== null ? '<div class="timer" id="timer" aria-label="Time left"></div>' : '') + btn + '</footer>';
    }
    root.innerHTML = '<div class="host-wrap">' + top + body + foot + '</div>';
    tick();
  }
  function tick() {
    const el = $('#timer'); if (!el) return;
    const ms = deadlineAt - Date.now(); el.textContent = clock(ms); el.classList.toggle('low', ms < 15000);
  }
  setInterval(tick, 250);

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.remove) cmd({ cmd: 'remove', pid: t.dataset.remove });
    else if ('addbot' in t.dataset) cmd({ cmd: 'addBot' });
    else if ('start' in t.dataset) cmd({ cmd: 'start' });
    else if ('continue' in t.dataset) cmd({ cmd: 'continue' });
    else if (t.dataset.timer !== undefined) cmd({ cmd: 'timer', sec: +t.dataset.timer });
    else if ('editaddr' in t.dataset) { editAddr = true; render(); const a = $('#addr'); if (a) a.focus(); }
    else if ('canceladdr' in t.dataset) { editAddr = false; render(); }
    else if ('saveaddr' in t.dataset) {
      let v = $('#addr').value.trim(); if (v && !/^https?:\/\//i.test(v)) v = 'http://' + v;
      if (v) { joinBase = v.replace(/\/+$/, ''); store.set('cellout.joinBase.' + code, joinBase); }
      editAddr = false; render();
    }
  });

  render();
  poll((v) => '/api/rooms/' + code + '/host?key=' + key + '&v=' + v, (s) => {
    state = s; deadlineAt = s.remainingMs === null ? 0 : Date.now() + s.remainingMs;
    if (editAddr && s.phase === 'lobby') { const a = $('#addr'); const keep = a ? a.value : null; render(); if (keep !== null && $('#addr')) { $('#addr').value = keep; } return; }
    render();
  }, (st) => { if (st && st.fatal) fatal('This game is no longer available', st.fatal); });
})();
