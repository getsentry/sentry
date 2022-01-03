import {mat3, vec2} from 'gl-matrix';

import {Rect} from 'sentry/utils/profiling/gl/utils';

describe('Rect', () => {
  it('initializes an empty rect as 0 width and height rect at 0,0 origin', () => {
    expect(Rect.Empty()).toEqual(new Rect(0, 0, 0, 0));
    expect(Rect.Empty().isEmpty).toBe(true);
  });

  it('clones rect', () => {
    const a = new Rect(1, 2, 3, 4);
    const b = Rect.From(a);

    expect(b.equals(a)).toBe(true);
  });
  it('getters return correct values', () => {
    const rect = new Rect(1, 2, 3, 4);

    expect(rect.x).toBe(1);
    expect(rect.y).toBe(2);
    expect(rect.width).toBe(3);
    expect(rect.height).toBe(4);

    expect(rect.left).toBe(rect.x);
    expect(rect.right).toBe(rect.left + rect.width);
    expect(rect.top).toBe(rect.y);
    expect(rect.bottom).toBe(rect.y + rect.height);
  });

  describe('collision', () => {
    it('containsX', () => {
      expect(new Rect(0, 0, 1, 1).containsX(vec2.fromValues(0.5, 0))).toBe(true);
      // when we are exactly on the edge
      expect(new Rect(0, 0, 1, 1).containsX(vec2.fromValues(0, 0))).toBe(true);
      expect(new Rect(0, 0, 1, 1).containsX(vec2.fromValues(1, 0))).toBe(true);
      // when we are outside the rect
      expect(new Rect(0, 0, 1, 1).containsX(vec2.fromValues(-0.5, 0))).toBe(false);
      expect(new Rect(0, 0, 1, 1).containsX(vec2.fromValues(1.5, 0))).toBe(false);
    });
    it('containsY', () => {
      expect(new Rect(0, 0, 1, 1).containsY(vec2.fromValues(0, 0.5))).toBe(true);
      // when we are exactly on the edge
      expect(new Rect(0, 0, 1, 1).containsY(vec2.fromValues(0, 0))).toBe(true);
      expect(new Rect(0, 0, 1, 1).containsY(vec2.fromValues(0, 1))).toBe(true);
      // when we are outside the rect
      expect(new Rect(0, 0, 1, 1).containsY(vec2.fromValues(0, -0.5))).toBe(false);
      expect(new Rect(0, 0, 1, 1).containsY(vec2.fromValues(0, 1.5))).toBe(false);
    });
    it('contains', () => {
      expect(new Rect(0, 0, 1, 1).contains(vec2.fromValues(0.5, 0.5))).toBe(true);
      expect(new Rect(0, 0, 1, 1).contains(vec2.fromValues(1.5, 1.5))).toBe(false);
      expect(new Rect(0, 0, 1, 1).contains(vec2.fromValues(-0.5, -0.5))).toBe(false);
    });
    it('overlaps', () => {
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(-1, -1, 2, 2))).toBe(true);
      // we are exactly on the edge
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(1, 1, 1, 1))).toBe(true);
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(2, 1, 1, 1))).toBe(false);
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(-1, -1, 1, 1))).toBe(true);
    });
  });

  describe('transforms', () => {
    it('transformRect', () => {
      // prettier-ignore
      // Scale (10,20),translate by (3, 4)
      const matrix = mat3.fromValues(
        10,0,0,
        0,20,0,
        3,4,0,
  )
      expect(new Rect(1, 1, 1, 1).transformRect(matrix)).toEqual(
        new Rect(13, 24, 10, 20)
      );
    });
    it('translateX', () => {
      expect(new Rect(0, 0, 1, 1).translateX(1).x).toBe(1);
    });
    it('translateY', () => {
      expect(new Rect(0, 0, 1, 1).translateY(1).y).toBe(1);
    });
    it('translate', () => {
      expect(new Rect(0, 0, 1, 1).translate(1, 1).origin).toEqual(vec2.fromValues(1, 1));
    });
    it('scaleX', () => {
      expect(new Rect(0, 0, 1, 1).scaleX(2).size).toEqual(vec2.fromValues(2, 1));
    });
    it('scaleY', () => {
      expect(new Rect(0, 0, 1, 1).scaleY(2).size).toEqual(vec2.fromValues(1, 2));
    });
    it('scale', () => {
      expect(new Rect(0, 0, 1, 1).scale(2, 2).size).toEqual(vec2.fromValues(2, 2));
    });
    it('scaleOriginBy', () => {
      expect(new Rect(1, 1, 1, 1).scaleOriginBy(2, 2).origin).toEqual(
        vec2.fromValues(2, 2)
      );
    });
  });
});
