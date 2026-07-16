import type { GridBounds } from '../../voxel/grid';

export const code = `// Cylindre : disque de rayon 4 dans le plan XZ, hauteur sur Y.
function isInside(x: number, y: number, z: number): boolean {
  const inDisc = x * x + z * z <= 16;
  const inHeight = y >= -4 && y <= 4;
  return inDisc && inHeight;
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
