import type {SessionRange} from './useSessionDetail';

/**
 * Shortest stretch of nothing that can count as idle at all.
 *
 * Sized to a person rather than to the chart: minutes, because that is what being
 * *away* looks like. Anything shorter is reading, thinking, filling in a form or
 * waiting on a slow request — all of which are the session doing something, even
 * when nothing is recorded while they happen.
 *
 * This started at ten seconds, borrowed from the replay player's own
 * `inactivePeriodThreshold`, and ten seconds turned out to be far too eager. The
 * player is only deciding whether to fast-forward, which the next second of
 * playback undoes; cutting an axis is a claim about the shape of the whole session,
 * and it has to be worth making. Twenty seconds of quiet in a three-minute session
 * is not.
 *
 * It is a floor and not the decision. What actually gets compressed is settled in
 * pixels further down; this only keeps the candidate list to stretches long enough
 * that cutting one could ever be honest.
 */
const IDLE_FLOOR_MS = 120_000;

/**
 * How much width a compressed stretch is given, and how much it has to save to
 * earn it.
 *
 * A break is a fixed width rather than a share of the time it stands for: the
 * magnitude is carried by its label, and six extra pixels say much less than
 * "11m" does. `GAIN` is what stops the chart being cut for nothing — a stretch has
 * to be eating at least three times the width it will be given, which at a
 * thousand-pixel track means about eight percent of the chart apiece.
 */
export const BREAK_PX = 24;
const GAIN = 3;

/**
 * Ceiling on the total width spent on breaks. Nine of them at most, and by then
 * the session is three quarters idle and every one of them is real — this is a
 * legibility brake rather than a correctness one.
 */
const GAP_BUDGET = 0.25;

/**
 * Floor on an activity stretch, which only ever binds for one pinned between two
 * breaks. Two events either side of an instant would otherwise put two breaks
 * flush against each other, and "nothing happened here, then nothing happened
 * here" is not something the chart should be able to say. Wide enough for the
 * smallest density marker, so the item that separates them is visible rather than
 * merely accounted for.
 */
const MIN_ACTIVITY_PX = 10;

/** One stretch of the session, and where it sits on the axis. */
export interface ScaleSegment {
  /** Epoch ms this stretch ends. */
  end: number;
  /** True for the stretches that are compressed. */
  isIdle: boolean;
  /** Epoch ms this stretch begins. */
  start: number;
  /** Where it begins on the axis, 0 at the session's start and 1 at its end. */
  u0: number;
  /** Where it ends. */
  u1: number;
}

/**
 * The session's time axis: monotone, piecewise linear, and linear *within* every
 * stretch it holds.
 *
 * That last part is the whole point. A smooth density-warped axis would draw a
 * 400ms trace wider than a 2s one wherever the density happened to change, and a
 * duration bar that cannot be compared to its neighbour is not worth drawing. Here
 * the slope only ever changes across a break, so every shape is drawn at one
 * scale and only empty time is ever removed.
 *
 * Zooming into a break therefore un-compresses it for free: a break is one segment
 * with a shallow slope, and magnifying its two dozen pixels to the full width shows
 * the stretch at an ordinary rate.
 */
export interface TimeScale {
  /** The compressed stretches, in order. Empty when the axis is linear. */
  idle: ScaleSegment[];
  /** True when anything is compressed, which is what makes this worth saying. */
  isCompressed: boolean;
  segments: ScaleSegment[];
  /** Axis position of a timestamp: 0 at the session's start, 1 at its end. */
  toRatio: (timestamp: number) => number;
  /** The inverse, for reading a pointer back into a time. */
  toTime: (ratio: number) => number;
}

/** A stretch where something was happening, and how much of it happened. */
export interface ActivityRegion extends SessionRange {
  /** Items that started inside this stretch. */
  count: number;
}

/**
 * Where a session was idle, and what it was doing the rest of the time.
 *
 * Both halves come out of one pass because they are complements of each other, and
 * because the second is what decides whether the first is worth acting on.
 */
export interface IdleAnalysis {
  /** Candidate idle stretches, ascending. */
  gaps: SessionRange[];
  /** The stretches between them, ascending. Always one more than `gaps`. */
  regions: ActivityRegion[];
}

const NO_IDLE: IdleAnalysis = {gaps: [], regions: []};

