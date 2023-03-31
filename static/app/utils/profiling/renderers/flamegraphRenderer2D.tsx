import {mat3} from 'gl-matrix';

import {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';

// Convert color component from 0-1 to 0-255 range
function colorComponentsToRgba(color: number[]): string {
  return `rgba(${Math.floor(color[0] * 255)}, ${Math.floor(color[1] * 255)}, ${Math.floor(
    color[2] * 255
  )}, ${color[3] ?? 1})`;
}

export class FlamegraphRenderer2D extends FlamegraphRenderer {
  draw(configViewToPhysicalSpace: mat3) {
    if (!this.canvas) {
      throw new Error('No canvas to draw on');
    }

    const context = this.canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas 2d context');
    }

    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
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

  setSearchResults(
    _query: string,
    _searchResults: FlamegraphSearch['results']['frames']
  ) {
    throw new Error('Method `setSearchResults` not implemented.');
  }
}
