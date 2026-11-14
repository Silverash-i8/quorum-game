'use strict';
// Shared host screen and phone controller for the smaller games. The game is the first part of the path
// (/chain/host, /quorum/play ...). Each game file registers itself with Kit.register({...}).
const Kit = (() => {
  const { $, esc, store, api, poll, dot, qrSvg, clock } = App;
  const game = location.pathname.split('/')[1];
  const mode = window.KIT_MODE;
  const root = $('#app');
  let G = null, S = null, link = 'ok', busy = false, error = '', draft = {}, draftKey = '', editing = false, tick = null, deadline = 0;

  const money = (x) => (x < 0 ? '−' : '') + '£' + Math.abs(Math.round(x * 2) / 2) + 'm';
  const pct = (x) => Math.round(x * 100) + '%';
  const chip = (s, pid) => { const p = s.players.find((x) => x.id === pid); return p ? '<span class="chip">' + dot(p.colour) + esc(p.name) + '</span>' : ''; };
  const name = (s, pid) => { const p = s.players.find((x) => x.id === pid); return p ? p.name : '?'; };
  function gauge(value, max, cls, mark) { return '<div class="k-gauge ' + (cls || '') + '"><i style="width:' + Math.max(0, Math.min(100, 100 * value / max)) + '%"></i>' + (mark !== undefined ? '<b style="left:' + Math.min(100, 100 * mark / max) + '%"></b>' : '') + '</div>'; }
  function stat(v, l) { return '<div class="k-stat"><span class="v">' + v + '</span><span class="l">' + esc(l) + '</span></div>'; }
  function choice(key, val, title, small, d) { return '<button class="choice" data-set="' + esc(key) + '" data-val=\'' + esc(JSON.stringify(val)) + '\' aria-pressed="' + (JSON.stringify(d[key]) === JSON.stringify(val)) + '"><b>' + title + '</b>' + (small ? '<small>' + small + '</small>' : '') + '</button>'; }
  function stepper(key, d, min, max, step) { const v = d[key] || 0; step = step || 1;
    return '<span class="stepper"><button data-step="' + esc(key) + '" data-d="' + -step + '" data-min="' + min + '" data-max="' + max + '"' + (v <= min ? ' disabled' : '') + ' aria-label="Less">−</button><output>' + v + '</output><button data-step="' + esc(key) + '" data-d="' + step + '" data-min="' + min + '" data-max="' + max + '"' + (v >= max ? ' disabled' : '') + ' aria-label="More">+</button></span>'; }

  // ---------- host
  const H = { code: null, key: null, base: '', bases: [] };
  // Every address this laptop can be reached on. The host picks the one that works for the phones in the room.
  async function refreshBases() {
    const info = await api('GET', '/api/info');
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const list = []; const add = (u) => { if (u && !list.includes(u)) list.push(u); };
    if (!local) add(location.origin);
    if (info.ok) { add(info.publicUrl); info.lan.forEach(add); }
    if (!list.length) add(location.origin);
    const saved = store.get('kit.base'), before = H.base + '|' + H.bases.join();
    H.bases = list; H.base = list.includes(saved) ? saved : list[0];
    if (before !== H.base + '|' + H.bases.join() && S && S.phase === 'lobby') draw();
  }
  async function hostBoot() {
    await refreshBases();
    setInterval(() => { if (!S || S.phase === 'lobby') refreshBases(); }, 4000);
    const saved = store.get('kit.host.' + game);
    if (saved) { H.code = saved.code; H.key = saved.key; } else await newRoom();
    startHostPoll();
  }
  async function newRoom() {
    const r = await api('POST', '/api/rooms?game=' + game);
    if (!r.ok) { error = r.error; return draw(); }
    H.code = r.code; H.key = r.hostKey; store.set('kit.host.' + game, { code: r.code, key: r.hostKey });
  }
  let poller = null;
  function startHostPoll() {
    if (poller) poller.stop();
    poller = poll((v) => '/api/rooms/' + H.code + '/host?key=' + H.key + '&v=' + v, onState, async (st) => {
      if (st && st.fatal) { store.del('kit.host.' + game); await newRoom(); startHostPoll(); } else { link = st; }
    });
  }
  async function hostCmd(cmd, extra) {
    if (busy) return; busy = true; error = '';
    if (cmd === 'new') { store.del('kit.host.' + game); S = null; await newRoom(); startHostPoll(); busy = false; return draw(); }
    const r = await api('POST', '/api/rooms/' + H.code + '/host', Object.assign({ key: H.key, cmd }, extra || {}));
    busy = false; if (!r.ok) { error = r.error; draw(); }
  }
  function joinUrl() { return H.base + '/j/' + H.code; }
  function hostDraw() {
    if (!S) return '<div class="host-wrap"><div class="topbar"><div class="wordmark">' + esc(G.title) + '</div></div><div class="stage"><p class="lede">' + (error ? esc(error) : 'Starting…') + '</p></div><div></div></div>';
    const s = S, lobby = s.phase === 'lobby', final = s.phase === 'final';
    let top = '<div class="topbar"><div class="wordmark">' + esc(G.title) + '</div>' + (lobby ? '' : '<div class="chip" style="font-size:1.1rem;padding:.35rem .9rem">' + esc(G.progress(s)) + '</div>') + '<div class="grow"></div>' +
      (lobby ? '<a class="btn ghost small" href="/">All games</a>' : '<div class="join-mini"><div><div class="soft">' + esc(H.base.replace(/^https?:\/\//, '')) + '</div><div class="code">' + esc(s.code) + '</div></div><div class="qr">' + qrSvg(joinUrl()) + '</div></div>') + '</div>';
    let main, foot;
    if (lobby) {
      const seats = s.players.map((p) => '<div class="seat">' + dot(p.colour) + '<span class="grow">' + esc(p.name) + '</span>' + (p.bot ? '<span class="tag">practice bot</span>' : p.online ? '<span class="tag mint">connected</span>' : '<span class="tag red">away</span>') +
        '<button class="btn ghost small" data-cmd="remove" data-pid="' + p.id + '">Remove</button></div>').join('');
      main = '<div class="lobby"><div class="stack"><div class="card joincard"><div class="qr">' + qrSvg(joinUrl()) + '</div><div class="stack"><div><div class="kicker">Scan to join, or open</div><div class="url">' + esc(joinUrl().replace(/^https?:\/\//, '')) + '</div></div><div><div class="kicker">Game code</div><div class="code">' + esc(s.code) + '</div></div></div></div>' +
        '<div class="card"><h3>Phones cannot connect?</h3><p class="soft">Every phone must be on the same Wi-Fi or hotspot as this laptop. University and halls Wi-Fi usually blocks this: turn on a phone hotspot, or Mobile hotspot on this laptop, and join everything to it. Then pick the address that matches below; new networks appear within a few seconds.</p>' +
        '<div class="seg" style="margin-top:.6rem;flex-wrap:wrap">' + H.bases.map((u) => '<button data-base="' + esc(u) + '" aria-pressed="' + (u === H.base) + '">' + esc(u.replace(/^https?:\/\//, '')) + '</button>').join('') + '</div></div>' +
        '<div class="card flat"><h3>' + esc(G.tagline) + '</h3><ol class="k-how">' + G.how.map((h) => '<li>' + esc(h) + '</li>').join('') + '</ol></div></div>' +
        '<div class="stack"><div class="card"><h2>' + s.players.length + ' of ' + s.maxPlayers + ' seats</h2>' + (seats || '<p class="soft">Waiting for the first player to scan the code.</p>') +
        '<div class="row" style="margin-top:.8rem"><button class="btn ghost small" data-cmd="addBot"' + (s.players.length >= s.maxPlayers ? ' disabled' : '') + '>Add a practice bot</button></div>' + (G.lobbyNote ? '<p class="soft" style="margin-top:.6rem">' + esc(G.lobbyNote) + '</p>' : '') + '</div>' +
        '<div class="card"><div class="kicker">Time allowed for each decision</div><div class="seg">' + s.timers.map((t) => '<button data-cmd="timer" data-sec="' + t + '" aria-pressed="' + (s.timerSec === t) + '">' + (t ? t + ' s' : 'No limit') + '</button>').join('') + '</div></div></div></div>';
      foot = '<div class="footbar">' + (error ? '<div class="error">' + esc(error) + '</div>' : '') + '<div class="grow"></div><button class="btn" data-cmd="start"' + (s.players.length < s.minPlayers ? ' disabled' : '') + '>Start the game</button></div>';
    } else {
      const side = '<div class="card flat"><h3>' + esc(G.sideTitle || 'Players') + '</h3>' + s.players.map((p) => '<div class="co-row"><div class="name">' + dot(p.colour) + '<span class="t">' + esc(p.name) + '</span></div><div class="badges">' +
        (s.decision ? (p.done ? '<span class="tag mint">locked in</span>' : '<span class="tag yellow">deciding</span>') : '') + '</div><div class="meters">' + (G.meter ? G.meter(s, p) : '') + (p.bot ? '<span>bot</span>' : p.online ? '' : '<span>away</span>') + '</div></div>').join('') + '</div>' + (G.side ? G.side(s) : '');
      main = '<div class="stage-grid"><div class="stage">' + G.host(s) + '</div><div class="side">' + side + '</div></div>';
      deadline = s.remainingMs !== null && s.remainingMs !== undefined ? Date.now() + s.remainingMs : 0;
      foot = '<div class="footbar">' + (error ? '<div class="error">' + esc(error) + '</div>' : '') + '<div class="grow soft">' + (s.decision ? 'Waiting for ' + s.players.filter((p) => !p.done).map((p) => esc(p.name)).join(', ') : '') + '</div>' +
        (s.decision && deadline ? '<div class="timer" id="k-timer"></div>' : '') +
        (final ? '<a class="btn ghost" href="/api/rooms/' + s.code + '/report.csv?key=' + H.key + '">Download the game report</a><button class="btn" data-cmd="new">Host a new game</button>'
          : '<button class="btn' + (s.decision ? ' ghost' : '') + '" data-cmd="continue">' + (s.decision ? 'Close this round now' : esc((G.nextLabel && G.nextLabel(s)) || 'Continue')) + '</button>') + '</div>';
    }
    return '<div class="host-wrap">' + top + main + foot + '</div>';
  }

  // ---------- phone
  const P = { code: (new URLSearchParams(location.search).get('room') || '').toUpperCase(), pid: null, token: null };
  function playBoot() {
    const seat = P.code && store.get('kit.seat.' + P.code);
    if (seat) { P.pid = seat.pid; P.token = seat.token; startPlayPoll(); } else draw();
  }
  function startPlayPoll() {
    if (poller) poller.stop();
    poller = poll((v) => '/api/rooms/' + P.code + '/player?pid=' + P.pid + '&token=' + P.token + '&v=' + v, onState, (st) => {
      if (st && st.fatal) { store.del('kit.seat.' + P.code); P.pid = null; S = null; error = st.fatal; draw(); } else { link = st; }
    });
  }
  async function join(code, nm) {
    if (busy) return; busy = true; error = '';
    code = String(code || '').trim().toUpperCase();
    const info = await api('GET', '/api/rooms/' + code);
    if (!info.ok) { busy = false; error = info.error; return draw(); }
    if (info.game !== game) { location.href = '/j/' + code; return; }
    const r = await api('POST', '/api/rooms/' + code + '/join', { name: nm });
    busy = false;
    if (!r.ok) { error = r.error; return draw(); }
    P.code = code; P.pid = r.pid; P.token = r.token; store.set('kit.seat.' + code, { pid: r.pid, token: r.token });
    history.replaceState(null, '', '?room=' + code); startPlayPoll();
  }
  async function act(sub) {
    if (busy) return; busy = true; error = ''; draw();
    const r = await api('POST', '/api/rooms/' + P.code + '/act', { pid: P.pid, token: P.token, sub });
    busy = false; if (!r.ok) error = r.error; else editing = false; draw();
  }
  function playDraw() {
    if (!P.pid) return '<div class="phone-wrap"><main class="p-main" style="padding-top:1.6rem"><h1>' + esc(G.title) + '</h1><p class="soft">' + esc(G.tagline) + '</p><form class="card stack" id="k-join">' +
      '<div><label class="field" for="k-code">Game code on the big screen</label><input type="text" id="k-code" maxlength="4" autocapitalize="characters" autocomplete="off" value="' + esc(P.code) + '" placeholder="ABCD"></div>' +
      '<div><label class="field" for="k-name">Your name or company</label><input type="text" id="k-name" maxlength="18" autocomplete="off" placeholder="Up to 18 letters"></div>' +
      (error ? '<div class="error">' + esc(error) + '</div>' : '') + '<button class="btn wide" type="submit">Join the game</button></form></main></div>';
    if (!S) return '<div class="phone-wrap"><main class="p-main"><p class="soft">Connecting…</p></main></div>';
    const s = S, me = s.me;
    const head = '<header class="p-head"><div class="row"><div class="co">' + dot(me.colour) + '<span>' + esc(me.name) + '</span></div>' + (s.phase !== 'lobby' && G.headBig ? '<div class="cash">' + G.headBig(s) + '</div>' : '') + '</div>' +
      (s.phase !== 'lobby' && G.head ? '<div class="stats">' + G.head(s) + '</div>' : '') + '</header>' + (link === 'retry' ? '<div class="banner">Reconnecting to the game…</div>' : '');
    let main, foot = '';
    if (s.phase === 'lobby') main = '<h1>You are in</h1><div class="card stack"><p>Watch the big screen. The host starts the game when everyone has joined.</p><div class="row">' + s.players.map((p) => '<span class="chip">' + dot(p.colour) + esc(p.name) + '</span>').join('') + '</div></div>' +
      '<div class="card flat"><h3>' + esc(G.tagline) + '</h3><ol class="k-how">' + G.how.map((h) => '<li>' + esc(h) + '</li>').join('') + '</ol></div>';
    else if (s.decision && G.idle && G.idle(s)) main = G.play(s, {});
    else if (s.decision && me.sub && !editing) main = (G.playTop ? G.playTop(s) : '') + '<div class="card locked"><div class="display">Locked in</div><p class="soft" style="margin:.5rem 0 1rem">' + (G.lockedText ? G.lockedText(s) : 'Waiting for the others. You can still change your mind.') + '</p><button class="btn ghost" data-edit>Change my choice</button></div>';
    else {
      const key = s.phase + ':' + s.year;
      if (key !== draftKey) { draftKey = key; draft = s.decision && G.draft ? G.draft(s) : {}; }
      main = G.play(s, draft);
      if (s.decision) { const pr = G.ready ? G.ready(s, draft) : true; foot = '<div class="p-foot">' + (error ? '<div class="error">' + esc(error) + '</div>' : '') + (typeof pr === 'string' ? '<div class="sum"><span>' + esc(pr) + '</span></div>' : '') + '<button class="btn wide" data-submit' + (pr !== true || busy ? ' disabled' : '') + '>' + esc((G.submitLabel && G.submitLabel(s)) || 'Lock in my choice') + '</button></div>'; }
    }
    return '<div class="phone-wrap">' + head + '<main class="p-main">' + main + '</main>' + foot + '</div>';
  }

  // ---------- shared
  function onState(state) { const k = state.phase + ':' + state.year; if (S && S.phase + ':' + S.year !== k) { editing = false; error = ''; if (mode === 'play') window.scrollTo(0, 0); } S = state; draw(); }
  function draw() {
    if (!G) return;
    const keep = document.activeElement && document.activeElement.id, val = keep && document.activeElement.value;
    const vals = {}; root.querySelectorAll('input[id]').forEach((i) => { vals[i.id] = i.value; });
    root.innerHTML = mode === 'host' ? hostDraw() : playDraw();
    for (const id of Object.keys(vals)) { const i = document.getElementById(id); if (i && vals[id]) i.value = vals[id]; }
    if (keep) { const el = document.getElementById(keep); if (el) { el.focus(); if (val !== undefined) el.value = val; } }
    document.title = G.title + (mode === 'host' ? ': host screen' : '');
    paintTimer();
  }
  function paintTimer() { const el = document.getElementById('k-timer'); if (!el || !deadline) return; const ms = deadline - Date.now(); el.textContent = clock(ms); el.classList.toggle('low', ms < 15000); }
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button,[data-cmd]'); if (!t) return;
    if (t.dataset.base) { H.base = t.dataset.base; store.set('kit.base', H.base); return draw(); }
    if (t.dataset.cmd) { const extra = {}; if (t.dataset.pid) extra.pid = t.dataset.pid; if (t.dataset.sec !== undefined) extra.sec = +t.dataset.sec; return hostCmd(t.dataset.cmd, extra); }
    if (t.dataset.set) { const v = JSON.parse(t.dataset.val); if (G.onSet) G.onSet(S, draft, t.dataset.set, v); else draft[t.dataset.set] = v; return draw(); }
    if (t.dataset.step) { const k = t.dataset.step; draft[k] = Math.max(+t.dataset.min, Math.min(+t.dataset.max, (draft[k] || 0) + +t.dataset.d)); return draw(); }
    if (t.dataset.edit !== undefined) { editing = true; draftKey = ''; return draw(); }
    if (t.dataset.submit !== undefined) return act(G.sub ? G.sub(S, draft) : draft);
  });
  root.addEventListener('submit', (e) => { if (e.target.id === 'k-join') { e.preventDefault(); join($('#k-code').value, $('#k-name').value); } });
  function register(g) { G = g; draw(); if (mode === 'host') hostBoot(); else playBoot(); tick = setInterval(paintTimer, 500); }
  const sc = document.createElement('script'); sc.src = '/g/' + game + '.js'; sc.onerror = () => { root.innerHTML = '<main class="landing"><h1 class="wordmark">Not found</h1><p class="lede">There is no game here. <a href="/" style="color:inherit">See all games</a>.</p></main>'; };
  document.body.appendChild(sc);
  return { register, money, pct, chip, name, gauge, stat, choice, stepper, esc, dot };
})();
