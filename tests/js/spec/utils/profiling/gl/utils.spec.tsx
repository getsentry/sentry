import {mat3, vec2} from 'gl-matrix';

import {
  createShader,
  getContext,
  makeProjectionMatrix,
  Rect,
  Transform,
} from 'sentry/utils/profiling/gl/utils';

describe('makeProjectionMatrix', () => {
  it('should return a projection matrix', () => {
    // prettier-ignore
    expect(makeProjectionMatrix(1024, 768)).toEqual(mat3.fromValues(
      2/1024, 0, 0,
      -0, -2/768, -0,
      -1,1,1
    ));
  });
});

describe('getContext', () => {
  it('throws if it cannot retrieve context', () => {
    expect(() =>
      // @ts-ignore partial canvas mock
      getContext({getContext: jest.fn().mockImplementationOnce(() => null)}, 'webgl')
    ).toThrow();
    expect(() =>
      // @ts-ignore partial canvas mock
      getContext({getContext: jest.fn().mockImplementationOnce(() => null)}, '2d')
    ).toThrow();
  });

  it('returns ctx', () => {
    const ctx = {};
    expect(
      // @ts-ignore partial canvas mock
      getContext({getContext: jest.fn().mockImplementationOnce(() => ctx)}, 'webgl')
    ).toBe(ctx);
  });
});

describe('createShader', () => {
  it('fails to create', () => {
    const ctx: Partial<WebGLRenderingContext> = {
      createShader: jest.fn().mockImplementationOnce(() => null),
    };

    const type = 0;
    // @ts-ignore this is a partial mock
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
      COMPILE_STATUS: 1,
    };

    // @ts-ignore this is a partial mock
    expect(() => createShader(ctx, type, shaderSource)).not.toThrow();
    // @ts-ignore this is a partial mock
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
      COMPILE_STATUS: 0,
    };

    // @ts-ignore this is a partial mock
    expect(() => createShader(ctx, type, shaderSource)).toThrow(
      'Failed to compile shader'
    );
  });
});

describe('Transform', () => {
  it('betweenRect', () => {
    expect(Transform.betweenRect(new Rect(2, 3, 4, 5), new Rect(1, 2, 10, 15))).toEqual(
      new Rect(1, 2, 2.5, 3)
    );
  });
});

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
    it('containsRect', () => {
      expect(new Rect(0, 0, 1, 1).containsRect(new Rect(0.1, 0.1, 0.1, 0.1))).toBe(true);
    });
    it('overlaps', () => {
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(-1, -1, 2, 2))).toBe(true);
      // we are exactly on the edge
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(1, 1, 1, 1))).toBe(true);
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(2, 1, 1, 1))).toBe(false);
      expect(new Rect(0, 0, 1, 1).overlaps(new Rect(-1, -1, 1, 1))).toBe(true);
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
