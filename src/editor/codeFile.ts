import { downloadBlob } from '../export/download';
import type { GridBounds } from '../voxel/grid';
import { isBounds } from '../ui/session';

/*
 * Fichier `.ts` exporté : un en-tête de métadonnées en commentaires précède le
 * code `isInside`. Toutes les lignes gérées commencent par `// voxelcad:` (pour
 * pouvoir les retirer proprement au rechargement), dont une ligne
 * `// voxelcad:meta {…}` lisible par la machine. Les anciens fichiers ne
 * portant qu'un `// voxelcad:bounds {…}` restent pris en charge.
 */
const APP_TAG = 'VoxelCAD';
const META_VERSION = 1;

// Toute ligne de marqueur géré (en-tête à retirer du code).
const MARKER_REGEX = /^\s*\/\/\s*voxelcad:/i;
const META_REGEX = /^\s*\/\/\s*voxelcad:meta\s*(\{.*\})\s*$/i;
// Ancien format : bornes seules.
const BOUNDS_REGEX = /^\s*\/\/\s*voxelcad:bounds\s*(\{.*\})\s*$/i;

export interface FileMeta {
  bounds: GridBounds;
  meshingMode?: string;
  displayMode?: string;
  name?: string;
}

function formatDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function serializeHeader(meta: FileMeta): string {
  const { bounds } = meta;
  const now = new Date();
  const payload = {
    app: APP_TAG,
    version: META_VERSION,
    exported: now.toISOString(),
    name: meta.name,
    bounds,
    meshingMode: meta.meshingMode,
    displayMode: meta.displayMode,
  };
  const summary =
    `X[${bounds.xMin}, ${bounds.xMax}] Y[${bounds.yMin}, ${bounds.yMax}] ` +
    `Z[${bounds.zMin}, ${bounds.zMax}] · pas ${bounds.step}` +
    (meta.meshingMode ? ` · maillage ${meta.meshingMode}` : '') +
    (meta.displayMode ? ` · affichage ${meta.displayMode}` : '');
  return [
    `// voxelcad: ${APP_TAG} — fonction isInside exportée le ${formatDate(now)}`,
    meta.name ? `// voxelcad: modèle « ${meta.name} »` : null,
    `// voxelcad: ${summary}`,
    `// voxelcad:meta ${JSON.stringify(payload)}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

/** Retire l'en-tête de métadonnées (toutes les lignes `// voxelcad:`) du code. */
function stripHeader(code: string): string {
  return code
    .split('\n')
    .filter((line) => !MARKER_REGEX.test(line))
    .join('\n')
    .replace(/^\n+/, '');
}

function parseBounds(json: string): GridBounds | null {
  try {
    const raw = JSON.parse(json) as unknown;
    return isBounds(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Extrait les métadonnées d'un fichier chargé, ou `null` si absentes/invalides. */
export function parseMeta(content: string): FileMeta | null {
  const lines = content.split('\n');

  // Format actuel : ligne `voxelcad:meta {…}`.
  for (const line of lines) {
    const match = line.match(META_REGEX);
    if (!match) continue;
    try {
      const raw = JSON.parse(match[1]) as Record<string, unknown>;
      if (isBounds(raw.bounds)) {
        return {
          bounds: raw.bounds,
          meshingMode: typeof raw.meshingMode === 'string' ? raw.meshingMode : undefined,
          displayMode: typeof raw.displayMode === 'string' ? raw.displayMode : undefined,
          name: typeof raw.name === 'string' ? raw.name : undefined,
        };
      }
    } catch {
      // Marqueur mal formé : on continue.
    }
  }

  // Repli : ancien marqueur `voxelcad:bounds {…}`.
  for (const line of lines) {
    const match = line.match(BOUNDS_REGEX);
    if (!match) continue;
    const bounds = parseBounds(match[1]);
    if (bounds) return { bounds };
  }

  return null;
}

export interface LoadedCode {
  code: string;
  meta: FileMeta | null;
}

/** Sépare le code (sans en-tête) des métadonnées d'un fichier chargé. */
export function splitLoadedCode(fileContent: string): LoadedCode {
  return { code: stripHeader(fileContent), meta: parseMeta(fileContent) };
}

/**
 * Enregistre le code `isInside` dans un fichier `.ts` téléchargé, précédé d'un
 * en-tête de métadonnées (bornes, modes de maillage/affichage, nom, date).
 */
export function saveCode(code: string, meta: FileMeta, filename: string): void {
  const content = `${serializeHeader(meta)}\n${stripHeader(code)}`;
  downloadBlob(content, filename, 'text/typescript');
}

/**
 * Ouvre un sélecteur de fichier et renvoie son contenu texte (`.ts` / `.txt`),
 * ou `null` si l'utilisateur annule.
 */
export function loadCodeFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ts,.txt,text/plain,text/typescript';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    });
    input.click();
  });
}
