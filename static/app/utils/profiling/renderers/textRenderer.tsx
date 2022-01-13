import {mat3} from 'gl-matrix';

import {Flamegraph} from '../Flamegraph';
import {FlamegraphTheme} from '../flamegraph/FlamegraphTheme';
import {getContext, Rect, resizeCanvasToDisplaySize} from '../gl/utils';

const ELLIPSIS = '\u2026';

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

  clearCache(): void {
    this.textCache = {};
  }

  measureText(context: CanvasRenderingContext2D, text: string): number {
    if (this.textCache[text]) {
      return this.textCache[text];
    }
    const metrics = context.measureText(text);
    this.textCache[text] = metrics.width;
    return metrics.width;
  }

  draw(configViewSpace: Rect, configSpace: Rect, configToPhysicalSpace: mat3): void {
    this.context.font = `${
      this.theme.SIZES.BAR_FONT_SIZE * window.devicePixelRatio
    }px "Source Code Pro", Courier, monospace`;
    this.context.textBaseline = 'alphabetic';
    this.context.fillStyle = this.theme.COLORS.BAR_LABEL_FONT_COLOR;

    const minWidth = this.measureText(this.context, `${ELLIPSIS}`);

    for (const frame of this.flamegraph.frames) {
      const text = frame.frame.name;

      const frameInConfigSpace = new Rect(
        frame.start,
        this.flamegraph.inverted ? configSpace.height - frame.depth + 1 : frame.depth + 1,
        frame.end - frame.start,
        1
      );

      if (frameInConfigSpace.right < configViewSpace.left) {
        continue;
      }
      if (frameInConfigSpace.left > configViewSpace.right) {
        continue;
      }

      if (this.flamegraph.inverted) {
        if (frameInConfigSpace.top - 1 > configViewSpace.bottom) {
          continue;
        }
      } else {
        if (frameInConfigSpace.bottom < configViewSpace.top - 1) {
          continue;
        }
      }

      const pinnedStart = Math.max(frame.start, configViewSpace.left);
      const pinnedEnd = Math.min(frame.end, configViewSpace.right);

      const offsetFrame = new Rect(
        pinnedStart,
        frameInConfigSpace.y,
        pinnedEnd - pinnedStart,
        1
      );

      const frameInPhysicalSpace = offsetFrame.transformRect(configToPhysicalSpace);

      const paddedWidth =
        frameInPhysicalSpace.width -
        2 * (this.theme.SIZES.BAR_PADDING * window.devicePixelRatio);

      const y =
        frameInPhysicalSpace.y -
        (this.theme.SIZES.BAR_FONT_SIZE / 2) * window.devicePixelRatio;
      const x =
        frameInPhysicalSpace.x + this.theme.SIZES.BAR_PADDING * window.devicePixelRatio;

      if (paddedWidth >= minWidth) {
        if (this.measureText(this.context, text) > paddedWidth) {
          const [low] = findValueBisect(
            0,
            text.length,
            n => this.measureText(this.context, text.substring(0, n)),
            paddedWidth
          );

          const prefixLength = Math.floor(low / 2);
          const postfixLength = low - prefixLength - 1;

          const string = `${text.substr(0, prefixLength)}${ELLIPSIS}${text.substr(
            text.length - postfixLength,
            postfixLength
          )}`;

          this.context.fillStyle = this.theme.COLORS.LABEL_FONT_COLOR;
          this.context.fillText(string, x, y);
        } else {
          this.context.fillStyle = this.theme.COLORS.LABEL_FONT_COLOR;
          this.context.fillText(text, x, y);
        }
      }
    }
  }
}

export {TextRenderer};
