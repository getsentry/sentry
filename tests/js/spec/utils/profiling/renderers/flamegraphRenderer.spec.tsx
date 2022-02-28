import {mat3, vec2} from 'gl-matrix';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {LightFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Frame} from 'sentry/utils/profiling/frame';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';
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
};

const makeFlamegraph = (
  trace?: Partial<Profiling.EventedProfile>,
  frames?: Profiling.Schema['shared']['frames']
): Flamegraph => {
  return new Flamegraph(
    EventedProfile.FromProfile(
      trace ? {...base, ...trace} : base,
      createFrameIndex(frames ?? [{name: 'f0'}])
    ),
    0,
    {inverted: false, leftHeavy: false}
  );
};

const makeContextMock = (
  partialMock: Partial<WebGLRenderingContext> = {}
): WebGLRenderingContext => {
  const context: Partial<WebGLRenderingContext> = {
    attachShader: jest.fn(),
    bufferData: jest.fn(),
    blendFuncSeparate: jest.fn(),
    bindBuffer: jest.fn(),
    clearColor: jest.fn(),
    clear: jest.fn(),
    createShader: jest.fn().mockReturnValue({}),
    createProgram: jest.fn().mockReturnValue({}),
    createBuffer: jest.fn().mockReturnValue([]),
    compileShader: jest.fn(),
    drawArrays: jest.fn(),
    enable: jest.fn(),
    enableVertexAttribArray: jest.fn(),
    getShaderParameter: jest.fn().mockReturnValue(1),
    getProgramParameter: jest.fn().mockReturnValue({}),
    getUniformLocation: jest.fn().mockReturnValue({}),
    getAttribLocation: jest.fn().mockReturnValue({}),
    linkProgram: jest.fn(),
    shaderSource: jest.fn(),
    uniformMatrix3fv: jest.fn(),
    uniform1i: jest.fn(),
    uniform2f: jest.fn(),
    useProgram: jest.fn(),
    vertexAttribPointer: jest.fn(),
    viewport: jest.fn(),

    // @ts-ignore
    canvas: {
      width: 1000,
      height: 1000,
    },
    ...partialMock,
  };

  return context as WebGLRenderingContext;
};

const makeCanvasMock = (
  partialMock: Partial<HTMLCanvasElement> = {}
): HTMLCanvasElement => {
  const canvas: Partial<HTMLCanvasElement> = {
    getContext: jest.fn().mockReturnValue(makeContextMock()),
    height: 1000,
    width: 1000,
    ...partialMock,
  };

  return canvas as HTMLCanvasElement;
};

const originalDpr = window.devicePixelRatio;

