import {RawReplayErrorFixture} from 'sentry-fixture/replay/error';
import {ReplayRequestFrameFixture} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {
  countColumns,
  divide,
  flattenFrames,
  formatTime,
  getFramesByColumn,
  showPlayerTime,
} from 'sentry/components/replays/utils';
import hydrateErrors from 'sentry/utils/replays/hydrateErrors';
import hydrateSpans from 'sentry/utils/replays/hydrateSpans';

const SECOND = 1000;

describe('formatTime', () => {
  it.each([
    ['seconds', 15 * 1000, '00:15'],
    ['minutes', 2.5 * 60 * 1000, '02:30'],
    ['hours', 75 * 60 * 1000, '01:15:00'],
  ])('should format a %s long duration into a string', (_desc, duration, expected) => {
    expect(formatTime(duration)).toEqual(expected);
  });
});

describe('countColumns', () => {
  it('should divide 27s by 2700px to find twentyseven 1s columns, with some fraction remaining', () => {
    // 2700 allows for up to 27 columns at 100px wide.
    // That is what we'd need if we were to render at `1s` granularity, so we can.
    const width = 2700;

    const duration = 27 * SECOND;
    const minWidth = 100;
    const {timespan, cols, remaining} = countColumns(duration, width, minWidth);

    expect(timespan).toBe(1 * SECOND);
    expect(cols).toBe(27);
    expect(remaining).toBe(0);
  });

  it('should divide 27s by 2699px to find five 5s columns, with some fraction remaining', () => {
    // 2699px allows for up to 26 columns at 100px wide, with 99px leftover.
    // That is less than the 27 cols we'd need if we were to render at `1s` granularity.
    // So instead we get 5 cols (wider than 100px) at 5s granularity, and some extra space is remaining.
    const width = 2699;

    const duration = 27 * SECOND;
    const minWidth = 100;
    const {timespan, cols, remaining} = countColumns(duration, width, minWidth);

    expect(timespan).toBe(5 * SECOND);
    expect(cols).toBe(5);
    expect(remaining).toBe(0.4);
  });

  it('should divide 27s by 600px to find five 5s columns, with some fraction column remaining', () => {
    // 600px allows for 6 columns at 100px wide to fix within it
    // That allows us to get 5 cols (100px wide) at 5s granularity, and an extra 100px for the remainder
    const width = 600;

    const duration = 27 * SECOND;
    const minWidth = 100;
    const {timespan, cols, remaining} = countColumns(duration, width, minWidth);

    expect(timespan).toBe(5 * SECOND);
    expect(cols).toBe(5);
    expect(remaining).toBe(0.4);
  });

  it('should divide 27s by 599px to find five 2s columns, with some fraction column remaining', () => {
    // 599px allows for 5 columns at 100px wide, and 99px remaining.
    // That allows us to get 2 cols (100px wide) at 10s granularity, and an extra px for the remainder
    const width = 599;

    const duration = 27 * SECOND;
    const minWidth = 100;
    const {timespan, cols, remaining} = countColumns(duration, width, minWidth);

    expect(timespan).toBe(10 * SECOND);
    expect(cols).toBe(2);
    expect(remaining).toBe(0.7);
  });
});

