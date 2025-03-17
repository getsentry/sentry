import type Fuse from 'fuse.js';
import {mat3, vec2} from 'gl-matrix';

import {
  computeConfigViewWithStrategy,
  computeHighlightedBounds,
  createProgram,
  createShader,
  ELLIPSIS,
  getCenterScaleMatrixFromConfigPosition,
  getContext,
  lowerBound,
  makeProjectionMatrix,
  upperBound,
} from 'sentry/utils/profiling/gl/utils';

import {findRangeBinarySearch, Rect, trimTextCenter} from '../speedscope';

describe('makeProjectionMatrix', () => {
  it('should return a projection matrix', () => {
    // prettier-ignore
    expect(makeProjectionMatrix(1024, 768)).toEqual(
      mat3.fromValues(2 / 1024, 0, 0, -0, -2 / 768, -0, -1, 1, 1)
    );
  });
});

describe('getContext', () => {
  it('throws if it cannot retrieve context', () => {
    expect(() =>
      // @ts-expect-error partial canvas mock
      getContext({getContext: jest.fn().mockImplementationOnce(() => null)}, 'webgl')
    ).toThrow();
    expect(() =>
      // @ts-expect-error partial canvas mock
      getContext({getContext: jest.fn().mockImplementationOnce(() => null)}, '2d')
    ).toThrow();
  });

  it('returns ctx', () => {
    const ctx = {};
    expect(
      // @ts-expect-error partial canvas mock
      getContext({getContext: jest.fn().mockImplementationOnce(() => ctx)}, 'webgl')
    ).toBe(ctx);
  });
});

describe('upperBound', () => {
  it.each([
    [[], 5, 0],
    [[1, 2, 3], 2, 1],
    [[-3, -2, -1], -2, 1],
    [[1, 2, 3], 10, 3],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5, 4],
  ])(`inserts %p`, (args, target, insert) => {
    expect(
      upperBound(
        target,
        args.map(x => ({start: x, end: x + 1}))
      )
    ).toBe(insert);
  });

  it('finds the upper bound frame outside of view', () => {
    const frames = new Array(10).fill(1).map((_, i) => ({start: i, end: i + 1}));
    const view = new Rect(4, 0, 2, 0);

    expect(upperBound(view.right, frames)).toBe(6);
    expect(frames[6]!.start).toBeGreaterThanOrEqual(view.right);
    expect(frames[6]!.end).toBeGreaterThanOrEqual(view.right);
  });
});

describe('lowerBound', () => {
  it.each([
    [[], 5, 0],
    [[1, 2, 3], 1, 0],
    [[-3, -2, -1], -1, 1],
    [[1, 2, 3], 10, 3],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5, 3],
  ])(`inserts %p`, (args, target, insert) => {
    expect(
      lowerBound(
        target,
        args.map(x => ({start: x, end: x + 1}))
      )
    ).toBe(insert);
  });

  it('finds the lower bound frame outside of view', () => {
    const frames = new Array(10).fill(1).map((_, i) => ({start: i, end: i + 1}));
    const view = new Rect(4, 0, 2, 0);

    expect(lowerBound(view.left, frames)).toBe(3);
    expect(frames[3]!.start).toBeLessThanOrEqual(view.left);
    expect(frames[3]!.end).toBeLessThanOrEqual(view.left);
  });
});

