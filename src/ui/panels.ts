/**
 * Rend un panneau repliable : le bouton de repli (dans l'en-tête) masque le
 * panneau et révèle un onglet de réouverture sur le bord de l'écran.
 */
export function setupCollapsiblePanel(
  panel: HTMLElement,
  collapseButton: HTMLElement,
  reopenTab: HTMLElement,
): void {
  const setCollapsed = (collapsed: boolean): void => {
    panel.classList.toggle('is-collapsed', collapsed);
    reopenTab.hidden = !collapsed;
  };

  collapseButton.addEventListener('click', () => setCollapsed(true));
  reopenTab.addEventListener('click', () => setCollapsed(false));
}
