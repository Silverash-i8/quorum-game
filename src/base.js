'use strict';
// Shared skeleton for the smaller games. A game supplies a spec; make() returns an engine with the same
// interface as the CELL OUT engine, so the server can host any of them.
//   spec = { id, version, min, max, setup(g), decide: { phase: { check(g,p,sub), dflt(g,p), auto?(g,p), resolve(g,subs) } },
//            next: { phase(g) }, pub(g,p), host(g), me(g,p), report?(g) }
const COLOURS = ['#FF7A66', '#35D0A0', '#6FC3FF', '#FFB627', '#B79BFF', '#FF8FCB'];
const err = (m) => ({ ok: false, error: m });

function rnd(g) { g.rng = (g.rng + 0x6D2B79F5) >>> 0; let t = g.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const pick = (g, n) => Math.floor(rnd(g) * n);
function shuffle(g, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = pick(g, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const half = (x) => Math.round(x * 2) / 2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const money = (x) => (x < 0 ? '−' : '') + '£' + Math.abs(half(x)) + 'm';
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi);

function make(spec) {
  const DECISION = Object.keys(spec.decide);
  const E = { R: { version: spec.version, minPlayers: spec.min, maxPlayers: spec.max }, DECISION, id: spec.id };
  E.newGame = (seed) => { const s = (seed >>> 0) || 1; return { rules: spec.version, game: spec.id, seed: s, rng: s, phase: 'lobby', year: -1, players: [], nextId: 1, cur: { subs: {} }, final: null }; };
  E.player = (g, pid) => g.players.find((p) => p.id === pid);
  E.addPlayer = (g, o) => {
    if (g.phase !== 'lobby') return err('This game has already started.');
    const name = String((o && o.name) || '').replace(/\s+/g, ' ').trim().slice(0, 18);
    if (!name) return err('Type a name first.');
    if (g.players.length >= spec.max) return err('This game is full.');
    if (g.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return err('That name is taken. Choose another.');
    const used = g.players.map((p) => p.colour);
    const p = { id: 'p' + g.nextId++, name, bot: (o && o.bot) || null, colour: COLOURS.find((c) => !used.includes(c)) || COLOURS[0] };
    g.players.push(p);
    return { ok: true, player: p };
  };
  E.removePlayer = (g, pid) => {
    if (g.phase !== 'lobby') return err('Players can only be removed before the game starts.');
    const i = g.players.findIndex((p) => p.id === pid);
    if (i < 0) return err('No such player.');
    g.players.splice(i, 1); return { ok: true };
  };
  E.start = (g) => {
    if (g.phase !== 'lobby') return err('This game has already started.');
    if (g.players.length < spec.min) return err('This game needs at least ' + spec.min + ' player' + (spec.min > 1 ? 's' : '') + '. Add a practice bot to fill a seat.');
    g.year = 0; spec.setup(g); settle(g);
    return { ok: true };
  };
  E.pending = (g) => (DECISION.includes(g.phase) ? g.players.filter((p) => !g.cur.subs[p.id]).map((p) => p.id) : []);
  function resolve(g) { const subs = g.cur.subs; g.cur.subs = {}; spec.decide[g.phase].resolve(g, subs); }
  // After any phase change: fill in players who have nothing to decide, and move on if nobody is left.
  function settle(g) {
    for (let guard = 0; guard < 20 && DECISION.includes(g.phase); guard++) {
      const d = spec.decide[g.phase];
      if (d.auto) for (const p of g.players) if (!g.cur.subs[p.id]) { const a = d.auto(g, p); if (a) g.cur.subs[p.id] = a; }
      if (E.pending(g).length) return;
      resolve(g);
    }
  }
  E.submit = (g, pid, sub) => {
    if (!DECISION.includes(g.phase)) return err('There is nothing to decide right now.');
    const p = E.player(g, pid);
    if (!p) return err('Unknown player.');
    const r = spec.decide[g.phase].check(g, p, sub && typeof sub === 'object' ? sub : {});
    if (!r.ok) return r;
    g.cur.subs[pid] = r.sub; settle(g);
    return { ok: true };
  };
  E.advance = (g) => {
    if (g.phase === 'lobby') return err('The game has not started.');
    if (g.phase === 'final') return err('The game is over.');
    if (DECISION.includes(g.phase)) { for (const p of g.players) if (!g.cur.subs[p.id]) g.cur.subs[p.id] = spec.decide[g.phase].dflt(g, p); resolve(g); }
    else spec.next[g.phase](g);
    settle(g);
    return { ok: true };
  };
  function common(g) {
    const v = { game: spec.id, rulesVersion: spec.version, phase: g.phase, year: g.year, minPlayers: spec.min, maxPlayers: spec.max, decision: DECISION.includes(g.phase),
      players: g.players.map((p) => Object.assign({ id: p.id, name: p.name, bot: p.bot, colour: p.colour, done: !!g.cur.subs[p.id] }, g.phase === 'lobby' ? {} : spec.pub(g, p))) };
    if (g.phase !== 'lobby') Object.assign(v, spec.host(g));
    return v;
  }
  E.hostView = (g) => common(g);
  E.playerView = (g, pid) => {
    const v = common(g), p = E.player(g, pid);
    v.me = p ? Object.assign({ id: p.id, name: p.name, colour: p.colour, sub: g.cur.subs[pid] || null }, g.phase === 'lobby' ? {} : spec.me(g, p)) : null;
    return v;
  };
  E.forceDefault = (g, pid) => { if (!DECISION.includes(g.phase)) return; g.cur.subs[pid] = spec.decide[g.phase].dflt(g, E.player(g, pid)); settle(g); };
  E.report = (g) => (spec.report ? spec.report(g) : { cols: [], rows: [] });
  return E;
}

// Bot runner shared by the games: decide(g, p, rand) returns a submission.
function bots(E, decide, STYLES, NAMES) {
  function run(g, rand) {
    for (let guard = 0; guard < 60 && E.DECISION.includes(g.phase); guard++) {
      const todo = g.players.filter((p) => p.bot && !g.cur.subs[p.id]);
      if (!todo.length) return;
      const phase = g.phase, year = g.year, p = todo[0];
      const r = E.submit(g, p.id, decide(g, p, rand || Math.random));
      if (!r.ok && g.phase === phase && g.year === year) { run.errors.push(E.id + ' bot ' + p.bot + ' in ' + phase + ': ' + r.error); E.forceDefault(g, p.id); }
    }
  }
  run.errors = []; // invalid bot moves fall back to the default choice; the tests assert this list stays empty
  return { run, decide, STYLES, NAMES };
}

module.exports = { make, bots, rnd, pick, shuffle, half, clamp, money, int, err, COLOURS };
