import {mat3, vec2} from 'gl-matrix';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {LightFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import {Frame} from 'sentry/utils/profiling/frame';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';

const base: Profiling.EventedProfile = {
  name: 'profile',
  startValue: 0,
  endValue: 10,
  unit: 'milliseconds',
  type: 'evented',
  events: [
    {type: 'O', at: 0, frame: 0},
    {type: 'C', at: 10, frame: 0},
  ],
  shared: {
    frames: [{name: 'f0'}],
  },
};

const makeFlamegraph = (trace?: Partial<Profiling.EventedProfile>): Flamegraph => {
  return new Flamegraph(
    EventedProfile.FromProfile(trace ? {...base, ...trace} : base),
    0,
    false,
    false
  );
};

const makeContextMock = (
  partialMock: Partial<WebGLRenderingContext> = {}
): WebGLRenderingContext => {
  const context: Partial<WebGLRenderingContext> = {
    enable: jest.fn(),
    blendFuncSeparate: jest.fn(),
    createShader: jest.fn().mockReturnValue({}),
    compileShader: jest.fn(),
    shaderSource: jest.fn(),
    getShaderParameter: jest.fn().mockReturnValue(1),
    attachShader: jest.fn(),
    createProgram: jest.fn().mockReturnValue({}),
    linkProgram: jest.fn(),
    getProgramParameter: jest.fn().mockReturnValue({}),
    getUniformLocation: jest.fn().mockReturnValue({}),
    getAttribLocation: jest.fn().mockReturnValue({}),
    createBuffer: jest.fn().mockReturnValue([]),
    bindBuffer: jest.fn(),
    bufferData: jest.fn(),
    vertexAttribPointer: jest.fn(),
    enableVertexAttribArray: jest.fn(),
    useProgram: jest.fn(),

    // @ts-ignore
    canvas: {
      width: 1000,
      height: 1000,
    },
    ...partialMock,
  };

  return context as WebGLRenderingContext;
};

const makeCanvasMock = (partialMock: Partial<HTMLCanvasElement>): HTMLCanvasElement => {
  const canvas: Partial<HTMLCanvasElement> = {
    getContext: jest.fn().mockReturnValue(makeContextMock()),
    height: 1000,
    width: 1000,
    ...partialMock,
  };

  return canvas as HTMLCanvasElement;
};

describe('flamegraphRenderer', () => {
  afterEach(() => {
    // We simulat regular screens unless differently specified
    window.devicePixelRatio = 1;
  });
  describe('colors', () => {
    it('generates new colors if none are set on the flamegraph', () => {
      const canvas = makeCanvasMock({
        getContext: jest.fn().mockReturnValue(makeContextMock()),
      });

      const flamegraph = makeFlamegraph();

      const renderer = new FlamegraphRenderer(
        canvas as HTMLCanvasElement,
        flamegraph,
        {
          ...LightFlamegraphTheme,
          COLORS: {
            ...LightFlamegraphTheme.COLORS,
            // @ts-ignore overridee the colors implementation
            STACK_TO_COLOR: () => {
              const colorMap = new Map<string, number[]>([['f0', [1, 0, 0, 1]]]);
              return {colorBuffer: [1, 0, 0, 1], colorMap};
            },
          },
        },
        vec2.fromValues(0, 0)
      );

      expect(renderer.colors).toEqual([1, 0, 0, 1]);
    });
    it('uses the ones set on flamegraph', () => {
      const canvas = makeCanvasMock({
        getContext: jest.fn().mockReturnValue(makeContextMock()),
      });

      const flamegraph = makeFlamegraph();
      flamegraph.colors = new Map([['f0', [1, 0, 0, 1]]]);

      const renderer = new FlamegraphRenderer(
        canvas as HTMLCanvasElement,
        flamegraph,
        LightFlamegraphTheme,
        vec2.fromValues(0, 0)
      );

      expect(renderer.colors.slice(0, 4)).toEqual([1, 0, 0, 1]);
    });
    it('adds the alpha channel if none is set', () => {
      const canvas = makeCanvasMock({
        getContext: jest.fn().mockReturnValue(makeContextMock()),
      });

      const flamegraph = makeFlamegraph();
      // No alpha channel
      flamegraph.colors = new Map([['f0', [1, 0, 0]]]);

      const renderer = new FlamegraphRenderer(
        canvas as HTMLCanvasElement,
        flamegraph,
        LightFlamegraphTheme,
        vec2.fromValues(0, 0)
      );

      expect(renderer.colors.slice(0, 4)).toEqual([1, 0, 0, 1]);
    });
  });

  it('inits vertices', () => {
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(makeContextMock()),
    });

    const flamegraph = makeFlamegraph();
    // No alpha channel
    flamegraph.colors = new Map([['f0', [1, 0, 0]]]);

    const renderer = new FlamegraphRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme,
      vec2.fromValues(0, 0)
    );

    // Helper rect for the only frame in our flamegraph
    const rect = new Rect(0, 0, 10, 1);

    // To draw a rect, we need to draw 2 triangles, each with 3 vertices
    // First triangle:  top left -> top right -> bottom left
    // Second triangle: bottom left -> top right -> bottom right
    expect(renderer.positions.slice(0, 2)).toEqual([rect.left, rect.top]);
    expect(renderer.positions.slice(2, 4)).toEqual([rect.right, rect.top]);
    expect(renderer.positions.slice(4, 6)).toEqual([rect.left, rect.bottom]);

    expect(renderer.positions.slice(6, 8)).toEqual([rect.left, rect.bottom]);
    expect(renderer.positions.slice(8, 10)).toEqual([rect.right, rect.top]);
    expect(renderer.positions.slice(10, 12)).toEqual([rect.right, rect.bottom]);
  });
  it('inits shaders', () => {
    const VERTEX = `void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;
    const FRAGMENT = `void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }`;

    const context = makeContextMock({
      createShader: jest.fn().mockReturnValueOnce(VERTEX).mockReturnValueOnce(FRAGMENT),
    });
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(context),
    });

    const flamegraph = makeFlamegraph();

    const _renderer = new FlamegraphRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme,
      vec2.fromValues(0, 0)
    );

    expect(context.createShader).toHaveBeenCalledTimes(2);
    expect(context.getShaderParameter).toHaveBeenCalledTimes(2);

    // @ts-ignore this is a mock
    expect(context.getShaderParameter.mock.calls[0][0]).toEqual(VERTEX);
    // @ts-ignore this is a mock
    expect(context.getShaderParameter.mock.calls[1][0]).toEqual(FRAGMENT);
  });
  it('inits config space', () => {
    const context = makeContextMock();
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(context),
    });

    const flamegraph = makeFlamegraph();

    const renderer = new FlamegraphRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme,
      vec2.fromValues(0, 0)
    );

    expect(
      // Config height is basically many flamegraph rectangles can fit into
      // the viewport vertically and config width is the duration of the flamegraph
      renderer.configSpace.equals(
        new Rect(0, 0, 10, context.canvas.height / LightFlamegraphTheme.SIZES.BAR_HEIGHT)
      )
    ).toBe(true);
  });
  it('inits physical space', () => {
    const context = makeContextMock();
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(context),
    });

    const flamegraph = makeFlamegraph();

    const renderer = new FlamegraphRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme,
      vec2.fromValues(0, 0)
    );

    expect(
      // Config height is basically many flamegraph rectangles can fit into
      // the viewport vertically and config width is the duration of the flamegraph
      renderer.physicalSpace.equals(
        new Rect(0, 0, context.canvas.width, context.canvas.height)
      )
    ).toBe(true);
  });
  it('inits logical space', () => {
    // @ts-ignore partial canvas mock
    const context = makeContextMock({canvas: {width: 100, height: 100}});
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(context),
    });

    const flamegraph = makeFlamegraph();

    const renderer = new FlamegraphRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme,
      vec2.fromValues(0, 0)
    );

    expect(renderer.logicalSpace).toEqual(new Rect(0, 0, 100, 100));
  });
  it('inits logicalToPhysicalSpace', () => {
    window.devicePixelRatio = 2;
    // @ts-ignore partial mock
    const context = makeContextMock({canvas: {width: 100, height: 100}});
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(context),
    });

    const flamegraph = makeFlamegraph();

    const renderer = new FlamegraphRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme,
      vec2.fromValues(0, 0)
    );

    expect(renderer.logicalToPhysicalSpace).toEqual(
      mat3.fromScaling(mat3.create(), vec2.fromValues(2, 2))
    );
  });

  it('handles resize events by updating space', () => {
    const canvasMock = {canvas: {width: 100, height: 100}};

    // @ts-ignore partial canvas mock
    const context = makeContextMock(canvasMock);
    // @ts-ignore partial canvas mock
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(context),
    });

    const flamegraph = makeFlamegraph();

    const renderer = new FlamegraphRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme,
      vec2.fromValues(0, 0)
    );

    expect(renderer.physicalSpace).toEqual(new Rect(0, 0, 100, 100));
    canvasMock.canvas.width = 200;
    canvasMock.canvas.height = 200;

    renderer.onResizeUpdateSpace();
    expect(renderer.physicalSpace).toEqual(new Rect(0, 0, 200, 200));
  });

  it('getColorForFrame', () => {
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(makeContextMock()),
    });

    const flamegraph = makeFlamegraph();
    flamegraph.colors = new Map([['f0', [1, 0, 0, 1]]]);

    const renderer = new FlamegraphRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme,
      vec2.fromValues(0, 0)
    );

    expect(renderer.getColorForFrame(flamegraph.frames[0].frame)).toEqual([1, 0, 0, 1]);
    expect(renderer.getColorForFrame(new Frame({key: 0, name: 'Unknown'}))).toEqual(
      LightFlamegraphTheme.COLORS.FRAME_FALLBACK_COLOR
    );
  });
  describe('getConfigSpaceCursor', () => {
    it('when view is not zoomed', () => {
      const canvas = makeCanvasMock({
        getContext: jest
          .fn()
          // @ts-ignore
          .mockReturnValue(makeContextMock({canvas: {width: 1000, height: 2000}})),
      });

      const flamegraph = makeFlamegraph({startValue: 0, endValue: 100});

      const renderer = new FlamegraphRenderer(
        canvas as HTMLCanvasElement,
        flamegraph,
        LightFlamegraphTheme,
        vec2.fromValues(0, 0)
      );

      // x=250 is 1/4 of the width of the viewport, so it should map to flamegraph duration / 4
      // y=250 is at 1/8th the height of the viewport, so it should map to view height / 8
      expect(renderer.getConfigSpaceCursor(vec2.fromValues(250, 250))).toEqual(
        vec2.fromValues(25, 2000 / LightFlamegraphTheme.SIZES.BAR_HEIGHT / 8)
      );
    });
  });

  it.todo('getHoveredNode');

  describe('setConfigView', () => {
    it.todo('handles edge detection on X axis');
    it.todo('handles edge detection on Y axis');
  });

  describe('draw', () => {
    it.todo('sets uniform1f for search results');
    it.todo('draws all frames');
  });
});
