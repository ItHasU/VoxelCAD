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
    const filled = new Uint8Array(total);
    const progressInterval = Math.max(1, request.progressInterval ?? (Math.floor(total / 100) || 1));

    forEachCell(dims, (i, j, k, index) => {
      const point = cellCoords(request.bounds, i, j, k);
      let inside: boolean;
      try {
        inside = Boolean(isInside(point.x, point.y, point.z));
      } catch (err) {
        throw new SamplerRuntimeError(err, point);
      }
      filled[index] = inside ? 1 : 0;
      if (index % progressInterval === 0) {
        post({ type: 'progress', done: index, total });
      }
    });

    post({ type: 'result', filled, dims }, [filled.buffer]);
  } catch (err) {
    const point = err instanceof SamplerRuntimeError ? err.point : undefined;
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', message, point });
  }
};
