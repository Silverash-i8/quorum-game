'use strict';
// Where games are kept. Two stores with the same interface:
//   memory - one process holds every game and saves them to a file. Used by start.bat and Docker on a laptop.
//   redis  - games live in a hosted Redis database, reached over its REST API. Used on Vercel, where the server can be
//            stopped, restarted or run as several copies at any time, so nothing may be kept only in memory.
// A room carries a version number v. put() succeeds only if nobody else saved that version first, so two copies of the
// server can never overwrite each other's moves.
const fs = require('fs'), path = require('path');
const TTL_S = 24 * 3600;

function memory(dataDir) {
  const rooms = new Map(), seen = new Map(), file = dataDir ? path.join(dataDir, 'rooms.json') : null;
  let timer = null;
  const save = () => { if (!file || timer) return; timer = setTimeout(() => { timer = null;
    try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify([...rooms.values()].map((s) => JSON.parse(s)))); fs.renameSync(file + '.tmp', file); } catch (e) { console.error('Could not save games:', e.message); } }, 400); };
  return {
    kind: 'memory', interval: 5000,
    load(valid) { if (!file) return 0; try { for (const r of JSON.parse(fs.readFileSync(file, 'utf8'))) if (Date.now() - r.touched < TTL_S * 1000 && valid(r)) rooms.set(r.code, JSON.stringify(r)); } catch (e) { /* first run */ } return rooms.size; },
    async get(code) { const s = rooms.get(code); return s ? JSON.parse(s) : null; },
    async meta(code) { const s = rooms.get(code); if (!s) return null; const r = JSON.parse(s); return { v: r.v, deadline: r.deadline || 0 }; },
    async put(code, prev, room) { const s = rooms.get(code), cur = s ? JSON.parse(s).v : 0; if (cur !== prev) return false; rooms.set(code, JSON.stringify(room)); save(); return true; },
    async touch(code, pid) { seen.set(code + ':' + pid, Date.now()); },
    async seen(code) { const out = {}; for (const [k, t] of seen) if (k.startsWith(code + ':')) out[k.slice(code.length + 1)] = t; return out; },
    sweep() { for (const [c, s] of rooms) if (Date.now() - JSON.parse(s).touched > TTL_S * 1000) rooms.delete(c); },
  };
}

function redis(url, token) {
  const base = url.replace(/\/+$/, ''), last = new Map();
  async function call(pathname, body) {
    const res = await fetch(base + pathname, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j) throw new Error('The game database answered ' + res.status);
    return j;
  }
  const cmd = async (...c) => { const j = await call('', c); if (j.error) throw new Error(j.error); return j.result; };
  const pipe = async (cmds) => { const j = await call('/pipeline', cmds); for (const x of j) if (x.error) throw new Error(x.error); return j.map((x) => x.result); };
  return {
    kind: 'redis', interval: 2000,
    load() { return 0; },
    async get(code) { const s = await cmd('GET', 'quorum:room:' + code); return s ? JSON.parse(s) : null; },
    async meta(code) { const s = await cmd('GET', 'quorum:meta:' + code); if (!s) return null; const [v, d] = String(s).split(':'); return { v: +v, deadline: +d || 0 }; },
    // Claim the next version number first. Only one copy of the server can claim it; the others re-read and try again.
    async put(code, prev, room) {
      if (room.v !== prev + 1) throw new Error('A room must move forward one version at a time.');
      const won = await cmd('SET', 'quorum:claim:' + code + ':' + room.v, '1', 'NX', 'EX', '120');
      if (won !== 'OK') return false;
      await pipe([['SET', 'quorum:room:' + code, JSON.stringify(room), 'EX', String(TTL_S)], ['SET', 'quorum:meta:' + code, room.v + ':' + (room.deadline || 0), 'EX', String(TTL_S)]]);
      return true;
    },
    // "Is this phone still here?" is written at most every six seconds per player, to stay well inside a free database plan.
    async touch(code, pid) { const k = code + ':' + pid, now = Date.now(); if (now - (last.get(k) || 0) < 6000) return; last.set(k, now); await pipe([['HSET', 'quorum:seen:' + code, pid, String(now)], ['EXPIRE', 'quorum:seen:' + code, String(TTL_S)]]); },
    async seen(code) { const a = (await cmd('HGETALL', 'quorum:seen:' + code)) || [], out = {}; for (let i = 0; i + 1 < a.length; i += 2) out[a[i]] = +a[i + 1]; return out; },
    sweep() { for (const [k, t] of last) if (Date.now() - t > 600000) last.delete(k); },
  };
}

// The database address and token arrive as environment variables. Vercel's Redis integrations use either pair of names.
function create(env, dataDir) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL, token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? redis(url, token) : memory(dataDir);
}
module.exports = { create, memory, redis };
