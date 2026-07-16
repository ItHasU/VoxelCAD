import type { GridBounds } from '../../voxel/grid';

export const code = `// Sphère de rayon 5 centrée sur l'origine.
function isInside(x: number, y: number, z: number): boolean {
  return x * x + y * y + z * z <= 25;
}
`;

export const bounds: GridBounds = {
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5,
  zMin: -5,
  zMax: 5,
  step: 0.5,
};
