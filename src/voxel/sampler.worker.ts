/// <reference lib="webworker" />

import { cellCoords, computeDimensions, forEachCell, voxelCount } from './grid';
import type { SamplerRequest, SamplerResponse } from './samplerProtocol';
import { vcad } from './vcad';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

class SamplerRuntimeError extends Error {
  point: { x: number; y: number; z: number };

  constructor(cause: unknown, point: { x: number; y: number; z: number }) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.point = point;
  }
}

function compileIsInside(code: string): (x: number, y: number, z: number) => boolean {
  // `vcad` est passé en paramètre lexical (pas via une variable globale) : le
  // code utilisateur peut le référencer, et `isInside` (déclaré par une fonction
  // ou un `const`) est renvoyé depuis la portée locale de la fabrique.
  const factory = new Function('vcad', `${code}\n;return isInside;`);
  const fn = factory(vcad);
  if (typeof fn !== 'function') {
    throw new Error("Le code doit définir une fonction isInside(x, y, z): boolean.");
  }
  return fn as (x: number, y: number, z: number) => boolean;
}

function post(message: SamplerResponse, transfer: Transferable[] = []): void {
  ctx.postMessage(message, transfer);
}

ctx.onmessage = (event: MessageEvent<SamplerRequest>) => {
  const request = event.data;
  if (request.type !== 'sample') return;

  try {
    const dims = computeDimensions(request.bounds);
    const total = voxelCount(dims);
    const isInside = compileIsInside(request.code);
    // Les formes `vcad` exposent une vraie distance signée : on l'échantillonne
    // pour lisser la surface. Sinon on retombe sur ±1 (dedans/dehors).
    const solid = isInside as { distance?: (x: number, y: number, z: number) => number };
    const distance = typeof solid.distance === 'function' ? solid.distance : null;
    const field = new Float32Array(total);
    const progressInterval = Math.max(1, request.progressInterval ?? (Math.floor(total / 100) || 1));

    forEachCell(dims, (i, j, k, index) => {
      const point = cellCoords(request.bounds, i, j, k);
      let value: number;
      try {
        if (distance) {
          const d = distance(point.x, point.y, point.z);
          value = Number.isFinite(d) ? d : 1;
        } else {
          value = isInside(point.x, point.y, point.z) ? -1 : 1;
        }
      } catch (err) {
        throw new SamplerRuntimeError(err, point);
      }
      field[index] = value;
      if (index % progressInterval === 0) {
        post({ type: 'progress', done: index, total });
      }
    });

    post({ type: 'result', field, dims }, [field.buffer]);
  } catch (err) {
    const point = err instanceof SamplerRuntimeError ? err.point : undefined;
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', message, point });
  }
};
