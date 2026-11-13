// Unit tests for vec3.js and mat4.js. They run in the browser on start-up (bottom-left
// panel) and in the terminal with `npm test`. Expected values are written out by hand.

import * as V from './vec3.js';
import * as M from './mat4.js';
import * as C from '../scene/compose.js';
import { Node } from '../scene/graph.js';
import * as Cam from '../scene/camera.js';
import * as Cv from './curves.js';
import * as Ex from '../scene/extrude.js';

const tests = [];
const test = (part, name, fn) => tests.push({ part, name, fn });

const EPS = 1e-4;
function near(a, b, what = 'value') {
  if (!Number.isFinite(a) || Math.abs(a - b) > EPS) throw new Error(`${what}: got ${fmt(a)}, expected ${fmt(b)}`);
}
function vecNear(got, exp, what = 'vector') {
  if (!got || got.length < exp.length) throw new Error(`${what}: got ${got}, expected [${exp.map(fmt)}]`);
  exp.forEach((e, i) => near(got[i], e, `${what}[${i}]`));
}
function matNear(got, exp, what = 'matrix') {
  if (!(got instanceof Float32Array) || got.length !== 16) throw new Error(`${what}: must be a Float32Array(16)`);
  exp.forEach((e, i) => near(got[i], e, `${what}[${i}] (row ${i % 4}, col ${Math.floor(i / 4)})`));
}
const fmt = x => (typeof x === 'number' ? +x.toFixed(4) : String(x));
const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
const deg = d => d * Math.PI / 180;

// ───────── vec3
test('vec3', 'add / sub / scale', () => {
  vecNear(V.add([1, 2, 3], [4, 5, 6]), [5, 7, 9], 'add');
  vecNear(V.sub([1, 2, 3], [4, 5, 6]), [-3, -3, -3], 'sub');
  vecNear(V.scale([1, -2, 3], 2), [2, -4, 6], 'scale');
});
test('vec3', 'dot / length', () => {
  near(V.dot([1, 2, 3], [4, 5, 6]), 32, 'dot');
  near(V.length([3, 4, 0]), 5, 'length');
});
test('vec3', 'cross', () => {
  vecNear(V.cross([1, 0, 0], [0, 1, 0]), [0, 0, 1], 'x × y');
  vecNear(V.cross([0, 1, 0], [0, 0, 1]), [1, 0, 0], 'y × z');
  vecNear(V.cross([2, 3, 4], [5, 6, 7]), [-3, 6, -3], 'general');
});
test('vec3', 'normalize', () => {
  vecNear(V.normalize([0, 3, 4]), [0, 0.6, 0.8], 'normalize');
  vecNear(V.normalize([0, 0, 0]), [0, 0, 0], 'zero vector');
});

// ───────── Part A
test('A', 'identity', () => matNear(M.identity(), I));
test('A', 'translate (column-major: m[12..14])', () =>
  matNear(M.translate(1, 2, 3), [1,0,0,0, 0,1,0,0, 0,0,1,0, 1,2,3,1]));
