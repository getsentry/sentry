export function SessionStatusCountByReleaseInPeriod() {
  return {
    query:
      'release:7a82c130be9143361f20bc77252df783cf91e4fc OR release:e102abb2c46e7fe8686441091005c12aed90da99',
    intervals: [
      '2021-03-05T00:00:00Z',
      '2021-03-06T00:00:00Z',
      '2021-03-07T00:00:00Z',
      '2021-03-08T00:00:00Z',
      '2021-03-09T00:00:00Z',
      '2021-03-10T00:00:00Z',
      '2021-03-11T00:00:00Z',
      '2021-03-12T00:00:00Z',
      '2021-03-13T00:00:00Z',
      '2021-03-14T00:00:00Z',
      '2021-03-15T00:00:00Z',
      '2021-03-16T00:00:00Z',
      '2021-03-17T00:00:00Z',
      '2021-03-18T00:00:00Z',
    ],
    groups: [
      {
        by: {
          project: 123,
          release: '7a82c130be9143361f20bc77252df783cf91e4fc',
          'session.status': 'crashed',
        },
        totals: {'sum(session)': 492},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 490]},
      },
      {
        by: {
          'session.status': 'healthy',
          project: 123,
          release: 'e102abb2c46e7fe8686441091005c12aed90da99',
        },
        totals: {'sum(session)': 6260},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5750, 510]},
      },
      {
        by: {
          project: 123,
          'session.status': 'abnormal',
          release: 'e102abb2c46e7fe8686441091005c12aed90da99',
        },
        totals: {'sum(session)': 0},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]},
      },
      {
        by: {
          project: 123,
          release: 'e102abb2c46e7fe8686441091005c12aed90da99',
          'session.status': 'crashed',
        },
        totals: {'sum(session)': 5},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0]},
      },
      {
        by: {
          project: 123,
          'session.status': 'abnormal',
          release: '7a82c130be9143361f20bc77252df783cf91e4fc',
        },
        totals: {'sum(session)': 0},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]},
      },
      {
        by: {
          project: 123,
          release: 'e102abb2c46e7fe8686441091005c12aed90da99',
          'session.status': 'errored',
        },
        totals: {'sum(session)': 59},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 59, 0]},
      },
      {
        by: {
          'session.status': 'healthy',
          project: 123,
          release: '7a82c130be9143361f20bc77252df783cf91e4fc',
        },
        totals: {'sum(session)': 202136},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3404, 198732]},
      },
      {
        by: {
          project: 123,
          release: '7a82c130be9143361f20bc77252df783cf91e4fc',
          'session.status': 'errored',
        },
        totals: {'sum(session)': 1954},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 1914]},
      },
    ],
  };
}

export function SessionStatusCountByProjectInPeriod() {
  return {
    query: '',
    intervals: [
      '2021-03-05T00:00:00Z',
      '2021-03-06T00:00:00Z',
      '2021-03-07T00:00:00Z',
      '2021-03-08T00:00:00Z',
      '2021-03-09T00:00:00Z',
      '2021-03-10T00:00:00Z',
      '2021-03-11T00:00:00Z',
      '2021-03-12T00:00:00Z',
      '2021-03-13T00:00:00Z',
      '2021-03-14T00:00:00Z',
      '2021-03-15T00:00:00Z',
      '2021-03-16T00:00:00Z',
      '2021-03-17T00:00:00Z',
      '2021-03-18T00:00:00Z',
    ],
    groups: [
      {
        by: {
          project: 123,
          'session.status': 'crashed',
        },
        totals: {'sum(session)': 992},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 990]},
      },
      {
        by: {
          project: 123,
          'session.status': 'healthy',
        },
        totals: {'sum(session)': 9260},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9167, 93]},
      },
      {
        by: {
          project: 123,
          'session.status': 'abnormal',
        },
        totals: {'sum(session)': 0},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]},
      },
      {
        by: {
          project: 123,
          'session.status': 'errored',
        },
        totals: {'sum(session)': 99},
        series: {'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 99, 0]},
      },
    ],
  };
}

