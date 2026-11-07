// Part A scene content: three objects in front of the painting, one of them
// driven by the UI, built with your translate / rotate / scale and compose.

import * as M from '../math/mat4.js';
import { composeTRS, composeSRT } from './compose.js';

export const partA = {
  tx: 0.55, ty: -0.45, tz: 0.45,       // translation (world units; painting is 2 high)
  axis: 'z', angle: 30,                // rotation axis + degrees
  scale: 0.25,
  order: 'TRS',                        // 'TRS' | 'SRT'
};
export const PART_A_DEFAULTS = { ...partA };

const rot = { x: M.rotateX, y: M.rotateY, z: M.rotateZ };
const rad = d => d * Math.PI / 180;

/** Returns the objects to draw plus both candidate matrices for the HUD. */
export function buildPartA() {
  const T = M.translate(partA.tx, partA.ty, partA.tz);
  const R = rot[partA.axis](rad(partA.angle));
  const S = M.scale(partA.scale, partA.scale, partA.scale);
  const TRS = composeTRS(T, R, S);
  const SRT = composeSRT(T, R, S);

  const objects = [
    // 1 — the UI-controlled object (a pyramid, so rotation is visible)
    { mesh: 'pyramid', model: partA.order === 'TRS' ? TRS : SRT, colour: [0.85, 0.35, 0.12, 1] },
    // 2 — a crate on the pier, left
    { mesh: 'cube', model: composeTRS(M.translate(-0.75, -0.55, 0.35), M.rotateY(rad(25)), M.scale(0.22, 0.22, 0.22)),
      colour: [0.55, 0.42, 0.28, 1] },
    // 3 — a buoy on the water, right
    { mesh: 'cube', model: composeTRS(M.translate(0.95, -0.2, 0.3), M.rotateZ(rad(45)), M.scale(0.12, 0.12, 0.12)),
      colour: [0.75, 0.15, 0.15, 1] },
  ];
  return { objects, T, R, S, TRS, SRT };
}