describe('createProgram', () => {
  it('throws if it fails to create a program', () => {
    const ctx: Partial<WebGLRenderingContext> = {
      createProgram: jest.fn().mockImplementation(() => {
        return null;
      }),
    };

    // @ts-expect-error this is a partial mock
    expect(() => createProgram(ctx, {}, {})).toThrow('Could not create program');
  });
  it('attaches both shaders and links program', () => {
    const program = {};
    const ctx: Partial<WebGLRenderingContext> = {
      createProgram: jest.fn().mockImplementation(() => {
        return program;
      }),
      getProgramParameter: jest.fn().mockImplementation(() => program),
      linkProgram: jest.fn(),
      attachShader: jest.fn(),
    };

    const vertexShader = {};
    const fragmentShader = {};

    // @ts-expect-error this is a partial mock
    createProgram(ctx, vertexShader, fragmentShader);

    expect(ctx.createProgram).toHaveBeenCalled();
    expect(ctx.linkProgram).toHaveBeenCalled();
    expect(ctx.attachShader).toHaveBeenCalledWith(program, vertexShader);
    expect(ctx.attachShader).toHaveBeenCalledWith(program, fragmentShader);
  });
  it('deletes the program if compiling fails', () => {
    const program = {};
    const ctx: Partial<WebGLRenderingContext> = {
      createProgram: jest.fn().mockImplementation(() => {
        return program;
      }),
      deleteProgram: jest.fn(),
      getProgramParameter: jest.fn().mockImplementation(() => 0),
      linkProgram: jest.fn(),
      attachShader: jest.fn(),
    };

    const vertexShader = {};
    const fragmentShader = {};

    // @ts-expect-error this is a partial mock
    expect(() => createProgram(ctx, vertexShader, fragmentShader)).toThrow();

    expect(ctx.createProgram).toHaveBeenCalled();
    expect(ctx.linkProgram).toHaveBeenCalled();
    expect(ctx.attachShader).toHaveBeenCalledWith(program, vertexShader);
    expect(ctx.attachShader).toHaveBeenCalledWith(program, fragmentShader);

    expect(ctx.deleteProgram).toHaveBeenCalledWith(program);
  });
});

describe('createShader', () => {
  it('fails to create', () => {
    const ctx: Partial<WebGLRenderingContext> = {
      createShader: jest.fn().mockImplementationOnce(() => null),
    };

    const type = 0;
    // @ts-expect-error this is a partial mock
    expect(() => createShader(ctx, type, '')).toThrow();
    expect(ctx.createShader).toHaveBeenLastCalledWith(type);
  });

  it('successfully compiles', () => {
    const shader: WebGLShader = {};
    const type = 0;
    const shaderSource = `vec4(1.0, 0.0, 0.0, 1.0)`;

    const ctx: Partial<WebGLRenderingContext> = {
      createShader: jest.fn().mockImplementation(() => shader),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      getShaderParameter: jest.fn().mockImplementation(() => 1),
      COMPILE_STATUS: 1 as any,
    };

    // @ts-expect-error this is a partial mock
    expect(() => createShader(ctx, type, shaderSource)).not.toThrow();
    // @ts-expect-error this is a partial mock
    expect(createShader(ctx, type, shaderSource)).toBe(shader);
    expect(ctx.shaderSource).toHaveBeenLastCalledWith(shader, shaderSource);
    expect(ctx.getShaderParameter).toHaveBeenLastCalledWith(shader, ctx.COMPILE_STATUS);
  });

  it('deletes shader if compilation fails', () => {
    const shader: WebGLShader = {};
    const type = 0;
    const shaderSource = `vec4(1.0, 0.0, 0.0, 1.0)`;

    const ctx: Partial<WebGLRenderingContext> = {
      createShader: jest.fn().mockImplementation(() => shader),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      getShaderParameter: jest.fn().mockImplementation(() => 0),
      deleteShader: jest.fn(),
      COMPILE_STATUS: 0 as any,
    };

    // @ts-expect-error this is a partial mock
    expect(() => createShader(ctx, type, shaderSource)).toThrow(
      'Failed to compile 0 shader'
    );
  });
});

