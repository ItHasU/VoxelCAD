import type { GridBounds } from '../../voxel/grid';

export const code = `// Cube plein : tout point de la grille est à l'intérieur.
function isInside(x: number, y: number, z: number): boolean {
  return Math.abs(x) <= 4 && Math.abs(y) <= 4 && Math.abs(z) <= 4;
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
