export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'voxelcad-theme';
const listeners = new Set<(theme: Theme) => void>();

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function stored(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

let current: Theme = stored() ?? systemTheme();

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  for (const listener of listeners) listener(theme);
}

export function initTheme(): Theme {
  apply(current);
  // Suit le thème système tant que l'utilisateur n'a pas choisi explicitement.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (stored() !== null) return;
    current = event.matches ? 'dark' : 'light';
    apply(current);
  });
  return current;
}

export function getTheme(): Theme {
  return current;
}

export function setTheme(theme: Theme): void {
  current = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  apply(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Enregistre un écouteur appelé à chaque changement de thème. Renvoie une fonction de désinscription. */
export function onThemeChange(listener: (theme: Theme) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
