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

class DevTools:
    """Minimal local Chrome DevTools WebSocket client; no dependencies."""
    def __init__(self, url):
        u = urlparse(url)
        self.sock = socket.create_connection((u.hostname, u.port), timeout=10)
        self.file = self.sock.makefile('rb')
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((f'GET {u.path} HTTP/1.1\r\nHost: {u.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        headers = b''
        while not headers.endswith(b'\r\n\r\n'): headers += self.file.read(1)
        if not headers.startswith(b'HTTP/1.1 101 '): raise RuntimeError(headers.decode())
        self.seq = 0
    def command(self, method, params=None):
        self.seq += 1
        payload = json.dumps({'id':self.seq, 'method':method, 'params':params or {}}).encode()
        length = len(payload)
        header = bytes([0x81, 0x80 | (length if length < 126 else 126)])
        if length >= 126: header += struct.pack('!H', length)
        mask = os.urandom(4)
        self.sock.sendall(header + mask + bytes(b ^ mask[i % 4] for i,b in enumerate(payload)))
        while True:
            first, second = self.file.read(2)
            length = second & 127
            if length == 126: length = struct.unpack('!H', self.file.read(2))[0]
            elif length == 127: length = struct.unpack('!Q', self.file.read(8))[0]
            message = json.loads(self.file.read(length))
            if message.get('id') == self.seq:
                if 'error' in message: raise RuntimeError(message['error'])
                return message.get('result', {})
    def evaluate(self, expression):
        return self.command('Runtime.evaluate', {'expression':expression,'returnByValue':True}).get('result',{}).get('value')

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
                if not report: raise RuntimeError('Browser report missing')
                print(f'{width}px: '+json.dumps({k:v for k,v in report.items() if k!='results'}),flush=True)
                if not report['passed']: raise RuntimeError(report)
                if report['actualWidth'] != width: raise RuntimeError('Viewport mismatch')
                # Capture expanded August, after the same behavioral checks.
                cdp.evaluate('document.documentElement.style.scrollBehavior="auto"; document.querySelector("#timeline").scrollIntoView();')
                screenshot=cdp.command('Page.captureScreenshot', {'format':'png'})
                Path(f'/tmp/partition-{width}.png').write_bytes(base64.b64decode(screenshot['data']))
                cdp.evaluate('document.querySelector("#poets").scrollIntoView();')
                screenshot=cdp.command('Page.captureScreenshot', {'format':'png'})
                Path(f'/tmp/poets-{width}.png').write_bytes(base64.b64decode(screenshot['data']))
                cdp.evaluate('document.querySelector("#freedoms-dawn-title").scrollIntoView();')
                screenshot=cdp.command('Page.captureScreenshot', {'format':'png'})
                Path(f'/tmp/freedoms-dawn-{width}.png').write_bytes(base64.b64decode(screenshot['data']))
                cdp.evaluate('document.querySelector("#poet-faiz .poet-background-button").click();')
                cdp.command('Input.dispatchKeyEvent', {'type':'keyDown','key':'Escape','code':'Escape','windowsVirtualKeyCode':27})
                cdp.command('Input.dispatchKeyEvent', {'type':'keyUp','key':'Escape','code':'Escape','windowsVirtualKeyCode':27})
                time.sleep(.05)
                if not cdp.evaluate('!document.querySelector("#poet-background").open && document.activeElement.matches("#poet-faiz .poet-background-button")'):
                    raise RuntimeError('Escape did not dismiss the biography and restore focus')
                print(f'{width}px: native Escape dismissal and focus return passed', flush=True)
            cdp.command('Browser.close')
            cdp.sock.close()
            process.wait(timeout=10)
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
finally:
    qa.unlink(missing_ok=True)
