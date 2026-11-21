# Forge

A small offline workout and body-composition log (installable web app).

- Data stays in this browser's local storage on your device. No account, no server, no tracking.
- Export a JSON backup from **More → Backup** regularly; import it on a new device.
- iPhone: open the site in Safari → Share → **Add to Home Screen**, then open it from the home screen.

Static files only (HTML/CSS/JS + service worker). Host anywhere that serves static files.

Deploy: GitHub Pages via `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions). Icons are stored as base64 and decoded at deploy time.
