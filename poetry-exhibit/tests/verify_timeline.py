"""Run against a local server: python3 tests/verify_timeline.py http://127.0.0.1:8000"""
import base64
import json
import os
from pathlib import Path
import socket
import struct
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen
from urllib.parse import urlparse

sys.dont_write_bytecode = True
from chrome_devtools import DevTools

root = Path(__file__).resolve().parents[1]
qa = root / 'dist' / '.timeline-qa.html'
source = (root / 'dist' / 'index.html').read_text()
script = (root / 'tests' / 'browser-smoke.js').read_text()
qa.write_text(source.replace('</body>', '<script>' + script + '</script></body>'))
try:
    with tempfile.TemporaryDirectory(prefix='partition-chrome-', ignore_cleanup_errors=True) as profile:
        process = subprocess.Popen(['google-chrome','--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port=0',f'--user-data-dir={profile}','about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            port_file = Path(profile) / 'DevToolsActivePort'
            for _ in range(100):
                if port_file.exists(): break
                time.sleep(.05)
            port = port_file.read_text().splitlines()[0]
            pages = json.load(urlopen(f'http://127.0.0.1:{port}/json/list'))
            cdp = DevTools(next(p['webSocketDebuggerUrl'] for p in pages if p['type']=='page'))
            for width in (1440,390,320):
                cdp.command('Emulation.setDeviceMetricsOverride',{'width':width,'height':1000,'deviceScaleFactor':1,'mobile':width<700})
                cdp.command('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
                cdp.command('Page.navigate', {'url':sys.argv[1]+'/.timeline-qa.html'})
                report = None
                for _ in range(150):
                    raw = cdp.evaluate('document.getElementById("qa-results")?.textContent')
                    if raw:
                        report=json.loads(raw)
                        break
                    time.sleep(.05)
                if not report: raise RuntimeError('Browser report missing: '+str(cdp.evaluate('JSON.stringify({progress:window.timelineQaProgress?.slice(-5),active:document.activeElement.id,open:document.querySelector("#poet-background").open,scroll:scrollY,top:document.body.style.top})')))
                print(f'{width}px: '+json.dumps({k:v for k,v in report.items() if k!='results'}),flush=True)
                if not report['passed']: raise RuntimeError(report)
                if report['actualWidth'] != width: raise RuntimeError('Viewport mismatch')
                # Capture expanded August, after the same behavioral checks.
                cdp.evaluate('document.documentElement.style.scrollBehavior="auto"; document.querySelector("#timeline").scrollIntoView();')
                screenshot=cdp.command('Page.captureScreenshot', {'format':'png', 'captureBeyondViewport':False})
                Path(f'/tmp/partition-{width}.png').write_bytes(base64.b64decode(screenshot['data']))
                cdp.evaluate('document.querySelector(`nav[aria-label="Main navigation"] a[href="#poets"]`).click();')
                screenshot=cdp.command('Page.captureScreenshot', {'format':'png', 'captureBeyondViewport':False})
                Path(f'/tmp/poets-{width}.png').write_bytes(base64.b64decode(screenshot['data']))
                cdp.evaluate('document.querySelector(`nav[aria-label="Main navigation"] a[href="#poems"]`).click(); document.querySelector("#freedoms-dawn-title").closest("details").open=true; document.querySelector("#freedoms-dawn-title").scrollIntoView();')
                screenshot=cdp.command('Page.captureScreenshot', {'format':'png', 'captureBeyondViewport':False})
                Path(f'/tmp/freedoms-dawn-{width}.png').write_bytes(base64.b64decode(screenshot['data']))
                cdp.evaluate('document.querySelector(`nav[aria-label="Main navigation"] a[href="#poets"]`).click(); document.querySelector("#poet-faiz .poet-background-button").click();')
                cdp.command('Input.dispatchKeyEvent', {'type':'keyDown','key':'Escape','code':'Escape','windowsVirtualKeyCode':27})
                cdp.command('Input.dispatchKeyEvent', {'type':'keyUp','key':'Escape','code':'Escape','windowsVirtualKeyCode':27})
                time.sleep(.05)
                if not cdp.evaluate('!document.querySelector("#poet-background").open && document.activeElement.matches("#poet-faiz .poet-background-button")'):
                    raise RuntimeError('Escape did not dismiss the biography and restore focus')
                print(f'{width}px: native Escape dismissal and focus return passed', flush=True)
                cdp.evaluate('document.querySelector("#poet-pritam .poet-background-button").click();')
                for _ in range(50):
                    if cdp.evaluate('Boolean(document.querySelector(".journey-after"))'): break
                    time.sleep(.05)
                cdp.evaluate('document.querySelector(".journey-after").click(); document.querySelector("#poet-background").scrollTop=0;')
                if not cdp.evaluate(f'innerWidth === {width} && document.querySelector("#poet-background").getBoundingClientRect().left >= 0 && document.querySelector("#poet-background").getBoundingClientRect().right <= {width}'):
                    raise RuntimeError('Journey dialog lies outside the device viewport')
                screenshot=cdp.command('Page.captureScreenshot', {'format':'png', 'captureBeyondViewport':False})
                Path(f'/tmp/pritam-map-{width}.png').write_bytes(base64.b64decode(screenshot['data']))
                cdp.evaluate('document.querySelector(".journey-before").click();')
                screenshot=cdp.command('Page.captureScreenshot', {'format':'png', 'captureBeyondViewport':False})
                Path(f'/tmp/pritam-map-before-{width}.png').write_bytes(base64.b64decode(screenshot['data']))
                cdp.evaluate('document.querySelector("#close-poet-background").click();')
                cdp.evaluate('document.querySelector("#photographs-heading").scrollIntoView();')
                screenshot=cdp.command('Page.captureScreenshot', {'format':'png', 'captureBeyondViewport':False})
                Path(f'/tmp/partition-photographs-{width}.png').write_bytes(base64.b64decode(screenshot['data']))
                cdp.evaluate('document.querySelector("#exhibit-reading").scrollIntoView();')
                screenshot=cdp.command('Page.captureScreenshot', {'format':'png', 'captureBeyondViewport':False})
                Path(f'/tmp/partition-summary-{width}.png').write_bytes(base64.b64decode(screenshot['data']))
                for poet_id in ('faiz', 'gulzar'):
                    cdp.evaluate(f'document.querySelector("#poet-{poet_id} .poet-background-button").click();')
                    for _ in range(100):
                        if cdp.evaluate('Boolean(document.querySelector(".journey-frame svg"))'): break
                        time.sleep(.05)
                    for era in ('before', 'after'):
                        cdp.evaluate(f'document.querySelector(".journey-{era}").click(); document.querySelector("#poet-background").scrollTop=0;')
                        screenshot=cdp.command('Page.captureScreenshot', {'format':'png', 'captureBeyondViewport':False})
                        Path(f'/tmp/{poet_id}-map-{era}-{width}.png').write_bytes(base64.b64decode(screenshot['data']))
                    cdp.evaluate('document.querySelector("#close-poet-background").click();')
            cdp.command('Browser.close')
            cdp.sock.close()
            process.wait(timeout=10)
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
finally:
    qa.unlink(missing_ok=True)
