// Part A — composition order.  ── YOU WRITE THESE TWO FUNCTIONS ──
// T, R, S are matrices you already built with translate / rotate / scale.
// Use M.multiply. Remember: with column vectors the RIGHT-most matrix acts first.

import * as M from '../math/mat4.js';

const TODO = name => { throw new Error(`TODO: compose.${name}`); };

/** M = T · R · S   (scale first, then rotate, then translate) */
export function composeTRS(T, R, S) { return M.multiply(T, M.multiply(R, S)); }

/** M = S · R · T   (translate first, then rotate, then scale) */
export function composeSRT(T, R, S) { return M.multiply(S, M.multiply(R, T)); }
