// Part D — curves.  ── YOU WRITE THIS FILE ──
// Points are 2-D arrays [x, y] (normalised painting coordinates, see scene/partD.js).
// Every function returns NEW arrays.

const TODO = name => { throw new Error(`TODO: curves.${name}`); };

/** Linear interpolation (1 − t)·a + t·b. Given — de Casteljau is built from it. */
export function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

/** The four cubic Bernstein basis functions at t: [B0, B1, B2, B3]. */
export function bernstein(t) {
    const u = 1 - t;
    return [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
}
/** Point on the cubic Bézier P0..P3 at t ∈ [0,1], using bernstein(t). */
export function bezier(P0, P1, P2, P3, t) {
    const b = bernstein(t);
    return [
        b[0] * P0[0] + b[1] * P1[0] + b[2] * P2[0] + b[3] * P3[0],   // x
        b[0] * P0[1] + b[1] * P1[1] + b[2] * P2[1] + b[3] * P3[1],                                                         // y: aynısı, [0] yerine [1]
    ];
}
/** Derivative (tangent vector) of the cubic Bézier at t. */
export function bezierTangent(P0, P1, P2, P3, t) {
    const u = 1 - t;
    return [
        3 * (u * u * (P1[0] - P0[0]) + 2 * u * t * (P2[0] - P1[0]) + t * t * (P3[0] - P2[0])),
        3 * (u * u * (P1[1] - P0[1]) + 2 * u * t * (P2[1] - P1[1]) + t * t * (P3[1] - P2[1])),
        // aynısı, [0] yerine [1]
    ];
}
export function c1Partner(joint, handle) {
    return [2 * joint[0] - handle[0], 2 * joint[1] - handle[1]];
}
/**
 * de Casteljau's construction at t. Returns all levels:
 *   [ [P0, P1, P2, P3],      level 0: the control points
 *     [Q0, Q1, Q2],          level 1: lerp between neighbours of level 0
 *     [R0, R1],              level 2
 *     [S] ]                  level 3: the point on the curve
 */
export function deCasteljau(P0, P1, P2, P3, t) {
    const L1 = [lerp(P0, P1, t), lerp(P1, P2, t), lerp(P2, P3, t)];    // 3 nokta
    const L2 = [lerp(L1[0], L1[1], t), lerp(L1[1], L1[2], t)];         // 2 nokta
    const L3 = [lerp(L2[0], L2[1], t)];                                // 1 nokta (eğri üzerindeki nokta)
    return [[P0, P1, P2, P3], L1, L2, L3];
}


/**
 * C¹ continuity at a joint. `joint` is shared by two segments, `handle` is the
 * control point next to it on one side. Return where the handle on the OTHER side
 * must be so that the curve is C¹ there.
 */

/** Uniform Catmull–Rom: point between p1 (t = 0) and p2 (t = 1); p0 and p3 are the neighbours. */
export function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
    ];
}