// Part B — scene graph.
// A Node has a LOCAL transform (relative to its parent), a parent, children,
// and a WORLD transform (relative to the scene) that is computed by traversal:
//
//     world(node) = world(parent) · local(node)          (root: world = local)
//
// Nodes may carry a mesh to draw; nodes without one only group/move their children.

import * as M from '../math/mat4.js';

const TODO = name => { throw new Error(`TODO: graph.${name}`); };

export class Node {
  constructor(name, { local = M.identity(), mesh = null, colour = [0.8, 0.8, 0.8, 1] } = {}) {
    this.name = name;
    this.local = local;        // Float32Array(16), set every frame for animated nodes
    this.world = M.identity(); // filled in by updateWorld()
    this.parent = null;
    this.children = [];
    this.mesh = mesh;          // 'cube' | 'pyramid' | null
    this.colour = colour;
  }

  /** Attach `child` under this node and return the child (so calls can be chained). */
  add(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  // ── YOU WRITE THIS ──────────────────────────────────────────────────
  /**
   * Compute this.world from parentWorld and this.local, then do the same for
   * every child, passing this node's world matrix down. Call it on the root
   * with no argument (a root has no parent, so its world is just its local).
   */
  updateWorld(parentWorld = null) {
    this.world = parentWorld ? M.multiply(parentWorld, this.local) : this.local;
    for (const child of this.children) child.updateWorld(this.world);
  }
  // ────────────────────────────────────────────────────────────────────

  /** Visit this node and all descendants (depth-first, parent before children). */
  forEach(fn, depth = 0) {
    fn(this, depth);
    for (const c of this.children) c.forEach(fn, depth + 1);
  }
}
