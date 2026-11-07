// The painting this project is built around, and the mapping between
// normalised image coordinates and the world plane it hangs in.

export const PAINTING = {
  artist: 'Hoca Ali Rıza', title: 'Moda İskelesi', url: '/moda.jpg',
  pxW: 900, pxH: 737,
  height: 2,                                // world units; the painting hangs in the z = 0 plane
};
PAINTING.width = PAINTING.height * PAINTING.pxW / PAINTING.pxH;

/**
 * Normalised image coordinates: u = x / width (0 left → 1 right), v = y / height (0 top → 1 bottom).
 * Curves live slightly in front of the canvas (z) so they never z-fight with it.
 */
export const CURVE_Z = 0.004;
export function uvToWorld([u, v], z = CURVE_Z) {
  return [(u - 0.5) * PAINTING.width, (0.5 - v) * PAINTING.height, z];
}
export function worldToUv([x, y]) {
  return [x / PAINTING.width + 0.5, 0.5 - y / PAINTING.height];
}
