# Orbit — AI Voice Fraud Detection

Frontend-only React app. No backend, no API keys. All data is mocked in `src/App.jsx`.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

To build for production:

```bash
npm run build
npm run preview
```

The build output lands in `dist/` — it's a static site, so you can drop that folder on Netlify, Vercel, GitHub Pages, or any static host.

## Files

```
index.html            page shell, loads Inter from Google Fonts
vite.config.js        Vite + React plugin
tailwind.config.js    Tailwind content paths and font family
postcss.config.js     Tailwind + autoprefixer
src/main.jsx          React entry point
src/index.css         global styles, Tailwind layers, slider/scrollbar/brandmark CSS
src/App.jsx           every screen and all mock data
```

Most styling is Tailwind utility classes written inline in `App.jsx`. `index.css` holds the
things Tailwind can't express: range slider thumbs, scrollbars, the native audio player,
the quarter-circle brand mark, and the reduced-motion override.

## Screens

| Screen | How to reach it |
| --- | --- |
| Dashboard | default |
| Contacts | sidebar — searchable |
| Upload Audio | sidebar — drag/drop or pick a real audio file |
| Upload Result | appears after an upload finishes analysing |
| Reports | sidebar — click any row to open its report |
| Incoming Call | Contacts → "Call" button, or the Dashboard "Live Calls Monitored" card |
| Call in Progress | Incoming Call → Accept |

There is also a **Screens** bar at the top of every page. It jumps directly to any of the
eight screens, including Incoming Call and Call in Progress, so you don't have to walk a
flow to see them. Delete the `<ScreenSwitcher .../>` line in `App.jsx` before shipping.

## What actually works

- File upload reads real metadata from the file you pick — name, size, MIME type, duration.
- The uploaded file plays back in the result screen through a real `<audio>` element.
- "Download Report" generates and downloads a `.txt` summary.
- Search filters the Contacts and Reports tables live.
- The call screen runs a live timer, an animated waveform, and a fraud gauge that drifts
  over time. Mute, Hold, and the Network & Audio Control popover are all interactive.
- Fraud scores are randomised per analysis, so the gauge, risk band, reason text, and
  summary all change together.

## Changing the data

Edit the arrays at the top of `src/App.jsx`: `CONTACTS`, `REPORTS`, `RECENT_ACTIVITY`,
`TREND_7D`, `TREND_30D`, `THREAT_DIST`.

To swap the random scoring for a real model, replace the `score` calculation inside
`handleFile` in the `UploadAudio` component with a `fetch` to your endpoint.
