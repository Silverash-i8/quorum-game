'use strict';
// Shared helpers for the host screen and the phone controller.
const App = (() => {
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (x) => (x < 0 ? '−' : '') + '£' + Math.abs(x) + 'm';
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: carry on without it */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  async function api(method, url, body) {
    let res;
    try { res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
    catch (e) { return { ok: false, network: true, error: 'Cannot reach the game server. Check that this device is on the same network as the host laptop.' }; }
    let data = null;
    try { data = await res.json(); } catch (e) { /* not json */ }
    if (!data) return { ok: false, status: res.status, error: 'The game server gave an unexpected reply.' };
    data.status = res.status;
    return data;
  }
  // Long-poll loop. onState(state) runs on every change; onStatus('ok' | 'retry' | {fatal}) reports the link.
  function poll(urlFor, onState, onStatus) {
    let v = 0, on = null, stopped = false, fails = 0;
    (async function loop() {
      while (!stopped) {
        const r = await api('GET', urlFor(v) + (on === null ? '' : '&on=' + encodeURIComponent(on)));
        if (stopped) return;
        if (r.ok) { fails = 0; onStatus('ok'); if (r.state) { v = r.v; on = typeof r.on === 'string' ? r.on : null; onState(r.state); } continue; }
        if (r.status === 403 || r.status === 404) { onStatus({ fatal: r.error }); return; }
        fails++; onStatus('retry');
        await new Promise((ok) => setTimeout(ok, Math.min(4000, 600 * fails)));
      }
    })();
    return { stop() { stopped = true; }, refresh() { v = 0; } };
  }
  function pips(kind, n, max) { let h = '<span class="pips ' + kind + '" aria-hidden="true">'; for (let i = 0; i < max; i++) h += '<i' + (i < n ? ' class="on"' : '') + '></i>'; return h + '</span>'; }
  function dot(colour) { return '<i class="dot" style="background:' + esc(colour) + '"></i>'; }
  function qrSvg(text) {
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), m = 2; let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" role="img" aria-label="QR code to join the game" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#0C1230"/></svg>';
  }
  const SEG = { premium: 'Premium', green: 'Green', budget: 'Budget' };
  const SUP = { valley: 'Valley', nordic: 'Nordic', loop: 'LoopCell' };
  function clock(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  return { $, esc, money, plural, store, api, poll, pips, dot, qrSvg, SEG, SUP, clock };
})();