test('A', 'scale', () => matNear(M.scale(2, 3, 4), [2,0,0,0, 0,3,0,0, 0,0,4,0, 0,0,0,1]));
test('A', 'rotateX(90°): y → z', () => {
  const m = M.rotateX(deg(90));
  matNear(m, [1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1]);
});
test('A', 'rotateY(90°): z → x', () => {
  const m = M.rotateY(deg(90));
  matNear(m, [0,0,-1,0, 0,1,0,0, 1,0,0,0, 0,0,0,1]);
});
test('A', 'rotateZ(90°): x → y', () => {
  const m = M.rotateZ(deg(90));
  matNear(m, [0,1,0,0, -1,0,0,0, 0,0,1,0, 0,0,0,1]);
});
test('A', 'multiply: I·A = A', () => matNear(M.multiply(M.identity(), M.translate(1, 2, 3)), [1,0,0,0, 0,1,0,0, 0,0,1,0, 1,2,3,1]));
test('A', 'multiply order: T·S ≠ S·T', () => {
  const T = M.translate(1, 2, 3), S = M.scale(2, 2, 2);
  matNear(M.multiply(T, S), [2,0,0,0, 0,2,0,0, 0,0,2,0, 1,2,3,1], 'T·S');
  matNear(M.multiply(S, T), [2,0,0,0, 0,2,0,0, 0,0,2,0, 2,4,6,1], 'S·T');
});
test('A', 'multiply: rotations compose', () => {
  matNear(M.multiply(M.rotateZ(deg(30)), M.rotateZ(deg(60))), [0,1,0,0, -1,0,0,0, 0,0,1,0, 0,0,0,1], 'Rz(30)·Rz(60)');
});
test('A', 'transpose', () => matNear(M.transpose(M.translate(1, 2, 3)), [1,0,0,1, 0,1,0,2, 0,0,1,3, 0,0,0,1]));
test('A', 'transformPoint (incl. divide by w)', () => {
  vecNear(M.transformPoint(M.translate(1, 2, 3), [1, 1, 1]), [2, 3, 4], 'translate');
  const W = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,2]);
  vecNear(M.transformPoint(W, [2, 4, 6]), [1, 2, 3], 'w = 2');
});
test('A', 'invertRigid', () => {
  matNear(M.invertRigid(M.translate(1, 2, 3)), [1,0,0,0, 0,1,0,0, 0,0,1,0, -1,-2,-3,1], 'inverse of T');
  const R = M.multiply(M.translate(1, -2, 0.5), M.multiply(M.rotateY(0.7), M.rotateX(-0.4)));
  matNear(M.multiply(M.invertRigid(R), R), I, 'inv(M)·M');
  matNear(M.multiply(R, M.invertRigid(R)), I, 'M·inv(M)');
});

test('A', 'composeTRS / composeSRT', () => {
  const T = M.translate(1, 0, 0), R = M.rotateZ(deg(90)), S = M.scale(2, 1, 1);
  vecNear(M.transformPoint(C.composeTRS(T, R, S), [1, 0, 0]), [1, 2, 0], 'T·R·S · (1,0,0)');
  vecNear(M.transformPoint(C.composeSRT(T, R, S), [1, 0, 0]), [0, 2, 0], 'S·R·T · (1,0,0)');
});

// ───────── Part B
test('B', 'scene graph: world = parent.world · local', () => {
  const root = new Node('root', { local: M.translate(1, 0, 0) });
  const arm = root.add(new Node('arm', { local: M.rotateZ(deg(90)) }));
  const tip = arm.add(new Node('tip', { local: M.translate(1, 0, 0) }));
  root.updateWorld();
  matNear(root.world, [1,0,0,0, 0,1,0,0, 0,0,1,0, 1,0,0,1], 'root.world');
  vecNear(M.transformPoint(tip.world, [0, 0, 0]), [1, 1, 0], 'tip position');
  vecNear(M.transformPoint(tip.world, [1, 0, 0]), [1, 2, 0], 'tip x-axis end');
});
test('B', 'scene graph: changing a parent moves the children', () => {
  const root = new Node('root');
  const child = root.add(new Node('child', { local: M.translate(0, 2, 0) }));
  root.updateWorld();
  root.local = M.translate(5, 0, 0);
  root.updateWorld();
  vecNear(M.transformPoint(child.world, [0, 0, 0]), [5, 2, 0], 'child after parent moved');
});

