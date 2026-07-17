import { describe, expect, it } from 'vitest';
import {
  cellCoords,
  cellIndex,
  checkVoxelCount,
  computeDimensions,
  forEachCell,
  indexToCell,
  voxelCount,
} from './grid';

describe('computeDimensions', () => {
  it('computes nx/ny/nz from bounds and step', () => {
    const dims = computeDimensions({
      xMin: 0,
      xMax: 2,
      yMin: 0,
      yMax: 2,
      zMin: 0,
      zMax: 2,
      step: 1,
    });
    expect(dims).toEqual({ nx: 3, ny: 3, nz: 3 });
  });

  it('returns a single voxel on a degenerate (zero-size) axis range', () => {
    const dims = computeDimensions({
      xMin: 5,
      xMax: 5,
      yMin: 0,
      yMax: 0,
      zMin: 0,
      zMax: 0,
      step: 1,
    });
    expect(dims).toEqual({ nx: 1, ny: 1, nz: 1 });
  });

  it('returns an empty grid when max < min on any axis', () => {
    const dims = computeDimensions({
      xMin: 5,
      xMax: 0,
      yMin: 0,
      yMax: 1,
      zMin: 0,
      zMax: 1,
      step: 1,
    });
    expect(voxelCount(dims)).toBe(0);
  });

  it('throws on a non-positive step', () => {
    expect(() =>
      computeDimensions({ xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1, step: 0 }),
    ).toThrow();
  });
});

describe('cellIndex / indexToCell', () => {
  it('round-trips indices for every cell in a small grid', () => {
    const dims = { nx: 2, ny: 3, nz: 4 };
    for (let k = 0; k < dims.nz; k++) {
      for (let j = 0; j < dims.ny; j++) {
        for (let i = 0; i < dims.nx; i++) {
          const index = cellIndex(dims, i, j, k);
          expect(indexToCell(dims, index)).toEqual({ i, j, k });
        }
      }
    }
  });
});

describe('cellCoords', () => {
  it('maps cell indices to world coordinates using the bounds origin and step', () => {
    const bounds = { xMin: -1, xMax: 1, yMin: 0, yMax: 2, zMin: 5, zMax: 7, step: 0.5 };
    expect(cellCoords(bounds, 0, 0, 0)).toEqual({ x: -1, y: 0, z: 5 });
    expect(cellCoords(bounds, 2, 1, 3)).toEqual({ x: 0, y: 0.5, z: 6.5 });
  });
});

describe('forEachCell', () => {
  it('visits nx*ny*nz cells exactly once each, in index order', () => {
    const dims = computeDimensions({
      xMin: 0,
      xMax: 1,
      yMin: 0,
      yMax: 1,
      zMin: 0,
      zMax: 1,
      step: 1,
    });
    const seen: number[] = [];
    forEachCell(dims, (_i, _j, _k, index) => {
      seen.push(index);
    });
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('does not invoke the callback for an empty grid', () => {
    const dims = { nx: 0, ny: 3, nz: 3 };
    const calls: number[] = [];
    forEachCell(dims, (_i, _j, _k, index) => calls.push(index));
    expect(calls).toEqual([]);
  });
});

describe('checkVoxelCount', () => {
  it('flags warn only above the threshold, never blocks', () => {
    expect(checkVoxelCount(10, 100)).toBe('ok');
    expect(checkVoxelCount(500, 100)).toBe('warn');
    expect(checkVoxelCount(5_000_000, 100)).toBe('warn');
  });
});
