// Part B scene content: a small harbour crane standing on the pier.
//
//   crane (root, on the pier)
//   ├── tower            mesh
//   └── jib              animated: slews around the tower (rotateY)
//       ├── jibBeam      mesh
//       └── hook         end of the jib
//           ├── cable    mesh
//           └── cargo    mesh, animated: spins on the cable
//
// 7 nodes, 4 levels (crane → jib → hook → cargo).

import * as M from '../math/mat4.js';
import { Node } from './graph.js';
import { composeTRS } from './compose.js';

const I = () => M.identity();

export function buildCrane() {
  const crane = new Node('crane', { local: M.translate(-0.2, -0.85, 0.75) });
  crane.add(new Node('tower', {
    local: composeTRS(M.translate(0, 0.32, 0), I(), M.scale(0.05, 0.64, 0.05)),
    mesh: 'cube', colour: [0.30, 0.32, 0.36, 1] }));
  const jib = crane.add(new Node('jib'));
  jib.add(new Node('jibBeam', {
    local: composeTRS(M.translate(0.17, 0, 0), I(), M.scale(0.50, 0.035, 0.035)),
    mesh: 'cube', colour: [0.85, 0.65, 0.15, 1] }));
  const hook = jib.add(new Node('hook', { local: M.translate(0.38, 0, 0) }));
  hook.add(new Node('cable', {
    local: composeTRS(M.translate(0, -0.09, 0), I(), M.scale(0.008, 0.18, 0.008)),
    mesh: 'cube', colour: [0.15, 0.15, 0.15, 1] }));
  const cargo = hook.add(new Node('cargo', { mesh: 'cube', colour: [0.62, 0.30, 0.18, 1] }));
  return { root: crane, jib, cargo };
}

/** Set the animated local transforms for time t (seconds). */
export function animateCrane(crane, t) {
  crane.jib.local = composeTRS(M.translate(0, 0.64, 0), M.rotateY(0.6 * t), I());
  crane.cargo.local = composeTRS(M.translate(0, -0.22, 0), M.rotateY(-1.5 * t), M.scale(0.09, 0.09, 0.09));
}

/** Indented text listing of the tree, for the UI and the report diagram. */
export function treeText(root) {
  const lines = [];
  root.forEach((n, d) => lines.push(`${'  '.repeat(d)}${d ? '└ ' : ''}${n.name}${n.mesh ? '' : ' ·'}`));
  return lines.join('\n');
}
