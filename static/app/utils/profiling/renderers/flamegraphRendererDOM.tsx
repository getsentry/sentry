import type {mat3} from 'gl-matrix';

import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import type {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {FlamegraphRendererOptions} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {
  DEFAULT_FLAMEGRAPH_RENDERER_OPTIONS,
  FlamegraphRenderer,
} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';

// Convert color component from 0-1 to 0-255 range
function colorComponentsToRgba(color: number[]): string {
  return `rgba(${Math.floor(color[0]! * 255)}, ${Math.floor(color[1]! * 255)}, ${Math.floor(
    color[2]! * 255
  )}, ${color[3] ?? 1})`;
}

export class FlamegraphRendererDOM extends FlamegraphRenderer {
  ctx: CanvasRenderingContext2D | null = null;
  container: HTMLElement;

  constructor(
    canvas: HTMLCanvasElement,
    flamegraph: Flamegraph,
    theme: FlamegraphTheme,
    options: FlamegraphRendererOptions = DEFAULT_FLAMEGRAPH_RENDERER_OPTIONS
  ) {
    super(canvas, flamegraph, theme, options);

    // @ts-expect-error we are mocking the ctx so that
    // safe renderer initialization does not skip the renderer
    this.ctx = {};

    const newContainer = document.createElement('div');
    canvas.parentElement?.appendChild(newContainer);
    this.container = newContainer;
  }

  draw(configViewToPhysicalSpace: mat3) {
    if (!this.container) {
      throw new Error('No container to render into');
    }

    const newContainer = document.createElement('div');
    this.canvas.parentElement?.appendChild(newContainer);
    this.container = newContainer;

    const queue: FlamegraphFrame[] = [...this.flamegraph.frames];
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
      div.setAttribute('data-test-id', 'flamegraph-frame');
      this.container.appendChild(div);
    }
  }

  setSearchResults(
    _query: string,
    _searchResults: FlamegraphSearch['results']['frames']
  ) {
    // @TODO for now just dont do anything as it will throw in tests
  }
}
