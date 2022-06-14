import {mat3} from 'gl-matrix';

import {Flamegraph} from '../flamegraph';
import {FlamegraphSearch} from '../flamegraph/flamegraphStateProvider/flamegraphSearch';
import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {FlamegraphFrame, getFlamegraphFrameSearchId} from '../flamegraphFrame';
import {
  ELLIPSIS,
  findRangeBinarySearch,
  getContext,
  matchHighlightedBounds,
  Rect,
  resizeCanvasToDisplaySize,
  trimTextCenter,
} from '../gl/utils';

class TextRenderer {
  textCache: Record<string, TextMetrics> = {};

  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  theme: FlamegraphTheme;
  flamegraph: Flamegraph;

  constructor(canvas: HTMLCanvasElement, flamegraph: Flamegraph, theme: FlamegraphTheme) {
    this.canvas = canvas;
    this.theme = theme;
    this.flamegraph = flamegraph;

    this.context = getContext(canvas, '2d');
    resizeCanvasToDisplaySize(canvas);
  }

  measureAndCacheText(text: string): TextMetrics {
    if (this.textCache[text]) {
      return this.textCache[text];
    }
    this.textCache[text] = this.context.measureText(text);
    return this.textCache[text];
  }

  maybeInvalidateCache(): void {
    const TEST_STRING = 'Who knows if this changed, font-display: swap wont tell me';

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
    flamegraphSearch: FlamegraphSearch | null = null
  ): void {
    this.maybeInvalidateCache();

    this.context.font = `${this.theme.SIZES.BAR_FONT_SIZE * window.devicePixelRatio}px ${
      this.theme.FONTS.FRAME_FONT
    }`;

    this.context.textBaseline = 'alphabetic';
    this.context.fillStyle = this.theme.COLORS.LABEL_FONT_COLOR;

    const minWidth = this.measureAndCacheText(ELLIPSIS).width;

    const SIDE_PADDING = 2 * this.theme.SIZES.BAR_PADDING * window.devicePixelRatio;
    const HALF_SIDE_PADDING = SIDE_PADDING / 2;
    const BASELINE_OFFSET =
      (this.theme.SIZES.BAR_HEIGHT - this.theme.SIZES.BAR_FONT_SIZE / 2) *
      window.devicePixelRatio;

    // We start by iterating over root frames, so we draw the call stacks top-down.
    // This allows us to do a couple optimizations that improve our best case performance.
    // 1. We can skip drawing the entire tree if the root frame is not visible
    // 2. We can skip drawing and
    const frames: FlamegraphFrame[] = [...this.flamegraph.roots];
    while (frames.length) {
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

      const frameInPhysicalSpace = [
        frameX + (frameWidth < 0 ? frameWidth : 0),
        frameY + (frameHeight < 0 ? frameHeight : 0),
        frameWidth,
        frameHeight,
      ];

      // Since the text is not exactly aligned to the left/right bounds of the frame, we need to subtract the padding
      // from the total width, so that we can truncate the center of the text accurately.
      const paddedRectangleWidth = frameInPhysicalSpace[2] - SIDE_PADDING;

      // Since children of a frame cannot be wider than the frame itself, we can exit early and discard the entire subtree
      if (paddedRectangleWidth <= minWidth) {
        continue;
      }

      // We want to draw the text in the vertical center of the frame, so we substract half the height of the text
      const y = frameInPhysicalSpace[1] + BASELINE_OFFSET;

      // Offset x by 1x the padding
      const x = frameInPhysicalSpace[0] + HALF_SIDE_PADDING;

      const frameName = frame.frame.name;
      const trim = trimTextCenter(
        frameName,
        findRangeBinarySearch(
          {low: 0, high: paddedRectangleWidth},
          n => this.measureAndCacheText(frame.frame.name.substring(0, n)).width,
          paddedRectangleWidth
        )[0]
      );

      const {text: trimText} = trim;

      if (flamegraphSearch) {
        const searchResults = flamegraphSearch.results ?? {};
        const searchQuery = flamegraphSearch.query;
        const frameId = getFlamegraphFrameSearchId(frame);
        const isFrameInSearchResults = searchResults[frameId];

        if (isFrameInSearchResults && searchQuery) {
          const re = new RegExp(searchQuery, 'ig');

          for (const highlightedBounds of matchHighlightedBounds(frameName, re, trim)) {
            const [startIndex, endIndex] = highlightedBounds;
            const highlightTextSize = this.measureAndCacheText(
              trimText.substring(startIndex, endIndex)
            );
            const frontMatter = trimText.slice(0, startIndex);
            const startHighlightX = this.measureAndCacheText(frontMatter).width;
            this.context.fillStyle = '#FFFF00';
            this.context.fillRect(
              startHighlightX + x,
              y - highlightTextSize.fontBoundingBoxAscent,
              highlightTextSize.width,
              highlightTextSize.fontBoundingBoxAscent +
                highlightTextSize.fontBoundingBoxDescent
            );
          }
        }
      }

      this.context.fillStyle = '#000000';
      this.context.fillText(trimText, x, y);

      for (let i = 0; i < frame.children.length; i++) {
        frames.push(frame.children[i]);
      }
    }
  }
}

export {TextRenderer};
