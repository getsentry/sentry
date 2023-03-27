import {mat3} from 'gl-matrix';

import {getContext} from 'sentry/utils/profiling/gl/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

import {Flamegraph} from '../flamegraph';
import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';

function computeAbsoluteSampleTimestamps(
  startedAt: number,
  weights: ReadonlyArray<number>
): number[] {
  if (!weights.length) {
    return [];
  }

  const first = weights[0];
  if (typeof first !== 'number') {
    throw new Error('Invalid weights, expected an array of numbers');
  }
  const timeline = [startedAt + first];
  for (let i = 1; i < weights.length; i++) {
    const previous = timeline[i - 1]!; // i starts at 1, so this is safe
    timeline.push(previous + weights[i]!); // iterating over non empty array
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
      this.flamegraph.profile.rawWeights
    );
    this.context = getContext(canvas, '2d');
  }

  draw(
    configViewToPhysicalSpace: mat3,
    configView: Rect,
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
      const interval = this.intervals[i]!; // iterating over a non empty array

      if (interval < configView.left) {
        continue;
      }

      if (interval > configView.right) {
        break;
      }

      // Compute the x position of our interval from config space to physical
      const physicalIntervalPosition = Math.round(
        interval * configViewToPhysicalSpace[0] + configViewToPhysicalSpace[6]
      );

      context.strokeRect(physicalIntervalPosition, 0, 0, height);
    }
  }
}

export {SampleTickRenderer};
