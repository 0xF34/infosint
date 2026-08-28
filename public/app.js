const $ = s => document.querySelector(s);
const results = $('#results');
const sidebar = $('#sidebar');
let selectedFile = null;
let map, marker, streetLayer, satelliteLayer;

$('#hamb').onclick = () => sidebar.classList.toggle('open');
$('#imageTab').onclick = () => sidebar.classList.remove('open');

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmt(v) { return v ? esc(v) : '<span class="muted">Not available</span>'; }

function initMap() {
  map = L.map('map', { zoomControl: true, worldCopyJump: true }).setView([20, 0], 2);
  streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 });
  satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri', maxZoom: 19 });
  streetLayer.addTo(map);
}
initMap();

function setLocation(lat, lon, label = 'Detected location') {
  map.setView([lat, lon], 15, { animate: true });
  if (marker) marker.remove();
  marker = L.marker([lat, lon]).addTo(map).bindPopup(`<b>${esc(label)}</b><br>${lat.toFixed(6)}, ${lon.toFixed(6)}`).openPopup();
  $('#mapStatus').textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

$('#street').onclick = () => { if (!map.hasLayer(streetLayer)) { map.addLayer(streetLayer); map.removeLayer(satelliteLayer); } $('#street').classList.add('active'); $('#satellite').classList.remove('active'); };
$('#satellite').onclick = () => { if (!map.hasLayer(satelliteLayer)) { map.addLayer(satelliteLayer); map.removeLayer(streetLayer); } $('#satellite').classList.add('active'); $('#street').classList.remove('active'); };
$('#go').onclick = goCoords;
$('#coords').onkeydown = e => { if (e.key === 'Enter') goCoords(); };
function goCoords() {
  const raw = $('#coords').value.trim();
  const m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return alert('Enter coordinates as latitude, longitude.');
  const lat = Number(m[1]), lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return alert('Coordinates are out of range.');
  setLocation(lat, lon, 'Manual coordinate');
}

const drop = $('#drop');
$('#image').onchange = e => selectFile(e.target.files[0]);
drop.ondragover = e => { e.preventDefault(); drop.classList.add('drag'); };
drop.ondragleave = () => drop.classList.remove('drag');
drop.ondrop = e => { e.preventDefault(); drop.classList.remove('drag'); selectFile(e.dataTransfer.files[0]); };
function selectFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return alert('Please select an image.');
  if (file.size > 15 * 1024 * 1024) return alert('Image must be 15 MB or smaller.');
  selectedFile = file;
  $('#fileName').textContent = `${file.name} · ${(file.size / 1048576).toFixed(2)} MB`;
  $('#analyze').disabled = false;
}

$('#analyze').onclick = async () => {
  if (!selectedFile) return;
  const button = $('#analyze'); button.disabled = true; button.textContent = 'Analyzing...';
  results.innerHTML = '<div class="loading"><span></span><span></span><span></span><p>Reading image metadata locally through the server...</p></div>';
  const form = new FormData(); form.append('image', selectedFile);
  try {
    const r = await fetch('/api/image-geolocate', { method: 'POST', body: form });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Analysis failed');
    render(d);
    if (d.gps) setLocation(d.gps.latitude, d.gps.longitude, 'EXIF GPS');
  } catch (e) { results.innerHTML = `<div class="empty error"><h2>Analysis failed</h2><p>${esc(e.message)}</p></div>`; }
  finally { button.disabled = false; button.textContent = 'Analyze Image'; }
};

function render(d) {
  const meta = d.metadata || {};
  const gps = d.gps ? `<div class="gps"><b>GPS coordinates detected</b><span>${d.gps.latitude.toFixed(6)}, ${d.gps.longitude.toFixed(6)}</span><button onclick="navigator.clipboard.writeText('${d.gps.latitude}, ${d.gps.longitude}')">Copy coordinates</button></div>` : '<div class="no-gps">No GPS coordinates are embedded in this image.</div>';
  results.innerHTML = `<div class="result-grid"><article class="card"><div class="card-head"><h3>LOCATION SIGNAL</h3><span class="badge ${d.gps ? 'found' : ''}">${d.gps ? 'GPS FOUND' : 'NO GPS'}</span></div>${gps}<dl><dt>File</dt><dd>${esc(d.filename)}</dd><dt>Type</dt><dd>${esc(d.type)}</dd><dt>Size</dt><dd>${(d.size / 1048576).toFixed(2)} MB</dd></dl></article><article class="card"><div class="card-head"><h3>EXIF METADATA</h3></div><dl><dt>Camera</dt><dd>${fmt(meta.make)} ${fmt(meta.model)}</dd><dt>Lens</dt><dd>${fmt(meta.lens)}</dd><dt>Captured</dt><dd>${fmt(meta.captured)}</dd><dt>Modified</dt><dd>${fmt(meta.modified)}</dd><dt>Software</dt><dd>${fmt(meta.software)}</dd><dt>Orientation</dt><dd>${fmt(meta.orientation)}</dd></dl></article></div><article class="card"><div class="card-head"><h3>PUBLIC VISUAL SEARCH</h3></div><p class="note">${esc(d.note)}</p><div class="source-grid"><a href="https://lens.google.com/" target="_blank" rel="noopener">Google Lens</a><a href="https://www.bing.com/visualsearch" target="_blank" rel="noopener">Bing Visual Search</a><a href="https://tineye.com/" target="_blank" rel="noopener">TinEye</a></div></article>`;
}
