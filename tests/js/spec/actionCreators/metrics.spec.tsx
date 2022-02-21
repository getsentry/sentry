import {doMetricsRequest} from 'sentry/actionCreators/metrics';
import {Client} from 'sentry/api';
import {SessionMetric} from 'sentry/utils/metrics/fields';

describe('Metrics ActionCreator', function () {
  const api = new Client();
  const orgSlug = TestStubs.Organization().slug;
  const options = {
    field: [SessionMetric.SENTRY_SESSIONS_SESSION],
    orgSlug,
    cursor: undefined,
    environment: [],
    groupBy: ['session.status'],
    interval: '1h',
    limit: 5,
    orderBy: SessionMetric.SENTRY_SESSIONS_SESSION,
    project: [TestStubs.Project().id],
    query: 'release:123',
    statsPeriod: '14d',
  };

  let mock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    mock = MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/metrics/data/`,
      body: {
        data: [],
      },
    });
  });

  it('requests metrics data', function () {
    doMetricsRequest(api, options);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenLastCalledWith(
      `/organizations/${orgSlug}/metrics/data/`,
      expect.objectContaining({
        query: {
          environment: [],
          field: ['sentry.sessions.session'],
          groupBy: ['session.status'],
          interval: '1h',
          orderBy: 'sentry.sessions.session',
          per_page: 5,
          project: ['2'],
          query: 'release:123',
          statsPeriod: '14d',
        },
      })
    );
  });

  it('fills in interval based on start and end', function () {
    doMetricsRequest(api, {
      ...options,
      statsPeriod: undefined,
      interval: undefined,
      start: '2022-01-01T00:00:00',
      end: '2022-03-01T00:00:00',
    });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenLastCalledWith(
      `/organizations/${orgSlug}/metrics/data/`,
      expect.objectContaining({
        query: {
          environment: [],
          field: ['sentry.sessions.session'],
          groupBy: ['session.status'],
          interval: '4h',
          orderBy: 'sentry.sessions.session',
          per_page: 5,
          project: ['2'],
          query: 'release:123',
          start: '2022-01-01T00:00:00.000',
          end: '2022-03-01T00:00:00.000',
        },
      })
    );
  });

  it('ignores falsy fields', function () {
    doMetricsRequest(api, {
      ...options,
      field: [SessionMetric.SENTRY_SESSIONS_SESSION, ''],
    });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenLastCalledWith(
      `/organizations/${orgSlug}/metrics/data/`,
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['sentry.sessions.session'],
        }),
      })
    );
  });
});
