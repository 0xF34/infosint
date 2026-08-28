const express = require('express');
const path = require('path');
const multer = require('multer');
const exifr = require('exifr');

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'infosint-image-location' }));

app.post('/api/image-geolocate', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload an image.' });
  if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Only image files are supported.' });
  try {
    const exif = await exifr.parse(req.file.buffer, { gps: true }) || {};
    const lat = Number(exif.latitude ?? exif.GPSLatitude);
    const lon = Number(exif.longitude ?? exif.GPSLongitude);
    const hasGps = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    res.json({
      filename: req.file.originalname, type: req.file.mimetype, size: req.file.size,
      gps: hasGps ? { latitude: lat, longitude: lon } : null,
      metadata: { make: exif.Make || null, model: exif.Model || null, lens: exif.LensModel || null, captured: exif.DateTimeOriginal || exif.CreateDate || null, modified: exif.ModifyDate || null, orientation: exif.Orientation || null, software: exif.Software || null },
      sources: { reverseImageSearch: ['Google Lens', 'Bing Visual Search', 'TinEye'], map: 'OpenStreetMap / Leaflet' },
      note: hasGps ? 'GPS coordinates were found in the image metadata.' : 'No GPS coordinates were found. Reverse-image search needs a visual-search provider; there is no universal free API that reliably searches the entire web.'
    });
  } catch (error) {
    console.error(error);
    res.status(422).json({ error: 'The image could not be parsed. Try a JPEG, PNG, HEIC, or WebP image.' });
  }
});

app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html')) return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  next();
});
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.listen(PORT, '0.0.0.0', () => console.log(`infosint listening on ${PORT}`));
