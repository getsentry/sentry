import {Rect} from 'sentry/utils/profiling/speedscope';
import {
  makeFormatter,
  makeFormatTo,
  makeTimelineFormatter,
} from 'sentry/utils/profiling/units/units';

export type UIFrameNode = {
  duration: number;
  end: number;
  node: Profiling.MeasurementValue;
  start: number;
  type: 'slow' | 'frozen';
};

type FrameRenders = NonNullable<Profiling.Schema['measurements']>;

function sortFramesByStartedTime(
  a: Profiling.MeasurementValue,
  b: Profiling.MeasurementValue
) {
  return a.elapsed_since_start_ns - a.value - (b.elapsed_since_start_ns - b.value);
}

class UIFrames {
  frames: ReadonlyArray<UIFrameNode> = [];
  toUnit: string = 'nanoseconds';
  minFrameDuration: number = Number.MAX_SAFE_INTEGER;
  configSpace: Rect = Rect.Empty();

  formatter = makeFormatter('nanoseconds');
  timelineFormatter = makeTimelineFormatter('nanoseconds');

  constructor(
    frames: {
      frozen: FrameRenders['frozen_frame_renders'];
      slow: FrameRenders['slow_frame_renders'];
    },
    options: {unit: string},
    configSpace?: Rect
  ) {
    const unit = frames.frozen?.unit || frames.slow?.unit || 'nanoseconds';
    const slowOrDefaultFrames = frames.slow ?? {values: [], unit};
    const frozenOrDefaultFrames = frames.frozen ?? {values: [], unit};

    this.toUnit = options.unit;

    this.frames = this.buildFramesIntervalTree(
      slowOrDefaultFrames,
      frozenOrDefaultFrames
    );
    this.configSpace = configSpace ?? Rect.Empty();

    this.timelineFormatter = makeTimelineFormatter(this.toUnit);
    this.formatter = makeFormatter(this.toUnit);
  }

  static Empty = new UIFrames(
    {frozen: undefined, slow: undefined},
    {unit: 'nanoseconds'}
  );

  isEmpty(): boolean {
    return this === UIFrames.Empty;
  }

  buildFramesIntervalTree(
    slowFrames: NonNullable<FrameRenders['slow_frame_renders']>,
    frozenFrames: NonNullable<FrameRenders['frozen_frame_renders']>
  ): ReadonlyArray<UIFrameNode> {
    const frames: UIFrameNode[] = [];

    const toSlowFinalUnit = makeFormatTo(slowFrames.unit, this.toUnit);
    const toFrozenFinalUnit = makeFormatTo(frozenFrames.unit, this.toUnit);

    const slowFramesQueue = [...slowFrames.values].sort(sortFramesByStartedTime);
    const frozenFramesQueue = [...frozenFrames.values].sort(sortFramesByStartedTime);

    while (slowFramesQueue.length > 0 || frozenFramesQueue.length > 0) {
      const nextType = !slowFramesQueue.length
        ? 'frozen'
        : !frozenFramesQueue.length
        ? 'slow'
        : slowFramesQueue[0].elapsed_since_start_ns - slowFramesQueue[0].value <
          frozenFramesQueue[0].elapsed_since_start_ns - frozenFramesQueue[0].value
        ? 'slow'
        : 'frozen';

      // Being lazy, but we could reverse and pop to avoid shift which is O(n)
      const frame =
        nextType === 'slow' ? slowFramesQueue.shift()! : frozenFramesQueue.shift()!;

      const unitFn = nextType === 'slow' ? toSlowFinalUnit : toFrozenFinalUnit;

      frames.push({
        start: unitFn(frame.elapsed_since_start_ns - frame.value),
        end: unitFn(frame.elapsed_since_start_ns),
        duration: unitFn(frame.value),
        node: frame,
        type: nextType,
      });
      this.minFrameDuration = Math.min(this.minFrameDuration, unitFn(frame.value));
    }

    return frames;
  }
}

export {UIFrames};