// ───────── Part C
test('C', 'lookAt: eye → origin, target → −z', () => {
  const V1 = M.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
  vecNear(M.transformPoint(V1, [0, 0, 5]), [0, 0, 0], 'eye');
  vecNear(M.transformPoint(V1, [0, 0, 0]), [0, 0, -5], 'target');
  const V2 = M.lookAt([3, 2, 5], [0, 1, 0], [0, 1, 0]);
  vecNear(M.transformPoint(V2, [3, 2, 5]), [0, 0, 0], 'eye (general)');
  vecNear(M.transformPoint(V2, [0, 1, 0]), [0, 0, -Math.hypot(3, 1, 5)], 'target (general)');
});
test('C', 'lookAt: right-handed (camera on +x looking at origin)', () => {
  const V1 = M.lookAt([5, 0, 0], [0, 0, 0], [0, 1, 0]);
  vecNear(M.transformPoint(V1, [0, 0, -1]), [1, 0, -5], 'world −z should be camera +x');
  vecNear(M.transformPoint(V1, [0, 1, 0]), [0, 1, -5], 'world +y should be camera +y');
});
test('C', 'lookAt: up parallel to view direction', () => {
  const V1 = M.lookAt([0, 5, 0], [0, 0, 0], [0, 1, 0]);
  for (let i = 0; i < 16; i++) if (!Number.isFinite(V1[i])) throw new Error(`NaN/Infinity at index ${i}`);
  vecNear(M.transformPoint(V1, [0, 5, 0]), [0, 0, 0], 'eye');
  vecNear(M.transformPoint(V1, [0, 0, 0]), [0, 0, -5], 'target');
});
test('C', 'perspective: depth 0 at near, 1 at far (WebGPU)', () => {
  const P = M.perspective(deg(60), 2, 0.5, 20);
  near(M.transformPoint(P, [0, 0, -0.5])[2], 0, 'depth at near');
  near(M.transformPoint(P, [0, 0, -20])[2], 1, 'depth at far');
  const mid = M.transformPoint(P, [0, 0, -5])[2];
  if (!(mid > 0 && mid < 1)) throw new Error(`depth at z=−5 should be in (0,1), got ${fmt(mid)}`);
});
test('C', 'perspective: frustum edges hit ±1', () => {
  const P = M.perspective(deg(60), 2, 0.5, 20);
  const h = 4 * Math.tan(deg(30));
  vecNear(M.transformPoint(P, [0, h, -4]).slice(0, 2), [0, 1], 'top edge');
  vecNear(M.transformPoint(P, [2 * h, 0, -4]).slice(0, 2), [1, 0], 'right edge (aspect 2)');
});
test('C', 'orthographic: box → [−1,1]² × [0,1]', () => {
  const O = M.orthographic(-2, 2, -1, 1, 0.5, 20);
  vecNear(M.transformPoint(O, [-2, -1, -0.5]), [-1, -1, 0], 'near-bottom-left');
  vecNear(M.transformPoint(O, [2, 1, -20]), [1, 1, 1], 'far-top-right');
});

// ───────── Part C · cameras (src/scene/camera.js)
test('Ccam', 'orbitEye', () => {
  vecNear(Cam.orbitEye([0, 0, 0], 5, 0, 0), [0, 0, 5], 'yaw 0, pitch 0');
  vecNear(Cam.orbitEye([0, 0, 0], 5, deg(90), 0), [5, 0, 0], 'yaw 90°');
  vecNear(Cam.orbitEye([0, 0, 0], 5, 0, deg(90)), [0, 5, 0], 'pitch 90°');
  vecNear(Cam.orbitEye([1, 2, 3], 2, 0, 0), [1, 2, 5], 'around a target');
});
test('Ccam', 'frustumCorners (perspective)', () => {
  const c = Cam.frustumCorners({ perspective: true, fovY: deg(90), aspect: 2, near: 1, far: 10 });
  if (!c || c.length !== 8) throw new Error('must return 8 points');
  vecNear(c[0], [-2, -1, -1], 'near bottom-left');
  vecNear(c[2], [2, 1, -1], 'near top-right');
  vecNear(c[4], [-20, -10, -10], 'far bottom-left');
  vecNear(c[6], [20, 10, -10], 'far top-right');
});
test('Ccam', 'frustumCorners (orthographic)', () => {
  const c = Cam.frustumCorners({ perspective: false, halfHeight: 1, aspect: 2, near: 1, far: 10 });
  if (!c || c.length !== 8) throw new Error('must return 8 points');
  vecNear(c[1], [2, -1, -1], 'near bottom-right');
  vecNear(c[7], [-2, 1, -10], 'far top-left');
});

