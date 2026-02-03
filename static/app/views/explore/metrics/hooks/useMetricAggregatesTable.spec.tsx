import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {MockMetricQueryParamsContext} from 'sentry/views/explore/metrics/hooks/testUtils';
import {useMetricAggregatesTable} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

jest.mock('sentry/utils/usePageFilters');

describe('useMetricAggregatesTable', () => {
  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
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
    renderHookWithProviders(useMetricAggregatesTable, {
      initialProps: {
        traceMetric: {
          name: 'test metric',
          type: 'counter',
        },
        limit: 100,
        enabled: true,
      },
      additionalWrapper: MockMetricQueryParamsContext,
    });

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

  it('includes multiple yAxis fields when multiple visualizes are configured', async () => {
    const visualize1 = new VisualizeFunction('avg(value,test-metric,-)');
    const visualize2 = new VisualizeFunction('sum(value,test-metric,-)');
    const visualize3 = new VisualizeFunction('count(value,test-metric,-)');

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [visualize1, visualize2, visualize3],
      aggregateSortBys: [{field: 'avg(value)', kind: 'desc'}],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{id: '1'}],
        meta: {fields: {}},
      },
      method: 'GET',
    });

    renderHookWithProviders(useMetricAggregatesTable, {
      initialProps: {
        traceMetric: {name: 'test-metric', type: 'counter'},
        limit: 100,
        enabled: true,
      },
      additionalWrapper: ({children}) => (
        <MockMetricQueryParamsContext
          metricQuery={{queryParams}}
          traceMetric={{name: 'test-metric', type: 'counter'}}
        >
          {children}
        </MockMetricQueryParamsContext>
      ),
    });

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalled();
    });

    // Verify all three yAxis fields are included in the request
    expect(mockRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: expect.arrayContaining([
            'avg(value,test-metric,-)',
            'sum(value,test-metric,-)',
            'count(value,test-metric,-)',
            // The count aggregate includes metric details: count(metric.name,<name>,<type>,-)
            expect.stringMatching(/^count\(metric\.name,test-metric,counter,-\)$/),
          ]),
        }),
      })
    );
  });

  it('includes groupBys and all visualize yAxes in fields', async () => {
    const groupBy1: GroupBy = {groupBy: 'environment'};
    const groupBy2: GroupBy = {groupBy: 'service'};
    const visualize1 = new VisualizeFunction('avg(value,test-metric,-)');
    const visualize2 = new VisualizeFunction('p95(value,test-metric,-)');

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [groupBy1, groupBy2, visualize1, visualize2],
      aggregateSortBys: [{field: 'avg(value,test-metric,-)', kind: 'desc'}],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{id: '1'}],
        meta: {fields: {}},
      },
      method: 'GET',
    });

    renderHookWithProviders(useMetricAggregatesTable, {
      initialProps: {
        traceMetric: {name: 'test-metric', type: 'distribution'},
        limit: 100,
        enabled: true,
      },
      additionalWrapper: ({children}) => (
        <MockMetricQueryParamsContext
          metricQuery={{queryParams}}
          traceMetric={{name: 'test-metric', type: 'distribution'}}
        >
          {children}
        </MockMetricQueryParamsContext>
      ),
    });

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalled();
    });

    // Verify groupBys come first, then visualize yAxes, plus the count aggregate
    expect(mockRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: expect.arrayContaining([
            'environment',
            'service',
            'avg(value,test-metric,-)',
            'p95(value,test-metric,-)',
            // The count aggregate includes metric details: count(metric.name,<name>,<type>,-)
            expect.stringMatching(/^count\(metric\.name,test-metric,distribution,-\)$/),
          ]),
        }),
      })
    );
  });
});
