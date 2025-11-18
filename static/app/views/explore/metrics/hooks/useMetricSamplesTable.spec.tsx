import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {MockMetricQueryParamsContext} from 'sentry/views/explore/metrics/hooks/testUtils';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';

jest.mock('sentry/utils/usePageFilters');

describe('useMetricSamplesTable', () => {
  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: {
          projects: [1, 2],
          datetime: {
            start: null,
            end: null,
            period: '24h',
            utc: null,
          },
          environments: ['prod'],
        },
      })
    );
    jest.clearAllMocks();
  });

  it('triggers the high accuracy request when there is no data and a partial scan', async () => {
    const mockNormalRequestUrl = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
        meta: {
          dataScanned: 'partial',
          fields: {},
        },
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.NORMAL;
        },
      ],
    });
    const mockHighAccuracyRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY;
        },
      ],
      method: 'GET',
    });
    renderHookWithProviders(
      () =>
        useMetricSamplesTable({
          traceMetric: {
            name: 'test metric',
            type: 'counter',
          },
          fields: [],
          limit: 100,
          ingestionDelaySeconds: 0,
        }),
      {
        additionalWrapper: MockMetricQueryParamsContext,
      }
    );

    expect(mockNormalRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockNormalRequestUrl).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: SAMPLING_MODE.NORMAL,
        }),
      })
    );

    await waitFor(() => {
      expect(mockHighAccuracyRequest).toHaveBeenCalledTimes(1);
    });
    expect(mockHighAccuracyRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
        }),
      })
    );
  });

  it('simple usage', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
        meta: {
          fields: {},
        },
      },
      method: 'GET',
    });

    renderHookWithProviders(
      () =>
        useMetricSamplesTable({
          traceMetric: {
            name: 'test.metric',
            type: 'counter',
          },
          fields: ['trace', 'timestamp'],
          limit: 50,
          ingestionDelaySeconds: 0,
        }),
      {
        additionalWrapper: MockMetricQueryParamsContext,
      }
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    expect(mockRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'metric.name:test.metric metric.type:counter',
          caseInsensitive: undefined,
          dataset: 'tracemetrics',
          disableAggregateExtrapolation: undefined,
          environment: ['prod'],
          field: [
            'id',
            'project.id',
            'trace',
            'span_id',
            'sentry.span_id',
            'metric.type',
            'metric.name',
            'timestamp',
          ],
          orderby: ['-timestamp'],
          per_page: 50,
          project: ['1', '2'],
          referrer: 'api.explore.metric-samples-table',
          sampling: SAMPLING_MODE.NORMAL,
          sort: '-timestamp',
        }),
      })
    );
  });
});
