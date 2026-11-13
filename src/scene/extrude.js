// Bonus — extrusion: sweep a curve that lies in the painting plane along +z,
// out of the painting, and render the swept surface as a triangle mesh.

import * as V from '../math/vec3.js';

const TODO = name => { throw new Error(`TODO: extrude.${name}`); };

// ── YOU WRITE THIS ──────────────────────────────────────────────────────
/**
 * points: world-space points [x, y, z] along the curve, in order.
 * depth:  how far the curve is swept along +z.
 * Returns a Float32Array of triangles, 6 floats per vertex: position (3) then normal (3).
 *
 * For every neighbouring pair a = points[i], b = points[i + 1]:
 *   a2 = a + (0, 0, depth),  b2 = b + (0, 0, depth)
 *   n  = normalize( (b − a) × (0, 0, 1) )        same normal for the whole quad
 *   two triangles:  (a, b, b2)  and  (a, b2, a2)
 */
export function extrude(points, depth) {
  const out = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const a2 = V.add(a, [0, 0, depth]);
    const b2 = V.add(b, [0, 0, depth]);
    const n = V.normalize(V.cross(V.sub(b, a), [0, 0, 1]));   // same normal for the whole quad
    for (const p of [a, b, b2, a, b2, a2]) out.push(...p, ...n); // triangles (a, b, b2) and (a, b2, a2)
  }
  return new Float32Array(out);
}
// ────────────────────────────────────────────────────────────────────────