export function SesssionTotalCountByReleaseIn24h() {
  return {
    query:
      'release:7a82c130be9143361f20bc77252df783cf91e4fc OR release:e102abb2c46e7fe8686441091005c12aed90da99',
    intervals: [
      '2021-03-17T10:00:00Z',
      '2021-03-17T11:00:00Z',
      '2021-03-17T12:00:00Z',
      '2021-03-17T13:00:00Z',
      '2021-03-17T14:00:00Z',
      '2021-03-17T15:00:00Z',
      '2021-03-17T16:00:00Z',
      '2021-03-17T17:00:00Z',
      '2021-03-17T18:00:00Z',
      '2021-03-17T19:00:00Z',
      '2021-03-17T20:00:00Z',
      '2021-03-17T21:00:00Z',
      '2021-03-17T22:00:00Z',
      '2021-03-17T23:00:00Z',
      '2021-03-18T00:00:00Z',
      '2021-03-18T01:00:00Z',
      '2021-03-18T02:00:00Z',
      '2021-03-18T03:00:00Z',
      '2021-03-18T04:00:00Z',
      '2021-03-18T05:00:00Z',
      '2021-03-18T06:00:00Z',
      '2021-03-18T07:00:00Z',
      '2021-03-18T08:00:00Z',
      '2021-03-18T09:00:00Z',
    ],
    groups: [
      {
        by: {project: 123, release: '7a82c130be9143361f20bc77252df783cf91e4fc'},
        totals: {'sum(session)': 219826},
        series: {
          'sum(session)': [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            3444,
            14912,
            15649,
            18019,
            16726,
            17540,
            16970,
            25015,
            34686,
            46434,
            10431,
          ],
        },
      },
      {
        by: {release: 'e102abb2c46e7fe8686441091005c12aed90da99', project: 123},
        totals: {'sum(session)': 6320},
        series: {
          'sum(session)': [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            5809,
            400,
            22,
            26,
            12,
            19,
            8,
            0,
            19,
            5,
            0,
          ],
        },
      },
    ],
  };
}

export function SessionTotalCountByProjectIn24h() {
  return {
    query: '',
    intervals: [
      '2021-03-17T10:00:00Z',
      '2021-03-17T11:00:00Z',
      '2021-03-17T12:00:00Z',
      '2021-03-17T13:00:00Z',
      '2021-03-17T14:00:00Z',
      '2021-03-17T15:00:00Z',
      '2021-03-17T16:00:00Z',
      '2021-03-17T17:00:00Z',
      '2021-03-17T18:00:00Z',
      '2021-03-17T19:00:00Z',
      '2021-03-17T20:00:00Z',
      '2021-03-17T21:00:00Z',
      '2021-03-17T22:00:00Z',
      '2021-03-17T23:00:00Z',
      '2021-03-18T00:00:00Z',
      '2021-03-18T01:00:00Z',
      '2021-03-18T02:00:00Z',
      '2021-03-18T03:00:00Z',
      '2021-03-18T04:00:00Z',
      '2021-03-18T05:00:00Z',
      '2021-03-18T06:00:00Z',
      '2021-03-18T07:00:00Z',
      '2021-03-18T08:00:00Z',
      '2021-03-18T09:00:00Z',
    ],
    groups: [
      {
        by: {project: 123},
        totals: {'sum(session)': 835965},
        series: {
          'sum(session)': [
            51284,
            43820,
            46981,
            56929,
            59999,
            60476,
            54145,
            52642,
            42917,
            35787,
            35036,
            29287,
            24815,
            19815,
            16334,
            16415,
            18961,
            17512,
            18149,
            17585,
            25725,
            36365,
            48104,
            6882,
          ],
        },
      },
    ],
  };
}

