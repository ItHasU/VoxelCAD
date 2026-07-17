import {
  AmbientLight,
  AxesHelper,
  BufferGeometry,
  DirectionalLight,
  GridHelper,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { observeResize } from './resize';
import { getTheme, onThemeChange, type Theme } from '../ui/theme';

export interface ViewerOptions {
  /** Couleur du matériau du modèle. */
  modelColor?: number;
}

const BACKGROUND: Record<Theme, number> = {
  dark: 0x14161c,
  light: 0xeceef3,
};

const GRID_COLORS: Record<Theme, [number, number]> = {
  dark: [0x555555, 0x333333],
  light: [0xc2c6d0, 0xd8dbe2],
};

export type DisplayMode = 'solid' | 'translucent' | 'wireframe';

export class Viewer {
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly material: MeshStandardMaterial;
  private readonly axes: AxesHelper;
  private gridHelper: GridHelper;

  private mesh: Mesh | null = null;
  private displayMode: DisplayMode = 'solid';
  private gridSpan = 20;
  private disposeResize: () => void;
  private disposeTheme: () => void;
  private frameHandle = 0;

  constructor(container: HTMLElement, options: ViewerOptions = {}) {
    const { modelColor = 0x4f9dff } = options;

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.scene = new Scene();

    this.camera = new PerspectiveCamera(50, 1, 0.01, 10_000);
    this.camera.position.set(8, 8, 8);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    const ambient = new AmbientLight(0xffffff, 0.6);
    const key = new DirectionalLight(0xffffff, 1.0);
    key.position.set(5, 10, 7);
    const fill = new DirectionalLight(0xffffff, 0.4);
    fill.position.set(-6, -3, -4);
    this.scene.add(ambient, key, fill);

    this.gridHelper = this.buildGrid();
    this.scene.add(this.gridHelper);

    // Repère X/Y/Z (rouge/vert/bleu) de 1 unité à l'origine, toujours visible.
    this.axes = new AxesHelper(1);
    const axesMaterial = this.axes.material as LineBasicMaterial;
    axesMaterial.depthTest = false;
    axesMaterial.transparent = true;
    this.axes.renderOrder = 999;
    this.scene.add(this.axes);

    this.material = new MeshStandardMaterial({
      color: modelColor,
      roughness: 0.6,
      metalness: 0.05,
      flatShading: true,
    });

    this.applyTheme(getTheme());
    this.disposeTheme = onThemeChange((theme) => this.applyTheme(theme));

    const rect = container.getBoundingClientRect();
    this.setSize(rect.width || window.innerWidth, rect.height || window.innerHeight);
    this.disposeResize = observeResize(container, (w, h) => this.setSize(w, h));

    this.animate();
  }

  private applyTheme(theme: Theme): void {
    this.renderer.setClearColor(BACKGROUND[theme], 1);
    this.rebuildGrid();
  }

  private setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    // updateStyle = true : le canvas prend la taille CSS du conteneur, sinon
    // sur écran HiDPI (devicePixelRatio > 1) il déborde et décentre la vue.
    this.renderer.setSize(width, height, true);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    this.frameHandle = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Affiche une nouvelle géométrie, en remplaçant proprement (dispose) le mesh
   * précédent. La géométrie devient la propriété du viewer.
   */
  setGeometry(geometry: BufferGeometry): void {
    this.clearMesh();
    geometry.computeVertexNormals();
    this.mesh = new Mesh(geometry, this.material);
    this.scene.add(this.mesh);
    this.fitToObject(this.mesh);
  }

  /**
   * Recadre la vue : recentre la rotation sur l'origine et rejoue l'auto-zoom
   * sur le volume courant (ou une vue par défaut si aucun modèle n'est chargé).
   */
  recenter(): void {
    if (this.mesh) {
      this.fitToObject(this.mesh);
    } else {
      this.camera.position.set(8, 6, 8);
      this.camera.updateProjectionMatrix();
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  private clearMesh(): void {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh = null;
  }

  /** Bascule le rendu du modèle entre plein, semi-transparent et filaire. */
  setDisplayMode(mode: DisplayMode): void {
    this.displayMode = mode;
    this.material.wireframe = mode === 'wireframe';
    this.material.transparent = mode === 'translucent';
    this.material.opacity = mode === 'translucent' ? 0.45 : 1;
    this.material.depthWrite = mode !== 'translucent';
    this.material.needsUpdate = true;
  }

  getDisplayMode(): DisplayMode {
    return this.displayMode;
  }

  /**
   * Centre la vue sur l'origine (0, 0, 0) et zoome pour englober la zone de
   * voxels. On part de la sphère englobante *serrée* de la géométrie, puis on
   * prend un rayon englobant l'origine (`|centre| + rayon`) afin que tout le
   * volume reste visible tout en gardant l'origine au centre de rotation.
   */
  private fitToObject(mesh: Mesh): void {
    mesh.geometry.computeBoundingSphere();
    const sphere = mesh.geometry.boundingSphere;
    if (!sphere || sphere.radius <= 0) return;

    const radius = Math.max(sphere.center.length() + sphere.radius, 0.5);

    // Distance nécessaire pour que la sphère de rayon `radius` tienne dans le
    // champ de vision, en tenant compte de l'aspect (le plus contraignant des
    // deux axes vertical/horizontal).
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const fitFov = Math.min(vFov, hFov);
    const distance = (radius / Math.sin(fitFov / 2)) * 1.15;

    const direction = new Vector3(1, 0.75, 1).normalize();
    this.camera.position.copy(direction).multiplyScalar(distance);
    this.camera.near = Math.max(distance / 1000, 0.01);
    this.camera.far = distance * 1000;
    this.camera.updateProjectionMatrix();

    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this.gridSpan = radius * 2;
    this.rebuildGrid();
  }

  private buildGrid(): GridHelper {
    const [main, secondary] = GRID_COLORS[getTheme()];
    const divisions = Math.min(Math.max(Math.ceil(this.gridSpan), 2), 200);
    const grid = new GridHelper(this.gridSpan, divisions, main, secondary);
    // Grille centrée sur l'origine (0, 0, 0).
    grid.position.set(0, 0, 0);
    return grid;
  }

  /** Reconstruit la grille de repère (taille, position et couleurs du thème courant). */
  private rebuildGrid(): void {
    this.scene.remove(this.gridHelper);
    this.gridHelper.geometry.dispose();
    (this.gridHelper.material as { dispose(): void }).dispose();
    this.gridHelper = this.buildGrid();
    this.scene.add(this.gridHelper);
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    this.disposeResize();
    this.disposeTheme();
    this.clearMesh();
    this.controls.dispose();
    this.material.dispose();
    this.gridHelper.geometry.dispose();
    this.axes.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