describe('flamegraphRenderer', () => {
  beforeEach(() => {
    // We simulate regular screens unless differently specified
    window.devicePixelRatio = 1;
  });
  afterEach(() => {
    window.devicePixelRatio = originalDpr;
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
  });

  it('inits vertices', () => {
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(makeContextMock()),
    });

    const flamegraph = makeFlamegraph();

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

    // @ts-ignore shaders are init from the constructor
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

    const renderer = new FlamegraphRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme,
      vec2.fromValues(0, 0)
    );

    expect(renderer.getColorForFrame(flamegraph.frames[0].frame)).toEqual([
      0.9750000000000001, 0.7250000000000001, 0.7250000000000001,
    ]);
    expect(renderer.getColorForFrame(new Frame({key: 20, name: 'Unknown'}))).toEqual(
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

  it('getHoveredNode', () => {
    const flamegraph = makeFlamegraph(
      {
        events: [
          {type: 'O', at: 0, frame: 0},
          {type: 'O', at: 1, frame: 1},
          {type: 'C', at: 2, frame: 1},
          {type: 'C', at: 3, frame: 0},
          {type: 'O', at: 4, frame: 2},
          {type: 'O', at: 5, frame: 3},
          {type: 'C', at: 7, frame: 3},
          {type: 'C', at: 8, frame: 2},
          {type: 'O', at: 9, frame: 4},
          {type: 'O', at: 10, frame: 5},
          {type: 'C', at: 11, frame: 5},
          {type: 'C', at: 12, frame: 4},
        ],
      },
      [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}, {name: 'f3'}, {name: 'f4'}, {name: 'f5'}]
    );

    const renderer = new FlamegraphRenderer(
      makeCanvasMock() as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme,
      vec2.fromValues(0, 0)
    );

    expect(renderer.getHoveredNode(vec2.fromValues(-1, 0))).toBeNull();
    expect(renderer.getHoveredNode(vec2.fromValues(-1, 0))).toBeNull();
    expect(renderer.getHoveredNode(vec2.fromValues(0, 0))?.frame?.name).toBe('f0');
    expect(renderer.getHoveredNode(vec2.fromValues(5, 2))?.frame?.name).toBe('f3');
  });

  describe('setConfigView', () => {
    const makeRenderer = () => {
      const flamegraph = makeFlamegraph(
        {
          startValue: 0,
          endValue: 1000,
          events: [
            {type: 'O', frame: 0, at: 0},
            {type: 'C', frame: 0, at: 500},
          ],
        },
        [{name: 'f0'}]
      );

      return new FlamegraphRenderer(
        makeCanvasMock() as HTMLCanvasElement,
        flamegraph,
        LightFlamegraphTheme,
        vec2.fromValues(0, 0)
      );
    };

    it('does not allow zooming in more than the min width of a frame', () => {
      const renderer = makeRenderer();
      expect(
        renderer.setConfigView(new Rect(0, 0, 10, 50)).equals(new Rect(0, 0, 500, 50))
      ).toBe(true);
    });

    it('does not allow zooming out more than the duration of a profile', () => {
      const renderer = makeRenderer();
      expect(
        renderer.setConfigView(new Rect(0, 0, 2000, 50)).equals(new Rect(0, 0, 1000, 50))
      ).toBe(true);
    });

    describe('edge detection on X axis', () => {
      it('is not zoomed in', () => {
        const renderer = makeRenderer();

        // Check that we cant go negative X from start of profile
        expect(
          renderer
            .setConfigView(new Rect(-100, 0, 1000, 50))
            .equals(new Rect(0, 0, 1000, 50))
        ).toBe(true);
        // Check that we cant go over X from end of profile
        expect(
          renderer
            .setConfigView(new Rect(2000, 0, 1000, 50))
            .equals(new Rect(0, 0, 1000, 50))
        ).toBe(true);
      });

      it('is zoomed in', () => {
        const renderer = makeRenderer();

        // Duration is is 1000, so we can't go over the end of the profile
        expect(
          renderer
            .setConfigView(new Rect(600, 0, 500, 50))
            .equals(new Rect(500, 0, 500, 50))
        ).toBe(true);
      });
    });

    describe('edge detection on Y axis', () => {
      it('is not zoomed in', () => {
        const renderer = makeRenderer();

        // Check that we cant go under stack height
        expect(
          renderer
            .setConfigView(new Rect(0, -50, 1000, 50))
            .equals(new Rect(0, 0, 1000, 50))
        ).toBe(true);

        // Check that we cant go over stack height
        expect(
          renderer
            .setConfigView(new Rect(0, 50, 1000, 50))
            .equals(new Rect(0, 0, 1000, 50))
        ).toBe(true);
      });

      it('is zoomed in', () => {
        const renderer = makeRenderer();

        // Check that we cant go over stack height
        expect(
          renderer
            .setConfigView(new Rect(0, 50, 1000, 25))
            .equals(new Rect(0, 25, 1000, 25))
        ).toBe(true);
      });
    });
  });

  describe('draw', () => {
    it('sets uniform1f for search results', () => {
      const context = makeContextMock();
      const canvas = makeCanvasMock({
        getContext: jest.fn().mockReturnValue(context),
      }) as HTMLCanvasElement;

      // @ts-ignore partial mock, we dont need the actual frame,
      // only f0 matched a search result
      const results: Record<string, FlamegraphFrame> = {f00: 1};

      const flamegraph = makeFlamegraph(
        {
          startValue: 0,
          endValue: 100,
          events: [
            {
              type: 'O',
              frame: 0,
              at: 0,
            },
            {
              type: 'C',
              frame: 0,
              at: 1,
            },
            {
              type: 'O',
              frame: 1,
              at: 1,
            },
            {
              type: 'C',
              frame: 1,
              at: 2,
            },
          ],
        },
        [{name: 'f0'}, {name: 'f1'}]
      );

      const renderer = new FlamegraphRenderer(
        canvas,
        flamegraph,
        LightFlamegraphTheme,
        vec2.fromValues(0, 0)
      );

      renderer.draw(results, renderer.configToPhysicalSpace);
      expect(context.uniform1i).toHaveBeenCalledTimes(3);
      expect(context.drawArrays).toHaveBeenCalledTimes(2);
    });
    it('draws all frames', () => {
      const context = makeContextMock();
      const canvas = makeCanvasMock({
        getContext: jest.fn().mockReturnValue(context),
      }) as HTMLCanvasElement;

      const flamegraph = makeFlamegraph(
        {
          startValue: 0,
          endValue: 100,
          events: [
            {
              type: 'O',
              frame: 0,
              at: 0,
            },
            {
              type: 'C',
              frame: 0,
              at: 1,
            },
            {
              type: 'O',
              frame: 1,
              at: 1,
            },
            {
              type: 'C',
              frame: 1,
              at: 2,
            },
          ],
        },
        [{name: 'f0'}, {name: 'f1'}]
      );

      const renderer = new FlamegraphRenderer(
        canvas,
        flamegraph,
        LightFlamegraphTheme,
        vec2.fromValues(0, 0)
      );

      renderer.draw(null, renderer.configToPhysicalSpace);
      expect(context.drawArrays).toHaveBeenCalledTimes(2);
    });
  });
});
