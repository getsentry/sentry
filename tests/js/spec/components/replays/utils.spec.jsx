import {
  countColumns,
  formatTime,
  getCrumbsByColumn,
} from 'sentry/components/replays/utils';

const SECOND = 1000;

describe('formatTime', () => {
  it.each([
    ['seconds', 15 * 1000, '0:15'],
    ['minutes', 2.5 * 60 * 1000, '2:30'],
    ['hours', 75 * 60 * 1000, '1:15:00'],
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

describe('getCrumbsByColumn', () => {
  const CRUMB_1 = {timestamp: '2022-04-14T14:19:47.326000Z'};
  const CRUMB_2 = {timestamp: '2022-04-14T14:19:49.249000Z'};
  const CRUMB_3 = {timestamp: '2022-04-14T14:19:51.512000Z'};
  const CRUMB_4 = {timestamp: '2022-04-14T14:19:57.326000Z'};
  const CRUMB_5 = {timestamp: '2022-04-14T14:20:13.036000Z'};

  it('should return a map of buckets', () => {
    const columnCount = 3;
    const columns = getCrumbsByColumn([], columnCount);
    const expectedEntries = [[0, []]];
    expect(columns).toEqual(new Map(expectedEntries));
  });

  it('should put a crumbs in the first and last buckets', () => {
    const columnCount = 3;
    const columns = getCrumbsByColumn([CRUMB_1, CRUMB_5], columnCount);
    const expectedEntries = [
      [1, [CRUMB_1]],
      [3, [CRUMB_5]],
    ];
    expect(columns).toEqual(new Map(expectedEntries));
  });

  it('should group crumbs by bucket', () => {
    // 6 columns gives is 5s granularity
    const columnCount = 6;
    const columns = getCrumbsByColumn(
      [CRUMB_1, CRUMB_2, CRUMB_3, CRUMB_4, CRUMB_5],
      columnCount
    );
    const expectedEntries = [
      [1, [CRUMB_1, CRUMB_2, CRUMB_3]],
      [2, [CRUMB_4]],
      [6, [CRUMB_5]],
    ];
    expect(columns).toEqual(new Map(expectedEntries));
  });
});
