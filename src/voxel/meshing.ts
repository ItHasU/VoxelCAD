import { BufferAttribute, BufferGeometry } from 'three';
import { cellIndex, type GridBounds, type GridDimensions } from './grid';

/*
 * Extraction d'iso-surface par « Naive Surface Nets » (S. F. Gibson,
 * implémentation de M. Lysenko). Plutôt que d'émettre un cube plein par voxel
 * (aspect en marches d'escalier), on considère le champ scalaire signé aux
 * sommets de la grille — négatif à l'intérieur, positif à l'extérieur — et on
 * place UN sommet lissé par cellule traversée par la surface (isovaleur 0), au
 * barycentre des points d'intersection des arêtes. Les cellules voisines
 * partagent ce sommet : le maillage est naturellement soudé, donc les normales
 * moyennées donnent un rendu doux et triangulé.
 *
 * Quand la fonction fournit une vraie distance signée (API `vcad`), les
 * intersections sont interpolées et la surface est réellement lisse ; pour un
 * `isInside` booléen (±1), les sommets tombent aux milieux d'arêtes, ce qui
 * adoucit malgré tout l'aspect cubique.
 */

// Les 12 arêtes du cube, en paires de sommets (numérotés par bits x/y/z).
const cubeEdges = new Int32Array(24);
// Pour chaque configuration de 8 sommets (256), le masque des arêtes traversées.
const edgeTable = new Int32Array(256);

(function initTables(): void {
  let k = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 1; j <= 4; j <<= 1) {
      const p = i ^ j;
      if (i <= p) {
        cubeEdges[k++] = i;
        cubeEdges[k++] = p;
      }
    }
  }
  for (let i = 0; i < 256; i++) {
    let em = 0;
    for (let j = 0; j < 24; j += 2) {
      const a = (i & (1 << cubeEdges[j])) !== 0;
      const b = (i & (1 << cubeEdges[j + 1])) !== 0;
      em |= a !== b ? 1 << (j >> 1) : 0;
    }
    edgeTable[i] = em;
  }
})();

interface NetMesh {
  /** Positions des sommets en coordonnées de treillis (3 valeurs par sommet). */
  positions: number[];
  /** Indices des triangles. */
  indices: number[];
}

/**
 * Cœur Surface Nets : `data` est le champ signé rangé en x-major
 * (`i + j*dims[0] + k*dims[0]*dims[1]`), négatif à l'intérieur.
 */
function surfaceNets(data: Float32Array, dims: readonly [number, number, number]): NetMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const R: [number, number, number] = [1, dims[0] + 1, (dims[0] + 1) * (dims[1] + 1)];
  const buffer = new Int32Array(R[2] * 2);
  const grid = new Float32Array(8);
  const x = [0, 0, 0];
  let n = 0;
  let bufNo = 1;

  for (x[2] = 0; x[2] < dims[2] - 1; x[2]++, n += dims[0], bufNo ^= 1, R[2] = -R[2]) {
    // Pointeur dans le tampon circulaire (deux tranches en z).
    let m = 1 + (dims[0] + 1) * (1 + bufNo * (dims[1] + 1));

    for (x[1] = 0; x[1] < dims[1] - 1; x[1]++, n++, m += 2) {
      for (x[0] = 0; x[0] < dims[0] - 1; x[0]++, n++, m++) {
        // Lit les 8 sommets du cube courant et calcule le masque de signes.
        let mask = 0;
        let g = 0;
        let idx = n;
        for (let kk = 0; kk < 2; kk++, idx += dims[0] * (dims[1] - 2)) {
          for (let jj = 0; jj < 2; jj++, idx += dims[0] - 2) {
            for (let ii = 0; ii < 2; ii++, g++, idx++) {
              const p = data[idx];
              grid[g] = p;
              mask |= p < 0 ? 1 << g : 0;
            }
          }
        }

        // Cellule entièrement dedans ou dehors : pas de surface.
        if (mask === 0 || mask === 0xff) continue;

        const edgeMask = edgeTable[mask];
        const v = [0, 0, 0];
        let eCount = 0;

        for (let i = 0; i < 12; i++) {
          if (!(edgeMask & (1 << i))) continue;
          const e0 = cubeEdges[i << 1];
          const e1 = cubeEdges[(i << 1) + 1];
          const g0 = grid[e0];
          const g1 = grid[e1];
          const delta = g0 - g1;
          if (Math.abs(delta) <= 1e-6) continue;
          const t = g0 / delta;
          eCount++;
          for (let j = 0, mask2 = 1; j < 3; j++, mask2 <<= 1) {
            const a = e0 & mask2;
            const b = e1 & mask2;
            if (a !== b) {
              v[j] += a ? 1 - t : t;
            } else if (a) {
              v[j] += 1;
            }
          }
        }

        const s = 1 / eCount;
        for (let i = 0; i < 3; i++) v[i] = x[i] + s * v[i];

        buffer[m] = positions.length / 3;
        positions.push(v[0], v[1], v[2]);

        // Émet les faces (quads → 2 triangles) sur les 3 arêtes de base.
        for (let i = 0; i < 3; i++) {
          if (!(edgeMask & (1 << i))) continue;
          const iu = (i + 1) % 3;
          const iv = (i + 2) % 3;
          if (x[iu] === 0 || x[iv] === 0) continue;
          const du = R[iu];
          const dv = R[iv];
          const v0 = buffer[m];
          const vdu = buffer[m - du];
          const vdv = buffer[m - dv];
          const vduv = buffer[m - du - dv];
          // Enroulement orienté vers l'extérieur (champ négatif à l'intérieur).
          if (mask & 1) {
            indices.push(v0, vdu, vduv, v0, vduv, vdv);
          } else {
            indices.push(v0, vdv, vduv, v0, vduv, vdu);
          }
        }
      }
    }
  }

  return { positions, indices };
}

