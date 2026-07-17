import { describe, expect, it } from 'vitest';
import { computeDimensions, type GridBounds, type GridDimensions } from './grid';
import { buildSmoothMesh } from './meshing';

/** Échantillonne un champ signé (négatif dedans) aux sommets de la grille. */
function makeField(
  dims: GridDimensions,
  bounds: GridBounds,
  sdf: (x: number, y: number, z: number) => number,
): Float32Array {
  const field = new Float32Array(dims.nx * dims.ny * dims.nz);
  let index = 0;
  for (let k = 0; k < dims.nz; k++) {
    for (let j = 0; j < dims.ny; j++) {
      for (let i = 0; i < dims.nx; i++) {
        field[index++] = sdf(
          bounds.xMin + i * bounds.step,
          bounds.yMin + j * bounds.step,
          bounds.zMin + k * bounds.step,
        );
      }
    }
  }
  return field;
}

describe('buildSmoothMesh', () => {
  it('produces no geometry for an entirely-outside field', () => {
    const bounds: GridBounds = { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -2, zMax: 2, step: 1 };
    const dims = computeDimensions(bounds);
    const field = makeField(dims, bounds, () => 1);

    const geometry = buildSmoothMesh(field, dims, bounds);

    expect(geometry.getAttribute('position').count).toBe(0);
    expect(geometry.getIndex()?.count ?? 0).toBe(0);
  });

  it('extracts a closed, triangulated surface for a sphere field', () => {
    const bounds: GridBounds = { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -3, zMax: 3, step: 0.5 };
    const dims = computeDimensions(bounds);
    // Sphère de rayon 2, bien à l'intérieur des bornes (surface fermée).
    const field = makeField(dims, bounds, (x, y, z) => Math.hypot(x, y, z) - 2);

    const geometry = buildSmoothMesh(field, dims, bounds);
    const index = geometry.getIndex();

    expect(index).not.toBeNull();
    expect(index!.count).toBeGreaterThan(0);
    expect(index!.count % 3).toBe(0); // uniquement des triangles
    expect(geometry.getAttribute('normal')).toBeTruthy();

    // Chaque sommet doit rester dans la boîte (rayon ~2, largement borné).
    const pos = geometry.getAttribute('position');
    for (let v = 0; v < pos.count; v++) {
      expect(Math.abs(pos.getX(v))).toBeLessThanOrEqual(3.5);
      expect(Math.abs(pos.getY(v))).toBeLessThanOrEqual(3.5);
      expect(Math.abs(pos.getZ(v))).toBeLessThanOrEqual(3.5);
    }
  });

  it('winds triangles so face normals point outward', () => {
    const bounds: GridBounds = { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -3, zMax: 3, step: 0.5 };
    const dims = computeDimensions(bounds);
    const field = makeField(dims, bounds, (x, y, z) => Math.hypot(x, y, z) - 2);

    const geometry = buildSmoothMesh(field, dims, bounds);
    const pos = geometry.getAttribute('position');
    const index = geometry.getIndex()!;

    let outward = 0;
    const tris = index.count / 3;
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t);
      const b = index.getX(t + 1);
      const c = index.getX(t + 2);
      const ax = pos.getX(a),
        ay = pos.getY(a),
        az = pos.getZ(a);
      const bx = pos.getX(b),
        by = pos.getY(b),
        bz = pos.getZ(b);
      const cx = pos.getX(c),
        cy = pos.getY(c),
        cz = pos.getZ(c);
      // Normale géométrique (b-a) x (c-a).
      const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      // Direction radiale sortante au barycentre (centre = origine).
      const rx = (ax + bx + cx) / 3;
      const ry = (ay + by + cy) / 3;
      const rz = (az + bz + cz) / 3;
      if (nx * rx + ny * ry + nz * rz > 0) outward++;
    }
    // La grande majorité des faces doit pointer vers l'extérieur.
    expect(outward / tris).toBeGreaterThan(0.95);
  });

  it('vertices approximate the target isosurface radius', () => {
    const bounds: GridBounds = { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -3, zMax: 3, step: 0.25 };
    const dims = computeDimensions(bounds);
    const field = makeField(dims, bounds, (x, y, z) => Math.hypot(x, y, z) - 2);

    const geometry = buildSmoothMesh(field, dims, bounds);
    const pos = geometry.getAttribute('position');

    let sum = 0;
    for (let v = 0; v < pos.count; v++) {
      sum += Math.hypot(pos.getX(v), pos.getY(v), pos.getZ(v));
    }
    const meanRadius = sum / pos.count;
    // La surface interpolée doit être proche du rayon 2 (à ~un pas près).
    expect(meanRadius).toBeGreaterThan(1.8);
    expect(meanRadius).toBeLessThan(2.2);
  });
});
