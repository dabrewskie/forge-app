# Forge

A small offline workout and body-composition log (installable web app).

- Data stays in this browser's local storage on your device. No account, no server, no tracking.
- Export a JSON backup from **More → Backup** regularly; import it on a new device.
- iPhone: open the site in Safari → Share → **Add to Home Screen**, then open it from the home screen.

Static files only (HTML/CSS/JS + service worker). Host anywhere that serves static files.

Deploy: GitHub Pages via `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions). Icons are stored as base64 and decoded at deploy time.

Food tab (v3): barcode scan (vendored [html5-qrcode](https://github.com/mebjas/html5-qrcode) 2.3.8, Apache-2.0, in `vendor/`), lookups from the public Open Food Facts API, manual/quick add, and a `FORGE-FOOD: name | 650 kcal | 55P 20F 60C` paste format. Food logs stay on the device like everything else.
