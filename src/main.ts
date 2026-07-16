import './style.css';
import SamplerWorker from './voxel/sampler.worker.ts?worker&inline';
import type { GridBounds } from './voxel/grid';
import { buildVoxelMesh } from './voxel/meshing';
import type { SamplerRequest, SamplerResponse } from './voxel/samplerProtocol';
import { Viewer } from './viewer/scene';
import { initTheme, toggleTheme } from './ui/theme';
import { createEditor } from './editor/monacoSetup';
import { transpile } from './editor/transpile';
import { createBoundsForm } from './ui/boundsForm';
import { createProgress } from './ui/progress';
import { createErrorPanel } from './ui/errorPanel';
import { EXAMPLES, setupExampleSelector } from './ui/exampleSelector';

initTheme();

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const viewer = new Viewer(el('viewer'));
const editor = createEditor(el('editor'), EXAMPLES[0].code);
const boundsForm = createBoundsForm(el<HTMLFormElement>('bounds-form'), EXAMPLES[0].bounds);
const progress = createProgress(el('progress'), el('progress-bar'), el<HTMLButtonElement>('cancel'));
const errorPanel = createErrorPanel(el('error-panel'));

const estimateEl = el('voxel-estimate');
const generateBtn = el<HTMLButtonElement>('generate');
const statusEl = el('status');

// ---------- Thème ----------
el<HTMLButtonElement>('theme-toggle').addEventListener('click', () => toggleTheme());

// ---------- Sélecteur d'exemples ----------
setupExampleSelector(el<HTMLSelectElement>('example-select'), (example) => {
  editor.setValue(example.code);
  boundsForm.setBounds(example.bounds);
  refreshEstimate();
});

// ---------- Estimation du nombre de voxels ----------
const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');

function refreshEstimate(): void {
  const result = boundsForm.getBounds();
  estimateEl.classList.remove('is-warn', 'is-block');
  if (result.status === 'invalid') {
    estimateEl.textContent = 'Paramètres invalides.';
    estimateEl.classList.add('is-block');
    generateBtn.disabled = true;
    return;
  }

  estimateEl.innerHTML = `Voxels estimés : <strong>${NUMBER_FORMAT.format(result.count)}</strong>`;
  if (result.status === 'block') {
    estimateEl.classList.add('is-block');
    estimateEl.append(' — trop élevé, réduisez les bornes ou augmentez le pas.');
    generateBtn.disabled = true;
  } else if (result.status === 'warn') {
    estimateEl.classList.add('is-warn');
    estimateEl.append(' — calcul potentiellement long.');
    generateBtn.disabled = false;
  } else {
    generateBtn.disabled = false;
  }
}

boundsForm.onChange(refreshEstimate);
refreshEstimate();

// ---------- Génération ----------
let activeWorker: Worker | null = null;

function setStatus(text: string): void {
  statusEl.textContent = text;
  statusEl.hidden = false;
}

function cancelActiveWorker(): void {
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
}

progress.onCancel(() => {
  cancelActiveWorker();
  progress.stop();
  generateBtn.disabled = false;
  setStatus('Génération annulée.');
});

async function generate(): Promise<void> {
  errorPanel.clear();
  const result = boundsForm.getBounds();
  if (!result.ok || !result.bounds) {
    errorPanel.show('Paramètres invalides — corrigez les bornes ou le pas.');
    return;
  }
  const bounds: GridBounds = result.bounds;

  generateBtn.disabled = true;
  setStatus('Compilation…');

  const { js, diagnostics } = await transpile(editor.getModelUri());
  if (diagnostics.length > 0) {
    errorPanel.show('Erreurs de compilation TypeScript :', diagnostics);
    generateBtn.disabled = false;
    statusEl.hidden = true;
    return;
  }

  cancelActiveWorker();
  const worker = new SamplerWorker();
  activeWorker = worker;
  progress.start();
  setStatus('Échantillonnage…');

  worker.onmessage = (event: MessageEvent<SamplerResponse>) => {
    const msg = event.data;
    if (msg.type === 'progress') {
      progress.update(msg.done, msg.total);
      setStatus(`Échantillonnage… ${NUMBER_FORMAT.format(msg.done)} / ${NUMBER_FORMAT.format(msg.total)}`);
    } else if (msg.type === 'result') {
      const geometry = buildVoxelMesh(msg.filled, msg.dims, bounds);
      const triangles = geometry.getAttribute('position').count / 3;
      viewer.setGeometry(geometry);
      progress.stop();
      setStatus(`${msg.dims.nx}×${msg.dims.ny}×${msg.dims.nz} — ${NUMBER_FORMAT.format(triangles)} triangles`);
      cancelActiveWorker();
      generateBtn.disabled = false;
    } else {
      const point = msg.point
        ? ` au point (${msg.point.x}, ${msg.point.y}, ${msg.point.z})`
        : '';
      errorPanel.show(`Erreur d'exécution${point} :`, [msg.message]);
      progress.stop();
      statusEl.hidden = true;
      cancelActiveWorker();
      generateBtn.disabled = false;
    }
  };

  const request: SamplerRequest = { type: 'sample', code: js, bounds };
  worker.postMessage(request);
}

generateBtn.addEventListener('click', () => {
  void generate();
});

// Génère l'exemple par défaut au chargement.
void generate();
