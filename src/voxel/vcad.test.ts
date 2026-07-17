import { describe, expect, it } from 'vitest';
import { vcad } from './vcad';

describe('vcad primitives', () => {
  it('sphere : dedans/dehors et distance signée', () => {
    const s = vcad.sphere(5);
    expect(s(0, 0, 0)).toBe(true);
    expect(s(4.9, 0, 0)).toBe(true);
    expect(s(5.1, 0, 0)).toBe(false);
    expect(s.distance(0, 0, 0)).toBeCloseTo(-5);
    expect(s.distance(5, 0, 0)).toBeCloseTo(0);
    expect(s.distance(8, 0, 0)).toBeCloseTo(3);
  });

  it('box : côtés complets, centrée sur l’origine', () => {
    const b = vcad.box(4, 6, 8); // demi-extents 2, 3, 4
    expect(b(0, 0, 0)).toBe(true);
    expect(b(2, 3, 4)).toBe(true);
    expect(b(2.01, 0, 0)).toBe(false);
    expect(b(0, 3.01, 0)).toBe(false);
    expect(b(0, 0, 4.01)).toBe(false);
  });

  it('cube et cylindre', () => {
    expect(vcad.cube(8)(3.9, 3.9, 3.9)).toBe(true);
    expect(vcad.cube(8)(4.1, 0, 0)).toBe(false);

    const c = vcad.cylinder(3, 10); // axe Y
    expect(c(0, 0, 0)).toBe(true);
    expect(c(3, 5, 0)).toBe(true);
    expect(c(3.1, 0, 0)).toBe(false); // hors du rayon
    expect(c(0, 5.1, 0)).toBe(false); // hors de la hauteur
  });
});

describe('vcad opérations booléennes', () => {
  const a = vcad.sphere(5);
  const b = vcad.sphere(5).translate(6, 0, 0);

  it('union', () => {
    const u = vcad.union(a, b);
    expect(u(0, 0, 0)).toBe(true);
    expect(u(6, 0, 0)).toBe(true);
    expect(u(20, 0, 0)).toBe(false);
    expect(a.union(b)(6, 0, 0)).toBe(true);
  });

  it('intersection', () => {
    const i = vcad.intersection(a, b);
    expect(i(3, 0, 0)).toBe(true); // dans les deux
    expect(i(0, 0, 0)).toBe(false); // seulement dans a
    expect(i(6, 0, 0)).toBe(false); // seulement dans b
  });

  it('difference (creuse)', () => {
    const d = vcad.cube(8).difference(vcad.sphere(3));
    expect(d(0, 0, 0)).toBe(false); // creusé par la sphère
    expect(d(3.5, 3.5, 3.5)).toBe(true); // coin du cube, hors sphère
  });
});

describe('vcad transformations', () => {
  it('translate déplace le volume', () => {
    const s = vcad.sphere(2).translate(10, 0, 0);
    expect(s(10, 0, 0)).toBe(true);
    expect(s(0, 0, 0)).toBe(false);
  });

  it('rotateZ fait tourner autour de Z', () => {
    // Boîte longue selon X ; après 90° autour de Z elle est longue selon Y.
    const bar = vcad.box(10, 1, 1).rotateZ(90);
    expect(bar(0, 4, 0)).toBe(true);
    expect(bar(4, 0, 0)).toBe(false);
  });

  it('scale agrandit', () => {
    const big = vcad.sphere(1).scale(5);
    expect(big(4, 0, 0)).toBe(true);
    expect(big(6, 0, 0)).toBe(false);
  });

  it('shell garde une coque creuse', () => {
    const hollow = vcad.sphere(5).shell(1);
    expect(hollow(0, 0, 0)).toBe(false); // centre vide
    expect(hollow(5, 0, 0)).toBe(true); // sur la surface
  });
});
