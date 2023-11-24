import {mat3} from 'gl-matrix';

import {colorComponentsToRGBA} from 'sentry/utils/profiling/colors/utils';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {getContext, resizeCanvasToDisplaySize} from 'sentry/utils/profiling/gl/utils';
import {
  DEFAULT_FLAMEGRAPH_RENDERER_OPTIONS,
  FlamegraphRenderer,
  FlamegraphRendererOptions,
} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';

export class FlamegraphRenderer2D extends FlamegraphRenderer {
  ctx: CanvasRenderingContext2D | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    flamegraph: Flamegraph,
    theme: FlamegraphTheme,
    options: FlamegraphRendererOptions = DEFAULT_FLAMEGRAPH_RENDERER_OPTIONS
  ) {
    super(canvas, flamegraph, theme, options);

    this.flamegraph = flamegraph;
    this.theme = theme;
    this.options = options;
    this.canvas = canvas;

    this.initCanvasContext();
  }

  initCanvasContext(): boolean {
    if (!this.canvas) {
      throw new Error('Cannot initialize context from null canvas');
    }

    this.ctx = getContext(this.canvas, '2d');
    if (!this.ctx) {
      throw new Error('Could not get canvas 2d context');
    }

    resizeCanvasToDisplaySize(this.canvas);
    return true;
  }

  draw(configViewToPhysicalSpace: mat3) {
    if (!this.canvas) {
      throw new Error('No canvas to draw on');
    }

    if (!this.ctx) {
      throw new Error('No canvas context to draw with');
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const border = window.devicePixelRatio;

    const queue: FlamegraphFrame[] = [...this.flamegraph.root.children];
    while (queue.length > 0) {
      const frame = queue.pop()!;

      const rect = new Rect(
        frame.start,
        frame.depth,
        frame.end - frame.start,
        1
      ).transformRect(configViewToPhysicalSpace);

      const colors =
        this.colorMap.get(frame.key) ?? this.theme.COLORS.FRAME_GRAYSCALE_COLOR;
      const color = colorComponentsToRGBA(colors);

      this.ctx.fillStyle = color;
      this.ctx.fillRect(
        rect.x + border,
        rect.y + border,
        rect.width - border,
        rect.height - border
      );

      for (let i = 0; i < frame.children.length; i++) {
        queue.push(frame.children[i]);
      }
    }
  }

  setSearchResults(
    _query: string,
    _searchResults: FlamegraphSearch['results']['frames']
  ) {
    throw new Error('Method `setSearchResults` not implemented.');
  }
}
