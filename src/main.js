// CS405 Project 1 — application entry point.
// Wires maths (src/math), rendering (src/gpu), scene (src/scene) and UI (src/ui) together.

import * as M from './math/mat4.js';
import * as V from './math/vec3.js';
import * as Cv from './math/curves.js';
import { runAll } from './math/tests.js';
import { createRenderer } from './gpu/renderer.js';
import { cube, pyramid, quad } from './scene/geometry.js';
import { PAINTING, uvToWorld } from './scene/painting.js';
import { partA, PART_A_DEFAULTS, buildPartA } from './scene/partA.js';
import { buildCrane, animateCrane, treeText } from './scene/partB.js';
import { camera, CAMERA_DEFAULTS, mainCameraMatrices, inspectCameraMatrices, frustumLines } from './scene/camera.js';
import { curves, CURVE_DEFAULTS, partD, PART_D_DEFAULTS, segmentCount, segmentPoints, isJoint,
         sampleBezier, sampleCatmull, alongBezier, moveBezierPoint, addBezierSegment, downloadJSON } from './scene/partD.js';
import { eventNDC, pickUv, pickPoint } from './scene/picking.js';
import { composeTRS } from './scene/compose.js';
import { extrude } from './scene/extrude.js';
import { createPanel, matrixHTML } from './ui/panel.js';

const $ = id => document.getElementById(id);

// App-level switches (UI writes into these).
const app = {
  view: 'main',          // 'main' | 'inspect'
  showAxes: false,       // Part B debug: local axes of every scene-graph node
  showFrustum: true,     // Part C: main camera frustum, visible from the inspection camera
  showCurves: true,      // Part D drawings
  animate: true,
};
const APP_DEFAULTS = { ...app };
const clock = { t: 0 };   // animation time in seconds; 'reset scene' sets it back to 0

// ── tests panel
function showTests(report) {
  const icon = { pass: '✓', fail: '✗', todo: '·' };
  $('testlist').innerHTML =
    `<div>${report.passed} passed · <span class="fail">${report.failed} failed</span> · <span class="todo">${report.todo} to write</span></div>` +
    report.results.map(t =>
      `<div class="${t.status === 'pass' ? 'ok' : t.status}">${icon[t.status]} [${t.part}] ${t.name}` +
      (t.status === 'fail' ? `<br>&nbsp;&nbsp;${t.msg}` : '') + '</div>').join('');
  if (report.failed + report.todo === 0) $('tests').classList.add('collapsed');
}

// Stand-in camera for before lookAt/perspective exist: x,y fitted to the window,
// depth = 0.5 − 0.1·z (things in front of the painting come out nearer).
function fallbackViewProj(aspect) {
  const s = 0.9 * Math.min(2 * aspect / PAINTING.width, 2 / PAINTING.height);
  return new Float32Array([s / aspect, 0, 0, 0,  0, s, 0, 0,  0, 0, -0.1, 0,  0, 0, 0.5, 1]);
}
const IDENTITY = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