function clampRatio(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * The session's idle stretches, as the complement of everything that happened.
 *
 * Deriving them this way rather than hunting for them is what makes the three
 * properties the chart depends on free: the stretches cannot overlap, cannot be
 * adjacent, and always have something between them, because each one is bounded by
 * the activity on either side of it. There is no repair pass because there is
 * nothing to repair.
 *
 * `activity` is every item's *extent*, not its timestamp — a trace occupies the
 * time it ran for. That is the other invariant worth having: a stretch with no
 * extent in it has no mark drawn in it either, so compressing one can never
 * squash a shape. Only empty space is ever removed.
 *
 * Note what is deliberately not in here. A route visit contributes nothing: visits
 * tile the session end to end, so counting their spans as activity would mean no
 * session was ever idle. Their arrivals are already segment spans in the trace
 * rows, so the band needs no separate say.
 */
export function findIdlePeriods(
  activity: readonly SessionRange[],
  bounds: SessionRange
): IdleAnalysis {
  if (activity.length === 0) {
    return NO_IDLE;
  }

  // Sorted here rather than asked for sorted: the caller holds one list per
  // dataset in whichever direction the rail is sorted, and a precondition nobody
  // can see is a precondition that eventually breaks.
  const extents = activity.toSorted((a, b) => a.start - b.start);

  const gaps: SessionRange[] = [];
  const regions: ActivityRegion[] = [];
  let cursor = bounds.start;
  let region: ActivityRegion = {start: bounds.start, end: bounds.start, count: 0};

  for (const extent of extents) {
    if (extent.start - cursor >= IDLE_FLOOR_MS) {
      gaps.push({start: cursor, end: extent.start});
      regions.push({...region, end: cursor});
      region = {start: extent.start, end: extent.start, count: 0};
    }
    region.count += 1;
    region.end = Math.max(region.end, extent.end);
    cursor = Math.max(cursor, extent.end);
  }

  if (bounds.end - cursor >= IDLE_FLOOR_MS) {
    gaps.push({start: cursor, end: bounds.end});
    regions.push({...region, end: cursor});
    // The tail past the last idle stretch, which holds nothing — a session cannot
    // end idle unless its bounds reach past its last item. Kept so `regions` is
    // always one longer than `gaps`, and so the axis it describes is complete.
    regions.push({start: bounds.end, end: bounds.end, count: 0});
  } else {
    regions.push({...region, end: Math.max(region.end, bounds.end)});
  }

  return gaps.length === 0 ? NO_IDLE : {gaps, regions};
}

/** A session drawn at one scale end to end, which is most of them. */
function linearScale(bounds: SessionRange): TimeScale {
  const span = Math.max(1, bounds.end - bounds.start);
  const segments: ScaleSegment[] = [
    {start: bounds.start, end: bounds.end, u0: 0, u1: 1, isIdle: false},
  ];
  return {
    segments,
    idle: [],
    isCompressed: false,
    toRatio: timestamp => clampRatio((timestamp - bounds.start) / span),
    toTime: ratio => bounds.start + clampRatio(ratio) * span,
  };
}

/**
 * Whether the chart is short of the width its marks need.
 *
 * The pixels a break frees have to go somewhere worth going, and this is the test
 * for that. Three logs a quarter of a minute apart are three dots either way —
 * compressing between them buys nothing and costs two breaks, which is the
 * over-fitting this exists to prevent. Fifty logs inside twenty seconds of a
 * half-hour session land in two buckets, and there the space is the difference
 * between a burst you can read and a smudge.
 *
 * So: does any stretch hold more items than it has buckets to draw them in. One
 * item in one bucket is never crowded, however narrow the stretch — a lone dot is
 * legible at any scale, and without the floor a stretch of zero width would report
 * every session as cramped.
 */
function isCrowded(
  regions: readonly ActivityRegion[],
  bounds: SessionRange,
  buckets: number
): boolean {
  const span = Math.max(1, bounds.end - bounds.start);
  return regions.some(region => {
    const share = ((region.end - region.start) / span) * buckets;
    return region.count > Math.max(1, share);
  });
}

/**
 * Which of the candidate stretches to compress, largest first.
 *
 * Measured in pixels rather than in seconds, because pixels are what the axis is
 * short of: a two-minute stretch is most of a five-minute session and a rounding
 * error in a six-hour one, and only one of those is worth cutting.
 *
 * Accepting a stretch redistributes the width it was wasting, which makes every
 * remaining candidate *more* eligible rather than less — so a descending pass that
 * stops at the first refusal has already found everything that qualifies, and can
 * never need to go back on one it took.
 */
function selectGaps(
  gaps: readonly SessionRange[],
  bounds: SessionRange,
  width: number
): SessionRange[] {
  const total = bounds.end - bounds.start;
  const budgetPx = width * GAP_BUDGET;
  const accepted: SessionRange[] = [];
  let idleTime = 0;

  const candidates = gaps.toSorted((a, b) => b.end - b.start - (a.end - a.start));
  for (const gap of candidates) {
    if ((accepted.length + 1) * BREAK_PX > budgetPx) {
      break;
    }
    const activeTime = total - idleTime;
    if (activeTime <= 0) {
      break;
    }
    // What this stretch would take if the axis kept it, at the scale the ones
    // already accepted imply — which is the width compressing it actually buys.
    const wouldTake =
      ((gap.end - gap.start) / activeTime) * (width - accepted.length * BREAK_PX);
    if (wouldTake < GAIN * BREAK_PX) {
      break;
    }
    accepted.push(gap);
    idleTime += gap.end - gap.start;
  }

  return accepted.sort((a, b) => a.start - b.start);
}

/**
 * Shares the width out: a fixed band per break, and the rest in proportion to
 * time.
 *
 * Floors are resolved the way flexbox resolves a minimum width — lock whatever
 * falls short, hand its shortfall back to the others, and ask again — because
 * flooring in one pass would let a stretch holding less time end up wider than one
 * holding more.
 *
 * Returns null when the track is too narrow to seat the breaks and the floors at
 * once, which is the honest answer for a chart with no room to be cut.
 */
function allocate(
  spans: ReadonlyArray<{end: number; isIdle: boolean; start: number}>,
  width: number
): number[] | null {
  const px: number[] = spans.map(span => (span.isIdle ? BREAK_PX : 0));
  const active = spans.reduce<number[]>(
    (indexes, span, index) => (span.isIdle ? indexes : [...indexes, index]),
    []
  );
  const available = width - (spans.length - active.length) * BREAK_PX;
  if (available < active.length * MIN_ACTIVITY_PX) {
    return null;
  }

  const locked = new Set<number>();
  for (;;) {
    const open = active.filter(index => !locked.has(index));
    if (open.length === 0) {
      break;
    }
    const free = available - locked.size * MIN_ACTIVITY_PX;
    const openTime = open.reduce(
      (sum, index) => sum + (spans[index]!.end - spans[index]!.start),
      0
    );

    // Every stretch left is an instant, so there is no time to divide by and
    // nothing to distinguish them: they share what is left equally.
    if (openTime <= 0) {
      open.forEach(index => {
        px[index] = free / open.length;
      });
      break;
    }

    const short = open.find(
      index =>
        ((spans[index]!.end - spans[index]!.start) / openTime) * free < MIN_ACTIVITY_PX
    );
    if (short === undefined) {
      open.forEach(index => {
        px[index] = ((spans[index]!.end - spans[index]!.start) / openTime) * free;
      });
      break;
    }
    locked.add(short);
    px[short] = MIN_ACTIVITY_PX;
  }

  return px;
}

/** First index whose value is greater than `target`, over an ascending list. */
function upperBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (values[mid]! <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/**
 * The axis a session is drawn against.
 *
 * Linear unless every one of three things is true: the session has stretches long
 * enough to be idle, the marks elsewhere are short of the width to draw them in,
 * and cutting a stretch buys meaningfully more width than the break costs. Any one
 * of them failing is a session better drawn straight, and most sessions are.
 *
 * `width` and `buckets` are the track's, because both questions are about pixels.
 * They are the session's own width and not the viewport's: the axis is a property
 * of the session, so it does not reflow as someone zooms into it.
 */
export function buildTimeScale({
  bounds,
  idle,
  width,
  buckets,
}: {
  bounds: SessionRange;
  buckets: number;
  idle: IdleAnalysis;
  width: number;
}): TimeScale {
  const total = bounds.end - bounds.start;
  if (idle.gaps.length === 0 || width <= 0 || total <= 0) {
    return linearScale(bounds);
  }
  if (!isCrowded(idle.regions, bounds, buckets)) {
    return linearScale(bounds);
  }

  const accepted = selectGaps(idle.gaps, bounds, width);
  if (accepted.length === 0) {
    return linearScale(bounds);
  }

  const spans: Array<{end: number; isIdle: boolean; start: number}> = [];
  let cursor = bounds.start;
  for (const gap of accepted) {
    spans.push({start: cursor, end: gap.start, isIdle: false});
    spans.push({start: gap.start, end: gap.end, isIdle: true});
    cursor = gap.end;
  }
  spans.push({start: cursor, end: bounds.end, isIdle: false});

  const px = allocate(spans, width);
  if (px === null) {
    return linearScale(bounds);
  }

  let at = 0;
  const segments: ScaleSegment[] = spans.map((span, index) => {
    const u0 = at / width;
    at += px[index]!;
    return {...span, u0, u1: at / width};
  });
  // Pinned rather than trusted to the arithmetic: the widths sum to `width` in
  // theory, and to a float's idea of it in practice.
  segments[segments.length - 1]!.u1 = 1;

  const starts = segments.map(segment => segment.start);
  const ratios = segments.map(segment => segment.u0);

  return {
    segments,
    idle: segments.filter(segment => segment.isIdle),
    isCompressed: true,
    toRatio: timestamp => {
      if (timestamp <= bounds.start) {
        return 0;
      }
      if (timestamp >= bounds.end) {
        return 1;
      }
      const segment = segments[Math.max(0, upperBound(starts, timestamp) - 1)]!;
      const span = segment.end - segment.start;
      return span <= 0
        ? segment.u0
        : segment.u0 + ((timestamp - segment.start) / span) * (segment.u1 - segment.u0);
    },
    toTime: ratio => {
      const u = clampRatio(ratio);
      const segment = segments[Math.max(0, upperBound(ratios, u) - 1)]!;
      const span = segment.u1 - segment.u0;
      return span <= 0
        ? segment.start
        : segment.start + ((u - segment.u0) / span) * (segment.end - segment.start);
    },
  };
}
