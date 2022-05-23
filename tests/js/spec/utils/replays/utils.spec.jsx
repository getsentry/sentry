import {
  countColumns,
  divide,
  flattenSpans,
  formatTime,
  getCrumbsByColumn,
  relativeTimeInMs,
  showPlayerTime,
} from 'sentry/components/replays/utils';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';

describe('replays/utils.tsx', () => {
  describe('relativeTimeinMs', () => {
    it('returns relative time in MS', () => {
      expect(relativeTimeInMs('2022-05-11T23:04:27.576000Z', 347.90000009536743)).toEqual(
        1652309919676
      );
    });

    it('returns NaN without relative time', () => {
      expect(relativeTimeInMs('2022-05-11T23:04:27.576000Z')).toEqual(NaN);
    });

    it('returns invalid date if date string is malformed', () => {
      expect(relativeTimeInMs('202223:04:27.576000Z')).toEqual(NaN);
    });
  });

  describe('showPlayerTime', () => {
    it('returns time formatted for player', () => {
      expect(showPlayerTime('2022-05-11T23:04:27.576000Z', 1652309918.676)).toEqual(
        '00:05:48'
      );
    });

    it('returns time without difference', () => {
      expect(showPlayerTime('2022-05-11T23:04:27.576000Z')).toEqual('Invalid date');
    });

    it('returns invalid date if timestamp is malformed', () => {
      expect(showPlayerTime('20223:04:27.576000Z')).toEqual('Invalid date');
    });
  });

  describe('formatTime', () => {
    it('returns time correctly', () => {
      expect(formatTime(165230.9918676)).toEqual('2:45');
    });

    it('returns NaN:NaN for falsey value', () => {
      expect(formatTime(undefined)).toEqual('NaN:NaN');
    });
  });

  describe('countColumns', () => {
    it('returns correctly', () => {
      expect(countColumns(6000, 500, 25)).toEqual({
        cols: 6,
        remaining: 0,
        timespan: 1000,
      });
    });

    it('return default with no args', () => {
      expect(countColumns()).toEqual({cols: 0, remaining: NaN, timespan: 0});
    });
  });

  it('getCrumbsByColumn with no args', () => {
    const result = new Map();
    result.set(1, [
      {color: 'blue100', description: 'player crumb one', id: 1001, type: 'console'},
      {color: 'hotpink', description: 'player crumb two', id: 1002, type: 'debug'},
    ]);
    expect(
      getCrumbsByColumn(
        1652309919676,
        6000,
        [
          {
            type: BreadcrumbType.CONSOLE,
            color: 'blue100',
            description: 'player crumb one',
            id: 1001,
          },
          {
            type: BreadcrumbType.DEBUG,
            color: 'hotpink',
            description: 'player crumb two',
            id: 1002,
          },
        ],
        2
      )
    ).toEqual(result);
  });

  it('flattenSpans returns flattenedSpans', () => {
    const rawSpans = [
      {
        data: {},
        span_id: '15145snn',
        start_timestamp: 1652309919.676,
        timestamp: 1652399919.676,
        trace_id: 'hhh664534',
      },
      {
        data: {},
        span_id: '15145tmp',
        start_timestamp: 1652309919.676,
        timestamp: 1652399919.676,
        trace_id: 'rew699534',
      },
    ];

    expect(flattenSpans(rawSpans)).toEqual([
      {
        duration: 90000000,
        endTimestamp: 1652399919676,
        spanCount: 2,
        spanId: '15145snn',
        startTimestamp: 1652309919676,
      },
    ]);
  });

  describe('divide', () => {
    it('divides numbers safely', () => {
      expect(divide(81, 9)).toEqual(9);
    });

    it('dividing by zero returns', () => {
      expect(divide(81, 0)).toEqual(0);
    });

    it('dividing undefined by number results in', () => {
      expect(divide(undefined, 9)).toEqual(NaN);
    });

    it('divides by string results in NaN', () => {
      expect(divide(9, 'number')).toEqual(0);
    });
  });
});
