import { BufferGeometry, Mesh, MeshStandardMaterial } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { downloadBlob } from './download';

/** Exporte une géométrie au format GLB (glTF binaire) et déclenche le téléchargement. */
export async function exportGlb(geometry: BufferGeometry, filename: string): Promise<void> {
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: 0x4f9dff }));
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(mesh, { binary: true });
  downloadBlob(result as ArrayBuffer, filename, 'model/gltf-binary');
}
