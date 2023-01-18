import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {getContext, resizeCanvasToDisplaySize} from '../gl/utils';

const TEST_STRING = 'Who knows if this changed, font-display: swap wont tell me';

abstract class TextRenderer {
  canvas: HTMLCanvasElement;
  theme: FlamegraphTheme;
  context: CanvasRenderingContext2D;
  textCache: Record<string, TextMetrics>;

  constructor(canvas: HTMLCanvasElement, theme: FlamegraphTheme) {
    this.canvas = canvas;
    this.theme = theme;

    this.textCache = {};
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
    if (this.textCache[TEST_STRING] === undefined) {
      this.measureAndCacheText(TEST_STRING);
      return;
    }

    const newMeasuredSize = this.context.measureText(TEST_STRING);
    if (newMeasuredSize !== this.textCache[TEST_STRING]) {
      this.textCache = {[TEST_STRING]: newMeasuredSize};
    }
  }
}

export {TextRenderer};
