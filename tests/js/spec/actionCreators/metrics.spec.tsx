import {waitFor} from 'sentry-test/reactTestingLibrary';

import {
  doMetricsRequest,
  fetchMetricsFields,
  fetchMetricsTags,
} from 'sentry/actionCreators/metrics';
import MetricsMetaActions from 'sentry/actions/metricsMetaActions';
import MetricsTagActions from 'sentry/actions/metricTagActions';
import {Client} from 'sentry/api';
import MetricsMetaStore from 'sentry/stores/metricsMetaStore';
import MetricsTagStore from 'sentry/stores/metricsTagStore';
import {SessionMetric} from 'sentry/utils/metrics/fields';

describe('Metrics ActionCreator', function () {
  const api = new Client();
  const orgSlug = TestStubs.Organization().slug;

  describe('doMetricsRequest', function () {
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

  describe('fetchMetricsTags', function () {
    let mock;
    const tags = [{key: 'release'}, {key: 'environment'}];

    beforeEach(function () {
      MockApiClient.clearMockResponses();
      mock = MockApiClient.addMockResponse({
        url: `/organizations/${orgSlug}/metrics/tags/`,
        body: tags,
      });
      jest.restoreAllMocks();
      jest.spyOn(MetricsTagActions, 'loadMetricsTagsSuccess');
      jest.spyOn(MetricsTagStore, 'reset');
    });

    it('fetches api and updates store', async function () {
      fetchMetricsTags(
        api,
        orgSlug,
        [1],
        [`sum(${SessionMetric.SENTRY_SESSIONS_SESSION})`]
      );

      await waitFor(() => expect(MetricsTagStore.reset).toHaveBeenCalledTimes(1));

      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock).toHaveBeenLastCalledWith(
        `/organizations/${orgSlug}/metrics/tags/`,
        expect.objectContaining({
          query: {metric: ['sum(sentry.sessions.session)'], project: [1]},
        })
      );
      expect(MetricsTagActions.loadMetricsTagsSuccess).toHaveBeenCalledTimes(1);
      expect(MetricsTagActions.loadMetricsTagsSuccess).toHaveBeenCalledWith(tags);
    });
  });

  describe('fetchMetricsFields', function () {
    let mock;
    const meta = [
      {name: 'sentry.sessions.session', type: 'counter', operations: ['sum'], unit: null},
      {
        name: 'sentry.sessions.user',
        type: 'set',
        operations: ['count_unique'],
        unit: null,
      },
    ];

    beforeEach(function () {
      MockApiClient.clearMockResponses();
      mock = MockApiClient.addMockResponse({
        url: `/organizations/${orgSlug}/metrics/meta/`,
        body: meta,
      });
      jest.restoreAllMocks();
      jest.spyOn(MetricsMetaActions, 'loadMetricsMetaSuccess');
      jest.spyOn(MetricsMetaStore, 'reset');
    });

    it('fetches api and updates store', async function () {
      fetchMetricsFields(api, orgSlug, [1]);

      await waitFor(() => expect(MetricsMetaStore.reset).toHaveBeenCalledTimes(1));

      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock).toHaveBeenLastCalledWith(
        `/organizations/${orgSlug}/metrics/meta/`,
        expect.objectContaining({
          query: {project: [1]},
        })
      );
      expect(MetricsMetaActions.loadMetricsMetaSuccess).toHaveBeenCalledTimes(1);
      expect(MetricsMetaActions.loadMetricsMetaSuccess).toHaveBeenCalledWith(meta);
    });
  });
});
