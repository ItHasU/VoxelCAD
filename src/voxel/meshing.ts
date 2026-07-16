import { BufferAttribute, BufferGeometry } from 'three';
import { cellIndex, type GridBounds, type GridDimensions } from './grid';

interface FaceSpec {
  di: number;
  dj: number;
  dk: number;
  normal: readonly [number, number, number];
  corners: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ];
}

// Corners are unit-cube offsets (0 or 1) listed CCW as seen from outside the face,
// so that (v1 - v0) x (v2 - v0) points along `normal`.
const FACES: readonly FaceSpec[] = [
  {
    di: 1,
    dj: 0,
    dk: 0,
    normal: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    di: -1,
    dj: 0,
    dk: 0,
    normal: [-1, 0, 0],
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    di: 0,
    dj: 1,
    dk: 0,
    normal: [0, 1, 0],
    corners: [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
  },
  {
    di: 0,
    dj: -1,
    dk: 0,
    normal: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    di: 0,
    dj: 0,
    dk: 1,
    normal: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  {
    di: 0,
    dj: 0,
    dk: -1,
    normal: [0, 0, -1],
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
];

/**
 * Builds a single merged BufferGeometry from a filled/empty voxel grid, emitting
 * only faces exposed to an empty (or out-of-grid) neighbor.
 */
export function buildVoxelMesh(
  filled: Uint8Array,
  dims: GridDimensions,
  bounds: GridBounds,
): BufferGeometry {
  const { nx, ny, nz } = dims;
  const step = bounds.step;

  function isFilled(i: number, j: number, k: number): boolean {
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return false;
    return filled[cellIndex(dims, i, j, k)] !== 0;
  }

  const positions: number[] = [];
  const normals: number[] = [];

  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (!isFilled(i, j, k)) continue;
        const ox = bounds.xMin + i * step;
        const oy = bounds.yMin + j * step;
        const oz = bounds.zMin + k * step;

        for (const face of FACES) {
          if (isFilled(i + face.di, j + face.dj, k + face.dk)) continue;

          const quad = face.corners.map(
            ([cx, cy, cz]) => [ox + cx * step, oy + cy * step, oz + cz * step] as const,
          );
          const [v0, v1, v2, v3] = quad;

          positions.push(...v0, ...v1, ...v2, ...v0, ...v2, ...v3);
          for (let n = 0; n < 6; n++) normals.push(...face.normal);
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  return geometry;
}
