import {mat3, vec2} from 'gl-matrix';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

export class FlamegraphRenderer {
  canvas: HTMLCanvasElement;
  flamegraph: Flamegraph;
  theme: FlamegraphTheme;
  options: {draw_border: boolean};

  frames: ReadonlyArray<FlamegraphFrame>;
  roots: ReadonlyArray<FlamegraphFrame>;

  colorBuffer: Array<number>;
  colorMap: Map<string | number, number[]>;

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

    this.frames = this.flamegraph.frames;
    this.roots = this.flamegraph.root.children;

    const {colorBuffer, colorMap} = this.theme.COLORS.STACK_TO_COLOR(
      this.frames,
      this.theme.COLORS.COLOR_MAP,
      this.theme.COLORS.COLOR_BUCKET
    );
    this.colorBuffer = colorBuffer;
    this.colorMap = colorMap;
  }

  getColorForFrame(frame: FlamegraphFrame): number[] {
    return this.colorMap.get(frame.key) ?? this.theme.COLORS.FRAME_GRAYSCALE_COLOR;
  }

  findHoveredNode(configSpaceCursor: vec2): FlamegraphFrame | null {
    // ConfigSpace origin is at top of rectangle, so we need to offset bottom by 1
    // to account for size of renderered rectangle.
    if (configSpaceCursor[1] > this.flamegraph.configSpace.bottom + 1) {
      return null;
    }

    if (configSpaceCursor[0] < this.flamegraph.configSpace.left) {
      return null;
    }

    if (configSpaceCursor[0] > this.flamegraph.configSpace.right) {
      return null;
    }

    let hoveredNode: FlamegraphFrame | null = null;
    const queue = [...this.roots];

    while (queue.length && !hoveredNode) {
      const frame = queue.pop()!;

      // We treat entire flamegraph as a segment tree, this allows us to query in O(log n) time by
      // only looking at the nodes that are relevant to the current cursor position. We discard any values
      // on x axis that do not overlap the cursor, and descend until we find a node that overlaps at cursor y position
      if (configSpaceCursor[0] < frame.start || configSpaceCursor[0] > frame.end) {
        continue;
      }

      // If our frame depth overlaps cursor y position, we have found our node
      if (
        configSpaceCursor[1] >= frame.depth &&
        configSpaceCursor[1] <= frame.depth + 1
      ) {
        hoveredNode = frame;
        break;
      }

      // Descend into the rest of the children
      for (let i = 0; i < frame.children.length; i++) {
        queue.push(frame.children[i]);
      }
    }
    return hoveredNode;
  }

  setHighlightedFrames(_frames: FlamegraphFrame[] | null) {
    throw new Error('Method `setHighlightedFrames` not implemented.');
  }

  setSearchResults(
    _query: string,
    _searchResults: FlamegraphSearch['results']['frames']
  ) {
    throw new Error('Method `setSearchResults` not implemented.');
  }

  draw(_configViewToPhysicalSpace: mat3): void {
    throw new Error('Method `draw` not implemented.');
  }
}
