/**
 * Rend un panneau (ancré à gauche, largeur fixe) redimensionnable par une
 * poignée sur son bord droit. La largeur est bornée puis mémorisée dans
 * `localStorage` ; un double-clic sur la poignée réinitialise la largeur par
 * défaut. L'éditeur Monaco a `automaticLayout: true` et se reflow tout seul.
 */
const MIN_WIDTH = 280;

function maxWidth(): number {
  // Laisse toujours de la place pour le viewer / le panneau de droite.
  return Math.max(MIN_WIDTH, Math.min(window.innerWidth * 0.85, window.innerWidth - 260));
}

export function setupResizablePanel(
  panel: HTMLElement,
  handle: HTMLElement,
  storageKey: string,
): void {
  const clamp = (w: number): number => Math.max(MIN_WIDTH, Math.min(w, maxWidth()));
  const applyWidth = (w: number): void => {
    panel.style.width = `${clamp(w)}px`;
  };

  const saved = Number(localStorage.getItem(storageKey));
  if (Number.isFinite(saved) && saved >= MIN_WIDTH) applyWidth(saved);

  let startX = 0;
  let startWidth = 0;

  const onMove = (event: PointerEvent): void => {
    applyWidth(startWidth + (event.clientX - startX));
  };

  const onUp = (event: PointerEvent): void => {
    handle.releasePointerCapture?.(event.pointerId);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.classList.remove('is-resizing');
    localStorage.setItem(storageKey, String(Math.round(panel.getBoundingClientRect().width)));
  };

  handle.addEventListener('pointerdown', (event: PointerEvent) => {
    event.preventDefault();
    startX = event.clientX;
    startWidth = panel.getBoundingClientRect().width;
    handle.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.classList.add('is-resizing');
  });

  // Double-clic : retour à la largeur par défaut (définie en CSS).
  handle.addEventListener('dblclick', () => {
    panel.style.width = '';
    localStorage.removeItem(storageKey);
  });

  // Si la fenêtre rétrécit, on reborne la largeur courante.
  window.addEventListener('resize', () => {
    if (panel.style.width) applyWidth(panel.getBoundingClientRect().width);
  });
}
