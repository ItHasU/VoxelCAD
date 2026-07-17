import { downloadBlob } from '../export/download';
import type { GridBounds } from '../voxel/grid';

// Marqueur de métadonnées inséré en tête du fichier exporté. Lisible et
// parseable : les bornes sont réappliquées au formulaire lors du chargement.
const BOUNDS_PREFIX = '// voxelcad:bounds';
const BOUNDS_REGEX = /^\/\/\s*voxelcad:bounds\s*(\{.*\})\s*$/;

function serializeBounds(bounds: GridBounds): string {
  return `${BOUNDS_PREFIX} ${JSON.stringify(bounds)}`;
}

/** Retire toute ligne de marqueur de bornes du code. */
function stripBoundsComment(code: string): string {
  return code
    .split('\n')
    .filter((line) => !BOUNDS_REGEX.test(line))
    .join('\n')
    .replace(/^\n+/, '');
}

/** Extrait les bornes du commentaire de métadonnées, ou `null` si absent/invalide. */
export function parseBoundsComment(code: string): GridBounds | null {
  for (const line of code.split('\n')) {
    const match = line.match(BOUNDS_REGEX);
    if (!match) continue;
    try {
      const raw = JSON.parse(match[1]) as Record<string, unknown>;
      const keys: (keyof GridBounds)[] = [
        'xMin',
        'xMax',
        'yMin',
        'yMax',
        'zMin',
        'zMax',
        'step',
      ];
      if (keys.every((k) => typeof raw[k] === 'number' && Number.isFinite(raw[k]))) {
        return raw as unknown as GridBounds;
      }
    } catch {
      // Marqueur mal formé : on l'ignore.
    }
  }
  return null;
}

export interface LoadedCode {
  code: string;
  bounds: GridBounds | null;
}

/** Sépare le code (sans marqueur) des bornes contenues dans un fichier chargé. */
export function splitLoadedCode(fileContent: string): LoadedCode {
  return { code: stripBoundsComment(fileContent), bounds: parseBoundsComment(fileContent) };
}

/**
 * Enregistre le code `isInside` dans un fichier `.ts` téléchargé, précédé d'un
 * commentaire décrivant la bounding box (bornes + pas) courante.
 */
export function saveCode(code: string, bounds: GridBounds, filename: string): void {
  const content = `${serializeBounds(bounds)}\n${stripBoundsComment(code)}`;
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
