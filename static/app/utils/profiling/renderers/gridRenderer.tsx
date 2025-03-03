import type {mat3} from 'gl-matrix';

import type {Rect} from 'sentry/utils/profiling/speedscope';
import {computeInterval} from 'sentry/utils/profiling/speedscope';

import type {FlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {getContext, measureText} from '../gl/utils';

export function getIntervalTimeAtX(logicalSpaceToConfigView: mat3, x: number): number {
  const vector = logicalSpaceToConfigView[0] * x + logicalSpaceToConfigView[6];

  if (vector > 1) {
    return Math.round(vector);
  }

  return Math.round(vector * 10) / 10;
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
    drawGridTicks = true
  ): void {
    this.context.font = `${
      this.theme.SIZES.LABEL_FONT_SIZE * window.devicePixelRatio
    }px ${this.theme.FONTS.FONT}`;
    this.context.textBaseline = 'top';
    this.context.lineWidth = this.theme.SIZES.GRID_LINE_WIDTH / 2;

    // Draw the background of the top timeline
    this.context.fillStyle = this.theme.COLORS.GRID_FRAME_BACKGROUND_COLOR;
    this.context.fillRect(
      0,
      0,
      physicalViewRect.width,
      this.theme.SIZES.TIMELINE_HEIGHT * window.devicePixelRatio
    );

    // Draw top timeline lines
    this.context.fillStyle = this.theme.COLORS.GRID_LINE_COLOR;
    this.context.fillRect(
      0,
      0,
      physicalViewRect.width,
      this.theme.SIZES.GRID_LINE_WIDTH / 2
    );
    this.context.fillRect(
      0,
      this.theme.SIZES.TIMELINE_HEIGHT * window.devicePixelRatio,
      physicalViewRect.width,
      this.theme.SIZES.GRID_LINE_WIDTH / 2
    );

    if (drawGridTicks) {
      const intervals = computeInterval(
        configViewSpace,
        logicalSpaceToConfigView,
        getIntervalTimeAtX
      );

      for (const interval of intervals) {
        // Compute the x position of our interval from config space to physical
        const physicalIntervalPosition = Math.round(
          interval * configViewToPhysicalSpace[0] + configViewToPhysicalSpace[6]
        );

        // Format the label text
        const labelText = this.formatter(interval);

        this.context.fillStyle = this.theme.COLORS.LABEL_FONT_COLOR;
        // Subtract width of the text and padding so that the text is align to the left of our interval
        this.context.fillText(
          labelText,
          physicalIntervalPosition -
            measureText(labelText, this.context).width -
            this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio,
          this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio
        );

        // Draw the vertical grid line
        this.context.strokeStyle = this.theme.COLORS.GRID_LINE_COLOR;
        this.context.strokeRect(
          physicalIntervalPosition - this.theme.SIZES.GRID_LINE_WIDTH / 2,
          physicalViewRect.y,
          this.theme.SIZES.GRID_LINE_WIDTH / 2,
          physicalViewRect.height
        );
      }
    }
  }
}

export {GridRenderer};
