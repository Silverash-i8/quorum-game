"""Renders the printable pages to PDF (needs Playwright for Python). Run from the project folder."""
import subprocess, time, os, tempfile, urllib.request
from playwright.sync_api import sync_playwright
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); PORT = 3122
srv = subprocess.Popen(['node', os.path.join(root, 'src', 'server.js')], env=dict(os.environ, PORT=str(PORT), DATA_DIR=tempfile.mkdtemp()), stdout=subprocess.DEVNULL)
try:
    for _ in range(50):
        try: urllib.request.urlopen(f'http://127.0.0.1:{PORT}/api/info'); break
        except Exception: time.sleep(0.1)
    with sync_playwright() as pw:
        b = pw.chromium.launch(); p = b.new_page()
        p.goto(f'http://127.0.0.1:{PORT}/instructions'); p.evaluate('document.fonts.ready')
        p.pdf(path=os.path.join(root, 'docs', 'CELL-OUT-Player-Instructions.pdf'), format='A4', print_background=True, prefer_css_page_size=True)
        p.goto(f'http://127.0.0.1:{PORT}/datasheet?copies=10'); p.evaluate('document.fonts.ready')
        p.pdf(path=os.path.join(root, 'docs', 'CELL-OUT-Datasheets-x10.pdf'), print_background=True, prefer_css_page_size=True)
        b.close()
finally:
    srv.terminate()
print('PDFs written to docs/')
