# CS405 Project 1 — Moda İskelesi

One WebGPU application that turns **Hoca Ali Rıza — _Moda İskelesi_** (Sakıp Sabancı Museum)
into a small 3D scene: the painting hangs as a textured quad, objects stand in front of it,
a harbour crane slews on its own scene graph, the camera orbits, and curves trace the
leaning plane tree and the hill across the water.

No graphics or maths libraries: every matrix, camera and curve function is in `src/math`
and `src/scene`, written for this project.

## Run

```bash
npm install
npm run dev      # open the printed http://localhost:5173 in Chrome / Edge / Safari 18+
npm test         # unit tests for the maths in the terminal (also shown bottom-left in the app)
```

## Controls

**Mouse**

| Action | Effect |
|---|---|
| drag on empty canvas | orbit the main camera around its target |
| mouse wheel | zoom (orbit radius) |
| drag a curve control point | move it in the plane of the painting (Bézier keeps C¹ at the joints) |
| shift + click on the painting | add a Bézier segment / a Catmull–Rom point at that spot |

**Panel (top right)**

| Section | Control | Effect |
|---|---|---|
| View & camera | view | main camera ↔ fixed inspection camera |
| | projection | perspective ↔ orthographic |
| | fov / near / far | main camera parameters (eye, target, fov, near, far are shown below) |
| Debug | axes | draw the local axes of every scene-graph node (and of the Part A object) |
| | frustum | draw the main camera's frustum (visible in the inspection view) |
| | curves | show / hide all Part D drawings |
| | animate | pause / resume all animation |
| A · Transformations | order | M = T·R·S or M = S·R·T; both matrices are displayed numerically |
| | tx ty tz, axis, angle, scale | the UI-controlled object (orange pyramid) |
| B · Scene graph | — | tree of the crane and the world matrix of the leaf node `cargo` |
| D · Curves | edit | which curve the mouse edits |
| | t, segment | de Casteljau construction of one Bézier segment at parameter t |
| | polygon / casteljau / catmull / follower | toggle control polygon, construction, Catmull–Rom, the object moving along the curve |
| | export JSON | download `curve.json` (control points in normalised image coordinates) |
| | reset curves | restore the traced shapes |
| Scene | reset scene | restore every setting above |

Top-left: frame time (smoothed), vertices submitted per frame, draw calls.

## Code layout

| Path | Contents |
|---|---|
| `src/math/vec3.js` | 3-vectors |
| `src/math/mat4.js` | 4×4 matrices (column-major): identity, multiply, translate, rotate x/y/z, scale, transpose, rigid inverse, transformPoint, lookAt, perspective, orthographic |
| `src/math/curves.js` | Bernstein basis, cubic Bézier and tangent, de Casteljau, C¹ rule, Catmull–Rom |
| `src/math/tests.js` | unit tests (`npm test`) |
| `src/scene/` | painting mapping, composition order (A), scene graph + crane (B), cameras + frustum (C), curves + picking (D), vertex data |
| `src/gpu/` | WebGPU device, pipelines, WGSL shaders |
| `src/ui/panel.js` | control panel |
| `src/main.js` | wiring and the render loop |

## Conventions

Column vectors (`p' = M·p`), matrices stored column-major exactly as WGSL `mat4x4f` expects.
Right-handed world; the camera looks down −z; clip-space depth is WebGPU's [0, 1].
Curve control points are stored in normalised image coordinates
(u = x/width from the left, v = y/height from the top).
