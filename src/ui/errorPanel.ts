export interface ErrorPanel {
  show(title: string, details?: string[]): void;
  clear(): void;
}

export function createErrorPanel(element: HTMLElement): ErrorPanel {
  return {
    show(title: string, details: string[] = []): void {
      element.textContent = details.length ? `${title}\n${details.join('\n')}` : title;
      element.hidden = false;
    },
    clear(): void {
      element.textContent = '';
      element.hidden = true;
    },
  };
}
