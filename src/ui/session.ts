import type { GridBounds } from '../voxel/grid';
import { DEFAULT_MESHING_MODE, MESHING_MODES, type MeshingMode } from '../voxel/meshing';
import type { DisplayMode } from '../viewer/scene';

/**
 * Persistance de l'état de travail dans `localStorage` : au rechargement de la
 * page, on retrouve le code, les bornes, le mode de maillage et le mode
 * d'affichage tels qu'ils étaient. (Le thème et la largeur de l'éditeur sont
 * mémorisés séparément par leurs modules respectifs.)
 */
const STORAGE_KEY = 'voxelcad.session';
const DISPLAY_MODES: readonly DisplayMode[] = ['solid', 'translucent', 'wireframe'];
const BOUNDS_KEYS = ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax', 'step'] as const;

export interface SessionState {
  code: string;
  bounds: GridBounds;
  meshingMode: MeshingMode;
  displayMode: DisplayMode;
  exampleId: string;
}

export function isBounds(value: unknown): value is GridBounds {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return BOUNDS_KEYS.every((k) => typeof obj[k] === 'number' && Number.isFinite(obj[k]));
}

export function isMeshingMode(value: unknown): value is MeshingMode {
  return MESHING_MODES.some((m) => m.id === value);
}

export function isDisplayMode(value: unknown): value is DisplayMode {
  return DISPLAY_MODES.includes(value as DisplayMode);
}

/** Lit l'état sauvegardé, ou `null` si absent / illisible / invalide. */
export function loadSession(): SessionState | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.code !== 'string' || !isBounds(data.bounds)) return null;
    return {
      code: data.code,
      bounds: data.bounds,
      meshingMode: isMeshingMode(data.meshingMode) ? data.meshingMode : DEFAULT_MESHING_MODE,
      displayMode: isDisplayMode(data.displayMode) ? data.displayMode : 'solid',
      exampleId: typeof data.exampleId === 'string' ? data.exampleId : 'custom',
    };
  } catch {
    return null;
  }
}

/** Écrit l'état de travail (silencieux en cas de quota / navigation privée). */
export function saveSession(state: SessionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota dépassé ou stockage indisponible : on ignore.
  }
}
