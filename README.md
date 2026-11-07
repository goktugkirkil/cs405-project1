# CS405 Project 1 — Moda İskelesi

Painting: **Hoca Ali Rıza — Moda İskelesi** (Sakıp Sabancı Museum).

## Run

```bash
npm install
npm run dev      # open the printed http://localhost:5173 in Chrome / Edge / Safari 18+
npm test         # maths unit tests in the terminal
```

## Code layout

| Folder | What it holds |
|---|---|
| `src/math/` | `vec3.js`, `mat4.js` (own matrix library, column-major), unit tests |
| `src/gpu/` | WebGPU device, pipelines, WGSL shaders |
| `src/scene/` | vertex data for the shapes |
| `src/main.js` | app wiring, render loop, HUD |

## Controls

_(filled in as parts A–E are added)_