describe('getFramesByColumn', () => {
  const durationMs = 25710; // milliseconds

  const [CRUMB_1, CRUMB_2, CRUMB_3, CRUMB_4, CRUMB_5] = hydrateErrors(
    ReplayRecordFixture({
      started_at: new Date('2022-04-14T14:19:47.326000Z'),
    }),
    [
      RawReplayErrorFixture({
        timestamp: new Date('2022-04-14T14:19:47.326000Z'),
      }),
      RawReplayErrorFixture({
        timestamp: new Date('2022-04-14T14:19:49.249000Z'),
      }),
      RawReplayErrorFixture({
        timestamp: new Date('2022-04-14T14:19:51.512000Z'),
      }),
      RawReplayErrorFixture({
        timestamp: new Date('2022-04-14T14:19:57.326000Z'),
      }),
      RawReplayErrorFixture({
        timestamp: new Date('2022-04-14T14:20:13.036000Z'),
      }),
    ]
  );

  it('should return an empty list when no crumbs exist', () => {
    const columnCount = 3;
    const columns = getFramesByColumn(durationMs, [], columnCount);
    const expectedEntries = [];
    expect(columns).toEqual(new Map(expectedEntries));
  });

  it('should put a crumbs in the first and last buckets', () => {
    const columnCount = 3;
    const columns = getFramesByColumn(durationMs, [CRUMB_1, CRUMB_5], columnCount);
    expect(columns).toEqual(
      new Map([
        [1, [CRUMB_1]],
        [3, [CRUMB_5]],
      ])
    );
  });

  it('should group crumbs by bucket', () => {
    // 6 columns gives is 5s granularity
    const columnCount = 6;
    const columns = getFramesByColumn(
      durationMs,
      [CRUMB_1, CRUMB_2, CRUMB_3, CRUMB_4, CRUMB_5],
      columnCount
    );
    expect(columns).toEqual(
      new Map([
        [1, [CRUMB_1, CRUMB_2, CRUMB_3]],
        [2, [CRUMB_4]],
        [6, [CRUMB_5]],
      ])
    );
  });
});

describe('flattenFrames', () => {
  it('should return an empty array if there ar eno spans', () => {
    expect(flattenFrames([])).toStrictEqual([]);
  });

  it('should return the FlattenedSpanRange for a single span', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
      }),
    ]);
    expect(flattenFrames(frames)).toStrictEqual([
      {
        duration: 20000,
        endTimestamp: 30000,
        frameCount: 1,
        startTimestamp: 10000,
      },
    ]);
  });

  it('should return two non-overlapping spans', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
      }),
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(60000),
        endTimestamp: new Date(90000),
      }),
    ]);

    expect(flattenFrames(frames)).toStrictEqual([
      {
        duration: 20000,
        endTimestamp: 30000,
        frameCount: 1,
        startTimestamp: 10000,
      },
      {
        duration: 30000,
        endTimestamp: 90000,
        frameCount: 1,
        startTimestamp: 60000,
      },
    ]);
  });

  it('should merge two overlapping spans', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
      }),
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(20000),
        endTimestamp: new Date(40000),
      }),
    ]);

    expect(flattenFrames(frames)).toStrictEqual([
      {
        duration: 30000,
        endTimestamp: 40000,
        frameCount: 2,
        startTimestamp: 10000,
      },
    ]);
  });

  it('should merge overlapping spans that are not first in the list', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(0),
        endTimestamp: new Date(1000),
      }),
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
      }),
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(20000),
        endTimestamp: new Date(40000),
      }),
    ]);

    expect(flattenFrames(frames)).toStrictEqual([
      {
        duration: 1000,
        endTimestamp: 1000,
        frameCount: 1,
        startTimestamp: 0,
      },
      {
        duration: 30000,
        endTimestamp: 40000,
        frameCount: 2,
        startTimestamp: 10000,
      },
    ]);
  });

  const diffMs = 1652309918676;
  describe('showPlayerTime', () => {
    it('returns time formatted for player', () => {
      expect(showPlayerTime('2022-05-11T23:04:27.576000Z', diffMs)).toEqual('05:48');
    });

    it('returns 0:00 if timestamp is malformed', () => {
      expect(showPlayerTime('20223:04:27.576000Z', diffMs)).toEqual('00:00');
    });
  });

  describe('divide', () => {
    it('divides numbers safely', () => {
      expect(divide(81, 9)).toEqual(9);
    });

    it('dividing by zero returns zero', () => {
      expect(divide(81, 0)).toEqual(0);
    });
  });
});
