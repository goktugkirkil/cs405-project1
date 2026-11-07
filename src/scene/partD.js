// Part D scene content: curves traced over the painting.
//   • a piecewise cubic Bézier (C¹ at the joints) along the big leaning plane tree:
//     trunk → main branch
//   • a uniform Catmull–Rom spline through points on the hill silhouette across the water
// Control points are stored in normalised image coordinates (see painting.js).

import * as Cv from '../math/curves.js';
import { PAINTING } from './painting.js';

export const curves = {
  // 3 segments → 3·3 + 1 = 10 points. Joints are indices 0, 3, 6, 9.
  bezier: [
    [0.395, 0.85], [0.41, 0.75], [0.455, 0.60], [0.49, 0.50],
    [0.525, 0.40], [0.58, 0.34], [0.62, 0.29],
    [0.66, 0.24], [0.70, 0.16], [0.73, 0.11],
  ],
  // The curve is drawn between the 2nd and the 2nd-to-last point; the end points only steer it.
  catmull: [
    [0.66, 0.585], [0.70, 0.565], [0.74, 0.545], [0.78, 0.530],
    [0.82, 0.524], [0.88, 0.524], [0.94, 0.530], [0.995, 0.545],
  ],
};
export const CURVE_DEFAULTS = structuredClone(curves);

export const partD = {
  edit: 'bezier',          // which curve the mouse edits: 'bezier' | 'catmull'
  t: 0.35,                 // de Casteljau parameter
  segment: 1,              // which Bézier segment shows the de Casteljau construction
  showPolygon: true,
  showCasteljau: true,
  showCatmull: true,
  animateAlong: true,
};
export const PART_D_DEFAULTS = { ...partD };

export const segmentCount = pts => (pts.length - 1) / 3;
export const segmentPoints = (pts, i) => pts.slice(3 * i, 3 * i + 4);
export const isJoint = i => i % 3 === 0;

/** Sampled polyline of the whole piecewise Bézier. */
export function sampleBezier(pts, perSegment = 32) {
  const out = [];
  for (let s = 0; s < segmentCount(pts); s++) {
    const P = segmentPoints(pts, s);
    for (let k = s ? 1 : 0; k <= perSegment; k++) out.push(Cv.bezier(...P, k / perSegment));
  }
  return out;
}

/** Sampled polyline of the Catmull–Rom spline (from pts[1] to pts[n-2]). */
export function sampleCatmull(pts, perSpan = 20) {
  const out = [];
  for (let i = 1; i + 2 < pts.length; i++) {
    for (let k = i > 1 ? 1 : 0; k <= perSpan; k++) out.push(Cv.catmullRom(pts[i - 1], pts[i], pts[i + 1], pts[i + 2], k / perSpan));
  }
  return out;
}

/** Position and tangent at global parameter s ∈ [0,1) over all segments (uniform per segment). */
export function alongBezier(pts, s) {
  const n = segmentCount(pts);
  const x = (((s % 1) + 1) % 1) * n;
  const seg = Math.min(n - 1, Math.floor(x));
  const P = segmentPoints(pts, seg);
  return { pos: Cv.bezier(...P, x - seg), tan: Cv.bezierTangent(...P, x - seg) };
}

/**
 * Move Bézier control point i to uv and keep the curve C¹:
 *   • a joint drags both of its handles along with it;
 *   • a handle next to an interior joint re-positions the handle on the other side.
 */
export function moveBezierPoint(pts, i, uv) {
  const d = [uv[0] - pts[i][0], uv[1] - pts[i][1]];
  pts[i] = uv;
  if (isJoint(i)) {
    for (const h of [i - 1, i + 1]) if (h >= 0 && h < pts.length) pts[h] = [pts[h][0] + d[0], pts[h][1] + d[1]];
    return;
  }
  const joint = i % 3 === 1 ? i - 1 : i + 1;          // the joint this handle belongs to
  const other = i % 3 === 1 ? i - 2 : i + 2;          // the handle across that joint
  if (other >= 0 && other < pts.length) pts[other] = Cv.c1Partner(pts[joint], pts[i]);
}

/** Append a segment ending at uv; its first handle is placed by the C¹ rule. */
export function addBezierSegment(pts, uv) {
  const n = pts.length;
  const P1 = Cv.c1Partner(pts[n - 1], pts[n - 2]);
  const P2 = [P1[0] + (uv[0] - P1[0]) * 0.6, P1[1] + (uv[1] - P1[1]) * 0.6];
  pts.push(P1, P2, uv);
}

export function exportJSON() {
  const r = p => p.map(x => +x.toFixed(4));
  return JSON.stringify({
    painting: { artist: PAINTING.artist, title: PAINTING.title, pixels: [PAINTING.pxW, PAINTING.pxH] },
    coordinates: 'normalised image coordinates: u = x / width (0 = left, 1 = right), v = y / height (0 = top, 1 = bottom)',
    bezier: {
      type: 'piecewise cubic Bézier, C1 at the joints',
      traces: 'trunk and main branch of the large leaning plane tree',
      segments: segmentCount(curves.bezier),
      controlPoints: curves.bezier.map(r),
    },
    catmullRom: {
      type: 'uniform Catmull–Rom (passes through points 2 … n−1)',
      traces: 'silhouette of the hill across the water',
      points: curves.catmull.map(r),
    },
  }, null, 2);
}

export function downloadJSON() {
  const blob = new Blob([exportJSON()], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'curve.json' });
  a.click();
  URL.revokeObjectURL(a.href);
}
