import type { GridBounds } from '../../voxel/grid';

export const code = `// Opération booléenne : un cube MOINS une sphère.
// Un point est plein s'il est dans le cube ET hors de la sphère,
// ce qui creuse une cavité sphérique dans un coin du cube.
function isInside(x: number, y: number, z: number): boolean {
  const inCube = Math.abs(x) <= 4 && Math.abs(y) <= 4 && Math.abs(z) <= 4;

  // Sphère de rayon 5 centrée sur le coin (4, 4, 4) du cube.
  const dx = x - 4;
  const dy = y - 4;
  const dz = z - 4;
  const inSphere = dx * dx + dy * dy + dz * dz <= 25;

  return inCube && !inSphere;
}
`;

export const bounds: GridBounds = {
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5,
  zMin: -5,
  zMax: 5,
  step: 0.4,
};
