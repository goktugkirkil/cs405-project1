// CS405 Project 1 — application entry point.
// Wires maths (src/math), rendering (src/gpu), scene (src/scene) and UI (src/ui) together.

import * as M from './math/mat4.js';
import * as V from './math/vec3.js';
import { runAll } from './math/tests.js';
import { createRenderer } from './gpu/renderer.js';
import { cube, pyramid, quad } from './scene/geometry.js';
import { partA, PART_A_DEFAULTS, buildPartA } from './scene/partA.js';
import { buildCrane, animateCrane, treeText } from './scene/partB.js';
import { camera, CAMERA_DEFAULTS, mainCameraMatrices, inspectCameraMatrices, frustumLines } from './scene/camera.js';
import { createPanel, matrixHTML } from './ui/panel.js';

export const PAINTING = {
  artist: 'Hoca Ali Rıza', title: 'Moda İskelesi', url: '/moda.jpg',
  pxW: 900, pxH: 737,
  height: 2,                                // world units; the painting hangs in the z = 0 plane
};
PAINTING.width = PAINTING.height * PAINTING.pxW / PAINTING.pxH;

const $ = id => document.getElementById(id);

// App-level switches (UI writes into these).
const app = {
  view: 'main',          // 'main' | 'inspect'
  showAxes: false,       // Part B debug: local axes of every scene-graph node
  showFrustum: true,     // Part C: main camera frustum, visible from the inspection camera
  animate: true,
};
const APP_DEFAULTS = { ...app };

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
  ui.html('hint').textContent = 'drag the canvas to orbit · wheel to zoom';
  const camInfo = ui.html('caminfo');

  ui.section('Debug');
  keep(ui.checkbox('axes', app, 'showAxes'));
  keep(ui.checkbox('frustum', app, 'showFrustum'));
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

  ui.section('Scene');
  ui.button('reset scene', () => {
    Object.assign(partA, PART_A_DEFAULTS);
    Object.assign(app, APP_DEFAULTS);
    Object.assign(camera, structuredClone(CAMERA_DEFAULTS));
    refreshers.forEach(r => r.refresh());
  });

  return { matrices, camInfo, tree, leaf };
}

// ── mouse: orbit the main camera
function attachOrbit(canvas) {
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    camera.yaw   -= (e.clientX - drag.x) * 0.3;
    camera.pitch  = Math.max(-85, Math.min(85, camera.pitch + (e.clientY - drag.y) * 0.3));
    drag = { x: e.clientX, y: e.clientY };
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
const fmt3 = v => `(${v.map(x => x.toFixed(2)).join(', ')})`;

async function main() {
  const report = runAll();
  showTests(report);

  const canvas = $('gfx');
  const r = await createRenderer(canvas);
  const meshes = {
    painting: r.mesh(quad(PAINTING.width, PAINTING.height), 'textured'),
    cube: r.mesh(cube()),
    pyramid: r.mesh(pyramid()),
  };
  const paintingTex = await r.texture(PAINTING.url);
  const ui = buildUI();
  attachOrbit(canvas);

  const crane = report.partB ? buildCrane() : null;
  if (crane) ui.tree.innerHTML = `<pre>${treeText(crane.root)}</pre>`;
  else ui.tree.innerHTML = '<span class="todo">write graph.js → updateWorld; the crane appears when the [B] tests pass</span>';

  let last = performance.now(), frameMs = 16.7, t = 0;

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    frameMs = 0.9 * frameMs + 0.1 * (now - last);          // smoothed frame time
    last = now;
    if (app.animate) t += dt;

    // ── cameras
    let mainCam = null, viewProj;
    if (report.partC) {
      mainCam = mainCameraMatrices(camera, r.aspect);
      viewProj = app.view === 'inspect' ? inspectCameraMatrices(r.aspect).VP : mainCam.VP;
    } else {
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