// ── UI
function buildUI() {
  const ui = createPanel($('controls'));
  const refreshers = [];
  const keep = c => (refreshers.push(c), c);

  ui.section('View & camera');
  keep(ui.select('view', app, 'view', { main: 'main camera', inspect: 'inspection camera' }));
  keep(ui.select('projection', camera, 'projection', { perspective: 'perspective', orthographic: 'orthographic' }));
  keep(ui.slider('fov°', camera, 'fov', 15, 100, 1));
  keep(ui.slider('near', camera, 'near', 0.05, 3));
  keep(ui.slider('far', camera, 'far', 3, 30, 0.1));
  ui.html('hint').textContent = 'drag empty canvas to orbit · wheel to zoom';
  const camInfo = ui.html('caminfo');

  ui.section('Debug');
  keep(ui.checkbox('axes', app, 'showAxes'));
  keep(ui.checkbox('frustum', app, 'showFrustum'));
  keep(ui.checkbox('curves', app, 'showCurves'));
  keep(ui.checkbox('animate', app, 'animate'));

  ui.section('A · Transformations', false);
  keep(ui.select('order', partA, 'order', { TRS: 'M = T · R · S', SRT: 'M = S · R · T' }));
  keep(ui.slider('tx', partA, 'tx', -1.5, 1.5));
  keep(ui.slider('ty', partA, 'ty', -1, 1));
  keep(ui.slider('tz', partA, 'tz', 0, 1.5));
  keep(ui.select('axis', partA, 'axis', { x: 'rotate x', y: 'rotate y', z: 'rotate z' }));
  keep(ui.slider('angle°', partA, 'angle', -180, 180, 1));
  keep(ui.slider('scale', partA, 'scale', 0.05, 1));
  const matrices = ui.html('matrices');

  ui.section('B · Scene graph', false);
  const tree = ui.html('tree');
  const leaf = ui.html('matrices');

  ui.section('D · Curves', false);
  keep(ui.select('edit', partD, 'edit', { bezier: 'edit Bézier', catmull: 'edit Catmull–Rom' }));
  keep(ui.slider('t', partD, 't', 0, 1));
  keep(ui.slider('segment', partD, 'segment', 0, 5, 1));
  keep(ui.checkbox('polygon', partD, 'showPolygon'));
  keep(ui.checkbox('casteljau', partD, 'showCasteljau'));
  keep(ui.checkbox('catmull', partD, 'showCatmull'));
  keep(ui.checkbox('follower', partD, 'animateAlong'));
  keep(ui.checkbox('extrude', partD, 'extrude'));
  keep(ui.slider('depth', partD, 'depth', 0.05, 1));
  ui.html('hint').innerHTML = 'drag a point to move it · shift+click adds a segment / point';
  ui.button('export JSON', downloadJSON);
  ui.button('reset curves', () => Object.assign(curves, structuredClone(CURVE_DEFAULTS)));
  const curveInfo = ui.html('caminfo');

  ui.section('Scene');
  ui.button('reset scene', () => {
    Object.assign(partA, PART_A_DEFAULTS);
    Object.assign(partD, PART_D_DEFAULTS);
    Object.assign(app, { ...APP_DEFAULTS, animate: app.animate });   // keep a paused animation paused
    Object.assign(camera, structuredClone(CAMERA_DEFAULTS));
    Object.assign(curves, structuredClone(CURVE_DEFAULTS));
    clock.t = 0;
    refreshers.forEach(r => r.refresh());
  });

  return { matrices, camInfo, tree, leaf, curveInfo };
}

// ── mouse: drag curve points on the painting, otherwise orbit the main camera
function attachMouse(canvas, frameState) {
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const s = frameState();
    if (s.mainCam && app.view === 'main' && app.showCurves) {
      const ndc = eventNDC(e, canvas);
      const pts = curves[partD.edit];
      const i = pickPoint(pts, s.mainCam.VP, ndc, canvas);
      if (i >= 0) { drag = { kind: 'point', i }; return; }
      if (e.shiftKey) {
        const uv = pickUv(camera, s.mainCam.V, s.aspect, ndc);
        if (uv) {
          if (partD.edit === 'catmull') pts.push(uv);
          else { try { addBezierSegment(pts, uv); } catch (err) { console.warn(err.message); } }
        }
        return;
      }
    }
    drag = { kind: 'orbit', x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    if (drag.kind === 'orbit') {
      camera.yaw  -= (e.clientX - drag.x) * 0.3;
      camera.pitch = Math.max(-85, Math.min(85, camera.pitch + (e.clientY - drag.y) * 0.3));
      drag.x = e.clientX; drag.y = e.clientY;
      return;
    }
    const s = frameState();
    const uv = pickUv(camera, s.mainCam.V, s.aspect, eventNDC(e, canvas));
    if (!uv) return;
    if (partD.edit === 'catmull') curves.catmull[drag.i] = uv;
    else {
      try { moveBezierPoint(curves.bezier, drag.i, uv); }
      catch { curves.bezier[drag.i] = uv; }       // c1Partner not written yet: move the point only
    }
  });
  canvas.addEventListener('pointerup', () => (drag = null));
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    camera.radius = Math.max(0.8, Math.min(20, camera.radius * Math.exp(e.deltaY * 0.001)));
  }, { passive: false });
}