describe('Rect', () => {
  it('initializes an empty rect as 0 width and height rect at 0,0 origin', () => {
    expect(Rect.Empty()).toEqual(new Rect(0, 0, 0, 0));
    expect(Rect.Empty().isEmpty()).toBe(true);
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
    it('containsRect', () => {
      expect(new Rect(0, 0, 1, 1).containsRect(new Rect(0.1, 0.1, 0.1, 0.1))).toBe(true);
    });

    it('overlapsLeft', () => {
      expect(new Rect(0, 0, 1, 1).leftOverlapsWith(new Rect(-0.5, 0, 1, 1))).toBe(true);
      expect(new Rect(0, 0, 1, 1).leftOverlapsWith(new Rect(1, 0, 1, 1))).toBe(false);
    });
    it('overlapsRight', () => {
      expect(new Rect(0, 0, 1, 1).rightOverlapsWith(new Rect(0.5, 0, 1, 1))).toBe(true);
      expect(new Rect(0, 0, 1, 1).rightOverlapsWith(new Rect(1.5, 0, 1, 1))).toBe(false);
    });
    it('overlaps', () => {
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(-1, -1, 2, 2))).toBe(true);
      // we are exactly on the edge
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(1, 1, 1, 1))).toBe(true);
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(2, 1, 1, 1))).toBe(false);
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(-1, -1, 1, 1))).toBe(true);
    });
    it('hasIntersectionWidth', () => {
      expect(new Rect(0, 0, 1, 1).hasIntersectionWith(new Rect(1, 1, 2, 2))).toBe(false);
      expect(new Rect(0, 0, 1, 1).hasIntersectionWith(new Rect(-1, -1, 2, 2))).toBe(true);
    });
  });

  it('withHeight', () => {
    expect(new Rect(0, 0, 1, 1).withHeight(2).height).toBe(2);
  });
  it('withWidth', () => {
    expect(new Rect(0, 0, 1, 1).withWidth(2).width).toBe(2);
  });
  it('toBounds', () => {
    expect(new Rect(1, 0, 2, 2).toBounds()).toEqual([1, 0, 3, 2]);
  });
  it('toArray', () => {
    expect(new Rect(0, 0, 1, 1).toArray()).toEqual([0, 0, 1, 1]);
  });
  it('between', () => {
    expect(new Rect(1, 1, 2, 4).between(new Rect(2, 2, 4, 10))).toEqual(
      new Rect(2, 2, 2, 2.5)
    );
  });
  it('toMatrix', () => {
    expect(new Rect(0.5, 1, 2, 3).toMatrix()).toEqual(
      mat3.fromValues(2, 0, 0, 0, 3, 0, 0.5, 1, 1)
    );
  });
  it('notEqualTo', () => {
    expect(new Rect(0, 0, 1, 1).notEqualTo(new Rect(0, 0, 1, 1))).toBe(false);
    expect(new Rect(0, 0, 1, 1).notEqualTo(new Rect(0, 0, 1, 2))).toBe(true);
  });

  describe('transforms', () => {
    it('transformRect', () => {
      // prettier-ignore
      // Scale (10,20),translate by (3, 4)
      const matrix = mat3.fromValues(10, 0, 0, 0, 20, 0, 3, 4, 0);
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
    it('equals', () => {
      expect(new Rect(1, 0, 0, 0).equals(new Rect(0, 0, 0, 0))).toBe(false);
      expect(new Rect(0, 1, 0, 0).equals(new Rect(0, 0, 0, 0))).toBe(false);
      expect(new Rect(0, 0, 1, 0).equals(new Rect(0, 0, 0, 0))).toBe(false);
      expect(new Rect(0, 0, 0, 1).equals(new Rect(0, 0, 0, 0))).toBe(false);
    });
    it('scaledBy', () => {
      expect(new Rect(0, 0, 1, 1).scale(3, 4).equals(new Rect(0, 0, 3, 4))).toBe(true);
    });
    it('scaleOriginBy', () => {
      expect(new Rect(1, 1, 1, 1).scaleOriginBy(2, 2).origin).toEqual(
        vec2.fromValues(2, 2)
      );
    });
  });
});

