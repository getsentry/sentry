import {vec2} from 'gl-matrix';

import {
  makeCanvasMock,
  makeContextMock,
  makeFlamegraph,
} from 'sentry-test/profiling/utils';

import {
  LightFlamegraphTheme,
  LightFlamegraphTheme as theme,
} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {FlamegraphView} from 'sentry/utils/profiling/flamegraphView';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';

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
          ...theme,
          COLORS: {
            ...theme.COLORS,
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
      theme
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
      theme
    );

    expect(context.createShader).toHaveBeenCalledTimes(2);
    expect(context.getShaderParameter).toHaveBeenCalledTimes(2);

    // @ts-ignore this is a mock
    expect(context.getShaderParameter.mock.calls[0][0]).toEqual(VERTEX);
    // @ts-ignore this is a mock
    expect(context.getShaderParameter.mock.calls[1][0]).toEqual(FRAGMENT);
  });

  it('getColorForFrame', () => {
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(makeContextMock()),
    });

    const flamegraph = makeFlamegraph();

    const renderer = new FlamegraphRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      theme
    );

    expect(renderer.getColorForFrame(flamegraph.frames[0])).toEqual([
      0.9750000000000001, 0.7250000000000001, 0.7250000000000001,
    ]);
    expect(
      renderer.getColorForFrame({
        key: 20,
        frame: flamegraph.frames[0].frame,
        node: flamegraph.frames[0].node,
        parent: null,
        children: [],
        depth: 0,
        start: 0,
        end: 0,
      })
    ).toEqual(LightFlamegraphTheme.COLORS.FRAME_FALLBACK_COLOR);
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
      theme
    );

    expect(renderer.getHoveredNode(vec2.fromValues(-1, 0))).toBeNull();
    expect(renderer.getHoveredNode(vec2.fromValues(-1, 0))).toBeNull();
    expect(renderer.getHoveredNode(vec2.fromValues(0, 0))?.frame?.name).toBe('f0');
    expect(renderer.getHoveredNode(vec2.fromValues(5, 2))?.frame?.name).toBe('f3');
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

      const flamegraphCanvas = new FlamegraphCanvas(canvas, vec2.fromValues(0, 0));
      const flamegraphView = new FlamegraphView({
        canvas: flamegraphCanvas,
        flamegraph,
        theme,
      });
      const renderer = new FlamegraphRenderer(canvas, flamegraph, theme);

      renderer.draw(
        flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace),
        results
      );
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

      const flamegraphCanvas = new FlamegraphCanvas(canvas, vec2.fromValues(0, 0));
      const flamegraphView = new FlamegraphView({
        canvas: flamegraphCanvas,
        flamegraph,
        theme,
      });
      const renderer = new FlamegraphRenderer(canvas, flamegraph, theme);

      renderer.draw(flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace));
      expect(context.drawArrays).toHaveBeenCalledTimes(2);
    });
  });
});
