/**
 * Déclarations ambiantes exposées à l'éditeur Monaco pour offrir autocomplétion
 * et vérification de types sur `vcad`, `Solid` et `isInside`, sans imposer
 * d'import à l'utilisateur. À garder en phase avec `src/voxel/vcad.ts`.
 */
export const VCAD_AMBIENT = `
/** Signature attendue par VoxelCAD : plein si la fonction renvoie true. */
type IsInside = (x: number, y: number, z: number) => boolean;

/**
 * Volume constructif. Appelable comme (x, y, z) => boolean (plein si distance <= 0),
 * donc directement assignable à isInside, et enrichi de méthodes chaînables.
 */
interface Solid {
  (x: number, y: number, z: number): boolean;
  /** Distance signee au volume : < 0 dedans, 0 sur la surface, > 0 dehors. */
  distance(x: number, y: number, z: number): number;

  /** Deplace le solide de (dx, dy, dz). */
  translate(dx: number, dy: number, dz: number): Solid;
  /** Echelle uniforme (un argument) ou par axe (trois arguments). */
  scale(s: number): Solid;
  scale(sx: number, sy: number, sz: number): Solid;
  /** Rotation autour de l'axe X, en degres. */
  rotateX(deg: number): Solid;
  /** Rotation autour de l'axe Y, en degres. */
  rotateY(deg: number): Solid;
  /** Rotation autour de l'axe Z, en degres. */
  rotateZ(deg: number): Solid;

  /** Union avec d'autres solides (dans l'un OU l'autre). */
  union(...others: Solid[]): Solid;
  /** Intersection (a la fois dans ce solide ET les autres). */
  intersection(...others: Solid[]): Solid;
  /** Soustrait les autres solides a celui-ci (creuse). */
  difference(...others: Solid[]): Solid;

  /** Ne garde qu'une coque d'epaisseur thickness autour de la surface. */
  shell(thickness: number): Solid;
  /** Arrondit les aretes du rayon radius. */
  round(radius: number): Solid;
}

/** Bibliotheque de geometrie constructive. */
declare const vcad: {
  /** Sphere pleine de rayon radius. */
  sphere(radius: number): Solid;
  /** Boite width x height x depth (cotes complets), centree sur l'origine. */
  box(width: number, height: number, depth: number): Solid;
  /** Cube de cote size. */
  cube(size: number): Solid;
  /** Cylindre d'axe Y, rayon radius, hauteur totale height. */
  cylinder(radius: number, height: number): Solid;
  /** Tore d'axe Y : rayon du cercle central, rayon de la section. */
  torus(radius: number, tube: number): Solid;
  /** Union de plusieurs solides. */
  union(...solids: Solid[]): Solid;
  /** Intersection de plusieurs solides. */
  intersection(...solids: Solid[]): Solid;
  /** Le premier solide prive de tous les suivants. */
  difference(first: Solid, ...rest: Solid[]): Solid;
};
`;
