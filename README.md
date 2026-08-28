# infosint

A focused dark image-location OSINT dashboard for authorized image research.

## Current module

Only **Image Location** is enabled in this fresh build.

### What it does

- Upload JPEG, PNG, WebP, HEIC, or HEIF images up to 15 MB
- Extract EXIF metadata with `exifr`
- Detect embedded GPS latitude/longitude when present
- Automatically center a Leaflet minimap on detected coordinates
- Black/dark map presentation
- Map / Satellite layer switch
- Coordinate search with a **Go** button
- Manual coordinate validation and map centering
- Camera, lens, capture date, modification date, orientation, and software fields when available
- Links to public visual-search services for images without GPS
- Images are processed in memory and are not written to disk by the application

### Important limitation

There is no universal free API that can reliably upload an arbitrary image and search the entire internet for every matching image and exact location. If an image has no GPS EXIF, this build provides links to public visual-search services rather than pretending that a global reverse-image search occurred.

## Deploy on Render

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Environment: `NODE_ENV=production`
- No API keys are required for the core EXIF + map module.

The server listens on Render's `PORT` and binds to `0.0.0.0`.

## Structure

```text
infosint/
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── package.json
├── server.js
└── README.md
```

## API

`GET /api/health` — service health check.

`POST /api/image-geolocate` — multipart form upload using the field name `image`. Returns parsed EXIF fields and GPS coordinates when available.

## Map services

Leaflet is used for the map interface. OpenStreetMap provides the standard map tiles and Esri World Imagery provides the satellite layer.

Use the application for images you own or are authorized to analyze, and respect the terms of the external visual-search and map providers.
