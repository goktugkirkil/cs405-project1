// Part C — cameras.
// The main camera orbits `target` on a sphere (yaw/pitch/radius, driven by the mouse).
// The inspection camera is fixed and looks at the scene from the side, so the main
// camera's frustum can be drawn as lines.

import * as M from '../math/mat4.js';

const TODO = name => { throw new Error(`TODO: camera.${name}`); };
const rad = d => d * Math.PI / 180;

export const camera = {
  target: [0, -0.15, 0.3],
  radius: 4.2,
  yaw: 0, pitch: 6,                 // degrees
  fov: 50, near: 0.5, far: 8,       // fov in degrees
  projection: 'perspective',        // 'perspective' | 'orthographic'
};
export const CAMERA_DEFAULTS = structuredClone(camera);

export const inspectCam = { eye: [10.5, 5.5, 7.5], target: [0, -0.3, 0.2], fov: 48, near: 0.1, far: 60 };

// ── YOU WRITE THESE TWO ────────────────────────────────────────────────

/**
 * Point on a sphere of `radius` around `target`.
 * yaw = 0, pitch = 0 puts the eye straight in front of the painting, on +z.
 * yaw turns around the y axis (yaw = +90° → on +x); pitch lifts towards +y.
 * Angles in radians. Returns [x, y, z].
 */
export function orbitEye(target, radius, yaw, pitch) {
  return [
    target[0] + radius * Math.cos(pitch) * Math.sin(yaw),
    target[1] + radius * Math.sin(pitch),
    target[2] + radius * Math.cos(yaw) * Math.cos(pitch),
  ];
}
/**
 * The 8 corners of a view frustum IN CAMERA SPACE (camera at origin, looking down −z).
 * Order: near plane bottom-left, bottom-right, top-right, top-left,
 *        then the far plane in the same order.
 * p = { perspective: true,  fovY, aspect, near, far }        fovY in radians
 * p = { perspective: false, halfHeight, aspect, near, far }  orthographic box
 */
export function frustumCorners(p) {
  const out = [];
  for (const d of [p.near, p.far]) {
    const h = p.perspective ? d * Math.tan(p.fovY / 2) : p.halfHeight;
    const w = h * p.aspect;
    out.push([-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d]);
  }
  return out;
}


// ────────────────────────────────────────────────────────────────────────

/** Half the height of the orthographic box: chosen so ortho frames the target like perspective does. */
export function orthoHalfHeight(cam) { return cam.radius * Math.tan(rad(cam.fov) / 2); }

/** Eye, view, projection and their product for the main camera. */
export function mainCameraMatrices(cam, aspect) {
  let eye;
  try { eye = orbitEye(cam.target, cam.radius, rad(cam.yaw), rad(cam.pitch)); }
  catch { eye = [cam.target[0], cam.target[1], cam.target[2] + cam.radius]; }   // until orbitEye is written
  const V = M.lookAt(eye, cam.target, [0, 1, 0]);
  let P;
  if (cam.projection === 'perspective') {
    P = M.perspective(rad(cam.fov), aspect, cam.near, cam.far);
  } else {
    const h = orthoHalfHeight(cam);
    P = M.orthographic(-h * aspect, h * aspect, -h, h, cam.near, cam.far);
  }
  return { eye, V, P, VP: M.multiply(P, V) };
}

export function inspectCameraMatrices(aspect) {
  const V = M.lookAt(inspectCam.eye, inspectCam.target, [0, 1, 0]);
  const P = M.perspective(rad(inspectCam.fov), aspect, inspectCam.near, inspectCam.far);
  return { eye: inspectCam.eye, V, P, VP: M.multiply(P, V) };
}

/** World-space line segments of the main camera's frustum (for drawing from the inspection camera). */
export function frustumLines(cam, V, aspect) {
  const corners = frustumCorners(cam.projection === 'perspective'
    ? { perspective: true, fovY: rad(cam.fov), aspect, near: cam.near, far: cam.far }
    : { perspective: false, halfHeight: orthoHalfHeight(cam), aspect, near: cam.near, far: cam.far });
  const camToWorld = M.invertRigid(V);
  const w = corners.map(c => M.transformPoint(camToWorld, c));
  const eye = M.transformPoint(camToWorld, [0, 0, 0]);
  const seg = [];
  for (let i = 0; i < 4; i++) {
    seg.push([w[i], w[(i + 1) % 4]]);           // near rectangle
    seg.push([w[4 + i], w[4 + (i + 1) % 4]]);   // far rectangle
    seg.push([w[i], w[4 + i]]);                 // side edges
    if (cam.projection === 'perspective') seg.push([eye, w[i]]);
  }
  return seg;
}
