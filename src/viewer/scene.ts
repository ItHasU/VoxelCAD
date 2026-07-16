import {
  AmbientLight,
  Box3,
  BufferGeometry,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { observeResize } from './resize';

export interface ViewerOptions {
  /** Couleur de fond de la scène (défaut : gris sombre). */
  background?: number;
  /** Couleur du matériau du modèle. */
  modelColor?: number;
}

export class Viewer {
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly material: MeshStandardMaterial;
  private gridHelper: GridHelper;

  private mesh: Mesh | null = null;
  private disposeResize: () => void;
  private frameHandle = 0;

  constructor(container: HTMLElement, options: ViewerOptions = {}) {
    const { background = 0x1a1b20, modelColor = 0x4f9dff } = options;

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

    this.gridHelper = new GridHelper(20, 20, 0x555555, 0x333333);
    this.scene.add(this.gridHelper);

    this.material = new MeshStandardMaterial({
      color: modelColor,
      roughness: 0.6,
      metalness: 0.05,
      flatShading: true,
    });

    this.renderer.setClearColor(background, 1);

    const rect = container.getBoundingClientRect();
    this.setSize(rect.width || 1, rect.height || 1);
    this.disposeResize = observeResize(container, (w, h) => this.setSize(w, h));

    this.animate();
  }

  private setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
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

  private clearMesh(): void {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh = null;
  }

  /** Cadre la caméra sur la bounding box du mesh donné. */
  private fitToObject(mesh: Mesh): void {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box || box.isEmpty()) return;

    const sphere = new Sphere();
    box.getBoundingSphere(sphere);
    const center = sphere.center;
    const radius = sphere.radius || 1;

    const fov = (this.camera.fov * Math.PI) / 180;
    const distance = (radius / Math.sin(fov / 2)) * 1.2;

    const direction = new Vector3(1, 0.8, 1).normalize();
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.camera.near = distance / 100;
    this.camera.far = distance * 100;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(center);
    this.controls.update();

    this.updateGrid(box);
  }

  /** Redimensionne et repositionne la grille de repère sous le volume. */
  private updateGrid(box: Box3): void {
    const size = new Vector3();
    box.getSize(size);
    const span = Math.max(size.x, size.z, 1);
    const divisions = Math.min(Math.ceil(span) * 2, 200);

    this.scene.remove(this.gridHelper);
    this.gridHelper.geometry.dispose();

    this.gridHelper = new GridHelper(span * 2, divisions, 0x555555, 0x333333);
    this.gridHelper.position.y = box.min.y;
    this.scene.add(this.gridHelper);
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    this.disposeResize();
    this.clearMesh();
    this.controls.dispose();
    this.material.dispose();
    this.gridHelper.geometry.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
