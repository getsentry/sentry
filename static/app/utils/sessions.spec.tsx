import {SessionFieldWithOperation, SessionStatus} from 'sentry/types';
import {
  filterSessionsInTimeWindow,
  getCount,
  getCountAtIndex,
  getCrashFreeRate,
  getSessionsInterval,
  getSessionStatusRate,
} from 'sentry/utils/sessions';

const sessionsApiResponse = {
  start: '2021-07-09T23:00:00Z',
  end: '2021-07-11T14:51:00Z',
  query: '',
  intervals: [
    '2021-07-09T23:00:00Z',
    '2021-07-10T00:00:00Z',
    '2021-07-10T01:00:00Z',
    '2021-07-10T02:00:00Z',
    '2021-07-10T03:00:00Z',
    '2021-07-10T04:00:00Z',
    '2021-07-10T05:00:00Z',
    '2021-07-10T06:00:00Z',
    '2021-07-10T07:00:00Z',
    '2021-07-10T08:00:00Z',
    '2021-07-10T09:00:00Z',
    '2021-07-10T10:00:00Z',
    '2021-07-10T11:00:00Z',
    '2021-07-10T12:00:00Z',
    '2021-07-10T13:00:00Z',
    '2021-07-10T14:00:00Z',
    '2021-07-10T15:00:00Z',
    '2021-07-10T16:00:00Z',
    '2021-07-10T17:00:00Z',
    '2021-07-10T18:00:00Z',
    '2021-07-10T19:00:00Z',
    '2021-07-10T20:00:00Z',
    '2021-07-10T21:00:00Z',
    '2021-07-10T22:00:00Z',
    '2021-07-10T23:00:00Z',
    '2021-07-11T00:00:00Z',
    '2021-07-11T01:00:00Z',
    '2021-07-11T02:00:00Z',
    '2021-07-11T03:00:00Z',
    '2021-07-11T04:00:00Z',
    '2021-07-11T05:00:00Z',
    '2021-07-11T06:00:00Z',
    '2021-07-11T07:00:00Z',
    '2021-07-11T08:00:00Z',
    '2021-07-11T09:00:00Z',
    '2021-07-11T10:00:00Z',
    '2021-07-11T11:00:00Z',
    '2021-07-11T12:00:00Z',
    '2021-07-11T13:00:00Z',
    '2021-07-11T14:00:00Z',
  ],
  groups: [
    {
      by: {'session.status': 'abnormal'},
      totals: {'count_unique(user)': 0, 'sum(session)': 0},
      series: {
        'count_unique(user)': [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
        'sum(session)': [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
        'p50(session.duration)': [
          5432, 3999, 2632, 2624, 2587, 3525, 3666, 3783, 4059, 3882, 4022, 4490, 4052,
          4157, 4166, 4502, 4260, 4713, 4474, 3802, 3199, 2296, 2737, 2259, 1560, 1659,
          1997, 1975, 1777, 1897, 2783, 3310, 4414, 4012, 4230, 4618, 4773, 4814, 4821,
          3893,
        ],
      },
    },
    {
      by: {'session.status': 'errored'},
      totals: {'count_unique(user)': 379, 'sum(session)': 146},
      series: {
        'count_unique(user)': [
          23, 6, 5, 7, 11, 5, 6, 8, 12, 14, 9, 16, 15, 22, 28, 11, 14, 16, 9, 11, 11, 7,
          7, 4, 3, 7, 6, 12, 3, 6, 6, 4, 8, 14, 23, 16, 14, 18, 12, 8,
        ],
        'sum(session)': [
          29, 3, 0, 0, 11, 0, 0, 0, 0, 1, 2, 5, 1, 16, 40, 0, 5, 0, 1, 13, 3, 0, 0, 5, 0,
          0, 3, 14, 0, 3, 2, 0, 3, 9, 16, 6, 0, 31, 20, 13,
        ],
        'p50(session.duration)': [
          0, 1, 2632, 2624, 2587, 3525, 3666, 3783, 4059, 3882, 4022, 4490, 4052, 4157,
          4166, 4502, 4260, 4713, 4474, 3802, 3199, 2296, 2737, 2259, 1560, 1659, 1997,
          1975, 1777, 1897, 2783, 3310, 4414, 4012, 4230, 4618, 4773, 4814, 4821, 2,
        ],
      },
    },
    {
      by: {'session.status': 'crashed'},
      totals: {'count_unique(user)': 341, 'sum(session)': 1796},
      series: {
        'count_unique(user)': [
          5, 10, 5, 6, 6, 12, 9, 16, 24, 16, 11, 13, 20, 16, 12, 18, 18, 17, 12, 8, 8, 19,
          15, 5, 4, 9, 4, 7, 5, 7, 4, 12, 13, 11, 15, 9, 21, 20, 14, 11,
        ],
        'sum(session)': [
          33, 32, 31, 36, 30, 78, 56, 60, 95, 55, 52, 47, 53, 43, 61, 68, 43, 71, 47, 29,
          38, 65, 55, 14, 14, 34, 30, 32, 23, 20, 21, 53, 40, 39, 56, 34, 60, 61, 62, 25,
        ],
        'p50(session.duration)': [
          3, 4, 5, 2624, 2587, 3525, 3666, 3783, 4059, 3882, 4022, 4490, 4052, 4157, 4166,
          4502, 4260, 4713, 4474, 3802, 3199, 2296, 2737, 2259, 1560, 1659, 1997, 1975,
          1777, 1897, 2783, 3310, 4414, 4012, 4230, 4618, 4773, 4814, 4821, 6,
        ],
      },
    },
    {
      by: {'session.status': 'healthy'},
      totals: {'count_unique(user)': 6585, 'sum(session)': 141851},
      series: {
        'count_unique(user)': [
          454, 351, 261, 239, 229, 250, 296, 329, 337, 336, 347, 368, 351, 372, 370, 391,
          323, 358, 348, 307, 266, 224, 201, 168, 156, 133, 146, 164, 168, 151, 184, 276,
          341, 354, 351, 379, 395, 400, 394, 333,
        ],
        'sum(session)': [
          5432, 3999, 2632, 2624, 2587, 3525, 3666, 3783, 4059, 3882, 4022, 4490, 4052,
          4157, 4166, 4502, 4260, 4713, 4474, 3802, 3199, 2296, 2737, 2259, 1560, 1659,
          1997, 1975, 1777, 1897, 2783, 3310, 4414, 4012, 4230, 4618, 4773, 4814, 4821,
          3893,
        ],
        'p50(session.duration)': [
          7, 8, 9, 2624, 2587, 3525, 3666, 3783, 4059, 3882, 4022, 4490, 4052, 4157, 4166,
          4502, 4260, 4713, 4474, 3802, 3199, 2296, 2737, 2259, 1560, 1659, 1997, 1975,
          1777, 1897, 2783, 3310, 4414, 4012, 4230, 4618, 4773, 4814, 4821, 10,
        ],
      },
    },
  ],
};

describe('utils/sessions', () => {
  describe('getCount', () => {
    const groups = [sessionsApiResponse.groups[1], sessionsApiResponse.groups[2]];
    it('returns sessions count', () => {
      expect(getCount(groups, SessionFieldWithOperation.SESSIONS)).toBe(1942);
    });
    it('returns users count', () => {
      expect(getCount(groups, SessionFieldWithOperation.USERS)).toBe(720);
    });
  });

  describe('getCountAtIndex', () => {
    const groups = [sessionsApiResponse.groups[1], sessionsApiResponse.groups[2]];
    it('returns sessions count', () => {
      expect(getCountAtIndex(groups, SessionFieldWithOperation.SESSIONS, 1)).toBe(35);
    });
    it('returns users count', () => {
      expect(getCountAtIndex(groups, SessionFieldWithOperation.USERS, 1)).toBe(16);
    });
  });

  describe('getCrashFreeRate', () => {
    const {groups} = sessionsApiResponse;
    it('returns crash free sessions', () => {
      expect(getCrashFreeRate(groups, SessionFieldWithOperation.SESSIONS)).toBe(98.751);
    });
    it('returns crash free users', () => {
      expect(getCrashFreeRate(groups, SessionFieldWithOperation.USERS)).toBe(95.332);
    });
  });

  describe('getSessionStatusRate', () => {
    const {groups} = sessionsApiResponse;
    it('returns errored sessions rate', () => {
      expect(
        getSessionStatusRate(
          groups,
          SessionFieldWithOperation.SESSIONS,
          SessionStatus.ERRORED
        )
      ).toBe(0.10153484522890543);
    });
    it('returns healthy users rate', () => {
      expect(
        getSessionStatusRate(
          groups,
          SessionFieldWithOperation.USERS,
          SessionStatus.HEALTHY
        )
      ).toBe(90.14373716632443);
    });
  });

  describe('getSessionsInterval', () => {
    describe('with high fidelity', () => {
      it('>= 60 days', () => {
        expect(getSessionsInterval({period: '60d'}, {highFidelity: true})).toBe('1d');
      });

      it('>= 30 days', () => {
        expect(getSessionsInterval({period: '30d'}, {highFidelity: true})).toBe('4h');
      });

      it('14 days', () => {
        expect(getSessionsInterval({period: '14d'}, {highFidelity: true})).toBe('1h');
      });

      it('>= 6 hours', () => {
        expect(getSessionsInterval({period: '6h'}, {highFidelity: true})).toBe('1h');
      });

      it('between 6 hours and 30 minutes', () => {
        expect(getSessionsInterval({period: '31m'}, {highFidelity: true})).toBe('5m');
      });

      it('less or equal to 30 minutes', () => {
        expect(getSessionsInterval({period: '30m'}, {highFidelity: true})).toBe('1m');
      });

      it('less or equal to 10 minutes', () => {
        expect(
          getSessionsInterval(
            {start: '2021-10-08T12:00:00Z', end: '2021-10-08T12:05:00.000Z'},
            {highFidelity: true}
          )
        ).toBe('10s');
      });

      it('ignores high fidelity flag if start is older than 30d', () => {
        expect(
          getSessionsInterval(
            {start: '2017-09-15T02:41:20Z', end: '2017-09-15T02:42:20Z'},
            {highFidelity: true}
          )
        ).toBe('1h');
      });
    });

    describe('with low fidelity', () => {
      it('>= 60 days', () => {
        expect(getSessionsInterval({period: '60d'})).toBe('1d');
        expect(
          getSessionsInterval(
            {start: '2021-07-19T15:14:23Z', end: '2021-10-19T15:14:23Z'},
            {highFidelity: true}
          )
        ).toBe('1d');
      });

      it('>= 30 days', () => {
        expect(getSessionsInterval({period: '30d'})).toBe('4h');
      });

      it('14 days', () => {
        expect(getSessionsInterval({period: '14d'})).toBe('1h');
      });

      it('>= 6 hours', () => {
        expect(getSessionsInterval({period: '6h'})).toBe('1h');
      });

      it('between 6 hours and 30 minutes', () => {
        expect(getSessionsInterval({period: '31m'})).toBe('1h');
      });

      it('less or equal to 30 minutes', () => {
        expect(getSessionsInterval({period: '30m'})).toBe('1h');
      });
    });
  });

  describe('filterSessionsInTimeWindow', () => {
    it('filters out intervals/series out of bounds', () => {
      const filtered = filterSessionsInTimeWindow(
        sessionsApiResponse,
        '2021-07-09T23:12:57.265410Z',
        '2021-07-11T14:49:59Z'
      );

      expect(filtered).toEqual({
        start: '2021-07-10T00:00:00Z',
        end: '2021-07-11T14:00:00Z',
        query: '',
        intervals: [
          '2021-07-10T00:00:00Z',
          '2021-07-10T01:00:00Z',
          '2021-07-10T02:00:00Z',
          '2021-07-10T03:00:00Z',
          '2021-07-10T04:00:00Z',
          '2021-07-10T05:00:00Z',
          '2021-07-10T06:00:00Z',
          '2021-07-10T07:00:00Z',
          '2021-07-10T08:00:00Z',
          '2021-07-10T09:00:00Z',
          '2021-07-10T10:00:00Z',
          '2021-07-10T11:00:00Z',
          '2021-07-10T12:00:00Z',
          '2021-07-10T13:00:00Z',
          '2021-07-10T14:00:00Z',
          '2021-07-10T15:00:00Z',
          '2021-07-10T16:00:00Z',
          '2021-07-10T17:00:00Z',
          '2021-07-10T18:00:00Z',
          '2021-07-10T19:00:00Z',
          '2021-07-10T20:00:00Z',
          '2021-07-10T21:00:00Z',
          '2021-07-10T22:00:00Z',
          '2021-07-10T23:00:00Z',
          '2021-07-11T00:00:00Z',
          '2021-07-11T01:00:00Z',
          '2021-07-11T02:00:00Z',
          '2021-07-11T03:00:00Z',
          '2021-07-11T04:00:00Z',
          '2021-07-11T05:00:00Z',
          '2021-07-11T06:00:00Z',
          '2021-07-11T07:00:00Z',
          '2021-07-11T08:00:00Z',
          '2021-07-11T09:00:00Z',
          '2021-07-11T10:00:00Z',
          '2021-07-11T11:00:00Z',
          '2021-07-11T12:00:00Z',
          '2021-07-11T13:00:00Z',
          '2021-07-11T14:00:00Z',
        ],
        groups: [
          {
            by: {'session.status': 'abnormal'},
            totals: {
              'count_unique(user)': 0,
              'sum(session)': 0,
              'p50(session.duration)': 3497.923076923077,
            },
            series: {
              'count_unique(user)': [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              ],
              'sum(session)': [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              ],
              'p50(session.duration)': [
                3999, 2632, 2624, 2587, 3525, 3666, 3783, 4059, 3882, 4022, 4490, 4052,
                4157, 4166, 4502, 4260, 4713, 4474, 3802, 3199, 2296, 2737, 2259, 1560,
                1659, 1997, 1975, 1777, 1897, 2783, 3310, 4414, 4012, 4230, 4618, 4773,
                4814, 4821, 3893,
              ],
            },
          },
          {
            by: {'session.status': 'errored'},
            totals: {
              'count_unique(user)': 379,
              'sum(session)': 226,
              'p50(session.duration)': 3295.641025641026,
            },
            series: {
              'count_unique(user)': [
                6, 5, 7, 11, 5, 6, 8, 12, 14, 9, 16, 15, 22, 28, 11, 14, 16, 9, 11, 11, 7,
                7, 4, 3, 7, 6, 12, 3, 6, 6, 4, 8, 14, 23, 16, 14, 18, 12, 8,
              ],
              'sum(session)': [
                3, 0, 0, 11, 0, 0, 0, 0, 1, 2, 5, 1, 16, 40, 0, 5, 0, 1, 13, 3, 0, 0, 5,
                0, 0, 3, 14, 0, 3, 2, 0, 3, 9, 16, 6, 0, 31, 20, 13,
              ],
              'p50(session.duration)': [
                1, 2632, 2624, 2587, 3525, 3666, 3783, 4059, 3882, 4022, 4490, 4052, 4157,
                4166, 4502, 4260, 4713, 4474, 3802, 3199, 2296, 2737, 2259, 1560, 1659,
                1997, 1975, 1777, 1897, 2783, 3310, 4414, 4012, 4230, 4618, 4773, 4814,
                4821, 2,
              ],
            },
          },
          {
            by: {'session.status': 'crashed'},
            totals: {
              'count_unique(user)': 341,
              'sum(session)': 1763,
              'p50(session.duration)': 3228.4615384615386,
            },
            series: {
              'count_unique(user)': [
                10, 5, 6, 6, 12, 9, 16, 24, 16, 11, 13, 20, 16, 12, 18, 18, 17, 12, 8, 8,
                19, 15, 5, 4, 9, 4, 7, 5, 7, 4, 12, 13, 11, 15, 9, 21, 20, 14, 11,
              ],
              'sum(session)': [
                32, 31, 36, 30, 78, 56, 60, 95, 55, 52, 47, 53, 43, 61, 68, 43, 71, 47,
                29, 38, 65, 55, 14, 14, 34, 30, 32, 23, 20, 21, 53, 40, 39, 56, 34, 60,
                61, 62, 25,
              ],
              'p50(session.duration)': [
                4, 5, 2624, 2587, 3525, 3666, 3783, 4059, 3882, 4022, 4490, 4052, 4157,
                4166, 4502, 4260, 4713, 4474, 3802, 3199, 2296, 2737, 2259, 1560, 1659,
                1997, 1975, 1777, 1897, 2783, 3310, 4414, 4012, 4230, 4618, 4773, 4814,
                4821, 6,
              ],
            },
          },
          {
            by: {'session.status': 'healthy'},
            totals: {
              'count_unique(user)': 6585,
              'sum(session)': 136419,
              'p50(session.duration)': 3228.769230769231,
            },
            series: {
              'count_unique(user)': [
                351, 261, 239, 229, 250, 296, 329, 337, 336, 347, 368, 351, 372, 370, 391,
                323, 358, 348, 307, 266, 224, 201, 168, 156, 133, 146, 164, 168, 151, 184,
                276, 341, 354, 351, 379, 395, 400, 394, 333,
              ],
              'sum(session)': [
                3999, 2632, 2624, 2587, 3525, 3666, 3783, 4059, 3882, 4022, 4490, 4052,
                4157, 4166, 4502, 4260, 4713, 4474, 3802, 3199, 2296, 2737, 2259, 1560,
                1659, 1997, 1975, 1777, 1897, 2783, 3310, 4414, 4012, 4230, 4618, 4773,
                4814, 4821, 3893,
              ],
              'p50(session.duration)': [
                8, 9, 2624, 2587, 3525, 3666, 3783, 4059, 3882, 4022, 4490, 4052, 4157,
                4166, 4502, 4260, 4713, 4474, 3802, 3199, 2296, 2737, 2259, 1560, 1659,
                1997, 1975, 1777, 1897, 2783, 3310, 4414, 4012, 4230, 4618, 4773, 4814,
                4821, 10,
              ],
            },
          },
        ],
      });
    });
  });
});
