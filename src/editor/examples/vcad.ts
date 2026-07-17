import type { GridBounds } from '../../voxel/grid';

export const code = `// API vcad : on compose des formes plutôt que d'écrire isInside à la main.
// Chaque forme est un champ de distance signée ; les opérations booléennes et
// les transformations se chaînent. Le résultat est directement assignable à
// isInside (plein la ou la distance est <= 0).
//
// Ici : un cube aux aretes arrondies, evide par une sphere, ceint d'un tore.
const isInside = vcad
  .cube(8)
  .round(0.6)
  .difference(vcad.sphere(5.2))
  .union(vcad.torus(4, 1).rotateX(90));
`;

export const bounds: GridBounds = {
  xMin: -6,
  xMax: 6,
  yMin: -6,
  yMax: 6,
  zMin: -6,
  zMax: 6,
  step: 0.35,
};
