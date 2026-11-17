'use strict';
// Georeferenced OpenStreetMap basemaps with a Web Mercator journey overlay.
window.createPoetJourneyMap = async function createPoetJourneyMap(journey, parent) {
  const host = document.createElement('section');
  host.className = 'journey-map';
  host.setAttribute('aria-label', `${journey.poetName}’s life and places`);
  const make = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  host.append(make('p', journey.eyebrow, 'journey-eyebrow'), make('h3', journey.title, 'journey-title'));
  parent.append(host);
  try {
    const response = await fetch(journey.basemapFile);
    if (!response.ok) throw new Error('Map data unavailable');
    const geo = await response.json();
    if (!host.isConnected) return;
    const [west, south, east, north] = geo.after.bounds;
    const mercator = latitude => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
    const top = mercator(north), bottom = mercator(south);
    const project = ([lon, lat]) => [(lon - west) / (east - west) * 900, (top - mercator(lat)) / (top - bottom) * 650];
    // Decode both local map images before enabling the route controls.
    await Promise.all(['before', 'after'].map(era => new Promise((resolve, reject) => {
      const image = new Image();image.onload = resolve;image.onerror = reject;image.src = geo[era].src;
    })));
    if (!host.isConnected) return;
    const imageBox = era => {
      const [w,s,e,n] = geo[era].bounds;
      const a = project([w,n]), b = project([e,s]);
      return {x:a[0],y:a[1],w:b[0]-a[0],h:b[1]-a[1]};
    };
    const ns = 'http://www.w3.org/2000/svg';
    const svgEl = (tag, attrs = {}, text) => {
      const e = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([key, value]) => e.setAttribute(key, value));
      if (text) e.textContent = text;
      return e;
    };
    const distance = (a, b) => {
      const rad = x => x * Math.PI / 180;
      const v = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
      return 3958.8 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
    };
    const controls = make('div', null, 'journey-modes');
    const before = make('button', journey.views[0].label, 'journey-before');
    const after = make('button', journey.views[1].label, 'journey-after');
    const modes = [before, after];
    modes.forEach(b => {b.type = 'button'; controls.append(b);});
    host.append(controls);
    const caption = make('p', null, 'journey-caption');
    host.append(caption);
    const toolbar = make('div', null, 'journey-toolbar');
    toolbar.setAttribute('aria-label', 'Map controls');
    const zoomIn = make('button', '+', 'map-zoom-in');
    const zoomOut = make('button', '−', 'map-zoom-out');
    const reset = make('button', 'Reset view', 'map-reset');
    zoomIn.setAttribute('aria-label', 'Zoom in');
    zoomOut.setAttribute('aria-label', 'Zoom out');
    [zoomIn, zoomOut, reset].forEach(b => {b.type = 'button'; toolbar.append(b);});
    const mileLabel = make('label', null, 'map-mile-toggle');
    const mileToggle = make('input'); mileToggle.type = 'checkbox'; mileToggle.checked = true;
    mileLabel.append(mileToggle, document.createTextNode('Mile markers'));
    toolbar.append(mileLabel); host.append(toolbar);
    const frame = make('div', null, 'journey-frame');
    frame.tabIndex = 0;
    frame.setAttribute('role', 'region');
    frame.setAttribute('aria-label', 'Journey map. Use arrow keys to pan and plus or minus to zoom.');
    const svg = svgEl('svg', {viewBox: '0 0 900 650', 'aria-label': `Places in ${journey.poetName}’s life`, role: 'group'});
    frame.append(svg);host.append(frame);
    const attribution = make('p', null, 'map-attribution');
    geo.attribution.forEach((credit, i) => {
      if (i) attribution.append(document.createTextNode(' · '));
      const a = make('a', credit.title);a.href = credit.url;a.target='_blank';a.rel='noopener noreferrer';attribution.append(a);
    });
    host.append(attribution);
    host.append(make('p', 'Before August 1947, all places shown here were in British India. Each place below identifies its present-day location. Political borders are hidden in the early-life view.', 'map-geography-note'));
    host.append(make('p', 'Select a place or mile marker. Drag to pan, or focus the map and use arrow keys and + / −. Journey lines connect documented cities, not a known road or train route.', 'map-help'));
    const itinerary = make('div', null, 'journey-stops'); host.append(itinerary);
    const placeDetail = make('div', null, 'journey-place-detail'); placeDetail.setAttribute('aria-live', 'polite');host.append(placeDetail);
    const summary = make('p', null, 'journey-distance');host.append(summary);
    const notes = make('details', null, 'journey-notes');
    notes.append(make('summary', 'About the route, miles & border'), make('p', journey.distanceNote), make('p', journey.borderNote));
    const credits = make('ul');
    journey.sources.forEach(s => {
      const li = make('li'); const a = make('a', s.title); a.href = s.url;a.target = '_blank';a.rel = 'noopener noreferrer';li.append(a);credits.append(li);
    });
    notes.append(credits);host.append(notes);
    let era = 'before', selectedId = journey.stops[0].id, box, activeStops = [], miles = [], total = 0;
    const initialBox = () => imageBox(era);
    const updateBox = () => {
      const bounds = initialBox();
      box.x = Math.max(bounds.x, Math.min(bounds.x + bounds.w - box.w, box.x));
      box.y = Math.max(bounds.y, Math.min(bounds.y + bounds.h - box.h, box.y));
      svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
      const viewport = svg.getBoundingClientRect();
      const unit = Math.max(box.w / (viewport.width || 900), box.h / (viewport.height || 650));
      svg.querySelectorAll('.map-city').forEach(node => {
        const stop = activeStops.find(s => s.id === node.dataset.stop);
        const [x,y] = project(stop.coordinates);
        const circles = node.querySelectorAll('circle');
        circles[0].style.r = `${22*unit}px`;
        circles[1].style.r = `${6*unit}px`;
        circles[1].style.strokeWidth = `${2*unit}px`;
        const label = node.querySelector('text');
        label.style.fontSize = `${14*unit}px`;label.style.strokeWidth = `${4*unit}px`;
        label.setAttribute('x', x + (['dehradun','lahore'].includes(stop.id) ? -12 : 12)*unit);
        label.setAttribute('y', y - 12*unit);
      });
      svg.querySelectorAll('.map-mile-marker').forEach(node => {
        const circle = node.querySelector('circle');
        circle.style.r = `${3*unit}px`;circle.style.strokeWidth = `${1.5*unit}px`;
        const label = node.querySelector('text');
        label.style.fontSize = `${10*unit}px`;label.style.strokeWidth = `${3*unit}px`;
        label.setAttribute('x', Number(circle.getAttribute('cx')) + 7*unit);
        label.setAttribute('y', Number(circle.getAttribute('cy')) + 16*unit);
      });
      svg.querySelectorAll('.map-scale-label').forEach(label => {
        label.style.fontSize = `${10*unit}px`;label.style.strokeWidth = `${3*unit}px`;
      });
    };
    const zoom = factor => {
      const bounds = initialBox();
      const width = Math.max(bounds.w / 4, Math.min(bounds.w, box.w * factor));
      const height = width * bounds.h / bounds.w;
      box = {x:box.x + (box.w - width) / 2, y:box.y + (box.h - height) / 2, w:width, h:height};updateBox();
    };
    const select = id => {
      selectedId = id;
      const stop = activeStops.find(s => s.id === id);
      if (!stop) return;
      placeDetail.replaceChildren(make('p', stop.date, 'journey-stop-date'), make('h4', stop.name), make('p', `Before Partition · ${stop.historicalLocation}`, 'journey-location'), make('p', `Present day · ${stop.presentDayLocation}`, 'journey-location'), make('p', stop.description));
      const sources = make('p', null, 'journey-stop-sources');
      (stop.sourceIds || []).forEach((id, index) => {
        const source = journey.sources.find(s => s.id === id);
        if (!source) return;
        if (index) sources.append(document.createTextNode(' · '));
        const link = make('a', source.title);link.href = source.url;link.target = '_blank';link.rel = 'noopener noreferrer';sources.append(link);
      });
      if (stop.locationSource) {
        if (sources.childNodes.length) sources.append(document.createTextNode(' · '));
        const link = make('a', stop.locationSource.title);link.href = stop.locationSource.url;link.target = '_blank';link.rel = 'noopener noreferrer';sources.append(link);
      }
      placeDetail.append(sources);
      host.querySelectorAll('[data-stop]').forEach(e => e.setAttribute('aria-pressed', String(e.dataset.stop === id)));
    };
    const activateSvg = (node, action) => {
      node.setAttribute('tabindex', '0');node.setAttribute('role', 'button');
      node.addEventListener('click', action);
      node.addEventListener('keydown', e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();action();}});
    };
    function render() {
      host.dataset.era = era;
      svg.replaceChildren();itinerary.replaceChildren();
      modes.forEach((b, i) => b.setAttribute('aria-pressed', String((i === 0) === (era === 'before'))));
      const view = journey.views.find(v => v.id === era);
      caption.textContent = view.caption;
      activeStops = view.stopIds.map(id => journey.stops.find(s => s.id === id));
      mileToggle.disabled = !view.showRoute;
      mileLabel.hidden = !view.showRoute;
      total = 0;miles = [0];
      activeStops.slice(1).forEach((s,i) => {total += distance(activeStops[i].coordinates,s.coordinates);miles.push(total);});
      const rect = imageBox(era);
      svg.append(svgEl('image', {
        href:geo[era].src, x:rect.x,y:rect.y,width:rect.w,height:rect.h,
        preserveAspectRatio:'none', 'class':`map-basemap${era === 'after' ? ' map-border' : ''}`,
        'aria-label':era === 'before' ? 'Geographic basemap without political boundaries' : 'Geographic basemap with modern boundaries for context'
      }));
      const points = activeStops.map(s => project(s.coordinates));
      if (view.showRoute) svg.append(svgEl('polyline',{points:points.map(p => p.join(',')).join(' '),fill:'none',stroke:'#193c32','stroke-width':3,'vector-effect':'non-scaling-stroke','class':'map-route'}));
      if (mileToggle.checked && view.showRoute) {
        for (let mile = view.mileInterval; mile < total; mile += view.mileInterval) {
          const leg = miles.findIndex((m,i) => i > 0 && m >= mile) - 1;
          const ratio = (mile - miles[leg]) / (miles[leg+1] - miles[leg]);
          const a = activeStops[leg].coordinates, b = activeStops[leg+1].coordinates;
          const pt = project([a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio]);
          const marker = svgEl('g',{'class':`map-mile-marker${mile % 100 ? ' map-half-century' : ''}`,'aria-label':`${mile} approximate straight-line miles from ${activeStops[0].name}`});
          marker.append(svgEl('circle',{cx:pt[0],cy:pt[1],r:5,fill:'#f7f1e4',stroke:'#934631','stroke-width':2}),svgEl('text',{x:pt[0]+9,y:pt[1]+16,'class':'map-mile-label'},`${mile} mi`));
          activateSvg(marker, () => placeDetail.replaceChildren(make('h4', `About ${mile} miles`),make('p', `Measured from ${activeStops[0].name} along the illustrated city-to-city connections. This is a distance marker, not a documented stop.`, 'mile-detail')));
          svg.append(marker);
        }
      }
      activeStops.forEach((stop,i) => {
        const [x,y] = points[i];
        const node = svgEl('g',{'class':'map-city','data-stop':stop.id,'aria-label':view.showRoute ? `${stop.name}, ${stop.date}, about ${Math.round(miles[i])} miles from ${activeStops[0].name}` : `${stop.name}, ${stop.date}`});
        node.append(svgEl('circle',{cx:x,cy:y,r:15,fill:'transparent'}),svgEl('circle',{cx:x,cy:y,r:7,'class':'map-city-dot'}),svgEl('text',{x:stop.id === 'dehradun' ? x-17 : x+17,y:stop.id === 'dehradun' ? y+40 : y-12,'text-anchor':['dehradun','lahore'].includes(stop.id) ? 'end' : 'start','class':'map-city-label'},stop.name));
        activateSvg(node, () => select(stop.id));svg.append(node);
        const button = make('button', view.showRoute ? `${stop.name} · ${Math.round(miles[i])} mi` : stop.name);
        button.append(make('span', `Present day · ${stop.presentDayLocation}`, 'journey-stop-location'));
        button.type = 'button';button.dataset.stop = stop.id;
        button.addEventListener('click', () => select(stop.id));itinerary.append(button);
      });
      // Scale is measured at the middle latitude, separate from the route milestones.
      const bounds = geo[era].bounds;
      const lon = bounds[0] + (bounds[2]-bounds[0])*.05, lat = bounds[1] + (bounds[3]-bounds[1])*.06;
      const a = [lon,lat], b = [lon+(bounds[2]-bounds[0])*.13,lat], pa = project(a), pb = project(b);
      svg.append(svgEl('line',{x1:pa[0],y1:pa[1],x2:pb[0],y2:pb[1],stroke:'#193c32','stroke-width':2}),svgEl('text',{x:pa[0],y:pa[1]-10,'class':'map-mile-label map-scale-label'},`≈ ${Math.round(distance(a,b))} miles`));
      summary.textContent = view.showRoute ? `About ${Math.round(total)} miles along the displayed connections · straight-line estimate` : 'One documented location · no journey distance inferred';
      if (!activeStops.some(s => s.id === selectedId)) selectedId = activeStops[0].id;
      select(selectedId);
    }
    function setEra(next) {era = next;box = initialBox();render();updateBox();}
    before.addEventListener('click', () => setEra('before'));
    after.addEventListener('click', () => setEra('after'));
    zoomIn.addEventListener('click', () => zoom(.8));zoomOut.addEventListener('click', () => zoom(1.25));
    reset.addEventListener('click', () => {box = initialBox();updateBox();});
    mileToggle.addEventListener('change', () => {render();updateBox();});
    frame.addEventListener('keydown', e => {
      if (e.target !== frame) return;
      if (e.key === '+' || e.key === '=') {e.preventDefault();zoom(.8);return;}
      if (e.key === '-') {e.preventDefault();zoom(1.25);return;}
      const shifts = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if (shifts[e.key]) {e.preventDefault();box.x += shifts[e.key][0]*box.w*.12;box.y += shifts[e.key][1]*box.h*.12;updateBox();}
    });
    let drag = null;
    frame.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('[role="button"]')) return;
      drag = {x:e.clientX,y:e.clientY,box:{...box}};frame.setPointerCapture(e.pointerId);
    });
    frame.addEventListener('pointermove', e => {
      if (!drag) return;
      const rect = svg.getBoundingClientRect();
      box.x = drag.box.x - (e.clientX-drag.x)/rect.width*drag.box.w;
      box.y = drag.box.y - (e.clientY-drag.y)/rect.height*drag.box.h;updateBox();
    });
    frame.addEventListener('pointerup', () => {drag=null;});frame.addEventListener('pointercancel', () => {drag=null;});
    setEra('before');
    const observer = new ResizeObserver(() => {if (!host.isConnected) observer.disconnect(); else updateBox();});
    observer.observe(svg);
  } catch (error) {
    host.append(make('p', 'The map could not load. The documented places are listed below.'));
    journey.stops.forEach(s => host.append(make('h4', `${s.name} · ${s.date}`),make('p', `Before Partition · ${s.historicalLocation}. Present day · ${s.presentDayLocation}.`),make('p',s.description)));
  }
};
