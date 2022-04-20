import {transformSessionsResponseToSeries} from 'sentry/views/dashboardsV2/widgetCard/transformSessionsResponseToSeries';

describe('transformSessionsResponseToSeries', function () {
  it('transforms sessions into series', () => {
    expect(
      transformSessionsResponseToSeries(
        TestStubs.MetricsSessionUserCountByStatusByRelease()
      )
    ).toEqual([
      {
        seriesName: 'crashed, 1 : sum(sentry.sessions.session)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 0},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 0},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 23},
          {name: '2022-01-25T00:00:00Z', value: 11},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'crashed, 1 : count_unique(sentry.sessions.user)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 0},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 0},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 1},
          {name: '2022-01-25T00:00:00Z', value: 1},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'abnormal, 1 : sum(sentry.sessions.session)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 1},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 0},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 0},
          {name: '2022-01-25T00:00:00Z', value: 0},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'abnormal, 1 : count_unique(sentry.sessions.user)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 1},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 0},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 0},
          {name: '2022-01-25T00:00:00Z', value: 0},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'errored, 1 : sum(sentry.sessions.session)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 0},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 37},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 335},
          {name: '2022-01-25T00:00:00Z', value: 79},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'errored, 1 : count_unique(sentry.sessions.user)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 0},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 1},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 2},
          {name: '2022-01-25T00:00:00Z', value: 2},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'healthy, 1 : sum(sentry.sessions.session)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 0},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 2503},
          {name: '2022-01-21T00:00:00Z', value: 661},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 1464},
          {name: '2022-01-25T00:00:00Z', value: 430},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'healthy, 1 : count_unique(sentry.sessions.user)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 0},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 3},
          {name: '2022-01-21T00:00:00Z', value: 3},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 1},
          {name: '2022-01-25T00:00:00Z', value: 1},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'crashed, 2 : sum(sentry.sessions.session)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 1},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 0},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 23},
          {name: '2022-01-25T00:00:00Z', value: 11},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'crashed, 2 : count_unique(sentry.sessions.user)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 1},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 0},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 2},
          {name: '2022-01-25T00:00:00Z', value: 2},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'abnormal, 2 : sum(sentry.sessions.session)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 1},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 0},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 0},
          {name: '2022-01-25T00:00:00Z', value: 0},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'abnormal, 2 : count_unique(sentry.sessions.user)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 1},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 0},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 0},
          {name: '2022-01-25T00:00:00Z', value: 0},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'errored, 2 : sum(sentry.sessions.session)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 1},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 37},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 335},
          {name: '2022-01-25T00:00:00Z', value: 79},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'errored, 2 : count_unique(sentry.sessions.user)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 1},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 1},
          {name: '2022-01-21T00:00:00Z', value: 0},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 1},
          {name: '2022-01-25T00:00:00Z', value: 1},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'healthy, 2 : sum(sentry.sessions.session)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 1},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 2503},
          {name: '2022-01-21T00:00:00Z', value: 661},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 1464},
          {name: '2022-01-25T00:00:00Z', value: 430},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
      {
        seriesName: 'healthy, 2 : count_unique(sentry.sessions.user)',
        data: [
          {name: '2022-01-15T00:00:00Z', value: 1},
          {name: '2022-01-16T00:00:00Z', value: 0},
          {name: '2022-01-17T00:00:00Z', value: 0},
          {name: '2022-01-18T00:00:00Z', value: 0},
          {name: '2022-01-19T00:00:00Z', value: 0},
          {name: '2022-01-20T00:00:00Z', value: 10},
          {name: '2022-01-21T00:00:00Z', value: 3},
          {name: '2022-01-22T00:00:00Z', value: 0},
          {name: '2022-01-23T00:00:00Z', value: 0},
          {name: '2022-01-24T00:00:00Z', value: 4},
          {name: '2022-01-25T00:00:00Z', value: 3},
          {name: '2022-01-26T00:00:00Z', value: 0},
          {name: '2022-01-27T00:00:00Z', value: 0},
          {name: '2022-01-28T00:00:00Z', value: 0},
        ],
      },
    ]);
  });

  it('supports legend aliases', () => {
    expect(
      transformSessionsResponseToSeries(
        TestStubs.MetricsSessionUserCountByStatusByRelease(),
        undefined,
        'Lorem'
      )[0]
    ).toEqual(
      expect.objectContaining({
        seriesName: 'Lorem > crashed, 1 : sum(sentry.sessions.session)',
      })
    );
  });
  it('returns correct number of series if limit is set', () => {
    expect(
      transformSessionsResponseToSeries(
        TestStubs.MetricsSessionUserCountByStatusByRelease(),
        undefined,
        'Lorem'
      ).length
    ).toEqual(16);

    // limit = 3 returns 6 series, 3 for count_unique and 3 for sum
    expect(
      transformSessionsResponseToSeries(
        TestStubs.MetricsSessionUserCountByStatusByRelease(),
        3,
        'Lorem'
      ).length
    ).toEqual(6);
  });
});
