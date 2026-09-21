# Sketchpad

A modern, premium, cross-platform digital drawing & sketching app. Web-first,
touch- and stylus-friendly, offline-capable, and installable as a PWA. Built to
feel like a real drawing tool — not a website.

> **Status:** v1 — the local drawing foundation. Cloud sync (Google sign-in +
> Firestore) is architected and scaffolded behind config; see
> [Firebase setup](#firebase-setup-optional--for-v2-cloud-sync).

## Features (v1)

- ✏️ Freehand drawing with **pen, pencil, marker, and eraser**
- 🎚️ Per-brush **size & opacity**, live color picker with palette + recents
- 🖊️ **Pressure-sensitive** stylus input (Pointer Events + `perfect-freehand`);
  velocity-simulated pressure for mouse/trackpad
- 🗂️ **Layers** — add / reorder / rename / opacity / visibility / delete
- 🎯 **Selection & transform** — tap or box-select strokes, then move / scale /
  rotate / delete (undoable)
- ☁️ **Cloud sync + Google sign-in** — start on your laptop, continue on your
  tablet (optional; enabled once Firebase is configured)
- ↩️ **Undo / redo** (patch-based history)
- 🔍 **Infinite canvas**: zoom, pan, and rotate
  - Desktop: `Ctrl`/pinch to zoom, wheel/space-drag to pan
  - Tablet: two-finger pan + pinch-zoom + twist-rotate
- 💾 **Offline-first** autosave to IndexedDB; a document gallery
- 🖼️ **Export** to PNG / JPEG, and lossless project `.json`
- 📱 **PWA** — installable on Android with offline support
- 🎨 Minimal, distraction-free, adaptive UI (desktop vs. touch)

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS · Zustand + Immer · perfect-freehand
· Dexie (IndexedDB) · vite-plugin-pwa

## Architecture (short version)

Everything you draw is stored as **vector data in world coordinates**
(`src/model`). A **camera** (`src/engine/camera.ts`) maps world → screen, giving
an infinite, resolution-independent canvas. The **renderer**
(`src/engine/renderer`) is a pluggable interface — v1 ships a Canvas 2D backend
with **per-layer offscreen caches** so only the active layer + live stroke
redraw while you draw. Input is unified through a single **PointerController**
(`src/engine/input`). State lives in a **Zustand store** with a patch-based
undo/redo stack (`src/store`). Persistence is local-first via **Dexie**
(`src/persistence`), which is also the offline cache Firestore will reconcile
against in v2.

```
src/
  model/        data model (Document, Layer, Element) + factories
  store/        Zustand store + undo/redo history
  engine/
    camera.ts   world <-> screen math (pan/zoom/rotate)
    renderer/   IRenderer + Canvas2DRenderer (layer caches, export)
    brushes/    brush presets + perfect-freehand stroke geometry
    input/      PointerController (mouse/touch/pen, gestures, pressure)
  persistence/  Dexie local DB + PNG/JPEG/JSON export
  services/     firebase.ts (gated; inert until configured)
  ui/           adaptive UI: canvas, toolbar, panels, gallery
  hooks/        device detection, keyboard shortcuts, autosave
```

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview the production build (works offline)
```

## Keyboard shortcuts (desktop)

| Key | Action |
| --- | --- |
| `B` / `P` / `M` / `E` | Pen / Pencil / Marker / Eraser |
| `V` | Selection tool |
| `[` / `]` | Decrease / increase brush size |
| `Delete` / `Backspace` | Delete selection |
| `Esc` | Clear selection |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Space` + drag | Pan |
| `Ctrl` + scroll | Zoom |

## Selection & transform

Pick the **Selection** tool (arrow icon, or press `V`). Then:

- **Tap/click** a stroke to select it; **drag on empty canvas** to box-select
  many.
- **Drag inside** the selection box to move; drag a **corner** to scale; drag
  the **round handle** above the box to rotate.
- **Delete** removes the selection (or use the on-screen bar on touch devices).

All transforms are a single undoable step.

## Cloud sync & Google sign-in

Configure Firebase (below) and a **Sign in** button appears in the top bar.
After signing in with Google:

- Your whole local library is **reconciled** with the cloud (newest copy wins),
  so every device converges to the same set of sketches.
- The open document **syncs live** — edits are pushed (debounced) and a newer
  copy from another device is pulled automatically. Start on your laptop, pick
  up on your tablet.
- Firestore's **offline persistence** means edits made offline sync when you
  reconnect.

Data lives under `users/{uid}/documents/{docId}` with one element per stroke.
Lock it down with the included [`firestore.rules`](firestore.rules) (paste into
Firestore Console → Rules).

## Deploying to GitHub Pages

The included workflow (`.github/workflows/deploy.yml`) builds and deploys on push
to `main`.

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. The workflow sets `VITE_BASE=/<repo-name>/` automatically, so the app is
   served correctly from `https://<user>.github.io/<repo-name>/`.
4. It also writes `dist/404.html` so client-side routing/refresh works.

Local production build with a custom base:

```bash
VITE_BASE=/your-repo/ npm run build
```

## Firebase setup (optional — for v2 cloud sync)

The app runs **fully local with zero configuration**. Cloud features stay hidden
until you add Firebase keys. To prepare for Google sign-in + cross-device sync:

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Authentication → Sign-in method → enable Google.**
3. **Build → Firestore Database → Create database** (production mode).
4. **Build → Storage → Get started** (for image imports/exports later).
5. **Project settings → Your apps → Web app (`</>`)** → copy the config.
6. Copy `.env.example` to `.env.local` and paste the values:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
7. For the deployed site, add the same values as **GitHub repository secrets**
   (Settings → Secrets and variables → Actions); the workflow already forwards
   them to the build.
8. Under Authentication → Settings → **Authorized domains**, add your
   `github.io` domain.

`.env.local` is gitignored — keys never get committed.

## Roadmap (next)

Shapes · text · image import · precise per-stroke selection & grouping · AI
assists (shape cleanup, handwriting recognition). The data model and renderer
are already structured for these.

Done: freehand drawing, brushes, layers, undo/redo, infinite canvas,
offline-first persistence, export, PWA, **selection & transform**, and
**cloud sync + Google sign-in**.
