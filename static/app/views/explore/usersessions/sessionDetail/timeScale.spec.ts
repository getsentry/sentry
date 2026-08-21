import {buildTimeScale, findIdlePeriods} from './timeScale';
import type {SessionRange} from './useSessionDetail';

/** The track the scale is measured against in these tests, and its bucket count. */
const WIDTH = 800;
const BUCKETS = 60;
const GAP_RATIO = 24 / WIDTH;

const S = 1000;

function at(seconds: number, durationSeconds = 0): SessionRange {
  return {start: seconds * S, end: (seconds + durationSeconds) * S};
}

function bounds(endSeconds: number): SessionRange {
  return {start: 0, end: endSeconds * S};
}

/** A run of instants, one per second, so a stretch can be made busy in one line. */
function burst(fromSeconds: number, count: number): SessionRange[] {
  return Array.from({length: count}, (_, index) => at(fromSeconds + index));
}

function scaleFor(activity: SessionRange[], endSeconds: number) {
  const range = bounds(endSeconds);
  return buildTimeScale({
    bounds: range,
    idle: findIdlePeriods(activity, range),
    width: WIDTH,
    buckets: BUCKETS,
  });
}

describe('findIdlePeriods', () => {
  it('reads a stretch of nothing off the space between two items', () => {
    const {gaps} = findIdlePeriods([at(0), at(300)], bounds(300));

    expect(gaps).toEqual([{start: 0, end: 300 * S}]);
  });

  it('leaves a stretch shorter than the floor alone', () => {
    // A minute and a half of quiet is reading, a form being filled in, or a slow
    // request. Being *away* takes minutes, and only that is worth cutting for.
    const {gaps} = findIdlePeriods([at(0), at(90), at(180)], bounds(180));

    expect(gaps).toEqual([]);
  });

  it('keeps the axis open across an item that occupies time', () => {
    // A trace running for the whole ten minutes is not ten idle minutes, even though
    // nothing else starts inside it. This is what stops a compressed stretch from
    // ever containing a mark.
    const {gaps} = findIdlePeriods([at(0, 600), at(600)], bounds(600));

    expect(gaps).toEqual([]);
  });

  it('counts what happened between the stretches, one region more than gaps', () => {
    const {gaps, regions} = findIdlePeriods(
      [...burst(0, 3), ...burst(300, 2), ...burst(600, 4)],
      bounds(601)
    );

    expect(gaps).toHaveLength(2);
    expect(regions).toHaveLength(3);
    expect(regions.map(region => region.count)).toEqual([3, 2, 4]);
    // Every gap is bounded by the regions either side of it, so they interleave by
    // construction rather than by repair.
    expect(regions[0]!.end).toBe(gaps[0]!.start);
    expect(regions[1]!.start).toBe(gaps[0]!.end);
  });

  it('reports nothing for a session with no telemetry', () => {
    expect(findIdlePeriods([], bounds(600))).toEqual({gaps: [], regions: []});
  });
});

describe('buildTimeScale', () => {
  it('leaves a session linear when its marks are not short of room', () => {
    // Three dots a quarter of a minute apart are three dots however the axis is
    // drawn, so the two stretches between them buy nothing worth a break. This is
    // the over-fitting guard: idle time alone is not a reason to cut.
    const scale = scaleFor([at(0), at(15), at(60)], 60);

    expect(scale.isCompressed).toBe(false);
    expect(scale.idle).toEqual([]);
    expect(scale.toRatio(15 * S)).toBeCloseTo(0.25);
  });

  it('compresses a stretch once the marks elsewhere are crowded', () => {
    // Three items inside two seconds of a ten-minute session share a single
    // bucket, which is a smudge rather than a burst.
    const scale = scaleFor([...burst(0, 3), ...burst(598, 3)], 600);

    expect(scale.isCompressed).toBe(true);
    expect(scale.idle).toHaveLength(1);
    expect(scale.idle[0]!.start).toBe(2 * S);
    expect(scale.idle[0]!.end).toBe(598 * S);
    // The break takes its fixed band, and the two busy ends split the rest.
    expect(scale.idle[0]!.u1 - scale.idle[0]!.u0).toBeCloseTo(GAP_RATIO);
    expect(scale.toRatio(2 * S)).toBeCloseTo((1 - GAP_RATIO) / 2);
  });

  it('refuses a stretch that buys less width than the break costs', () => {
    // Two and a half minutes of an hour is thirty-three pixels of an eight-hundred
    // pixel track. It is long enough to be real idle time, and cutting it would
    // still spend twenty-four pixels to save thirty-three.
    const activity: SessionRange[] = [];
    for (let second = 0; second <= 3600; second += 5) {
      if (second > 100 && second < 250) {
        continue;
      }
      activity.push(at(second));
    }

    const scale = scaleFor(activity, 3600);

    expect(findIdlePeriods(activity, bounds(3600)).gaps).toEqual([
      {start: 100 * S, end: 250 * S},
    ]);
    expect(scale.isCompressed).toBe(false);
  });

  it('compresses every stretch that earns it', () => {
    const scale = scaleFor(
      [...burst(0, 10), ...burst(600, 10), ...burst(1200, 10), ...burst(1790, 10)],
      1800
    );

    expect(scale.idle).toHaveLength(3);
    expect(scale.segments).toHaveLength(7);
    // Alternating by construction: activity, break, activity, break, and so on.
    expect(scale.segments.map(segment => segment.isIdle)).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  it('never puts two breaks against each other', () => {
    // One item between two long idle stretches. The stretches are both real and
    // both worth cutting, so what has to hold is that the item between them stays
    // visible rather than being closed over.
    const scale = scaleFor([...burst(0, 10), at(900), ...burst(1790, 10)], 1800);

    expect(scale.idle).toHaveLength(2);
    expect(scale.idle[0]!.u1).toBeLessThan(scale.idle[1]!.u0);
    // Ten pixels: the floor an activity stretch gets whatever its duration, which
    // is what a lone instant between two breaks falls back on.
    expect(scale.idle[1]!.u0 - scale.idle[0]!.u1).toBeCloseTo(10 / WIDTH);
  });

  it('runs monotonically and reads back the time it drew', () => {
    const scale = scaleFor([...burst(0, 3), ...burst(598, 3)], 600);

    const ratios = [0, 1, 2, 200, 400, 598, 599, 600].map(second =>
      scale.toRatio(second * S)
    );
    expect(ratios).toEqual(ratios.toSorted((a, b) => a - b));
    expect(ratios[0]).toBe(0);
    expect(ratios.at(-1)).toBe(1);

    // The inverse has to agree, or a pointer lands on a different time than the
    // mark drawn under it.
    for (const second of [0, 1, 2, 300, 598, 600]) {
      expect(scale.toTime(scale.toRatio(second * S))).toBeCloseTo(second * S, 0);
    }
  });

  it('stays linear when the track is too narrow to seat a break', () => {
    const range = bounds(600);
    const idle = findIdlePeriods([...burst(0, 3), ...burst(598, 3)], range);

    expect(
      buildTimeScale({bounds: range, idle, width: 20, buckets: BUCKETS}).isCompressed
    ).toBe(false);
  });
});
