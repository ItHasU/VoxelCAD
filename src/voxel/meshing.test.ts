import { describe, expect, it } from 'vitest';
import { computeDimensions, type GridDimensions } from './grid';
import { buildVoxelMesh } from './meshing';

function makeFilled(
  dims: GridDimensions,
  predicate: (i: number, j: number, k: number) => boolean,
): Uint8Array {
  const filled = new Uint8Array(dims.nx * dims.ny * dims.nz);
  let index = 0;
  for (let k = 0; k < dims.nz; k++) {
    for (let j = 0; j < dims.ny; j++) {
      for (let i = 0; i < dims.nx; i++) {
        filled[index] = predicate(i, j, k) ? 1 : 0;
        index++;
      }
    }
  }
  return filled;
}

describe('buildVoxelMesh', () => {
  it('emits 6 faces (12 triangles) for a single filled voxel', () => {
    const bounds = { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0, step: 1 };
    const dims = computeDimensions(bounds);
    const filled = makeFilled(dims, () => true);

    const geometry = buildVoxelMesh(filled, dims, bounds);

    expect(geometry.getAttribute('position').count).toBe(6 * 6);
  });

  it('culls internal faces for a fully filled 2x2x2 grid', () => {
    const bounds = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1, step: 1 };
    const dims = computeDimensions(bounds);
    const filled = makeFilled(dims, () => true);

    const geometry = buildVoxelMesh(filled, dims, bounds);

    // 6 sides of the outer cube, each made of 2x2 unit faces = 24 exposed faces.
    expect(geometry.getAttribute('position').count).toBe(24 * 6);
  });

  it('produces no geometry for an entirely empty grid', () => {
    const bounds = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1, step: 1 };
    const dims = computeDimensions(bounds);
    const filled = makeFilled(dims, () => false);

    const geometry = buildVoxelMesh(filled, dims, bounds);

    expect(geometry.getAttribute('position').count).toBe(0);
  });

  it('only culls the shared face between two adjacent filled voxels', () => {
    const bounds = { xMin: 0, xMax: 1, yMin: 0, yMax: 0, zMin: 0, zMax: 0, step: 1 };
    const dims = computeDimensions(bounds);
    const filled = makeFilled(dims, () => true);

    const geometry = buildVoxelMesh(filled, dims, bounds);

    // 2 voxels * 6 faces - 2 shared internal faces = 10 exposed faces.
    expect(geometry.getAttribute('position').count).toBe(10 * 6);
  });
});
