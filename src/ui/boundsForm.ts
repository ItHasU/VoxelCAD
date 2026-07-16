import {
  checkVoxelCount,
  computeDimensions,
  voxelCount,
  type GridBounds,
  type VoxelCountStatus,
} from '../voxel/grid';

const AXES = ['x', 'y', 'z'] as const;
type Axis = (typeof AXES)[number];

interface FieldRefs {
  step: HTMLInputElement;
  min: Record<Axis, HTMLInputElement>;
  max: Record<Axis, HTMLInputElement>;
}

export interface BoundsFormResult {
  ok: boolean;
  bounds?: GridBounds;
  count: number;
  status: VoxelCountStatus | 'invalid';
}

export interface BoundsForm {
  getBounds(): BoundsFormResult;
  setBounds(bounds: GridBounds): void;
  onChange(callback: () => void): void;
}

function numberInput(value: number, step = 'any'): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'input';
  input.step = step;
  input.value = String(value);
  return input;
}

export function createBoundsForm(form: HTMLFormElement, initial: GridBounds): BoundsForm {
  form.innerHTML = '';
  const refs: FieldRefs = {
    step: numberInput(initial.step),
    min: {} as Record<Axis, HTMLInputElement>,
    max: {} as Record<Axis, HTMLInputElement>,
  };

  for (const axis of AXES) {
    const row = document.createElement('div');
    row.className = 'axis-row';

    const name = document.createElement('span');
    name.className = 'axis-name';
    name.textContent = axis.toUpperCase();

    const min = numberInput(initial[`${axis}Min`]);
    const max = numberInput(initial[`${axis}Max`]);
    min.setAttribute('aria-label', `${axis}Min`);
    max.setAttribute('aria-label', `${axis}Max`);
    refs.min[axis] = min;
    refs.max[axis] = max;

    row.append(name, min, max);
    form.appendChild(row);
  }

  const stepField = document.createElement('label');
  stepField.className = 'field';
  const stepLabel = document.createElement('span');
  stepLabel.className = 'field-label';
  stepLabel.textContent = 'Pas de calcul (step)';
  refs.step.min = '0';
  stepField.append(stepLabel, refs.step);
  form.appendChild(stepField);

  function readBounds(): GridBounds | null {
    const values: Record<string, number> = {};
    const inputs: HTMLInputElement[] = [refs.step];
    for (const axis of AXES) {
      inputs.push(refs.min[axis], refs.max[axis]);
    }

    let valid = true;
    const step = Number(refs.step.value);
    const stepInvalid = !Number.isFinite(step) || step <= 0;
    refs.step.classList.toggle('is-invalid', stepInvalid);
    if (stepInvalid) valid = false;

    for (const axis of AXES) {
      const min = Number(refs.min[axis].value);
      const max = Number(refs.max[axis].value);
      const axisInvalid = !Number.isFinite(min) || !Number.isFinite(max) || max < min;
      refs.min[axis].classList.toggle('is-invalid', axisInvalid);
      refs.max[axis].classList.toggle('is-invalid', axisInvalid);
      if (axisInvalid) valid = false;
      values[`${axis}Min`] = min;
      values[`${axis}Max`] = max;
    }

    if (!valid) return null;

    return {
      xMin: values.xMin,
      xMax: values.xMax,
      yMin: values.yMin,
      yMax: values.yMax,
      zMin: values.zMin,
      zMax: values.zMax,
      step,
    };
  }

  return {
    getBounds(): BoundsFormResult {
      const bounds = readBounds();
      if (!bounds) return { ok: false, count: 0, status: 'invalid' };
      const count = voxelCount(computeDimensions(bounds));
      const status = checkVoxelCount(count);
      return { ok: status !== 'block', bounds, count, status };
    },
    setBounds(bounds: GridBounds): void {
      refs.step.value = String(bounds.step);
      for (const axis of AXES) {
        refs.min[axis].value = String(bounds[`${axis}Min`]);
        refs.max[axis].value = String(bounds[`${axis}Max`]);
      }
    },
    onChange(callback: () => void): void {
      form.addEventListener('input', () => callback());
    },
  };
}
