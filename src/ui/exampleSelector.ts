import type { GridBounds } from '../voxel/grid';
import * as cube from '../editor/examples/cube';
import * as sphere from '../editor/examples/sphere';
import * as cylinder from '../editor/examples/cylinder';

export interface Example {
  id: string;
  label: string;
  code: string;
  bounds: GridBounds;
}

export const EXAMPLES: Example[] = [
  { id: 'sphere', label: 'Sphère', code: sphere.code, bounds: sphere.bounds },
  { id: 'cube', label: 'Cube', code: cube.code, bounds: cube.bounds },
  { id: 'cylinder', label: 'Cylindre', code: cylinder.code, bounds: cylinder.bounds },
];

export function setupExampleSelector(
  select: HTMLSelectElement,
  onSelect: (example: Example) => void,
): void {
  select.innerHTML = '';
  for (const example of EXAMPLES) {
    const option = document.createElement('option');
    option.value = example.id;
    option.textContent = example.label;
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    const example = EXAMPLES.find((e) => e.id === select.value);
    if (example) onSelect(example);
  });
}
