import {transformMetricsResponseToTable} from 'sentry/utils/metrics/transformMetricsResponseToTable';

describe('transformMetricsResponseToTable', function () {
  it('transforms metrics into table', () => {
    expect(
      transformMetricsResponseToTable(
        TestStubs.MetricsSessionUserCountByStatusByRelease()
      )
    ).toEqual({
      data: [
        {
          'count_unique(sentry.sessions.user)': 1,
          id: '0',
          release: '1',
          'session.status': 'crashed',
          'sum(sentry.sessions.session)': 34,
        },
        {
          'count_unique(sentry.sessions.user)': 1,
          id: '1',
          release: '1',
          'session.status': 'abnormal',
          'sum(sentry.sessions.session)': 1,
        },
        {
          'count_unique(sentry.sessions.user)': 2,
          id: '2',
          release: '1',
          'session.status': 'errored',
          'sum(sentry.sessions.session)': 451,
        },
        {
          'count_unique(sentry.sessions.user)': 3,
          id: '3',
          release: '1',
          'session.status': 'healthy',
          'sum(sentry.sessions.session)': 5058,
        },
        {
          'count_unique(sentry.sessions.user)': 2,
          id: '4',
          release: '2',
          'session.status': 'crashed',
          'sum(sentry.sessions.session)': 35,
        },
        {
          'count_unique(sentry.sessions.user)': 1,
          id: '5',
          release: '2',
          'session.status': 'abnormal',
          'sum(sentry.sessions.session)': 1,
        },
        {
          'count_unique(sentry.sessions.user)': 1,
          id: '6',
          release: '2',
          'session.status': 'errored',
          'sum(sentry.sessions.session)': 452,
        },
        {
          'count_unique(sentry.sessions.user)': 10,
          id: '7',
          release: '2',
          'session.status': 'healthy',
          'sum(sentry.sessions.session)': 5059,
        },
      ],
      meta: {
        'count_unique(sentry.sessions.user)': 'integer',
        release: 'string',
        'session.status': 'string',
        'sum(sentry.sessions.session)': 'integer',
      },
    });
  });
});
