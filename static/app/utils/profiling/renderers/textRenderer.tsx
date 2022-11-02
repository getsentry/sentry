import {mat3} from 'gl-matrix';

import {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';

import {Flamegraph} from '../flamegraph';
import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {FlamegraphFrame, getFlamegraphFrameSearchId} from '../flamegraphFrame';
import {
  computeHighlightedBounds,
  ELLIPSIS,
  findRangeBinarySearch,
  getContext,
  Rect,
  resizeCanvasToDisplaySize,
  trimTextCenter,
} from '../gl/utils';

const TEST_STRING = 'Who knows if this changed, font-display: swap wont tell me';

class TextRenderer {
  canvas: HTMLCanvasElement;
  theme: FlamegraphTheme;
  flamegraph: Flamegraph;
  context: CanvasRenderingContext2D;
  textCache: Record<string, TextMetrics>;

  constructor(canvas: HTMLCanvasElement, flamegraph: Flamegraph, theme: FlamegraphTheme) {
    this.canvas = canvas;
    this.theme = theme;
    this.flamegraph = flamegraph;

    this.context = getContext(canvas, '2d');
    this.textCache = {};
    resizeCanvasToDisplaySize(canvas);
  }

  measureAndCacheText(text: string): TextMetrics {
    if (this.textCache[text]) {
      // @ts-expect-error TS(2322) FIXME: Type 'TextMetrics | undefined' is not assignable t... Remove this comment to see the full error message
      return this.textCache[text];
    }
    this.textCache[text] = this.context.measureText(text);
    // @ts-expect-error TS(2322) FIXME: Type 'TextMetrics | undefined' is not assignable t... Remove this comment to see the full error message
    return this.textCache[text];
  }

  maybeInvalidateCache(): void {
    if (this.textCache[TEST_STRING] === undefined) {
      this.measureAndCacheText(TEST_STRING);
      return;
    }

    const newMeasuredSize = this.context.measureText(TEST_STRING);
    if (newMeasuredSize !== this.textCache[TEST_STRING]) {
      this.textCache = {[TEST_STRING]: newMeasuredSize};
    }
  }

  draw(
    configView: Rect,
    configViewToPhysicalSpace: mat3,
    flamegraphSearchResults: FlamegraphSearch['results']
  ): void {
    // Make sure we set font size before we measure text for the first draw
    const FONT_SIZE = this.theme.SIZES.BAR_FONT_SIZE * window.devicePixelRatio;
    this.context.font = `${FONT_SIZE}px ${this.theme.FONTS.FRAME_FONT}`;
    this.context.textBaseline = 'alphabetic';

    this.maybeInvalidateCache();

    const MIN_WIDTH = this.measureAndCacheText(ELLIPSIS).width;
    const SIDE_PADDING = 2 * this.theme.SIZES.BAR_PADDING * window.devicePixelRatio;
    const HALF_SIDE_PADDING = SIDE_PADDING / 2;
    const BASELINE_OFFSET =
      (this.theme.SIZES.BAR_HEIGHT - this.theme.SIZES.BAR_FONT_SIZE / 2) *
      window.devicePixelRatio;

    const HIGHLIGHT_BACKGROUND_COLOR = `rgb(${this.theme.COLORS.HIGHLIGHTED_LABEL_COLOR.join(
      ', '
    )})`;

    const TOP_BOUNDARY = configView.top - 1;
    const BOTTOM_BOUNDARY = configView.bottom + 1;
    const HAS_SEARCH_RESULTS = flamegraphSearchResults.size > 0;

    // We start by iterating over root frames, so we draw the call stacks top-down.
    // This allows us to do a couple optimizations that improve our best case performance.
    // 1. We can skip drawing the entire tree if the root frame is not visible
    // 2. We can skip drawing and
    const frames: FlamegraphFrame[] = [...this.flamegraph.root.children];

    while (frames.length > 0) {
      const frame = frames.pop()!;

      // Check if our rect overlaps with the current viewport and skip it
      if (frame.end < configView.left || frame.start > configView.right) {
        continue;
      }

      // We pin the start and end of the frame, so scrolling around keeps text pinned to the left or right side of the viewport
      const pinnedStart = Math.max(frame.start, configView.left);
      const pinnedEnd = Math.min(frame.end, configView.right);

      // Transform frame to physical space coordinates. This does the same operation as
      // Rect.transformRect, but without allocating a new Rect object.
      const frameWidth =
        (pinnedEnd - pinnedStart) * configViewToPhysicalSpace[0] +
        configViewToPhysicalSpace[3];

      // Since the text is not exactly aligned to the left/right bounds of the frame, we need to subtract the padding
      // from the total width, so that we can truncate the center of the text accurately.
      const paddedRectangleWidth = frameWidth - SIDE_PADDING;

      // Since children of a frame cannot be wider than the frame itself, we can exit early and discard the entire subtree
      if (paddedRectangleWidth <= MIN_WIDTH) {
        continue;
      }

      if (frame.depth > BOTTOM_BOUNDARY) {
        continue;
      }

      for (let i = 0; i < frame.children.length; i++) {
        // @ts-expect-error TS(2345) FIXME: Argument of type 'FlamegraphFrame | undefined' is ... Remove this comment to see the full error message
        frames.push(frame.children[i]);
      }

      // If a frame is lower than the top, we can skip drawing its text, however
      // we can only do so after we have pushed it's children into the queue or else
      // those children will never be drawn and the entire sub-tree will be skipped.
      if (frame.depth < TOP_BOUNDARY) {
        continue;
      }

      // Transform frame to physical space coordinates. This does the same operation as
      // Rect.transformRect, but without allocating a new Rect object.
      const frameHeight =
        (pinnedEnd - pinnedStart) * configViewToPhysicalSpace[1] +
        configViewToPhysicalSpace[4];
      const frameX =
        pinnedStart * configViewToPhysicalSpace[0] +
        frame.depth * configViewToPhysicalSpace[3] +
        configViewToPhysicalSpace[6];
      const frameY =
        pinnedStart * configViewToPhysicalSpace[1] +
        frame.depth * configViewToPhysicalSpace[4] +
        configViewToPhysicalSpace[7];

      // We want to draw the text in the vertical center of the frame, so we substract half the height of the text.
      // Since the origin of the rect in the inverted view is also inverted, we need to add the height.
      const y = frameY + (frameHeight < 0 ? frameHeight : 0) + BASELINE_OFFSET;
      const x = frameX + (frameWidth < 0 ? frameWidth : 0) + HALF_SIDE_PADDING;

      const trim = trimTextCenter(
        frame.frame.name,
        findRangeBinarySearch(
          {low: 0, high: paddedRectangleWidth},
          n => this.measureAndCacheText(frame.frame.name.substring(0, n)).width,
          paddedRectangleWidth
        )[0]
      );

      if (HAS_SEARCH_RESULTS) {
        const frameId = getFlamegraphFrameSearchId(frame);
        const frameResults = flamegraphSearchResults.get(frameId);

        if (frameResults) {
          this.context.fillStyle = HIGHLIGHT_BACKGROUND_COLOR;

          const highlightedBounds = computeHighlightedBounds(frameResults.match, trim);

          const frontMatter = trim.text.slice(0, highlightedBounds[0]);
          const highlightWidth = this.measureAndCacheText(
            trim.text.substring(highlightedBounds[0], highlightedBounds[1])
          ).width;

          this.context.fillRect(
            x + this.measureAndCacheText(frontMatter).width,
            y + FONT_SIZE / 2 - BASELINE_OFFSET,
            highlightWidth,
            FONT_SIZE
          );
        }
      }
      this.context.fillStyle = this.theme.COLORS.LABEL_FONT_COLOR;
      this.context.fillText(trim.text, x, y);
    }
  }
}

export {TextRenderer};
