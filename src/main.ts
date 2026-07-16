import './style.css';
import SamplerWorker from './voxel/sampler.worker.ts?worker&inline';
import type { GridBounds } from './voxel/grid';
import { buildVoxelMesh } from './voxel/meshing';
import type { SamplerRequest, SamplerResponse } from './voxel/samplerProtocol';
import { Viewer } from './viewer/scene';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div id="viewer"></div>
  <div id="status">Échantillonnage en cours…</div>
`;

const viewerEl = document.querySelector<HTMLDivElement>('#viewer')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;

const viewer = new Viewer(viewerEl);

// Test de fumée : échantillonne une sphère et l'affiche dans le viewer, en
// attendant l'éditeur Monaco et le formulaire de paramètres (phases 2-3).
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
    viewer.setGeometry(geometry);
    statusEl.textContent = `Sphère test : grille ${msg.dims.nx}×${msg.dims.ny}×${msg.dims.nz}, ${triangleCount} triangles.`;
    worker.terminate();
  } else {
    statusEl.textContent = `Erreur : ${msg.message}`;
    worker.terminate();
  }
};

const request: SamplerRequest = { type: 'sample', code, bounds };
worker.postMessage(request);
