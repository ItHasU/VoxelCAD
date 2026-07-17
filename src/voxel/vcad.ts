/**
 * `vcad` — petite bibliothèque de géométrie constructive (CSG) pour écrire des
 * volumes de façon déclarative plutôt qu'avec un `isInside` manuel.
 *
 *     isInside = vcad.sphere(5).translate(2, 2, 2);
 *     isInside = vcad.cube(8).difference(vcad.sphere(5));
 *
 * Représentation : chaque `Solid` porte un champ de distance signée (SDF),
 * `distance(x, y, z)`, négatif à l'intérieur du volume et positif à l'extérieur.
 * Le `Solid` est lui-même appelable comme `(x, y, z) => boolean` (vrai quand
 * `distance <= 0`), il est donc directement assignable à `isInside`.
 *
 * Les opérations booléennes sont exactes du point de vue du signe (c'est tout ce
 * dont la voxelisation a besoin) : union = min, intersection = max,
 * différence = max(a, -b). Les transformations agissent en évaluant le SDF au
 * point transformé par la transformation inverse.
 */

/** Champ de distance signée : négatif dedans, positif dehors. */
export type Sdf = (x: number, y: number, z: number) => number;

export interface Solid {
  /** Vrai si le point (x, y, z) est à l'intérieur du volume. */
  (x: number, y: number, z: number): boolean;
  /** Distance signée au volume : < 0 dedans, 0 sur la surface, > 0 dehors. */
  distance(x: number, y: number, z: number): number;

  /** Déplace le solide de (dx, dy, dz). */
  translate(dx: number, dy: number, dz: number): Solid;
  /** Met à l'échelle uniformément (un argument) ou par axe (trois arguments). */
  scale(s: number): Solid;
  scale(sx: number, sy: number, sz: number): Solid;
  /** Rotation autour de l'axe X, en degrés. */
  rotateX(deg: number): Solid;
  /** Rotation autour de l'axe Y, en degrés. */
  rotateY(deg: number): Solid;
  /** Rotation autour de l'axe Z, en degrés. */
  rotateZ(deg: number): Solid;

  /** Union avec un ou plusieurs autres solides (ce qui est dans l'un OU l'autre). */
  union(...others: Solid[]): Solid;
  /** Intersection (ce qui est à la fois dans ce solide ET les autres). */
  intersection(...others: Solid[]): Solid;
  /** Soustraction des autres solides à celui-ci (creuse). */
  difference(...others: Solid[]): Solid;

  /** Ne garde qu'une coque d'épaisseur `thickness` autour de la surface. */
  shell(thickness: number): Solid;
  /** Arrondit les arêtes du rayon `radius` (gonfle le volume d'autant). */
  round(radius: number): Solid;
}

const DEG = Math.PI / 180;

/** Construit un `Solid` à partir de son champ de distance signée. */
function solid(sdf: Sdf): Solid {
  const s = ((x: number, y: number, z: number) => sdf(x, y, z) <= 0) as Solid;

  s.distance = sdf;

  s.translate = (dx, dy, dz) => solid((x, y, z) => sdf(x - dx, y - dy, z - dz));

  s.scale = (sx: number, sy?: number, sz?: number) => {
    const ax = sx;
    const ay = sy ?? sx;
    const az = sz ?? sx;
    // Compense la métrique pour rester une distance valide (borne inférieure).
    const k = Math.min(Math.abs(ax), Math.abs(ay), Math.abs(az));
    return solid((x, y, z) => sdf(x / ax, y / ay, z / az) * k);
  };

  s.rotateX = (deg) => {
    const c = Math.cos(deg * DEG);
    const sn = Math.sin(deg * DEG);
    return solid((x, y, z) => sdf(x, y * c + z * sn, -y * sn + z * c));
  };
  s.rotateY = (deg) => {
    const c = Math.cos(deg * DEG);
    const sn = Math.sin(deg * DEG);
    return solid((x, y, z) => sdf(x * c - z * sn, y, x * sn + z * c));
  };
  s.rotateZ = (deg) => {
    const c = Math.cos(deg * DEG);
    const sn = Math.sin(deg * DEG);
    return solid((x, y, z) => sdf(x * c + y * sn, -x * sn + y * c, z));
  };

  s.union = (...others) => union(s, ...others);
  s.intersection = (...others) => intersection(s, ...others);
  s.difference = (...others) => difference(s, ...others);

  s.shell = (thickness) => solid((x, y, z) => Math.abs(sdf(x, y, z)) - thickness / 2);
  s.round = (radius) => solid((x, y, z) => sdf(x, y, z) - radius);

  return s;
}

