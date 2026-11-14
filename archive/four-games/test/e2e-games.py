"""Plays CHAIN REACTION, QUORUM and PATENT PENDING through real browsers: one host screen, one phone, bots in the other seats.
Run from the project folder: python3 test/e2e-games.py   (needs Playwright for Python). Screenshots go to test/shots/."""
import subprocess, time, os, sys, tempfile, urllib.request
from playwright.sync_api import sync_playwright
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); PORT = 3133; base = f'http://127.0.0.1:{PORT}'
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
        hub = b.new_page(viewport={'width': 1280, 'height': 800}); watch(hub, 'hub'); hub.goto(base + '/'); hub.wait_for_selector('.k-games'); hub.screenshot(path=os.path.join(shots, 'hub.png'))
        assert hub.locator('.k-games .card').count() == 4
        for game in ['chain', 'quorum', 'patent']:
            host = b.new_page(viewport={'width': 1600, 'height': 900}); watch(host, game + ' host')
            host.goto(f'{base}/{game}/host'); host.wait_for_selector('.joincard .code')
            code = host.locator('.joincard .code').inner_text().strip(); assert len(code) == 4
            ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); phone = ctx.new_page(); watch(phone, game + ' phone')
            phone.goto(f'{base}/j/{code}'); phone.wait_for_selector('#k-name'); assert f'/{game}/play' in phone.url
            phone.fill('#k-name', 'Abdulrahman'); phone.click('button[type=submit]'); phone.wait_for_selector('text=You are in')
            host.wait_for_selector('.seat'); host.click('[data-cmd=addBot]'); host.wait_for_function("document.querySelectorAll('.seat').length === 2")
            host.screenshot(path=os.path.join(shots, f'{game}-host-lobby.png')); phone.screenshot(path=os.path.join(shots, f'{game}-phone-lobby.png'))
            host.click('[data-cmd=start]'); host.wait_for_selector('.stage')
            seen = set(); steps = 0
            while steps < 150:
                steps += 1; time.sleep(0.12)
                if host.locator('[data-cmd=new]').count(): break
                title = host.locator('.stage h1, .stage .k-big').first.inner_text() if host.locator('.stage h1, .stage .k-big').count() else '?'
                key = phone.evaluate("document.querySelector('.p-main h1') ? document.querySelector('.p-main h1').textContent : ''")
                submit = phone.locator('[data-submit]')
                if submit.count():
                    # press the first option in every group that has nothing chosen yet
                    for _ in range(12):
                        n = phone.evaluate("""() => { for (const c of document.querySelectorAll('.p-main .card')) { const bs = [...c.querySelectorAll('.choice')]; if (bs.length && !bs.some((x) => x.getAttribute('aria-pressed') === 'true')) { bs[0].click(); return 1; } } return 0; }""")
                        if not n: break
                        time.sleep(0.03)
                    if game == 'patent' and phone.locator('[data-step^=b_]').count():
                        for _ in range(4): phone.locator('[data-step^=b_][data-d="1"]').first.click()
                    tag = key.split()[0] if key else 'x'
                    if tag not in seen:
                        seen.add(tag); phone.screenshot(path=os.path.join(shots, f'{game}-phone-{len(seen):02d}-{tag.lower()}.png'), full_page=True); host.screenshot(path=os.path.join(shots, f'{game}-host-{len(seen):02d}-{tag.lower()}.png'))
                    assert submit.is_enabled(), f'{game}: cannot submit on "{key}": ' + phone.locator('.p-foot').inner_text()
                    submit.click(); time.sleep(0.15)
                    assert not phone.locator('.p-foot .error').count(), phone.locator('.p-foot').inner_text()
                elif host.locator('[data-cmd=continue]').count():
                    tag = 'r-' + (key.split()[0] if key else 'x')
                    if tag not in seen:
                        seen.add(tag); phone.screenshot(path=os.path.join(shots, f'{game}-phone-{len(seen):02d}-{tag.lower()}.png'), full_page=True); host.screenshot(path=os.path.join(shots, f'{game}-host-{len(seen):02d}-{tag.lower()}.png'))
                    host.click('[data-cmd=continue]')
            assert host.locator('[data-cmd=new]').count(), f'{game} did not reach the end in {steps} steps'
            time.sleep(0.3); host.screenshot(path=os.path.join(shots, f'{game}-host-final.png')); phone.screenshot(path=os.path.join(shots, f'{game}-phone-final.png'), full_page=True)
            csv = urllib.request.urlopen(base + host.locator('a[href*="report.csv"]').get_attribute('href')).read().decode(); assert csv.count('\n') > 8, csv
            # a refresh keeps the seat
            phone.reload(); phone.wait_for_selector('.p-head'); assert 'Abdulrahman' in phone.locator('.p-head').inner_text()
            print(f'{game}: finished in {steps} steps, screens seen: {sorted(seen)}; final headline: ' + host.locator('.k-big').inner_text())
            host.close(); ctx.close()
        b.close()
    assert not errors, errors
    print('E2E GAMES OK')
finally:
    srv.terminate()