/**
 * Construit une géométrie lissée (triangulée, indexée, normales moyennées) à
 * partir du champ signé échantillonné aux sommets de la grille. Le champ est
 * entouré d'une bordure « extérieure » pour fermer proprement les volumes qui
 * atteignent le bord de la boîte.
 */
export function buildSmoothMesh(
  field: Float32Array,
  dims: GridDimensions,
  bounds: GridBounds,
): BufferGeometry {
  const { nx, ny, nz } = dims;
  const step = bounds.step;

  // Champ complété d'une cellule de bordure (valeur positive = extérieur).
  const pnx = nx + 2;
  const pny = ny + 2;
  const pnz = nz + 2;
  const padded = new Float32Array(pnx * pny * pnz);
  padded.fill(1);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      const src = (k * ny + j) * nx;
      const dst = ((k + 1) * pny + (j + 1)) * pnx + 1;
      for (let i = 0; i < nx; i++) padded[dst + i] = field[src + i];
    }
  }

  const { positions, indices } = surfaceNets(padded, [pnx, pny, pnz]);

  // Treillis (décalé d'une cellule par le padding) → coordonnées monde.
  const world = new Float32Array(positions.length);
  for (let p = 0; p < positions.length; p += 3) {
    world[p] = bounds.xMin + (positions[p] - 1) * step;
    world[p + 1] = bounds.yMin + (positions[p + 1] - 1) * step;
    world[p + 2] = bounds.zMin + (positions[p + 2] - 1) * step;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(world, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// --- Maillage cubique (« voxels ») -----------------------------------------

interface FaceSpec {
  di: number;
  dj: number;
  dk: number;
  normal: readonly [number, number, number];
  corners: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ];
}

// Coins en offsets unitaires (0/1), listés CCW vus de l'extérieur de la face,
// de sorte que (v1 - v0) x (v2 - v0) pointe le long de `normal`.
const FACES: readonly FaceSpec[] = [
  { di: 1, dj: 0, dk: 0, normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { di: -1, dj: 0, dk: 0, normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { di: 0, dj: 1, dk: 0, normal: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { di: 0, dj: -1, dk: 0, normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { di: 0, dj: 0, dk: 1, normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { di: 0, dj: 0, dk: -1, normal: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

/**
 * Maillage « voxel » historique : un cube plein (de la taille du pas) par
 * cellule intérieure (champ < 0), en n'émettant que les faces exposées à une
 * cellule vide ou hors grille. Aspect en marches d'escalier, faces carrées.
 */
export function buildBlockyMesh(
  field: Float32Array,
  dims: GridDimensions,
  bounds: GridBounds,
): BufferGeometry {
  const { nx, ny, nz } = dims;
  const step = bounds.step;

  function isFilled(i: number, j: number, k: number): boolean {
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return false;
    return field[cellIndex(dims, i, j, k)] < 0;
  }

  const positions: number[] = [];
  const normals: number[] = [];

  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (!isFilled(i, j, k)) continue;
        const ox = bounds.xMin + i * step;
        const oy = bounds.yMin + j * step;
        const oz = bounds.zMin + k * step;

        for (const face of FACES) {
          if (isFilled(i + face.di, j + face.dj, k + face.dk)) continue;

          const quad = face.corners.map(
            ([cx, cy, cz]) => [ox + cx * step, oy + cy * step, oz + cz * step] as const,
          );
          const [v0, v1, v2, v3] = quad;

          positions.push(...v0, ...v1, ...v2, ...v0, ...v2, ...v3);
          for (let n = 0; n < 6; n++) normals.push(...face.normal);
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  return geometry;
}

// --- Registre des modes de maillage ----------------------------------------

export type MeshingMode = 'smooth' | 'blocky';

export interface MeshingModeInfo {
  id: MeshingMode;
  label: string;
  build: (field: Float32Array, dims: GridDimensions, bounds: GridBounds) => BufferGeometry;
}

/**
 * Modes de maillage disponibles. Pour en ajouter un : écrire un `build(field,
 * dims, bounds)` et l'enregistrer ici (et étendre l'union `MeshingMode`).
 */
export const MESHING_MODES: readonly MeshingModeInfo[] = [
  { id: 'smooth', label: 'Lissé (Surface Nets)', build: buildSmoothMesh },
  { id: 'blocky', label: 'Cubes (voxels)', build: buildBlockyMesh },
];

export const DEFAULT_MESHING_MODE: MeshingMode = 'smooth';

/** Construit la géométrie selon le mode demandé (retombe sur le premier mode si inconnu). */
export function buildMesh(
  mode: MeshingMode,
  field: Float32Array,
  dims: GridDimensions,
  bounds: GridBounds,
): BufferGeometry {
  const info = MESHING_MODES.find((m) => m.id === mode) ?? MESHING_MODES[0];
  return info.build(field, dims, bounds);
}
