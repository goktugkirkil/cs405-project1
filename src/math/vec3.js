// 3-vectors as plain arrays [x, y, z].  ── YOU WRITE THIS FILE ──
// Each function returns a NEW array; never modify the inputs.

const TODO = name => { throw new Error(`TODO: vec3.${name}`); };

/** a + b */
export function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
/** a − b */
export function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

/** s · a  (s is a number) */
export function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

/** a · b  → number */
export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

/** a × b  → vector perpendicular to both (right-handed) */
export function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
/** |a|  → number */
export function length(a) { return Math.sqrt(dot(a, a)); }
/** a / |a|. Return [0, 0, 0] for a zero-length input instead of NaNs. */
export function normalize(a) {
    const len = length(a);
    if (len === 0) return [0, 0, 0];
    return scale(a, 1 / len);
}