export function SessionUserStatusCountByReleaseInPeriod() {
  return {
    query:
      'release:7a82c130be9143361f20bc77252df783cf91e4fc OR release:e102abb2c46e7fe8686441091005c12aed90da99',
    intervals: [
      '2021-03-05T00:00:00Z',
      '2021-03-06T00:00:00Z',
      '2021-03-07T00:00:00Z',
      '2021-03-08T00:00:00Z',
      '2021-03-09T00:00:00Z',
      '2021-03-10T00:00:00Z',
      '2021-03-11T00:00:00Z',
      '2021-03-12T00:00:00Z',
      '2021-03-13T00:00:00Z',
      '2021-03-14T00:00:00Z',
      '2021-03-15T00:00:00Z',
      '2021-03-16T00:00:00Z',
      '2021-03-17T00:00:00Z',
      '2021-03-18T00:00:00Z',
    ],
    groups: [
      {
        by: {
          project: 123,
          release: '7a82c130be9143361f20bc77252df783cf91e4fc',
          'session.status': 'crashed',
        },
        totals: {'sum(session)': 492, 'count_unique(user)': 92},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 490],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 90],
        },
      },
      {
        by: {
          'session.status': 'healthy',
          project: 123,
          release: 'e102abb2c46e7fe8686441091005c12aed90da99',
        },
        totals: {'sum(session)': 6260, 'count_unique(user)': 760},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5750, 510],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 750, 10],
        },
      },
      {
        by: {
          project: 123,
          'session.status': 'abnormal',
          release: 'e102abb2c46e7fe8686441091005c12aed90da99',
        },
        totals: {'sum(session)': 0, 'count_unique(user)': 0},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
      },
      {
        by: {
          project: 123,
          release: 'e102abb2c46e7fe8686441091005c12aed90da99',
          'session.status': 'crashed',
        },
        totals: {'sum(session)': 5, 'count_unique(user)': 1},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
        },
      },
      {
        by: {
          project: 123,
          'session.status': 'abnormal',
          release: '7a82c130be9143361f20bc77252df783cf91e4fc',
        },
        totals: {'sum(session)': 0, 'count_unique(user)': 0},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
      },
      {
        by: {
          project: 123,
          release: 'e102abb2c46e7fe8686441091005c12aed90da99',
          'session.status': 'errored',
        },
        totals: {'sum(session)': 59, 'count_unique(user)': 9},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 59, 0],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 0],
        },
      },
      {
        by: {
          'session.status': 'healthy',
          project: 123,
          release: '7a82c130be9143361f20bc77252df783cf91e4fc',
        },
        totals: {'sum(session)': 202136, 'count_unique(user)': 99136},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3404, 198732],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 404, 98732],
        },
      },
      {
        by: {
          project: 123,
          release: '7a82c130be9143361f20bc77252df783cf91e4fc',
          'session.status': 'errored',
        },
        totals: {'sum(session)': 1954, 'count_unique(user)': 915},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 1914],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 914],
        },
      },
    ],
  };
}

export function SessionUserStatusCountByProjectInPeriod() {
  return {
    query: '',
    intervals: [
      '2021-03-05T00:00:00Z',
      '2021-03-06T00:00:00Z',
      '2021-03-07T00:00:00Z',
      '2021-03-08T00:00:00Z',
      '2021-03-09T00:00:00Z',
      '2021-03-10T00:00:00Z',
      '2021-03-11T00:00:00Z',
      '2021-03-12T00:00:00Z',
      '2021-03-13T00:00:00Z',
      '2021-03-14T00:00:00Z',
      '2021-03-15T00:00:00Z',
      '2021-03-16T00:00:00Z',
      '2021-03-17T00:00:00Z',
      '2021-03-18T00:00:00Z',
    ],
    groups: [
      {
        by: {
          project: 123,
          'session.status': 'crashed',
        },
        totals: {'sum(session)': 992, 'count_unique(user)': 92},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 990],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 90],
        },
      },
      {
        by: {
          project: 123,
          'session.status': 'healthy',
        },
        totals: {'sum(session)': 9260, 'count_unique(user)': 260},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9167, 93],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 258],
        },
      },
      {
        by: {
          project: 123,
          'session.status': 'abnormal',
        },
        totals: {'sum(session)': 0, 'count_unique(user)': 0},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
      },
      {
        by: {
          project: 123,
          'session.status': 'errored',
        },
        totals: {'sum(session)': 99, 'count_unique(user)': 9},
        series: {
          'sum(session)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 99, 0],
          'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 8],
        },
      },
    ],
  };
}