// ───────── Part D (src/math/curves.js)
const BP = [[0, 0], [1, 2], [3, 2], [4, 0]];
test('D', 'bernstein', () => {
  vecNear(Cv.bernstein(0), [1, 0, 0, 0], 't = 0');
  vecNear(Cv.bernstein(1), [0, 0, 0, 1], 't = 1');
  vecNear(Cv.bernstein(0.5), [0.125, 0.375, 0.375, 0.125], 't = 0.5');
  const b = Cv.bernstein(0.3);
  near(b[0] + b[1] + b[2] + b[3], 1, 'weights sum to 1');
});
test('D', 'bezier: starts at P0, ends at P3', () => {
  vecNear(Cv.bezier(...BP, 0), [0, 0], 't = 0');
  vecNear(Cv.bezier(...BP, 1), [4, 0], 't = 1');
  vecNear(Cv.bezier(...BP, 0.5), [2, 1.5], 't = 0.5');
  // P0 ≠ 0, so a wrong weight on P0 cannot hide
  const Q = [[1, 3], [2, 5], [4, 5], [5, 1]];
  vecNear(Cv.bezier(...Q, 0), [1, 3], 'P0 ≠ 0, t = 0');
  vecNear(Cv.bezier(...Q, 0.5), [3, 4.25], 'P0 ≠ 0, t = 0.5');
  const b = Cv.bezier(...Q, 0.3), L = Cv.deCasteljau(...Q, 0.3)[3][0];
  vecNear(b, L, 'bezier(t) = de Casteljau(t)');
});
test('D', 'bezierTangent', () => {
  vecNear(Cv.bezierTangent(...BP, 0), [3, 6], 't = 0 → 3(P1 − P0)');
  vecNear(Cv.bezierTangent(...BP, 1), [3, -6], 't = 1 → 3(P3 − P2)');
  vecNear(Cv.bezierTangent(...BP, 0.5), [4.5, 0], 't = 0.5');
});
test('D', 'deCasteljau', () => {
  const L = Cv.deCasteljau(...BP, 0.5);
  if (!L || L.length !== 4) throw new Error('must return 4 levels');
  if (L[1].length !== 3 || L[2].length !== 2 || L[3].length !== 1) throw new Error('levels must have 4, 3, 2, 1 points');
  vecNear(L[1][0], [0.5, 1], 'level 1, first point');
  vecNear(L[2][1], [2.75, 1.5], 'level 2, second point');
  vecNear(L[3][0], [2, 1.5], 'final point = bezier(t)');
});
test('D', 'c1Partner', () => {
  vecNear(Cv.c1Partner([1, 1], [0, 0]), [2, 2], 'mirror of the handle through the joint');
  vecNear(Cv.c1Partner([2, 0], [1, 3]), [3, -3], 'general');
});
test('D', 'catmullRom', () => {
  const p = [[0, 0], [1, 1], [2, 1], [3, 0]];
  vecNear(Cv.catmullRom(...p, 0), [1, 1], 't = 0 → p1');
  vecNear(Cv.catmullRom(...p, 1), [2, 1], 't = 1 → p2');
  vecNear(Cv.catmullRom(...p, 0.5), [1.5, 1.125], 't = 0.5');
});

// ───────── Bonus: extrusion (src/scene/extrude.js)
test('Bonus', 'extrude', () => {
  const m = Ex.extrude([[0, 0, 0], [1, 0, 0], [1, 1, 0]], 2);
  if (!(m instanceof Float32Array)) throw new Error('must return a Float32Array');
  if (m.length !== 2 * 6 * 6) throw new Error(`2 segments → 12 vertices → 72 floats, got ${m.length}`);
  const v = i => Array.from(m.slice(i * 6, i * 6 + 6));
  vecNear(v(0), [0, 0, 0, 0, -1, 0], 'vertex 0 = a, normal (b−a)×z');
  vecNear(v(1), [1, 0, 0, 0, -1, 0], 'vertex 1 = b');
  vecNear(v(2), [1, 0, 2, 0, -1, 0], 'vertex 2 = b2');
  vecNear(v(5), [0, 0, 2, 0, -1, 0], 'vertex 5 = a2');
  vecNear(v(6), [1, 0, 0, 1, 0, 0], 'second segment starts at points[1], normal (1,0,0)');
});

/** Run every test. status: 'pass' | 'fail' | 'todo' (function not written yet). */
export function runAll() {
  const results = tests.map(({ part, name, fn }) => {
    try { fn(); return { part, name, status: 'pass' }; }
    catch (e) {
      const msg = String(e?.message ?? e);
      return { part, name, status: msg.startsWith('TODO') ? 'todo' : 'fail', msg };
    }
  });
  const count = s => results.filter(r => r.status === s).length;
  const partOK = p => results.filter(r => r.part === p || r.part === 'vec3').every(r => r.status === 'pass');
  return { results, passed: count('pass'), failed: count('fail'), todo: count('todo'),
           partA: partOK('A'), partB: partOK('A') && partOK('B'), partC: partOK('A') && partOK('C'),
           orbit: partOK('A') && partOK('C') && results.filter(r => r.name === 'orbitEye').every(r => r.status === 'pass'),
           frustum: partOK('A') && partOK('C') && partOK('Ccam'),
           partD: partOK('A') && partOK('D'),
           extrude: partOK('A') && partOK('D') && partOK('Bonus') };
}