// ---------- Primitives (centrées sur l'origine) ----------

/** Sphère pleine de rayon `radius`. */
function sphere(radius: number): Solid {
  return solid((x, y, z) => Math.sqrt(x * x + y * y + z * z) - radius);
}

/** Boîte de dimensions `width` × `height` × `depth` (côtés complets). */
function box(width: number, height: number, depth: number): Solid {
  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;
  return solid((x, y, z) => {
    const qx = Math.abs(x) - hx;
    const qy = Math.abs(y) - hy;
    const qz = Math.abs(z) - hz;
    const outside = Math.sqrt(
      Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2 + Math.max(qz, 0) ** 2,
    );
    const inside = Math.min(Math.max(qx, qy, qz), 0);
    return outside + inside;
  });
}

/** Cube de côté `size`. */
function cube(size: number): Solid {
  return box(size, size, size);
}

/** Cylindre d'axe Y, de rayon `radius` et de hauteur totale `height`. */
function cylinder(radius: number, height: number): Solid {
  const hy = height / 2;
  return solid((x, y, z) => {
    const dr = Math.sqrt(x * x + z * z) - radius;
    const dy = Math.abs(y) - hy;
    const outside = Math.sqrt(Math.max(dr, 0) ** 2 + Math.max(dy, 0) ** 2);
    const inside = Math.min(Math.max(dr, dy), 0);
    return outside + inside;
  });
}

/** Tore d'axe Y : rayon `radius` du cercle central, rayon `tube` de la section. */
function torus(radius: number, tube: number): Solid {
  return solid((x, y, z) => {
    const q = Math.sqrt(x * x + z * z) - radius;
    return Math.sqrt(q * q + y * y) - tube;
  });
}

// ---------- Opérations booléennes ----------

/** Union : tout point à l'intérieur d'au moins un des solides. */
function union(...solids: Solid[]): Solid {
  const ds = solids.map((s) => s.distance);
  return solid((x, y, z) => {
    let m = Infinity;
    for (let i = 0; i < ds.length; i++) {
      const v = ds[i](x, y, z);
      if (v < m) m = v;
    }
    return m;
  });
}

/** Intersection : tout point à l'intérieur de tous les solides. */
function intersection(...solids: Solid[]): Solid {
  const ds = solids.map((s) => s.distance);
  return solid((x, y, z) => {
    let m = -Infinity;
    for (let i = 0; i < ds.length; i++) {
      const v = ds[i](x, y, z);
      if (v > m) m = v;
    }
    return m;
  });
}

/** Différence : le premier solide privé de tous les suivants. */
function difference(first: Solid, ...rest: Solid[]): Solid {
  const base = first.distance;
  const ds = rest.map((s) => s.distance);
  return solid((x, y, z) => {
    let m = base(x, y, z);
    for (let i = 0; i < ds.length; i++) {
      const v = -ds[i](x, y, z);
      if (v > m) m = v;
    }
    return m;
  });
}

/** Espace de noms exposé au code utilisateur dans le worker d'échantillonnage. */
export const vcad = {
  sphere,
  box,
  cube,
  cylinder,
  torus,
  union,
  intersection,
  difference,
};

export type Vcad = typeof vcad;
