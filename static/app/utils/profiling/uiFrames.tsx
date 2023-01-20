import {makeFormatTo} from './units/units';

export type UIFrameNode = {
  duration: number;
  end: number;
  node: Profiling.FrameRender;
  start: number;
  type: 'slow' | 'frozen';
};

type FrameRenders = NonNullable<Profiling.Schema['measurements']>;

function sortFramesByStartedTime(a: Profiling.FrameRender, b: Profiling.FrameRender) {
  return a.elapsed_since_start_ns - b.elapsed_since_start_ns;
}

class UIFrames {
  frames: ReadonlyArray<UIFrameNode> = [];
  toUnit: string = 'nanoseconds';

  constructor(
    frames: {
      frozen: FrameRenders['frozen_frame_renders'];
      slow: FrameRenders['slow_frame_renders'];
    },
    options: {unit: string}
  ) {
    const unit = frames.frozen?.unit || frames.slow?.unit || 'nanoseconds';
    const slowOrDefaultFrames = frames.frozen ?? {values: [], unit};
    const frozenOrDefaultFrames = frames.slow ?? {values: [], unit};

    this.toUnit = options.unit;

    this.frames = this.buildFramesIntervalTree(
      slowOrDefaultFrames,
      frozenOrDefaultFrames
    );
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
        : slowFramesQueue[0].elapsed_since_start_ns <
          frozenFramesQueue[0].elapsed_since_start_ns
        ? 'slow'
        : 'frozen';

      // Being lazy, but we could reverse and pop to avoid shift which is O(n)
      const frame =
        nextType === 'slow' ? slowFramesQueue.shift()! : frozenFramesQueue.shift()!;

      const unitFn = nextType === 'slow' ? toSlowFinalUnit : toFrozenFinalUnit;

      frames.push({
        start: unitFn(frame.elapsed_since_start_ns),
        end: unitFn(frame.elapsed_since_start_ns + frame.value),
        duration: unitFn(frame.value),
        node: frame,
        type: nextType,
      });
    }

    return frames;
  }
}

export {UIFrames};
