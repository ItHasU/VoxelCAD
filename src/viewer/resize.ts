/**
 * Observe le redimensionnement d'un élément et invoque `callback` avec la
 * nouvelle taille (en pixels CSS). Renvoie une fonction de nettoyage.
 */
export function observeResize(
  element: HTMLElement,
  callback: (width: number, height: number) => void,
): () => void {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      callback(width, height);
    }
  });
  observer.observe(element);
  return () => observer.disconnect();
}
