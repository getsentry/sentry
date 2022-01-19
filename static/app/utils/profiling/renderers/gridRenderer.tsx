import {mat3, vec2} from 'gl-matrix';

import {FlamegraphTheme} from '../flamegraph/FlamegraphTheme';
import {getContext, measureText, Rect} from '../gl/utils';

export function getIntervalTimeAtX(configToPhysicalSpace: mat3, x: number): number {
  const logicalToPhysical = mat3.fromScaling(
    mat3.create(),
    vec2.fromValues(window.devicePixelRatio ?? 1, window.devicePixelRatio ?? 1)
  );
  const physicalToConfigSpace = mat3.invert(mat3.create(), configToPhysicalSpace);

  const logicalToConfigSpace = mat3.multiply(
    mat3.create(),
    physicalToConfigSpace,
    logicalToPhysical
  );

  return vec2.transformMat3(
    vec2.create(),
    vec2.fromValues(x, 1),
    logicalToConfigSpace
  )[0];
}

export function computeInterval(configView: Rect, configToPhysicalSpace: mat3): number[] {
  // Compute x at 200 and subtract left, so we have the interval
  const targetInterval = getIntervalTimeAtX(configToPhysicalSpace, 200) - configView.left;
  const minInterval = Math.pow(10, Math.floor(Math.log10(targetInterval)));

  let interval = minInterval;

  if (targetInterval / interval > 5) {
    interval *= 5;
  } else if (targetInterval / interval > 2) {
    interval *= 2;
  }

  const intervals: number[] = [];

  let x = Math.ceil(configView.left / interval) * interval;

  while (x <= configView.right) {
    intervals.push(x);
    x += interval;
  }

  return intervals;
}

class FlamegraphGridRenderer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  theme: FlamegraphTheme;

  formatter: (value: number) => string;

  constructor(
    canvas: HTMLCanvasElement,
    theme: FlamegraphTheme,
    formatter: (value: number) => string
  ) {
    this.canvas = canvas;
    this.theme = theme;
    this.formatter = formatter;

    this.context = getContext(canvas, '2d');
  }

  draw(
    configViewSpace: Rect,
    physicalViewRect: Rect,
    configToPhysicalSpace: mat3,
    context: CanvasRenderingContext2D = this.context
  ): void {
    context.font = `${this.theme.SIZES.LABEL_FONT_SIZE * window.devicePixelRatio}px ${
      this.theme.FONTS.FONT
    }`;
    context.textBaseline = 'top';

    const intervals = computeInterval(configViewSpace, configToPhysicalSpace);

    context.fillStyle = this.theme.COLORS.GRID_LINE_COLOR;
    context.fillRect(0, 0, physicalViewRect.width, 1 * window.devicePixelRatio);
    context.fillRect(
      0,
      this.theme.SIZES.TIMELINE_HEIGHT * window.devicePixelRatio,
      physicalViewRect.width,
      1 * window.devicePixelRatio
    );

    context.fillStyle = this.theme.COLORS.GRID_FRAME_BACKGROUND_COLOR;
    context.fillRect(
      0,
      1 * window.devicePixelRatio,
      physicalViewRect.width,
      this.theme.SIZES.LABEL_FONT_SIZE * window.devicePixelRatio +
        this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio * 2 -
        this.theme.SIZES.LABEL_FONT_PADDING
    );

    for (let i = 0; i < intervals.length; i++) {
      const intervalVector = vec2.fromValues(intervals[i], 1);
      const pos = Math.round(
        vec2.transformMat3(vec2.create(), intervalVector, configToPhysicalSpace)[0]
      );
      const labelText = this.formatter(intervals[i]);

      context.fillStyle = this.theme.COLORS.LABEL_FONT_COLOR;
      context.fillText(
        labelText,
        pos -
          measureText(labelText, context).width -
          this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio,
        this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio
      );
      context.fillStyle = this.theme.COLORS.GRID_LINE_COLOR;
      context.fillRect(
        pos - 1 * window.devicePixelRatio,
        0,
        1 * window.devicePixelRatio,
        physicalViewRect.height
      );
    }
  }
}

export {FlamegraphGridRenderer};
