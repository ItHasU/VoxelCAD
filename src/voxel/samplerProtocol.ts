import type { GridBounds, GridDimensions } from './grid';

export interface SamplerSampleRequest {
  type: 'sample';
  code: string;
  bounds: GridBounds;
  progressInterval?: number;
}

export type SamplerRequest = SamplerSampleRequest;

export interface SamplerProgressMessage {
  type: 'progress';
  done: number;
  total: number;
}

export interface SamplerResultMessage {
  type: 'result';
  /** Champ signé aux sommets de la grille : négatif à l'intérieur, positif dehors. */
  field: Float32Array;
  dims: GridDimensions;
}

export interface SamplerErrorMessage {
  type: 'error';
  message: string;
  point?: { x: number; y: number; z: number };
}

export type SamplerResponse = SamplerProgressMessage | SamplerResultMessage | SamplerErrorMessage;