// ── debug drawing helpers
const AXIS_COLOURS = [[1, 0.25, 0.25], [0.3, 1, 0.3], [0.35, 0.55, 1]];
function drawAxes(r, world, len = 0.12) {
  const o = M.transformPoint(world, [0, 0, 0]);
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((e, i) => {
    const dir = V.normalize(V.sub(M.transformPoint(world, e), o));   // direction only: ignore the node's scale
    r.line(o, V.add(o, V.scale(dir, len)), AXIS_COLOURS[i], true);
  });
}
function drawSquare(r, uv, size, colour) {
  const [x, y, z] = uvToWorld(uv), s = size / 2;
  r.polyline([[x - s, y - s, z], [x + s, y - s, z], [x + s, y + s, z], [x - s, y + s, z], [x - s, y - s, z]], colour, true);
}
function drawCross(r, uv, size, colour) {
  const [x, y, z] = uvToWorld(uv), s = size / 2;
  r.line([x - s, y - s, z], [x + s, y + s, z], colour, true);
  r.line([x - s, y + s, z], [x + s, y - s, z], colour, true);
}
const toWorld = pts => pts.map(p => uvToWorld(p));
const fmt3 = v => `(${v.map(x => x.toFixed(2)).join(', ')})`;
const fmt2 = v => `(${v.map(x => x.toFixed(3)).join(', ')})`;

function drawCurves(r, report, t, ui) {
  const C = { bez: [0.95, 0.25, 0.85], poly: [0.6, 0.6, 0.6], joint: [1, 0.9, 0.2], handle: [0.9, 0.9, 0.9],
              cr: [0.2, 0.9, 1], crPt: [0.25, 0.45, 1], l1: [0.2, 0.8, 1], l2: [0.4, 1, 0.4], pt: [1, 0.2, 0.2] };
  const B = curves.bezier, K = curves.catmull;
  const sz = 0.03;

  if (partD.showPolygon) r.polyline(toWorld(B), C.poly, true);
  if (report.partD) r.polyline(toWorld(sampleBezier(B)), C.bez, true);
  B.forEach((p, i) => drawSquare(r, p, isJoint(i) ? sz * 1.3 : sz, isJoint(i) ? C.joint : C.handle));

  if (partD.showCatmull) {
    if (report.partD) r.polyline(toWorld(sampleCatmull(K)), C.cr, true);
    K.forEach(p => drawSquare(r, p, sz, C.crPt));
  }

  let info = report.partD ? '' : '<span class="todo">write src/math/curves.js — the curves are drawn when the [D] tests pass</span>';
  if (report.partD && partD.showCasteljau) {
    const seg = Math.min(partD.segment, segmentCount(B) - 1);
    const L = Cv.deCasteljau(...segmentPoints(B, seg), partD.t);
    r.polyline(toWorld(L[1]), C.l1, true);
    r.polyline(toWorld(L[2]), C.l2, true);
    L[1].concat(L[2]).forEach(p => drawSquare(r, p, sz * 0.6, C.l2));
    drawCross(r, L[3][0], sz * 1.6, C.pt);
    info = `segment ${seg} · t = ${partD.t.toFixed(2)} → ${fmt2(L[3][0])}`;
  }
  ui.curveInfo.innerHTML = info + `<br>${segmentCount(B)} Bézier segments · ${K.length} Catmull–Rom points`;
}

