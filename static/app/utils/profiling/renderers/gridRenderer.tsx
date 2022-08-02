import {mat3} from 'gl-matrix';

import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {getContext, measureText, Rect} from '../gl/utils';

export function getIntervalTimeAtX(logicalSpaceToConfigView: mat3, x: number): number {
  const vector = logicalSpaceToConfigView[0] * x + logicalSpaceToConfigView[6];

  if (vector > 1) {
    return Math.round(vector);
  }

  return Math.round(vector * 10) / 10;
}

export function computeInterval(
  configView: Rect,
  logicalSpaceToConfigView: mat3
): number[] {
  // We want to draw an interval every 200px
  const target = 200;
  // Compute x at 200 and subtract left, so we have the interval
  const targetInterval =
    getIntervalTimeAtX(logicalSpaceToConfigView, target) - configView.left;

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

class GridRenderer {
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
    configViewToPhysicalSpace: mat3,
    logicalSpaceToConfigView: mat3,
    context: CanvasRenderingContext2D = this.context
  ): void {
    context.font = `${this.theme.SIZES.LABEL_FONT_SIZE * window.devicePixelRatio}px ${
      this.theme.FONTS.FONT
    }`;
    context.textBaseline = 'top';

    const LINE_WIDTH = 1;

    // Draw the background of the top timeline
    context.fillStyle = this.theme.COLORS.GRID_FRAME_BACKGROUND_COLOR;
    context.fillRect(
      0,
      LINE_WIDTH,
      physicalViewRect.width,
      this.theme.SIZES.LABEL_FONT_SIZE * window.devicePixelRatio +
        this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio * 2 -
        this.theme.SIZES.LABEL_FONT_PADDING
    );

    // Draw top timeline lines
    context.fillStyle = this.theme.COLORS.GRID_LINE_COLOR;
    context.fillRect(0, 0, physicalViewRect.width, LINE_WIDTH / 2);
    context.fillRect(
      0,
      this.theme.SIZES.TIMELINE_HEIGHT * window.devicePixelRatio,
      physicalViewRect.width,
      LINE_WIDTH / 2
    );

    const intervals = computeInterval(configViewSpace, logicalSpaceToConfigView);

    for (let i = 0; i < intervals.length; i++) {
      // Compute the x position of our interval from config space to physical
      const physicalIntervalPosition = Math.round(
        intervals[i] * configViewToPhysicalSpace[0] + configViewToPhysicalSpace[6]
      );

      // Format the label text
      const labelText = this.formatter(intervals[i]);

      context.fillStyle = this.theme.COLORS.LABEL_FONT_COLOR;
      // Subtract width of the text and padding so that the text is align to the left of our interval
      context.fillText(
        labelText,
        physicalIntervalPosition -
          measureText(labelText, context).width -
          this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio,
        this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio
      );

      // Draw the vertical grid line
      context.strokeStyle = this.theme.COLORS.GRID_LINE_COLOR;
      context.lineWidth = this.theme.SIZES.GRID_LINE_WIDTH;
      context.strokeRect(
        physicalIntervalPosition - LINE_WIDTH / 2,
        physicalViewRect.y,
        LINE_WIDTH / 2,
        physicalViewRect.height
      );
    }
  }
}

export {GridRenderer};
