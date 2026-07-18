import './style.css';
import SamplerWorker from './voxel/sampler.worker.ts?worker&inline';
import type { GridBounds, GridDimensions } from './voxel/grid';
import { buildMesh, DEFAULT_MESHING_MODE, MESHING_MODES, type MeshingMode } from './voxel/meshing';
import type { SamplerRequest, SamplerResponse } from './voxel/samplerProtocol';
import { Viewer } from './viewer/scene';
import { initTheme, toggleTheme } from './ui/theme';
import { createEditor } from './editor/monacoSetup';
import { transpile } from './editor/transpile';
import { createBoundsForm } from './ui/boundsForm';
import { createProgress } from './ui/progress';
import { createErrorPanel } from './ui/errorPanel';
import { EXAMPLES, setupExampleSelector } from './ui/exampleSelector';
import { exportStl } from './export/exportStl';
import { exportGlb } from './export/exportGlb';
import { setupCollapsiblePanel } from './ui/panels';
import { setupResizablePanel } from './ui/panelResize';
import { loadCodeFile, saveCode, splitLoadedCode, type FileMeta } from './editor/codeFile';
import type { DisplayMode } from './viewer/scene';
import type { BufferGeometry } from 'three';
import { registerServiceWorker } from './pwa';
import { isDisplayMode, isMeshingMode, loadSession, saveSession } from './ui/session';

initTheme();
registerServiceWorker();

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const viewer = new Viewer(el('viewer'));

// État restauré depuis localStorage, ou valeurs de l'exemple par défaut.
const initial = loadSession() ?? {
  code: EXAMPLES[0].code,
  bounds: EXAMPLES[0].bounds,
  meshingMode: DEFAULT_MESHING_MODE,
  displayMode: 'solid' as DisplayMode,
  exampleId: EXAMPLES[0].id,
};

const editor = createEditor(el('editor'), initial.code);
const boundsForm = createBoundsForm(el<HTMLFormElement>('bounds-form'), initial.bounds);
const progress = createProgress(el('progress'), el('progress-bar'), el<HTMLButtonElement>('cancel'));
const errorPanel = createErrorPanel(el('error-panel'));

const estimateEl = el('voxel-estimate');
const generateBtn = el<HTMLButtonElement>('generate');
const statusEl = el('status');
const exportStlBtn = el<HTMLButtonElement>('export-stl');
const exportGlbBtn = el<HTMLButtonElement>('export-glb');

let currentName = initial.exampleId;
let lastGeometry: BufferGeometry | null = null;

// Dernier champ échantillonné, conservé pour re-mailler sans ré-échantillonner
// lorsqu'on change de mode de maillage.
let meshingMode: MeshingMode = initial.meshingMode;
let displayMode: DisplayMode = initial.displayMode;
let currentBounds: GridBounds = initial.bounds;
let lastField: Float32Array | null = null;
let lastDims: GridDimensions | null = null;
let lastBounds: GridBounds | null = null;

/** Sauvegarde (différée) de l'état de travail dans localStorage. */
let persistTimer = 0;
function persistSession(): void {
  const result = boundsForm.getBounds();
  if (result.bounds) currentBounds = result.bounds;
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    saveSession({
      code: editor.getValue(),
      bounds: currentBounds,
      meshingMode,
      displayMode,
      exampleId: currentName,
    });
  }, 300);
}

editor.onDidChange(persistSession);

// ---------- Mode de maillage ----------
const meshingSelect = el<HTMLSelectElement>('meshing-select');
for (const mode of MESHING_MODES) {
  const opt = document.createElement('option');
  opt.value = mode.id;
  opt.textContent = mode.label;
  meshingSelect.appendChild(opt);
}
meshingSelect.value = meshingMode;
meshingSelect.addEventListener('change', () => {
  meshingMode = meshingSelect.value as MeshingMode;
  renderMesh(); // re-maillage à partir du champ en cache, sans ré-échantillonner
  persistSession();
});

