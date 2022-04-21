import {mat3} from 'gl-matrix';

import {Flamegraph} from '../flamegraph';
import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {FlamegraphFrame} from '../flamegraphFrame';
import {
  ELLIPSIS,
  findRangeBinarySearch,
  getContext,
  Rect,
  resizeCanvasToDisplaySize,
  trimTextCenter,
} from '../gl/utils';

export function isOutsideView(frame: Rect, view: Rect): boolean {
  // Frame is outside of the view on the left
  if (frame.overlaps(view)) {
    return false;
  }

  return true;
}

class TextRenderer {
  textCache: Record<string, number> = {};

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

  measureAndCacheText(text: string): number {
    if (this.textCache[text]) {
      return this.textCache[text];
    }
    this.textCache[text] = this.context.measureText(text).width;
    return this.textCache[text];
  }

  maybeInvalidateCache(): void {
    const TEST_STRING = 'Who knows if this changed, font-display: swap wont tell me';

    if (this.textCache[TEST_STRING] === undefined) {
      this.measureAndCacheText(TEST_STRING);
      return;
    }

    const newMeasuredSize = this.context.measureText(TEST_STRING).width;
    if (newMeasuredSize !== this.textCache[TEST_STRING]) {
      this.textCache = {[TEST_STRING]: newMeasuredSize};
    }
  }

  draw(configViewSpace: Rect, configSpace: Rect, configViewToPhysicalSpace: mat3): void {
    this.maybeInvalidateCache();

    this.context.font = `${this.theme.SIZES.BAR_FONT_SIZE * window.devicePixelRatio}px ${
      this.theme.FONTS.FRAME_FONT
    }`;

    this.context.textBaseline = 'alphabetic';
    this.context.fillStyle = this.theme.COLORS.LABEL_FONT_COLOR;

    const minWidth = this.measureAndCacheText(ELLIPSIS);

    let frame: FlamegraphFrame;
    let i: number;
    const length: number = this.flamegraph.frames.length;

    // We currently iterate over all frames, but we could optimize this to only iterate over visible frames.
    // This could be achieved by querying the flamegraph tree (as an interval tree). This would still run in O(n), but
    // would improve our best case performance (e.g. when users) zoom into the flamegraph
    for (i = 0; i < length; i++) {
      frame = this.flamegraph.frames[i];

      // This rect gets discarded after each render which is wasteful
      const frameInConfigSpace = new Rect(
        frame.start,
        this.flamegraph.inverted ? configSpace.height - frame.depth - 1 : frame.depth,
        frame.end - frame.start,
        1
      );

      // Check if our rect overlaps with the current viewport and skip it
      if (isOutsideView(frameInConfigSpace, configViewSpace)) {
        continue;
      }

      // We pin the start and end of the frame, so scrolling around keeps text pinned to the left or right side of the viewport
      const pinnedStart = Math.max(frame.start, configViewSpace.left);
      const pinnedEnd = Math.min(frame.end, configViewSpace.right);

      // This rect gets discarded after each render which is wasteful
      const offsetFrame = new Rect(
        pinnedStart,
        frameInConfigSpace.y,
        pinnedEnd - pinnedStart,
        1
      );

      // Transform frame to physical space coordinates
      const frameInPhysicalSpace = offsetFrame.transformRect(configViewToPhysicalSpace);

      // Since the text is not exactly aligned to the left/right bounds of the frame, we need to subtract the padding
      // from the total width, so that we can truncate the center of the text accurately.
      const paddedRectangleWidth =
        frameInPhysicalSpace.width -
        2 * this.theme.SIZES.BAR_PADDING * window.devicePixelRatio;

      // We want to draw the text in the vertical center of the frame, so we substract half the height of the text
      const y =
        frameInPhysicalSpace.y +
        (this.theme.SIZES.BAR_HEIGHT - this.theme.SIZES.BAR_FONT_SIZE / 2) *
          window.devicePixelRatio;

      // Offset x by 1x the padding
      const x =
        frameInPhysicalSpace.x + this.theme.SIZES.BAR_PADDING * window.devicePixelRatio;

      // If the width of the text is greater than the minimum width to render, we should render it
      if (paddedRectangleWidth >= minWidth) {
        let text = frame.frame.name;

        // If text width is smaller than rectangle, just draw the text
        if (this.measureAndCacheText(text) > paddedRectangleWidth) {
          text = trimTextCenter(
            text,
            findRangeBinarySearch(
              {low: 0, high: paddedRectangleWidth},
              n => this.measureAndCacheText(text.substring(0, n)),
              paddedRectangleWidth
            )[0]
          );
        }

        this.context.fillText(text, x, y);
      }
    }
  }
}

export {TextRenderer};
