import type {mat3} from 'gl-matrix';

import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import type {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {getFlamegraphFrameSearchId} from 'sentry/utils/profiling/flamegraphFrame';
import {getContext, resizeCanvasToDisplaySize} from 'sentry/utils/profiling/gl/utils';
import type {FlamegraphRendererOptions} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {
  DEFAULT_FLAMEGRAPH_RENDERER_OPTIONS,
  FlamegraphRenderer,
} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';

function colorComponentsToRgba(color: number[]): string {
  return `rgba(${Math.floor(color[0]! * 255)}, ${Math.floor(color[1]! * 255)}, ${Math.floor(
    color[2]! * 255
  )}, ${color[3] ?? 1})`;
}

export class FlamegraphRenderer2D extends FlamegraphRenderer {
  ctx: CanvasRenderingContext2D | null = null;
  searchResults: FlamegraphSearch['results']['frames'] = new Map();
  isSearching = false;

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

      const color = this.colorMap.get(frame.key) ?? this.theme.COLORS.SPAN_FALLBACK_COLOR;

      this.ctx.fillStyle =
        this.isSearching && !this.searchResults.has(getFlamegraphFrameSearchId(frame))
          ? colorComponentsToRgba(this.theme.COLORS.FRAME_FALLBACK_COLOR)
          : colorComponentsToRgba(color);

      this.ctx.fillRect(
        rect.x + border,
        rect.y + border,
        rect.width - border,
        rect.height - border
      );

      for (const child of frame.children) {
        queue.push(child);
      }
    }
  }

  setSearchResults(query: string, searchResults: FlamegraphSearch['results']['frames']) {
    if (!this.ctx) {
      return;
    }

    this.isSearching = query.length > 0;
    this.searchResults = searchResults;
  }
}
