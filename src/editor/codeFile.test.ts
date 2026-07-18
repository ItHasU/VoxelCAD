import { describe, expect, it } from 'vitest';
import { parseMeta, splitLoadedCode } from './codeFile';

const BOUNDS = { xMin: -6, xMax: 6, yMin: -6, yMax: 6, zMin: -6, zMax: 6, step: 0.35 };

describe('codeFile metadata', () => {
  it('parses a full voxelcad:meta header', () => {
    const meta = {
      app: 'VoxelCAD',
      version: 1,
      name: 'vcad',
      bounds: BOUNDS,
      meshingMode: 'smooth',
      displayMode: 'wireframe',
    };
    const content = `// voxelcad: VoxelCAD — exporté\n// voxelcad:meta ${JSON.stringify(meta)}\nconst isInside = vcad.sphere(5);\n`;

    const parsed = parseMeta(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.bounds).toEqual(BOUNDS);
    expect(parsed!.meshingMode).toBe('smooth');
    expect(parsed!.displayMode).toBe('wireframe');
    expect(parsed!.name).toBe('vcad');
  });

  it('strips every voxelcad header line from the code', () => {
    const content = `// voxelcad: VoxelCAD — exporté le 2026-07-18 12:00\n// voxelcad: X[-6, 6] · pas 0.35\n// voxelcad:meta {"bounds":${JSON.stringify(BOUNDS)}}\nconst isInside = vcad.cube(8);\n`;

    const { code } = splitLoadedCode(content);
    expect(code).toBe('const isInside = vcad.cube(8);\n');
    expect(code).not.toContain('voxelcad');
  });

  it('still reads the legacy voxelcad:bounds marker', () => {
    const content = `// voxelcad:bounds ${JSON.stringify(BOUNDS)}\nfunction isInside(x,y,z){ return true; }\n`;

    const { code, meta } = splitLoadedCode(content);
    expect(meta).not.toBeNull();
    expect(meta!.bounds).toEqual(BOUNDS);
    expect(meta!.meshingMode).toBeUndefined();
    expect(code.startsWith('function isInside')).toBe(true);
  });

  it('returns null metadata when no marker is present', () => {
    expect(parseMeta('const isInside = () => true;\n')).toBeNull();
  });

  it('ignores a malformed meta payload', () => {
    expect(parseMeta('// voxelcad:meta {not json}\n')).toBeNull();
  });
});
