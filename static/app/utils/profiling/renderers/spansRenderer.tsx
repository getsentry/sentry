import type {mat3, vec2} from 'gl-matrix';

import type {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import type {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {getContext, resizeCanvasToDisplaySize} from 'sentry/utils/profiling/gl/utils';
import type {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';
import {Rect} from 'sentry/utils/profiling/speedscope';

import {makeSpansColorMapByOpAndDescription} from '../colors/utils';

// Convert color component from 0-1 to 0-255 range
function colorComponentsToRgba(color: number[] | undefined): string {
  return `rgba(${Math.floor(color?.[0]! * 255)}, ${Math.floor(color?.[1]! * 255)}, ${Math.floor(
    color?.[2]! * 255
  )}, ${color?.[3] ?? 1})`;
}

/**
 * Creates a striped canvas pattern used to fill missing instrumentation
 * rectangles so they stand out from the rest of the spans.
 */
function makePatternCanvas(
  barHeight: number,
  backgroundColor: string,
  barColor: string
): [CanvasPattern | null, string] {
  const dpr = window.devicePixelRatio;
  const canvas = document.createElement('canvas');

  // Extend by width
  const lineWidth = 4 * dpr;
  const width = barHeight * dpr + lineWidth;

  canvas.width = width;
  canvas.height = width;
  const ctx = getContext(canvas, '2d');

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, width);

  ctx.lineCap = 'round';
  ctx.lineWidth = 2 * dpr;
  const offset = 12;
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(width + offset * i, 0);
    ctx.lineTo(0 + offset * i, width);
  }
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(width - offset * i, 0);
    ctx.lineTo(0 - offset * i, width);
  }
  ctx.strokeStyle = barColor;
  ctx.stroke();

  const pattern = ctx.createPattern(canvas, 'repeat');
  return [pattern, canvas.toDataURL()];
}

export class SpanChartRenderer2D {
  canvas: HTMLCanvasElement | null;
  spanChart: SpanChart;
  theme: FlamegraphTheme;
  searchResults: FlamegraphSearch['results']['spans'] = new Map();

  pattern: CanvasPattern;
  patternDataUrl: string;
  context: CanvasRenderingContext2D;
  colors: ReturnType<typeof makeSpansColorMapByOpAndDescription>;

  isSearching = false;

  constructor(canvas: HTMLCanvasElement, spanChart: SpanChart, theme: FlamegraphTheme) {
    this.canvas = canvas;
    this.spanChart = spanChart;
    this.theme = theme;

    this.context = getContext(this.canvas, '2d');
    this.colors = makeSpansColorMapByOpAndDescription(
      this.spanChart.spans,
      this.theme.COLORS.SPAN_COLOR_BUCKET
    );

    const [pattern, thumbnail] = makePatternCanvas(
      this.theme.SIZES.SPANS_BAR_HEIGHT,
      this.theme.COLORS.SPAN_FRAME_LINE_PATTERN_BACKGROUND,
      this.theme.COLORS.SPAN_FRAME_LINE_PATTERN
    );
    if (!pattern) {
      throw new Error('Failed to create canvas pattern');
    }
    this.pattern = pattern;
    this.patternDataUrl = thumbnail;

    resizeCanvasToDisplaySize(this.canvas);
  }

  getColorForFrame(span: SpanChartNode): number[] | CanvasPattern {
    if (span.node.span.op === 'missing-instrumentation') {
      return this.pattern;
    }
    return (
      this.colors.get(span.node.span.span_id) ?? this.theme.COLORS.FRAME_FALLBACK_COLOR
    );
  }

  setSearchResults(query: string, searchResults: FlamegraphSearch['results']['spans']) {
    this.isSearching = query.length > 0;
    this.searchResults = searchResults;
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
      for (const child of span.children) {
        queue.push(child);
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

    for (const span of spans) {
      if (span.end < configView.left || span.start > configView.right) {
        continue;
      }

      if (span.depth > BOTTOM_BOUNDARY) {
        continue;
      }

      for (const child of span.children) {
        spans.push(child);
      }

      if (span.depth < TOP_BOUNDARY) {
        continue;
      }

      const rect = new Rect(span.start, span.depth, span.duration, 1).transformRect(
        configViewToPhysicalSpace
      );

      const color =
        this.colors.get(span.node.span.span_id) ?? this.theme.COLORS.SPAN_FALLBACK_COLOR;

      // Reset any transforms that may have been applied before.
      // If we dont do it, it sometimes causes the canvas to be drawn with a translation
      this.context.setTransform(1, 0, 0, 1, 0, 0);

      if (span.node.span.op === 'missing span instrumentation') {
        this.context.beginPath();
        this.context.rect(
          rect.x + BORDER_WIDTH / 2,
          rect.y + BORDER_WIDTH / 2,
          rect.width - BORDER_WIDTH / 2,
          rect.height - BORDER_WIDTH / 2
        );
        this.context.setTransform(1, 0, 0, 1, rect.x, rect.y);
        this.context.fillStyle = this.pattern;
        this.context.fill();
      } else {
        this.context.beginPath();

        this.context.fillStyle =
          this.isSearching && !this.searchResults.has(span.node.span.span_id)
            ? colorComponentsToRgba(this.theme.COLORS.FRAME_FALLBACK_COLOR)
            : colorComponentsToRgba(color);

        this.context.fillRect(
          rect.x + BORDER_WIDTH / 2,
          rect.y + BORDER_WIDTH / 2,
          rect.width - BORDER_WIDTH / 2,
          rect.height - BORDER_WIDTH / 2
        );
      }
    }

    // Reset canvas transform at the end
    this.context.setTransform(1, 0, 0, 1, 0, 0);
  }
}
