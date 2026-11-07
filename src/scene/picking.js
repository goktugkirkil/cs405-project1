// Mouse → painting plane. Used to place and drag curve control points.
//
// A pixel defines a ray from the main camera. In camera space:
//   perspective:  origin (0,0,0),               direction (x·tanθ·aspect, y·tanθ, −1)
//   orthographic: origin (x·h·aspect, y·h, 0),  direction (0, 0, −1)
// with (x, y) the pixel in NDC and θ = fov/2. invertRigid(V) takes it to world space,
// where it is intersected with the plane z = CURVE_Z.

import * as M from '../math/mat4.js';
import { orthoHalfHeight } from './camera.js';
import { CURVE_Z, worldToUv, uvToWorld } from './painting.js';

const rad = d => d * Math.PI / 180;

/** NDC of a pointer event over the canvas. */
export function eventNDC(e, canvas) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2];
}

/** uv on the painting plane under NDC point (x, y), or null if the ray misses it. */
export function pickUv(cam, V, aspect, [x, y]) {
  let oCam, dCam;
  if (cam.projection === 'perspective') {
    const t = Math.tan(rad(cam.fov) / 2);
    oCam = [0, 0, 0]; dCam = [x * t * aspect, y * t, -1];
  } else {
    const h = orthoHalfHeight(cam);
    oCam = [x * h * aspect, y * h, 0]; dCam = [0, 0, -1];
  }
  const toWorld = M.invertRigid(V);
  const o = M.transformPoint(toWorld, oCam);
  const e = M.transformPoint(toWorld, [oCam[0] + dCam[0], oCam[1] + dCam[1], oCam[2] + dCam[2]]);
  const d = [e[0] - o[0], e[1] - o[1], e[2] - o[2]];
  if (Math.abs(d[2]) < 1e-6) return null;
  const s = (CURVE_Z - o[2]) / d[2];
  if (s <= 0) return null;
  return worldToUv([o[0] + s * d[0], o[1] + s * d[1]]);
}

/** Index of the control point nearest to the pointer, within `px` screen pixels; −1 if none. */
export function pickPoint(points, VP, ndc, canvas, px = 14) {
  const r = canvas.getBoundingClientRect();
  let best = -1, bestD = px;
  points.forEach((uv, i) => {
    const p = M.transformPoint(VP, uvToWorld(uv));
    const dx = (p[0] - ndc[0]) * r.width / 2, dy = (p[1] - ndc[1]) * r.height / 2;
    const dist = Math.hypot(dx, dy);
    if (dist < bestD) { bestD = dist; best = i; }
  });
  return best;
}
