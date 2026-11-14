"""End-to-end test: one host screen and three phones play a full five-year game through the real UI."""
import subprocess, sys, time, os, json, tempfile, urllib.request
from playwright.sync_api import sync_playwright
PORT = 3111; BASE = f'http://127.0.0.1:{PORT}'; SHOTS = os.path.join(os.path.dirname(__file__), 'shots')
env = dict(os.environ, PORT=str(PORT), DATA_DIR=tempfile.mkdtemp(), PUBLIC_URL='http://192.168.1.20:3000')
srv = subprocess.Popen(['node', os.path.join(os.path.dirname(__file__), '..', 'src', 'server.js')], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
for _ in range(50):
    try: urllib.request.urlopen(BASE + '/api/info'); break
    except Exception: time.sleep(0.1)
errors = []
PLANS = {  # per phone: dilemma choice, actions per year (data-pick keys), supplier preference, fallback
  'VoltWorks': dict(choice='proper', acts=[['qa', 'sust'], ['recyc', 'line'], ['sust', 'cyber'], ['line', 'mkt'], ['mkt', 'sust']], sup=['loop', 'nordic'], fb=False, loan={1: 'take'}),
  'CheapCo':   dict(choice='shortcut', acts=[['line', 'qa'], ['rd-secret', 'line'], ['rd-secret', 'cyber'], ['cyber', 'mkt'], ['mkt', 'mkt']], sup=['valley'], fb=False, loan={0: 'take'}),
  'IonLab':    dict(choice='proper', acts=[['rd-patent', 'cyber'], ['rd-patent', 'line'], ['cyber', 'qa'], ['line', 'rd-patent'], ['mkt', 'rd-patent']], sup=['nordic'], fb=True, loan={1: 'take'}),
}
def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=True)
def wait_phase(page, text, timeout=8000):
    page.wait_for_function('t => document.body.innerText.toLowerCase().includes(t.toLowerCase())', arg=text, timeout=timeout)
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        hctx = br.new_context(viewport={'width': 1600, 'height': 900}); host = hctx.new_page()
        host.on('pageerror', lambda e: errors.append('host: ' + str(e))); host.on('console', lambda m: errors.append('host console: ' + m.text) if m.type == 'error' else None)
        host.goto(BASE + '/host'); host.wait_for_selector('.joincard .code')
        code = host.inner_text('.joincard .code').strip(); assert len(code) == 4, code
        assert '192.168.1.20:3000' in host.inner_text('.joincard .url'), 'join address should come from PUBLIC_URL when the host is on localhost'
        shot(host, 'host-00-lobby-empty')
        phones = {}
        for name in PLANS:
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            p = ctx.new_page(); p.on('pageerror', lambda e, n=name: errors.append(n + ': ' + str(e))); p.on('console', lambda m, n=name: errors.append(n + ' console: ' + m.text) if m.type == 'error' else None)
            p.goto(BASE + '/j/' + code.lower()); p.wait_for_selector('#name')
            assert p.input_value('#code') == code
            if name == 'VoltWorks': shot(p, 'phone-00-join')
            p.fill('#name', name); p.click('button[type=submit]'); wait_phase(p, 'You are in'); phones[name] = p
        # duplicate name is refused with a clear message
        ctx = br.new_context(viewport={'width': 390, 'height': 844}); dup = ctx.new_page(); dup.goto(BASE + '/play?room=' + code); dup.fill('#name', 'voltworks'); dup.click('button[type=submit]'); dup.wait_for_selector('.error'); assert 'taken' in dup.inner_text('.error'); ctx.close()
        host.wait_for_function('document.querySelectorAll(".seat").length === 3')
        shot(host, 'host-01-lobby'); shot(phones['VoltWorks'], 'phone-01-lobby')
        host.click('[data-timer="0"]'); host.wait_for_selector('[data-timer="0"][aria-pressed="true"]')
        host.click('[data-start]'); host.wait_for_selector('.pack')
        V = phones['VoltWorks']
        for y in range(5):
            first = (y == 0)
            wait_phase(host, str(2027 + y) + ':')
            if first: shot(host, 'host-02-news'); wait_phase(V, 'This year'); shot(V, 'phone-02-news')
            host.click('[data-continue]'); wait_phase(host, 'Boardroom dilemma')
            if first: shot(host, 'host-03-dilemma')
            for name, p in phones.items():
                p.wait_for_selector('[data-choice]'); 
                if first and name == 'VoltWorks': shot(p, 'phone-03-dilemma')
                p.click(f'[data-choice="{PLANS[name]["choice"]}"]'); p.click('[data-lock]')
                if name != 'IonLab': p.wait_for_selector('.locked')
                if first and name == 'VoltWorks': shot(p, 'phone-03b-locked')
            host.wait_for_selector('.reveal-count'); time.sleep(1.6 if first else 0)
            if first: shot(host, 'host-04-dilemma-reveal'); shot(V, 'phone-04-dilemma-reveal')
            host.click('[data-continue]'); wait_phase(host, 'Choose up to 2 actions')
            if first: shot(host, 'host-05-boardroom')
            for name, p in phones.items():
                p.wait_for_selector('[data-pick]')
                loan = PLANS[name]['loan'].get(y)
                if loan:
                    b = p.locator(f'[data-loan="{loan}"]')
                    if b.is_enabled(): b.click()
                for key in PLANS[name]['acts'][y]:
                    b = p.locator(f'[data-pick="{key}"]')
                    if b.is_enabled(): b.click()
                if first and name == 'VoltWorks': shot(p, 'phone-05-boardroom')
                p.click('[data-lock]')
            host.wait_for_function('document.body.innerText.includes("What the boards decided")'.replace('What the boards decided', 'WHAT THE BOARDS DECIDED'))
            if first: shot(host, 'host-06-boardroom-reveal'); wait_phase(V, 'What you did'); shot(V, 'phone-06-boardroom-reveal')
            host.click('[data-continue]'); wait_phase(host, 'Order cells on your phone')
            if first: shot(host, 'host-07-supply')
            for name, p in phones.items():
                p.wait_for_selector('[data-step]')
                for sup in PLANS[name]['sup']:
                    plus = p.locator(f'[data-step="{sup}"][data-d="1"]')
                    for _ in range(8):
                        if not plus.is_enabled(): break
                        # leave a little cash for running costs
                        plus.click()
                if PLANS[name]['fb'] and p.locator('[data-fb="1"]').count(): p.click('[data-fb="1"]')
                if first and name == 'VoltWorks': shot(p, 'phone-07-supply')
                if first and name == 'IonLab': shot(p, 'phone-07-supply-fallback')
                p.click('[data-lock]')
            wait_phase(host, 'Deliveries'); wait_phase(host, 'Climate track:')
            if first: shot(host, 'host-08-deliveries'); wait_phase(V, 'built'); shot(V, 'phone-08-deliveries')
            host.click('[data-continue]'); host.wait_for_selector('.card.risk'); time.sleep(3.2 if first else 0)
            if first: shot(host, 'host-09-risk'); shot(V, 'phone-09-risk')
            host.click('[data-continue]'); wait_phase(host, str(2027 + y) + ' sales')
            wait_phase(V, 'accounts')
            if first: shot(host, 'host-10-market'); shot(V, 'phone-10-accounts')
            if y == 2: shot(host, 'host-10-market-y3'); shot(phones['CheapCo'], 'phone-10-accounts-cheapco-y3')
            host.click('[data-continue]')
        host.wait_for_selector('.winner-name'); time.sleep(3.6)
        shot(host, 'host-11-final')
        for name, p in phones.items():
            wait_phase(p, 'Enterprise Score'); shot(p, 'phone-11-final-' + name)
        V.click('[data-sheet]'); V.wait_for_selector('.sheet table'); shot(V, 'phone-12-datasheet')
        assert V.locator('.sheet thead th').count() == 6 and V.locator('.sheet tbody tr').count() == 22
        # the report downloads and has 15 yearly rows
        key = host.evaluate('JSON.parse(localStorage.getItem("cellout.host.' + code + '"))')
        csv = urllib.request.urlopen(f'{BASE}/api/rooms/{code}/report.csv?key={key}').read().decode()
        rows = [l for l in csv.split('\r\n') if l.startswith('"VoltWorks"') or l.startswith('"CheapCo"') or l.startswith('"IonLab"')]
        assert len(rows) == 15, len(rows)
        open(os.path.join(SHOTS, 'report.csv'), 'w').write(csv)
        # a refreshed phone comes straight back to its seat
        V.reload(); wait_phase(V, 'Enterprise Score')
        # QR on the host screen decodes to the join link
        h2 = br.new_context(viewport={'width': 1600, 'height': 900}).new_page(); h2.goto(BASE + '/host'); h2.wait_for_selector('.joincard .qr svg')
        code2 = h2.inner_text('.joincard .code').strip(); h2.locator('.joincard .qr').screenshot(path=os.path.join(SHOTS, 'qr.png'))
        import cv2
        val, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(os.path.join(SHOTS, 'qr.png')))
        assert val == 'http://192.168.1.20:3000/j/' + code2, repr(val)
        print('QR decodes to', val)
        final = json.loads(urllib.request.urlopen(f'{BASE}/api/rooms/{code}/host?key={key}&v=0').read())['state']['final']
        print('final scores', [(s['pid'], s['total'], s['parts']) for s in final['scores']], 'crisis', final['crisis'])
        br.close()
finally:
    srv.terminate()
if errors: print('BROWSER ERRORS:', *errors, sep='\n  '); sys.exit(1)
print('E2E OK')
