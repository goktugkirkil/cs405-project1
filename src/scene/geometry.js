// Vertex data for the few shapes the scene needs. Pure data, no maths library.

/** Unit cube centred on the origin. 36 vertices × (position, normal). */
export function cube() {
  const faces = [
    [[ 0, 0, 1], [[-.5,-.5, .5], [ .5,-.5, .5], [ .5, .5, .5], [-.5, .5, .5]]],
    [[ 0, 0,-1], [[ .5,-.5,-.5], [-.5,-.5,-.5], [-.5, .5,-.5], [ .5, .5,-.5]]],
    [[ 1, 0, 0], [[ .5,-.5, .5], [ .5,-.5,-.5], [ .5, .5,-.5], [ .5, .5, .5]]],
    [[-1, 0, 0], [[-.5,-.5,-.5], [-.5,-.5, .5], [-.5, .5, .5], [-.5, .5,-.5]]],
    [[ 0, 1, 0], [[-.5, .5, .5], [ .5, .5, .5], [ .5, .5,-.5], [-.5, .5,-.5]]],
    [[ 0,-1, 0], [[-.5,-.5,-.5], [ .5,-.5,-.5], [ .5,-.5, .5], [-.5,-.5, .5]]],
  ];
  const out = [];
  for (const [n, q] of faces) for (const i of [0, 1, 2, 0, 2, 3]) out.push(...q[i], ...n);
  return new Float32Array(out);
}

/** Square-based pyramid (apex +y), base in y = -0.5, height 1. Good for showing orientation. */
export function pyramid() {
  const A = [0, .5, 0], b = [[-.5,-.5, .5], [.5,-.5, .5], [.5,-.5,-.5], [-.5,-.5,-.5]];
  const out = [];
  const push = (p, q, r) => {
    const u = [q[0]-p[0], q[1]-p[1], q[2]-p[2]], v = [r[0]-p[0], r[1]-p[1], r[2]-p[2]];
    let n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    const l = Math.hypot(...n); n = n.map(x => x / l);
    out.push(...p, ...n, ...q, ...n, ...r, ...n);
  };
  for (let i = 0; i < 4; i++) push(b[i], b[(i + 1) % 4], A);
  push(b[0], b[3], b[2]); push(b[0], b[2], b[1]);
  return new Float32Array(out);
}

/** Quad in the z = 0 plane, centred, w × h, with uv (0,0) at the top-left of the image. */
export function quad(w, h) {
  const x = w / 2, y = h / 2;
  return new Float32Array([
    -x, -y, 0, 0, 1,    x, -y, 0, 1, 1,    x,  y, 0, 1, 0,
    -x, -y, 0, 0, 1,    x,  y, 0, 1, 0,   -x,  y, 0, 0, 0,
  ]);
}