describe('findRangeBinarySearch', () => {
  it('finds in single iteration', () => {
    const text = new Array(10)
      .fill(0)
      .map((_, i) => String.fromCharCode(i + 97))
      .join('');

    const fn = jest.fn().mockImplementation(n => {
      return text.substring(0, n).length;
    });

    const target = 2;
    const precision = 1;

    // First iteration will halve 1+3, next iteration will compare 2-1 <= 1 and return [1,2]
    const [low, high] = findRangeBinarySearch({low: 1, high: 3}, fn, target, precision);

    expect([low, high]).toEqual([1, 2]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(text.substring(0, low)).toBe('a');
  });

  it('finds closest range', () => {
    const text = new Array(10)
      .fill(0)
      .map((_, i) => String.fromCharCode(i + 97))
      .join('');

    const fn = jest.fn().mockImplementation(n => {
      return text.substring(0, n).length;
    });

    const target = 4;
    const precision = 1;

    const [low, high] = findRangeBinarySearch({low: 0, high: 10}, fn, target, precision);

    expect([low, high]).toEqual([3.75, 4.375]);
    expect(fn).toHaveBeenCalledTimes(4);
    expect(text.substring(0, low)).toBe('abc');
  });
});

describe('trimTextCenter', () => {
  it('trims nothing if low > length', () => {
    expect(trimTextCenter('abc', 4)).toMatchObject({
      end: 0,
      length: 0,
      start: 0,
      text: 'abc',
    });
  });
  it('trims center perfectly', () => {
    expect(trimTextCenter('abcdef', 5.5)).toMatchObject({
      end: 4,
      length: 2,
      start: 2,
      text: `ab${ELLIPSIS}ef`,
    });
  });
  it('favors prefix length', () => {
    expect(trimTextCenter('abcdef', 5)).toMatchObject({
      end: 5,
      length: 3,
      start: 2,
      text: `ab${ELLIPSIS}f`,
    });
  });
});

describe('computeHighlightedBounds', () => {
  const testTable = [
    {
      name: 'reduces bounds[1] if tail is truncated',
      text: 'CA::Display::DisplayLink::dispatch_items(unsigned long long, unsigned long long, unsigned long long)',
      args: {
        bounds: [4, 11],
        trim: {
          // match tail truncated
          text: 'CA::Dis…long)',
          start: 7,
          end: 95,
          length: 88,
        },
      },
      expected: [4, 8], // Dis...
    },
    {
      name: 'shifts bounds if truncated before bounds',
      text: '-[UIScrollView _smoothScrollDisplayLink:]',
      args: {
        bounds: [28, 35],
        trim: {
          text: '-[UIScrollView…playLink:]',
          start: 14,
          end: 31,
          length: 17,
        },
      },
      expected: [14, 19], // ...play
    },
    {
      name: 'shifts bounds if truncated before bounds',
      text: '-[UIScrollView _smoothScrollDisplayLink:]',
      args: {
        bounds: [28, 35],
        trim: {
          // match bounds are shifted after truncate
          text: '-[UIScrollView _sm…rollDisplayLink:]',
          start: 18,
          end: 24,
          length: 6,
        },
      },
      expected: [23, 30], // Display
    },
    {
      name: 'reduces bounds if fully truncated',
      text: '-[UIScrollView _smoothScrollDisplayLink:]',
      args: {
        bounds: [28, 35],
        trim: {
          // matched text is within truncated ellipsis ,
          text: '-[UIScr…Link:]',
          start: 7,
          end: 35,
          length: 28,
        },
      },
      expected: [7, 8], // …
    },
    {
      name: 'matched bounds fall before and after truncate',
      text: '-[UIScrollView _smoothScrollDisplayLink:]',
      args: {
        bounds: [16, 28],
        trim: {
          // match bounds are shifted after truncate
          text: '-[UIScrollView _sm…rollDisplayLink:]',
          start: 18,
          end: 24,
          length: 6,
        },
      },
      expected: [16, 23], // smoothScroll
    },
    {
      name: 'matched bounds fall before  truncate',
      text: '-[UIScrollView _smoothScrollDisplayLink:]',
      args: {
        bounds: [4, 14],
        trim: {
          // match bounds are shifted after truncate
          text: '-[UIScrollView _sm…rollDisplayLink:]',
          start: 18,
          end: 24,
          length: 6,
        },
      },
      expected: [4, 14], // smoothScroll
    },
  ];

  it.each(testTable)(`$name`, ({args, expected}) => {
    const value = computeHighlightedBounds(args.bounds as Fuse.RangeTuple, args.trim);
    expect(value).toEqual(expected);
  });
});

describe('computeConfigViewWithStrategy', () => {
  it('exact (preserves view height)', () => {
    const view = new Rect(0, 0, 1, 1);
    const frame = new Rect(0, 0, 0.5, 0.5);

    expect(
      computeConfigViewWithStrategy('exact', view, frame).equals(new Rect(0, 0, 0.5, 1))
    ).toBe(true);
  });

  it('min (frame is in view -> preserves view)', () => {
    const view = new Rect(0, 0, 1, 1);
    const frame = new Rect(0, 0, 0.5, 0.5);

    expect(computeConfigViewWithStrategy('min', view, frame).equals(view)).toBe(true);
  });

  it('min (when view is too small to fit frame)', () => {
    const view = new Rect(0, 0, 1, 1);
    const frame = new Rect(2, 2, 5, 1);

    expect(
      computeConfigViewWithStrategy('min', view, frame).equals(new Rect(2, 2, 5, 1))
    ).toBe(true);
  });

  it('min (frame is outside of view on the left)', () => {
    const view = new Rect(5, 0, 10, 1);
    const frame = new Rect(1, 0, 1, 1);

    expect(
      computeConfigViewWithStrategy('min', view, frame).equals(new Rect(1, 0, 10, 1))
    ).toBe(true);
  });

  it('min (frame overlaps with view on the left)', () => {
    const view = new Rect(5, 0, 10, 1);
    const frame = new Rect(4, 0, 2, 1);

    expect(
      computeConfigViewWithStrategy('min', view, frame).equals(new Rect(4, 0, 10, 1))
    ).toBe(true);
  });

  it('min (frame overlaps with view on the right)', () => {
    const view = new Rect(0, 0, 10, 1);
    const frame = new Rect(9, 0, 5, 1);

    expect(
      computeConfigViewWithStrategy('min', view, frame).equals(new Rect(4, 0, 10, 1))
    ).toBe(true);
  });

  it('min (frame is outside of view on the right)', () => {
    const view = new Rect(0, 0, 10, 1);
    const frame = new Rect(12, 0, 5, 1);

    expect(
      computeConfigViewWithStrategy('min', view, frame).equals(new Rect(7, 0, 10, 1))
    ).toBe(true);
  });

  it('min (frame is above the view)', () => {
    const view = new Rect(0, 1, 10, 1);
    const frame = new Rect(0, 0, 10, 1);

    expect(
      computeConfigViewWithStrategy('min', view, frame).equals(new Rect(0, 0, 10, 1))
    ).toBe(true);
  });

  it('min (frame is below the view)', () => {
    const view = new Rect(0, 0, 10, 1);
    const frame = new Rect(0, 2, 10, 1);

    expect(
      computeConfigViewWithStrategy('min', view, frame).equals(new Rect(0, 2, 10, 1))
    ).toBe(true);
  });

  describe('getCenterScaleMatrixFromConfigPosition', function () {
    it('returns a matrix that represents scaling on both x and y axes', function () {
      const actual = getCenterScaleMatrixFromConfigPosition(
        vec2.fromValues(2, 2),
        vec2.fromValues(0, 0)
      );

      // Scales by 2 along the x and y axis
      expect(actual).toEqual(
        // prettier-ignore
        mat3.fromValues(2, 0, 0, 0, 2, 0, 0, 0, 1)
      );
    });

    it('returns a matrix that scales and translates back so the scaling appears to zoom into the point', function () {
      const actual = getCenterScaleMatrixFromConfigPosition(
        vec2.fromValues(2, 2),
        vec2.fromValues(5, 5)
      );

      expect(actual).toEqual(
        // prettier-ignore
        mat3.fromValues(2, 0, 0, 0, 2, 0, -5, -5, 1)
      );
    });
  });
});