async function main() {
  const report = runAll();
  showTests(report);

  const canvas = $('gfx');
  const r = await createRenderer(canvas);
  const meshes = {
    painting: r.mesh(quad(PAINTING.width, PAINTING.height), 'textured'),
    cube: r.mesh(cube()),
    pyramid: r.mesh(pyramid()),
    hillWall: r.dynamicMesh(4096),
  };
  const paintingTex = await r.texture(PAINTING.url);
  const ui = buildUI();

  let mainCam = null;
  attachMouse(canvas, () => ({ mainCam, aspect: r.aspect }));

  const crane = report.partB ? buildCrane() : null;
  if (crane) ui.tree.innerHTML = `<pre>${treeText(crane.root)}</pre>`;
  else ui.tree.innerHTML = '<span class="todo">write graph.js → updateWorld; the crane appears when the [B] tests pass</span>';

  let last = performance.now(), frameMs = 16.7;

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    frameMs = 0.9 * frameMs + 0.1 * (now - last);          // smoothed frame time
    last = now;
    if (app.animate) clock.t += dt;
    const t = clock.t;

    // ── cameras
    let viewProj;
    if (report.partC) {
      mainCam = mainCameraMatrices(camera, r.aspect);
      viewProj = app.view === 'inspect' ? inspectCameraMatrices(r.aspect).VP : mainCam.VP;
    } else {
      mainCam = null;
      viewProj = fallbackViewProj(r.aspect);
    }

    // ── scene
    const A = report.partA ? buildPartA() : null;
    if (crane) { animateCrane(crane, t); crane.root.updateWorld(); }

    r.begin(viewProj);
    r.drawTextured(meshes.painting, report.partA ? M.identity() : IDENTITY, paintingTex);
    if (A) for (const o of A.objects) r.drawMesh(meshes[o.mesh], o.model, o.colour);
    if (crane) crane.root.forEach(n => {
      if (n.mesh) r.drawMesh(meshes[n.mesh], n.world, n.colour);
      if (app.showAxes) drawAxes(r, n.world);
    });
    if (A && app.showAxes) drawAxes(r, partA.order === 'TRS' ? A.TRS : A.SRT, 0.2);

    // Part D: curves, plus a small pyramid that climbs the Bézier, pointing along its tangent
    if (app.showCurves && report.partA) drawCurves(r, report, t, ui);
    if (app.showCurves && report.partD && partD.animateAlong) {
      const { pos, tan } = alongBezier(curves.bezier, t * 0.08);
      const [x, y] = uvToWorld(pos);
      const angle = Math.atan2(-tan[1] * PAINTING.height, tan[0] * PAINTING.width);   // v points down in uv
      const model = composeTRS(M.translate(x, y, 0.05), M.rotateZ(angle - Math.PI / 2), M.scale(0.07, 0.07, 0.07));
      r.drawMesh(meshes.pyramid, model, [0.95, 0.25, 0.85, 1]);
      if (app.showAxes) drawAxes(r, model, 0.12);
    }

    // Bonus: the Catmull–Rom hill line swept along +z into a wall (an extrusion), rebuilt every frame
    if (app.showCurves && report.extrude && partD.extrude) {
      const line = sampleCatmull(curves.catmull, 12).map(uv => uvToWorld(uv, 0.002));
      r.updateMesh(meshes.hillWall, extrude(line, partD.depth));
      r.drawMesh(meshes.hillWall, M.identity(), [0.55, 0.62, 0.48, 1], true);
    }

    if (mainCam && app.view === 'inspect' && app.showFrustum && report.frustum) {
      for (const [a, b] of frustumLines(camera, mainCam.V, r.aspect)) r.line(a, b, [1, 0.85, 0.2], true);
    }
    const stats = r.end();

    // ── HUD
    ui.matrices.innerHTML = A
      ? `<div class="${partA.order === 'TRS' ? 'active' : ''}">T·R·S ${matrixHTML(A.TRS)}</div>` +
        `<div class="${partA.order === 'SRT' ? 'active' : ''}">S·R·T ${matrixHTML(A.SRT)}</div>`
      : '<span class="todo">matrices appear when the [A] tests pass</span>';
    if (crane) ui.leaf.innerHTML = `<div class="active">cargo.world (leaf) ${matrixHTML(crane.cargo.world, 3)}</div>`;

    ui.camInfo.innerHTML = mainCam
      ? `eye ${fmt3(mainCam.eye)}<br>target ${fmt3(camera.target)}<br>` +
        `fov ${camera.fov}° · near ${camera.near.toFixed(2)} · far ${camera.far.toFixed(1)}<br>` +
        `${camera.projection}` +
        (app.view === 'inspect' && !report.frustum ? '<br><span class="todo">write frustumCorners to see the frustum</span>' : '')
      : '<span class="todo">write lookAt + perspective</span>';

    $('readout').innerHTML =
      `frame ${frameMs.toFixed(2)} ms (${(1000 / frameMs).toFixed(0)} fps)<br>` +
      `vertices/frame ${stats.vertices} · draws ${stats.draws}<br>` +
      `canvas ${r.width}×${r.height} · view: ${app.view}`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch(err => {
  console.error(err);
  const e = $('error'); e.style.display = 'grid'; e.textContent = err.message;
});
