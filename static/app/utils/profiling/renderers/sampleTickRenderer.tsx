import {mat3} from 'gl-matrix';

import {Flamegraph} from '../flamegraph';
import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {getContext, Rect} from '../gl/utils';

function computeAbsoluteSampleTimestamps(startedAt: number, weights: readonly number[]) {
  const timeline = [startedAt + weights[0]];
  for (let i = 1; i < weights.length; i++) {
    timeline.push(timeline[i - 1] + weights[i]);
  }
  return timeline;
}

class SampleTickRenderer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  theme: FlamegraphTheme;
  flamegraph: Flamegraph;
  intervals: number[];

  constructor(
    canvas: HTMLCanvasElement,
    flamegraph: Flamegraph,
    configSpace: Rect,
    theme: FlamegraphTheme
  ) {
    this.canvas = canvas;
    this.flamegraph = flamegraph;
    this.theme = theme;
    this.intervals = computeAbsoluteSampleTimestamps(
      configSpace.x,
      this.flamegraph.profile.weights
    );
    this.context = getContext(canvas, '2d');
  }

  draw(
    configViewToPhysicalSpace: mat3,
    context: CanvasRenderingContext2D = this.context
  ): void {
    if (this.intervals.length === 0) {
      return;
    }
    const height =
      this.theme.SIZES.LABEL_FONT_SIZE * window.devicePixelRatio +
      this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio * 2 -
      this.theme.SIZES.LABEL_FONT_PADDING;

    context.strokeStyle = `rgba(${this.theme.COLORS.SAMPLE_TICK_COLOR.join(',')})`;
    context.lineWidth = this.theme.SIZES.INTERNAL_SAMPLE_TICK_LINE_WIDTH;

    for (let i = 0; i < this.intervals.length; i++) {
      // Compute the x position of our interval from config space to physical
      const physicalIntervalPosition = Math.round(
        this.intervals[i] * configViewToPhysicalSpace[0] + configViewToPhysicalSpace[6]
      );

      if (physicalIntervalPosition < 0) {
        continue;
      }

      if (physicalIntervalPosition > this.canvas.clientWidth) {
        break;
      }

      context.strokeRect(physicalIntervalPosition, 0, 0, height);
    }
  }
}

export {SampleTickRenderer};