export function UserTotalCountByReleaseIn24h() {
  return {
    query:
      'release:7a82c130be9143361f20bc77252df783cf91e4fc OR release:e102abb2c46e7fe8686441091005c12aed90da99',
    intervals: [
      '2021-03-17T10:00:00Z',
      '2021-03-17T11:00:00Z',
      '2021-03-17T12:00:00Z',
      '2021-03-17T13:00:00Z',
      '2021-03-17T14:00:00Z',
      '2021-03-17T15:00:00Z',
      '2021-03-17T16:00:00Z',
      '2021-03-17T17:00:00Z',
      '2021-03-17T18:00:00Z',
      '2021-03-17T19:00:00Z',
      '2021-03-17T20:00:00Z',
      '2021-03-17T21:00:00Z',
      '2021-03-17T22:00:00Z',
      '2021-03-17T23:00:00Z',
      '2021-03-18T00:00:00Z',
      '2021-03-18T01:00:00Z',
      '2021-03-18T02:00:00Z',
      '2021-03-18T03:00:00Z',
      '2021-03-18T04:00:00Z',
      '2021-03-18T05:00:00Z',
      '2021-03-18T06:00:00Z',
      '2021-03-18T07:00:00Z',
      '2021-03-18T08:00:00Z',
      '2021-03-18T09:00:00Z',
    ],
    groups: [
      {
        by: {project: 123, release: '7a82c130be9143361f20bc77252df783cf91e4fc'},
        totals: {'count_unique(user)': 56826},
        series: {
          'count_unique(user)': [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            444,
            4912,
            5649,
            8019,
            6726,
            7540,
            6970,
            5015,
            4686,
            6434,
            431,
          ],
        },
      },
      {
        by: {release: 'e102abb2c46e7fe8686441091005c12aed90da99', project: 123},
        totals: {'count_unique(user)': 850},
        series: {
          'count_unique(user)': [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            809,
            0,
            2,
            6,
            2,
            9,
            8,
            0,
            9,
            5,
            0,
          ],
        },
      },
    ],
  };
}

export function UserTotalCountByProjectIn24h() {
  return {
    query: '',
    intervals: [
      '2021-03-17T10:00:00Z',
      '2021-03-17T11:00:00Z',
      '2021-03-17T12:00:00Z',
      '2021-03-17T13:00:00Z',
      '2021-03-17T14:00:00Z',
      '2021-03-17T15:00:00Z',
      '2021-03-17T16:00:00Z',
      '2021-03-17T17:00:00Z',
      '2021-03-17T18:00:00Z',
      '2021-03-17T19:00:00Z',
      '2021-03-17T20:00:00Z',
      '2021-03-17T21:00:00Z',
      '2021-03-17T22:00:00Z',
      '2021-03-17T23:00:00Z',
      '2021-03-18T00:00:00Z',
      '2021-03-18T01:00:00Z',
      '2021-03-18T02:00:00Z',
      '2021-03-18T03:00:00Z',
      '2021-03-18T04:00:00Z',
      '2021-03-18T05:00:00Z',
      '2021-03-18T06:00:00Z',
      '2021-03-18T07:00:00Z',
      '2021-03-18T08:00:00Z',
      '2021-03-18T09:00:00Z',
    ],
    groups: [
      {
        by: {project: 123},
        totals: {'count_unique(user)': 140965},
        series: {
          'count_unique(user)': [
            1284,
            3820,
            6981,
            6929,
            9999,
            1476,
            4145,
            2642,
            2917,
            5787,
            5036,
            9287,
            4815,
            9815,
            6334,
            6415,
            8961,
            7512,
            8149,
            7585,
            5725,
            6365,
            8104,
            882,
          ],
        },
      },
    ],
  };
}
