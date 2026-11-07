// 4×4 matrices.  ── YOU WRITE THIS FILE ──
//
// Storage: Float32Array(16), COLUMN-MAJOR, exactly what WGSL's mat4x4f expects.
//   element (row r, column c)  lives at  m[c * 4 + r]
//   so the translation of an affine matrix is m[12], m[13], m[14].
//
// Convention used everywhere in this project: column vectors, p' = M · p.
//   multiply(A, B) = A · B   → B is applied to the point first.
//
// Every function returns a NEW Float32Array(16).

const TODO = name => { throw new Error(`TODO: mat4.${name}`); };

// ───────────────────────────── Part A ─────────────────────────────

export function identity() {
    return new Float32Array([
        1, 0, 0, 0,   // 1. sütun
        0, 1, 0, 0,   // 2. sütun
        0, 0, 1, 0,   // 3. sütun
        0, 0, 0, 1,   // 4. sütun
    ]);
}
/** A · B */
export function multiply(a, b) {
    const out = new Float32Array(16);
    for (let r = 0; r < 4; r++) {          // satır
        for (let c = 0; c < 4; c++) {      // sütun
            let sum = 0;
            for (let k = 0; k < 4; k++) {
                sum += a[k * 4 + r] * b[c * 4 + k];      // A[r][k] · B[k][c]
            }
            out[c * 4 + r] = sum;
        }
    }
    return out;
}


export function translate(tx, ty, tz) {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        tx, ty, tz, 1,
    ]);
}


/** Rotation by `rad` radians about the x axis (right-hand rule). */
export function rotateX(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1,
    ]);
}
export function rotateY(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1,
    ]);
}
export function rotateZ(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([
        c, s, 0, 0,
        -s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ]);
}

export function scale(sx, sy, sz) {
    return new Float32Array([
        sx, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, sz, 0,
        0, 0, 0, 1,
    ]);
}

export function transpose(m) {
    const out = new Float32Array(16);
    for (let r = 0; r < 4; r++) {          // satır
        for (let c = 0; c < 4; c++) {      // sütun
            out[r * 4 + c] = m[c * 4 + r];    // m'nin (r, c) elemanı → out'un (c, r) pozisyonuna
        }
    }
    return out;
}
/** Inverse of a RIGID transform M = T·R (rotation + translation only, no scale). */
export function invertRigid(m) {
    const out = identity();

    // 1) Sol üst 3×3'ü transpoze et: m'nin (r,c) elemanı → out'un (c,r) pozisyonu
    for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
            out[r * 4 + c] = m[c * 4 + r];          // transpose'da yazdığın indeksin aynısı

    // 2) t = m'nin 4. sütunu
    const t = [m[12], m[13], m[14]];

    // 3) Yeni öteleme = −Rᵀt.  Bunun r. bileşeni = −(R'nin r. sütunu · t)
    for (let r = 0; r < 3; r++)
        out[12 + r] = -(m[r * 4 + 0] * t[0] + m[r * 4 + 1] * t[1] + m[r * 4 + 2] * t[2]);

    return out;
}
/** M · [p, 1], then divide by w. Returns [x, y, z]. */
export function transformPoint(m, p) {
    const v = [0, 0, 0, 0];
    for (let r = 0; r < 4; r++)
        v[r] = m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r];
    return [v[0] / v[3], v[1] / v[3], v[2] / v[3]];
}

// ───────────────────────────── Part C ─────────────────────────────
import * as V from './vec3.js';      // ← bunu dosyanın EN ÜSTÜNE ekle
/**
 * View matrix: world → camera space. The camera sits at `eye`, looks at
 * `target`, and in camera space looks down −z with +y up.
 * Build the basis with TWO cross products. If `up` is (nearly) parallel to
 * the viewing direction, choose a different up instead of returning NaNs.
 */
export function lookAt(eye, target, up) {
    const f = V.normalize(V.sub(target, eye));               // target − eye

    // dejenere durum: up, f'ye (neredeyse) paralelse başka bir up seç
    if (Math.abs(V.dot(f, V.normalize(up))) > 0.999)
        up = Math.abs(f[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];

    const s = V.normalize(V.cross(f, up));             // f × up
    const u = V.cross(s, f);                          // s × f

    // kameranın dünya matrisi: sütunlar = s, u, −f, eye
    const camToWorld = new Float32Array([
        s[0], s[1], s[2], 0,
        u[0], u[1], u[2], 0,
        -f[0], -f[1], -f[2], 0,     // −f
        eye[0], eye[1], eye[2], 1,     // eye
    ]);
    return invertRigid(camToWorld);
}

/**
 * Perspective projection for WebGPU. fovY in radians.
 * After the divide by w, a point on the axis at z = −near must land at depth 0
 * and one at z = −far at depth 1 (NOT OpenGL's −1…1).
 */
export function perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, far / (near - far), -1,     // −f
        0, 0, near * far / (near - far), 0,
    ]);
}
/**
 * Orthographic projection for WebGPU: the box [l,r]×[b,t]×[−near,−far]
 * maps to x,y ∈ [−1,1] and depth ∈ [0,1], with the same near/far meaning as above.
 */
export function orthographic(left, right, bottom, top, near, far) {
    return new Float32Array([
        2 / (right - left), 0, 0, 0,
        0, 2 / (top - bottom), 0, 0,
        0, 0, 1 / (near - far), 0,
        -(right + left) / (right - left), -(top + bottom) / (top - bottom), near / (near - far), 1,
    ]);
}
