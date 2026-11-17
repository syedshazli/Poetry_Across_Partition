"""Export georeferenced OpenStreetMap basemaps with and without political boundaries.

Requires requests and Google Chrome. Run from any directory with network access.
Uses at most four parallel upstream requests, a descriptive user agent, and <50 MB.
Only the two PNG exports and their bounds/attribution are written to the exhibit.
"""
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import urlopen
import requests

ROOT = Path(__file__).resolve().parents[1]
POET = sys.argv[1] if len(sys.argv) > 1 else 'pritam'
journey = next(p['journey'] for p in json.loads((ROOT/'dist'/'timeline-data.json').read_text())['poets'] if p['id'] == POET and p.get('journey'))
sys.path.insert(0, str(ROOT / 'tests'))
sys.dont_write_bytecode = True
from chrome_devtools import DevTools
UA = 'PoetryAcrossPartition/1.0 (https://github.com/syedshazli/Poetry_Across_Partition; educational map export)'
WIDTH, HEIGHT = 1080, 780
cache = {}
cache_lock = threading.Lock()
slots = threading.Semaphore(4)
bytes_received = 0

def get(url):
    global bytes_received
    with cache_lock:
        if url in cache: return cache[url]
    with slots:
        with cache_lock:
            if url in cache: return cache[url]
        response = requests.get(url, headers={'User-Agent':UA}, timeout=45)
        response.raise_for_status()
        body, mime = response.content, response.headers.get('Content-Type','application/octet-stream')
        with cache_lock:
            bytes_received += len(body)
            if bytes_received > 50_000_000: raise RuntimeError('50 MB download limit reached')
            cache[url] = (body, mime)
        return body, mime

def proxy(url):
    return '/proxy?url=' + quote(url, safe='{}')

style = json.loads(get('https://tiles.openfreemap.org/styles/liberty')[0])
for source in style['sources'].values():
    if 'url' in source:
        info = json.loads(get(source.pop('url'))[0])
        source.update({key: info[key] for key in ['tiles','minzoom','maxzoom','attribution'] if key in info})
    if 'tiles' in source: source['tiles'] = [proxy(url) for url in source['tiles']]
style['sprite'] = proxy(style['sprite'])
style['glyphs'] = proxy(style['glyphs'])
renderer = get('https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js')
css = get('https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css')

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def do_GET(self):
        request = urlparse(self.path)
        try:
            if request.path.startswith('/proxy'):
                suffix = request.path[len('/proxy'):]
                if suffix not in ['', '.json', '.png', '@2x.json', '@2x.png']: raise ValueError('Unsupported suffix')
                url = parse_qs(request.query)['url'][0] + suffix
                if urlparse(url).hostname != 'tiles.openfreemap.org': raise ValueError('Unsupported upstream')
                body, mime = get(url)
            elif request.path == '/maplibre.js': body,mime = renderer
            elif request.path == '/maplibre.css': body,mime = css
            elif request.path == '/render.html':
                era = parse_qs(request.query).get('era',['before'])[0]
                selected = json.loads(json.dumps(style).replace('/proxy?url=', f'http://127.0.0.1:{self.server.server_port}/proxy?url='))
                if era == 'before':
                    selected['layers'] = [layer for layer in selected['layers'] if layer.get('source-layer') != 'boundary' and not any(word in layer['id'] for word in ['label_country','label_state','label_province'])]
                bounds = journey.get('basemapBounds', {'before':[[73.65,31.15],[75.05,32.45]],'after':[[73.6,28.25],[78.5,32.5]]})[era]
                html = '''<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/maplibre.css"><style>html,body,#map{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="map"></div><script src="/maplibre.js"></script><script>
                window.renderReady=false;window.renderErrors=[];
                maplibregl.setMaxParallelImageRequests(4);
                const map = new maplibregl.Map({container:'map',style:STYLE,center:[75,31],zoom:7,interactive:false,attributionControl:false,preserveDrawingBuffer:true,fadeDuration:0,renderWorldCopies:false});
                window.map=map;
                map.on('error',e=>window.renderErrors.push(String(e.error?.message||e.error)));
                map.once('load',()=>{
                  map.fitBounds(BOUNDS,{padding:40,duration:0});
                  map.once('idle',()=>{
                    const sw=map.unproject([0,map.getCanvas().clientHeight]),ne=map.unproject([map.getCanvas().clientWidth,0]);
                    window.mapBounds=[sw.lng,sw.lat,ne.lng,ne.lat];
                    window.featureCount=map.queryRenderedFeatures().length;
                    window.placeNames=[...new Set(map.queryRenderedFeatures().filter(f=>f.sourceLayer==='place').map(f=>f.properties['name:en']||f.properties['name:latin']||f.properties.name))];
                    window.renderReady=true;
                  });
                });
                </script>'''.replace('STYLE',json.dumps(selected)).replace('BOUNDS',json.dumps(bounds))
                body,mime = html.encode(),'text/html'
            else:
                self.send_error(404);return
            self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        except Exception as error:
            self.send_error(502,str(error))

server = ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
metadata = {'projection':'Web Mercator','width':900,'height':650,'attribution':[{'title':'© OpenStreetMap contributors','url':'https://www.openstreetmap.org/copyright'},{'title':'© OpenMapTiles','url':'https://openmaptiles.org/'},{'title':'OpenFreeMap','url':'https://openfreemap.org/'}], 'note':'Present-day OpenStreetMap geography. Political boundaries and country/state labels are removed from the before-Partition basemap. This is not a historical road map.'}
try:
    with tempfile.TemporaryDirectory(prefix='pritam-map-export-',ignore_cleanup_errors=True) as profile:
        browser = subprocess.Popen(['google-chrome','--headless','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0',f'--user-data-dir={profile}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        try:
            portfile = Path(profile)/'DevToolsActivePort'
            for _ in range(150):
                if portfile.exists():break
                time.sleep(.05)
            port=portfile.read_text().splitlines()[0]
            pages=json.load(urlopen(f'http://127.0.0.1:{port}/json/list'))
            cdp=DevTools(next(page['webSocketDebuggerUrl'] for page in pages if page['type']=='page'))
            cdp.command('Emulation.setDeviceMetricsOverride',{'width':WIDTH,'height':HEIGHT,'deviceScaleFactor':2,'mobile':False})
            for era in ['before','after']:
                cdp.command('Page.navigate',{'url':f'http://127.0.0.1:{server.server_port}/render.html?era={era}'})
                ready=False
                for _ in range(400):
                    if cdp.evaluate('window.renderReady === true'):
                        ready=True;break
                    time.sleep(.1)
                count=cdp.evaluate('window.featureCount')
                errors=cdp.evaluate('window.renderErrors')
                if not ready or not count or count < 50:raise RuntimeError(f'Map failed: ready={ready}, features={count}, errors={errors}')
                if errors:raise RuntimeError(f'Basemap errors: {errors}')
                output=ROOT/'dist'/'images'/'maps'/f'{POET}-{era}.png'
                output.parent.mkdir(parents=True,exist_ok=True)
                shot=cdp.command('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
                output.write_bytes(base64.b64decode(shot['data']))
                metadata[era]={'src':f'images/maps/{POET}-{era}.png','bounds':cdp.evaluate('window.mapBounds'),'featureCount':count,'placeNames':cdp.evaluate('window.placeNames')}
                print(era,output.stat().st_size,'bytes,',count,'map features, bounds',metadata[era]['bounds'],flush=True)
                cdp.evaluate('window.map.remove()')
            cdp.command('Browser.close');cdp.sock.close();browser.wait(timeout=10)
        finally:
            if browser.poll() is None:browser.terminate();browser.wait(timeout=10)
    output=ROOT/'dist'/f'{POET}-basemaps.json'
    output.write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
    print('Downloaded',bytes_received,'bytes across',len(cache),'resources',flush=True)
finally:server.shutdown();server.server_close()
