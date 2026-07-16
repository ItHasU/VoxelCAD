export interface ProgressControl {
  start(): void;
  update(done: number, total: number): void;
  stop(): void;
  onCancel(callback: () => void): void;
}

export function createProgress(
  container: HTMLElement,
  bar: HTMLElement,
  cancelButton: HTMLButtonElement,
): ProgressControl {
  cancelButton.addEventListener('click', () => {
    for (const cb of cancelCallbacks) cb();
  });
  const cancelCallbacks = new Set<() => void>();

  return {
    start(): void {
      bar.style.width = '0%';
      container.hidden = false;
    },
    update(done: number, total: number): void {
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      bar.style.width = `${pct}%`;
    },
    stop(): void {
      container.hidden = true;
    },
    onCancel(callback: () => void): void {
      cancelCallbacks.add(callback);
    },
  };
}
