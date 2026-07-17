import { BufferGeometry, Mesh, MeshStandardMaterial } from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { downloadBlob } from './download';

/** Exporte une géométrie au format STL binaire et déclenche le téléchargement. */
export function exportStl(geometry: BufferGeometry, filename: string): void {
  const mesh = new Mesh(geometry, new MeshStandardMaterial());
  const exporter = new STLExporter();
  const data = exporter.parse(mesh, { binary: true }) as unknown as DataView;
  downloadBlob(data.buffer as ArrayBuffer, filename, 'model/stl');
}