/** (Re)construit la géométrie depuis le dernier champ échantillonné selon le mode courant. */
function renderMesh(): void {
  if (!lastField || !lastDims || !lastBounds) return;
  const geometry = buildMesh(meshingMode, lastField, lastDims, lastBounds);
  const index = geometry.getIndex();
  const triangles = (index ? index.count : geometry.getAttribute('position').count) / 3;
  viewer.setGeometry(geometry);
  lastGeometry = geometry;
  exportStlBtn.disabled = false;
  exportGlbBtn.disabled = false;
  setStatus(
    `${lastDims.nx}×${lastDims.ny}×${lastDims.nz} — ${NUMBER_FORMAT.format(triangles)} triangles`,
  );
}

// ---------- Thème ----------
el<HTMLButtonElement>('theme-toggle').addEventListener('click', () => toggleTheme());

// ---------- Panneaux repliables ----------
setupCollapsiblePanel(
  el('panel-editor'),
  el('panel-editor').querySelector<HTMLButtonElement>('.collapse-btn')!,
  el('reopen-editor'),
);
setupCollapsiblePanel(
  el('panel-params'),
  el('panel-params').querySelector<HTMLButtonElement>('.collapse-btn')!,
  el('reopen-params'),
);

// ---------- Éditeur redimensionnable ----------
setupResizablePanel(el('panel-editor'), el('editor-resizer'), 'voxelcad.editor-width');

// ---------- Mode d'affichage ----------
const displayModeGroup = el('display-mode');

function applyDisplayMode(mode: DisplayMode): void {
  displayMode = mode;
  displayModeGroup
    .querySelectorAll<HTMLButtonElement>('button')
    .forEach((b) => b.classList.toggle('is-active', b.dataset.mode === mode));
  viewer.setDisplayMode(mode);
}

displayModeGroup.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    applyDisplayMode(btn.dataset.mode as DisplayMode);
    persistSession();
  });
});

// Restaure le mode d'affichage sauvegardé.
applyDisplayMode(displayMode);

// ---------- Sauvegarde / chargement du code ----------
el<HTMLButtonElement>('save-code').addEventListener('click', () => {
  const result = boundsForm.getBounds();
  const meta: FileMeta = {
    bounds: result.bounds ?? currentBounds,
    meshingMode,
    displayMode,
    name: currentName,
  };
  saveCode(editor.getValue(), meta, `voxelcad-${currentName}.ts`);
});

el<HTMLButtonElement>('load-code').addEventListener('click', () => {
  void loadCodeFile().then((content) => {
    if (content === null) return;
    const { code, meta } = splitLoadedCode(content);
    editor.setValue(code);
    if (meta) {
      boundsForm.setBounds(meta.bounds);
      if (isMeshingMode(meta.meshingMode)) {
        meshingMode = meta.meshingMode;
        meshingSelect.value = meshingMode;
      }
      if (isDisplayMode(meta.displayMode)) applyDisplayMode(meta.displayMode);
      currentName = meta.name ?? 'custom';
    } else {
      currentName = 'custom';
    }
    refreshEstimate();
    persistSession();
  });
});

// ---------- Recentrage / auto-zoom ----------
el<HTMLButtonElement>('recenter').addEventListener('click', () => viewer.recenter());

// ---------- Sélecteur d'exemples ----------
const exampleSelect = el<HTMLSelectElement>('example-select');
setupExampleSelector(exampleSelect, (example) => {
  currentName = example.id;
  editor.setValue(example.code);
  boundsForm.setBounds(example.bounds);
  refreshEstimate();
  persistSession();
});
// Reflète l'exemple courant dans le sélecteur (si l'état restauré en vient d'un).
if (EXAMPLES.some((e) => e.id === currentName)) exampleSelect.value = currentName;

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
  if (result.status === 'warn') {
    estimateEl.classList.add('is-warn');
    estimateEl.append(' — calcul potentiellement long.');
  }
  generateBtn.disabled = false;
}

boundsForm.onChange(() => {
  refreshEstimate();
  persistSession();
});
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
      lastField = msg.field;
      lastDims = msg.dims;
      lastBounds = bounds;
      renderMesh();
      progress.stop();
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

// ---------- Export ----------
function exportFilename(extension: string): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `voxelcad-${currentName}-${stamp}.${extension}`;
}

exportStlBtn.addEventListener('click', () => {
  if (lastGeometry) exportStl(lastGeometry, exportFilename('stl'));
});

exportGlbBtn.addEventListener('click', () => {
  if (lastGeometry) void exportGlb(lastGeometry, exportFilename('glb'));
});

// Génère l'exemple par défaut au chargement.
void generate();
