import {mat3} from 'gl-matrix';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {
  DEFAULT_FLAMEGRAPH_RENDERER_OPTIONS,
  FlamegraphRenderer,
  FlamegraphRendererOptions,
} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';

// Convert color component from 0-1 to 0-255 range
function colorComponentsToRgba(color: number[]): string {
  return `rgba(${Math.floor(color[0] * 255)}, ${Math.floor(color[1] * 255)}, ${Math.floor(
    color[2] * 255
  )}, ${color[3] ?? 1})`;
}

export class FlamegraphRendererDOM extends FlamegraphRenderer {
  container: HTMLElement;

  constructor(
    canvas: HTMLCanvasElement,
    flamegraph: Flamegraph,
    theme: FlamegraphTheme,
    options: FlamegraphRendererOptions = DEFAULT_FLAMEGRAPH_RENDERER_OPTIONS
  ) {
    super(canvas, flamegraph, theme, options);

    const newContainer = document.createElement('div');
    document.body.appendChild(newContainer);
    this.container = newContainer;
  }

  draw(configViewToPhysicalSpace: mat3) {
    if (!this.container) {
      throw new Error('No container to render into');
    }

    const parent = document.body;

    if (this.container) {
      this.container.remove();
    }

    const newContainer = document.createElement('div');
    newContainer.setAttribute('data-test-id', 'flamegraph-zoom-view-container');

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
        this.colorMap.get(frame.key) ?? this.theme.COLORS.FRAME_GRAYSCALE_COLOR;
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

  setHighlightedFrames(_frames: FlamegraphFrame[] | null) {
    // @TODO for now just dont do anything as it will throw in tests
  }

  setSearchResults(
    _query: string,
    _searchResults: FlamegraphSearch['results']['frames']
  ) {
    // @TODO for now just dont do anything as it will throw in tests
  }
}
