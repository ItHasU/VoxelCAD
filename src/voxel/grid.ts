export interface GridBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
  step: number;
}

export interface GridDimensions {
  nx: number;
  ny: number;
  nz: number;
}

const EPSILON = 1e-9;

function axisCount(min: number, max: number, step: number): number {
  if (max < min) return 0;
  return Math.floor((max - min) / step + EPSILON) + 1;
}

export function computeDimensions(bounds: GridBounds): GridDimensions {
  const { xMin, xMax, yMin, yMax, zMin, zMax, step } = bounds;
  if (!(step > 0)) {
    throw new Error('step must be > 0');
  }
  return {
    nx: axisCount(xMin, xMax, step),
    ny: axisCount(yMin, yMax, step),
    nz: axisCount(zMin, zMax, step),
  };
}

export function voxelCount(dims: GridDimensions): number {
  return dims.nx * dims.ny * dims.nz;
}

/** Flat index for cell (i, j, k) in a grid of the given dimensions (x-major, then y, then z). */
export function cellIndex(dims: GridDimensions, i: number, j: number, k: number): number {
  return i + j * dims.nx + k * dims.nx * dims.ny;
}

export function indexToCell(
  dims: GridDimensions,
  index: number,
): { i: number; j: number; k: number } {
  const i = index % dims.nx;
  const j = Math.floor(index / dims.nx) % dims.ny;
  const k = Math.floor(index / (dims.nx * dims.ny));
  return { i, j, k };
}

export function cellCoords(
  bounds: GridBounds,
  i: number,
  j: number,
  k: number,
): { x: number; y: number; z: number } {
  return {
    x: bounds.xMin + i * bounds.step,
    y: bounds.yMin + j * bounds.step,
    z: bounds.zMin + k * bounds.step,
  };
}

export function forEachCell(
  dims: GridDimensions,
  callback: (i: number, j: number, k: number, index: number) => void,
): void {
  let index = 0;
  for (let k = 0; k < dims.nz; k++) {
    for (let j = 0; j < dims.ny; j++) {
      for (let i = 0; i < dims.nx; i++) {
        callback(i, j, k, index);
        index++;
      }
    }
  }
}

export const DEFAULT_VOXEL_WARN_THRESHOLD = 500_000;

export type VoxelCountStatus = 'ok' | 'warn';

/**
 * Évalue le nombre de voxels : `warn` au-delà du seuil (calcul potentiellement
 * long), sinon `ok`. Aucun blocage — l'utilisateur reste libre de générer.
 */
export function checkVoxelCount(
  total: number,
  warnThreshold: number = DEFAULT_VOXEL_WARN_THRESHOLD,
): VoxelCountStatus {
  return total > warnThreshold ? 'warn' : 'ok';
}
