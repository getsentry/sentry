import {mat3, vec2} from 'gl-matrix';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphSearch';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect} from 'sentry/utils/profiling/gl/utils';

// Convert color component from 0-1 to 0-255 range
function colorComponentsToRgba(color: number[]): string {
  return `rgba(${Math.floor(color[0] * 255)}, ${Math.floor(color[1] * 255)}, ${Math.floor(
    color[2] * 255
  )}, ${color[3] ?? 1})`;
}

export class FlamegraphRenderer2d {
  canvas: HTMLCanvasElement | null;
  flamegraph: Flamegraph;
  theme: FlamegraphTheme;
  options: {draw_border: boolean};

  frames: ReadonlyArray<FlamegraphFrame> = [];
  colorMap: Map<string | number, number[]> = new Map();

  constructor(
    canvas: HTMLCanvasElement,
    flamegraph: Flamegraph,
    theme: FlamegraphTheme,
    options: {draw_border: boolean} = {draw_border: false}
  ) {
    this.canvas = canvas;
    this.flamegraph = flamegraph;
    this.theme = theme;
    this.options = options;

    this.init();
  }

  init() {
    this.frames = [...this.flamegraph.frames];
    const {colorMap} = this.theme.COLORS.STACK_TO_COLOR(
      this.frames,
      this.theme.COLORS.COLOR_MAP,
      this.theme.COLORS.COLOR_BUCKET
    );

    this.colorMap = colorMap;
  }

  getColorForFrame(frame: FlamegraphFrame): number[] {
    return this.colorMap.get(frame.key) ?? this.theme.COLORS.FRAME_FALLBACK_COLOR;
  }

  // We dont really need this in node, it's just here for completeness and it makes
  // the flamegraph UI not throw errors when used in dev
  getHoveredNode(_configSpaceCursor: vec2): FlamegraphFrame | null {
    return null;
  }

  draw(
    configViewToPhysicalSpace: mat3,
    _searchResults: FlamegraphSearch['results'] = null
  ) {
    if (!this.canvas) {
      throw new Error('No canvas to draw on');
    }

    const queue: FlamegraphFrame[] = [...this.flamegraph.roots];
    const context = this.canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas 2d context');
    }

    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const border = window.devicePixelRatio;

    while (queue.length > 0) {
      const frame = queue.pop()!;

      const rect = new Rect(
        frame.start,
        frame.depth,
        frame.end - frame.start,
        1
      ).transformRect(configViewToPhysicalSpace);

      const colors =
        this.colorMap.get(frame.key) ?? this.theme.COLORS.FRAME_FALLBACK_COLOR;
      const color = colorComponentsToRgba(colors);

      context.fillStyle = color;
      context.fillRect(
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
}
