"""Plays QUORUM through real browsers: one host screen, two phones, bots in the other four seats.
Run from the project folder: python3 test/e2e.py   (needs Playwright for Python). Screenshots go to test/shots/."""
import subprocess, time, os, tempfile, urllib.request
from playwright.sync_api import sync_playwright
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); PORT = 3144; base = f'http://127.0.0.1:{PORT}'
shots = os.path.join(root, 'test', 'shots'); os.makedirs(shots, exist_ok=True)
srv = subprocess.Popen(['node', os.path.join(root, 'src', 'server.js')], env=dict(os.environ, PORT=str(PORT), DATA_DIR=tempfile.mkdtemp(), PUBLIC_URL='http://192.168.1.20:3000'), stdout=subprocess.DEVNULL)
errors = []
def watch(page, who):
    page.on('pageerror', lambda e: errors.append(f'{who}: {e}'))
    page.on('console', lambda m: errors.append(f'{who} console: {m.text}') if m.type == 'error' and 'favicon' not in m.text else None)
try:
    for _ in range(50):
        try: urllib.request.urlopen(base + '/api/info'); break
        except Exception: time.sleep(0.1)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        home = b.new_page(viewport={'width': 390, 'height': 844}); watch(home, 'home'); home.goto(base + '/'); home.wait_for_selector('.wordmark'); home.screenshot(path=os.path.join(shots, 'home.png'))
        host = b.new_page(viewport={'width': 1600, 'height': 900}); watch(host, 'host'); host.goto(base + '/host'); host.wait_for_selector('.joincard .code')
        code = host.locator('.joincard .code').inner_text().strip(); assert len(code) == 4
        phones = []
        for nm in ['Abdulrahman', 'Hasham']:
            ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); ph = ctx.new_page(); watch(ph, nm)
            ph.goto(f'{base}/j/{code}'); ph.wait_for_selector('#k-name'); ph.fill('#k-name', nm); ph.click('button[type=submit]'); ph.wait_for_selector('text=You are in'); phones.append(ph)
        host.wait_for_function("document.querySelectorAll('.seat').length === 2"); host.screenshot(path=os.path.join(shots, 'host-lobby.png'))
        host.click('[data-cmd=start]'); host.wait_for_selector('.stage')
        assert host.locator('.co-row').count() == 6, 'six seats on the board'
        seen = set(); steps = 0
        def snap(tag):
            if tag in seen: return
            seen.add(tag); host.screenshot(path=os.path.join(shots, f'host-{len(seen):02d}-{tag}.png')); phones[0].screenshot(path=os.path.join(shots, f'phone-{len(seen):02d}-{tag}.png'), full_page=True)
        while steps < 200:
            steps += 1; time.sleep(0.1)
            if host.locator('[data-cmd=new]').count(): break
            acted = False
            for i, ph in enumerate(phones):
                if not ph.locator('[data-submit]').count(): continue
                head = ph.evaluate("document.querySelector('.p-main h1').textContent")
                for _ in range(8):
                    n = ph.evaluate("""() => { for (const c of document.querySelectorAll('.p-main .card')) { const bs = [...c.querySelectorAll(':scope > .choice, :scope > .k-two > .choice')]; if (bs.length && !bs.some((x) => x.getAttribute('aria-pressed') === 'true')) { bs[%d %% bs.length].click(); return 1; } } return 0; }""" % i)
                    if not n: break
                    time.sleep(0.03)
                if i == 0: snap('vote' if head == 'Vote' else 'brief')
                assert ph.locator('[data-submit]').is_enabled(), ph.locator('.p-foot').inner_text()
                # the stats below the decision are on every phone
                assert ph.locator('text=The company').count() and ph.locator('text=Your score so far').count() and ph.locator('text=The board').count()
                ph.click('[data-submit]'); time.sleep(0.12); assert not ph.locator('.p-foot .error').count(); acted = True
            if not acted and host.locator('[data-cmd=continue]').count():
                if host.locator('.k-big').count(): snap('result')
                host.click('[data-cmd=continue]')
        assert host.locator('[data-cmd=new]').count(), f'did not reach the end in {steps} steps'
        time.sleep(0.3); host.screenshot(path=os.path.join(shots, 'host-final.png'), full_page=True); phones[0].screenshot(path=os.path.join(shots, 'phone-final.png'), full_page=True)
        csv = urllib.request.urlopen(base + host.locator('a[href*="report.csv"]').get_attribute('href')).read().decode(); assert 'Abdulrahman' in csv and csv.count('\n') > 20
        phones[0].reload(); phones[0].wait_for_selector('.p-head'); assert 'Abdulrahman' in phones[0].locator('.p-head').inner_text()
        phones[0].click('#guide summary'); time.sleep(0.1); assert phones[0].locator('#guide[open]').count() == 1
        print(f'finished in {steps} steps; screens: {sorted(seen)}; headline: ' + host.locator('.k-big').inner_text())
        b.close()
    assert not errors, errors
    print('E2E OK')
finally:
    srv.terminate()
