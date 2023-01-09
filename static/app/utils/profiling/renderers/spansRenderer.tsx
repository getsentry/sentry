import {mat3, vec2} from 'gl-matrix';

import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {
  getContext,
  Rect,
  resizeCanvasToDisplaySize,
} from 'sentry/utils/profiling/gl/utils';
import {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';

import {makeSpansColorMapByOpAndDescription} from '../colors/utils';

// Convert color component from 0-1 to 0-255 range
function colorComponentsToRgba(color: number[]): string {
  return `rgba(${Math.floor(color[0] * 255)}, ${Math.floor(color[1] * 255)}, ${Math.floor(
    color[2] * 255
  )}, ${color[3] ?? 1})`;
}

export class SpanChartRenderer2D {
  canvas: HTMLCanvasElement | null;
  spanChart: SpanChart;
  theme: FlamegraphTheme;

  context: CanvasRenderingContext2D;
  colors: ReturnType<typeof makeSpansColorMapByOpAndDescription>;

  constructor(canvas: HTMLCanvasElement, spanChart: SpanChart, theme: FlamegraphTheme) {
    this.canvas = canvas;
    this.spanChart = spanChart;
    this.theme = theme;

    this.context = getContext(this.canvas, '2d');
    this.colors = makeSpansColorMapByOpAndDescription(
      this.spanChart.spans,
      this.theme.COLORS.SPAN_COLOR_BUCKET
    );

    resizeCanvasToDisplaySize(this.canvas);
  }

  getColorForFrame(span: SpanChartNode): number[] {
    return (
      this.colors.get(span.node.span.span_id) ?? this.theme.COLORS.FRAME_FALLBACK_COLOR
    );
  }

  findHoveredNode(configSpaceCursor: vec2): SpanChartNode | null {
    // ConfigSpace origin is at top of rectangle, so we need to offset bottom by 1
    // to account for size of renderered rectangle.
    if (configSpaceCursor[1] > this.spanChart.configSpace.bottom + 1) {
      return null;
    }

    if (
      configSpaceCursor[0] < this.spanChart.configSpace.left ||
      configSpaceCursor[0] > this.spanChart.configSpace.right
    ) {
      return null;
    }

    let hoveredNode: SpanChartNode | null = null;
    const queue = [...this.spanChart.root.children];

    while (queue.length && !hoveredNode) {
      const span = queue.pop()!;

      // We treat entire span chart as a segment tree, this allows us to query in O(log n) time by
      // only looking at the nodes that are relevant to the current cursor position. We discard any values
      // on x axis that do not overlap the cursor, and descend until we find a node that overlaps at cursor y position
      if (configSpaceCursor[0] < span.start || configSpaceCursor[0] > span.end) {
        continue;
      }

      // If our frame depth overlaps cursor y position, we have found our node
      if (configSpaceCursor[1] >= span.depth && configSpaceCursor[1] <= span.depth + 1) {
        hoveredNode = span;
        break;
      }

      // Descend into the rest of the children
      for (let i = 0; i < span.children.length; i++) {
        queue.push(span.children[i]);
      }
    }
    return hoveredNode;
  }

  draw(configView: Rect, configViewToPhysicalSpace: mat3) {
    if (!this.canvas) {
      throw new Error('No canvas to draw on');
    }

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const BORDER_WIDTH = 2 * window.devicePixelRatio;
    const TOP_BOUNDARY = configView.top - 1;
    const BOTTOM_BOUNDARY = configView.bottom + 1;

    const spans: SpanChartNode[] = [...this.spanChart.root.children];

    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];

      if (span.end < configView.left || span.start > configView.right) {
        continue;
      }

      if (span.depth > BOTTOM_BOUNDARY) {
        continue;
      }

      for (let j = 0; j < span.children.length; j++) {
        spans.push(span.children[j]);
      }

      if (span.depth < TOP_BOUNDARY) {
        continue;
      }

      const color =
        this.colors.get(span.node.span.span_id) ?? this.theme.COLORS.SPAN_FALLBACK_COLOR;

      if (!color) {
        throw new Error('Missing color for span');
      }

      this.context.fillStyle = colorComponentsToRgba(color);
      const rect = new Rect(span.start, span.depth, span.duration, 1).transformRect(
        configViewToPhysicalSpace
      );

      this.context.fillRect(
        rect.x + BORDER_WIDTH / 2,
        rect.y + BORDER_WIDTH / 2,
        rect.width - BORDER_WIDTH / 2,
        rect.height - BORDER_WIDTH / 2
      );
    }
  }
}
