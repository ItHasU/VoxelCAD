import './style.css';
import SamplerWorker from './voxel/sampler.worker.ts?worker&inline';
import type { GridBounds } from './voxel/grid';
import { buildVoxelMesh } from './voxel/meshing';
import type { SamplerRequest, SamplerResponse } from './voxel/samplerProtocol';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <h1>VoxelCAD</h1>
  <p id="status">Échantillonnage en cours…</p>
`;

const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;

// Smoke test wiring the sampler worker + meshing pipeline end-to-end until the
// real editor/UI/viewer land in later phases.
const bounds: GridBounds = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5, step: 0.5 };
const code = `
function isInside(x, y, z) {
  return x * x + y * y + z * z <= 25;
}
`;

const worker = new SamplerWorker();

worker.onmessage = (event: MessageEvent<SamplerResponse>) => {
  const msg = event.data;
  if (msg.type === 'progress') {
    statusEl.textContent = `Échantillonnage… ${msg.done}/${msg.total}`;
  } else if (msg.type === 'result') {
    const geometry = buildVoxelMesh(msg.filled, msg.dims, bounds);
    const triangleCount = geometry.getAttribute('position').count / 3;
    statusEl.textContent = `Sphère test : grille ${msg.dims.nx}×${msg.dims.ny}×${msg.dims.nz}, ${triangleCount} triangles générés.`;
    worker.terminate();
  } else {
    statusEl.textContent = `Erreur : ${msg.message}`;
    worker.terminate();
  }
};

const request: SamplerRequest = { type: 'sample', code, bounds };
worker.postMessage(request);
