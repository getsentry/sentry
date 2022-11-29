import {mat3, vec2} from 'gl-matrix';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect} from 'sentry/utils/profiling/gl/utils';

// Convert color component from 0-1 to 0-255 range
function colorComponentsToRgba(color: number[]): string {
  return `rgba(${Math.floor(color[0] * 255)}, ${Math.floor(color[1] * 255)}, ${Math.floor(
    color[2] * 255
  )}, ${color[3] ?? 1})`;
}

export class FlamegraphDomRenderer {
  canvas: HTMLCanvasElement | null;
  container: HTMLElement;
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

    const newContainer = document.createElement('div');
    document.body.appendChild(newContainer);
    this.container = newContainer;

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

  draw(configViewToPhysicalSpace: mat3, _searchResults: FlamegraphSearch['results']) {
    if (!this.container) {
      throw new Error('No container to render into');
    }

    const parent = document.body;

    if (this.container) {
      this.container.remove();
    }

    const newContainer = document.createElement('div');
    this.container = newContainer;
    parent.appendChild(newContainer);

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
        this.colorMap.get(frame.key) ?? this.theme.COLORS.FRAME_FALLBACK_COLOR;
      const color = colorComponentsToRgba(colors);

      const div = document.createElement('div');
      div.style.pointerEvents = 'absolute';
      div.style.left = `${rect.x}px`;
      div.style.top = `${rect.y}px`;
      div.style.width = `${rect.width}px`;
      div.style.height = `${rect.height}px`;
      div.style.backgroundColor = color;
      div.innerHTML = frame.frame.name;

      this.container.appendChild(div);

      for (let i = 0; i < frame.children.length; i++) {
        queue.push(frame.children[i]);
      }
    }
  }
}
