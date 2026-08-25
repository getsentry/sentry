import type {ReactNode} from 'react';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useExploreAggregatesTable} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {SpanFields} from 'sentry/views/insights/types';

jest.mock('sentry/components/pageFilters/usePageFilters');

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}
describe('useExploreAggregatesTable', () => {
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
    renderHookWithProviders(
      () =>
        useExploreAggregatesTable({
          query: 'test value',
          enabled: true,
          limit: 100,
        }),
      {
        additionalWrapper: Wrapper,
      }
    );

    expect(mockNormalRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockNormalRequestUrl).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: SAMPLING_MODE.NORMAL,
          query: 'test value',
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
          query: 'test value',
        }),
      })
    );
  });

  it('includes trace and timestamp aggregates for sample trace links', () => {
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

    const {result} = renderHookWithProviders(
      () =>
        useExploreAggregatesTable({
          query: 'test value',
          enabled: true,
          limit: 100,
        }),
      {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              groupBy: 'span.op',
              visualize: JSON.stringify({yAxes: ['count()']}),
            },
          },
        },
      }
    );

    const traceField = `any(${SpanFields.TRACE})`;
    const timestampField = `any(${SpanFields.TIMESTAMP})`;

    expect(result.current.fields).toEqual([
      traceField,
      timestampField,
      'span.op',
      'count()',
    ]);
    expect(mockRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: [traceField, timestampField, 'span.op', 'count()'],
          query: 'test value',
        }),
      })
    );
  });

  it('disables extrapolation', async () => {
    const mockNonExtrapolatedRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      match: [
        function (_url: string, options: Record<string, any>) {
          return (
            options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY &&
            options.query.disableAggregateExtrapolation === '1'
          );
        },
      ],
      method: 'GET',
    });

    renderHookWithProviders(
      () =>
        useExploreAggregatesTable({
          query: 'test value',
          enabled: true,
          limit: 100,
        }),
      {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              extrapolate: '0',
            },
          },
        },
      }
    );

    await waitFor(() => expect(mockNonExtrapolatedRequest).toHaveBeenCalledTimes(1));
    expect(mockNonExtrapolatedRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          disableAggregateExtrapolation: '1',
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
          query: 'test value',
        }),
      })
    );
  });

  it('does not query when the only series has an invalid conditional filter', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
    });

    const {result} = renderHookWithProviders(
      () =>
        useExploreAggregatesTable({
          query: 'test value',
          enabled: true,
          limit: 100,
        }),
      {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              aggregateField: [
                JSON.stringify({groupBy: ''}),
                JSON.stringify({
                  yAxes: ['count_if(`p95(span.duration):>100`,span.duration)'],
                }),
              ],
            },
          },
        },
      }
    );

    expect(mockRequest).not.toHaveBeenCalled();
    expect(result.current.result.isPending).toBe(false);
    expect(result.current.result.isError).toBe(true);
    expect(result.current.result.error).toEqual(
      new Error('Aggregates cannot be used in conditional filters')
    );
  });

  it('does not order by a dropped invalid series when another series remains', async () => {
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
        useExploreAggregatesTable({
          query: 'test value',
          enabled: true,
          limit: 100,
        }),
      {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              aggregateField: [
                JSON.stringify({groupBy: ''}),
                JSON.stringify({
                  yAxes: [
                    'count(span.duration)',
                    'count_if(`p95(span.duration):>100`,span.duration)',
                  ],
                }),
              ],
              // Sort by the invalid series — must fall back to the remaining valid one.
              aggregateSort: ['-count_if(`p95(span.duration):>100`,span.duration)'],
            },
          },
        },
      }
    );

    await waitFor(() => expect(mockRequest).toHaveBeenCalled());
    const requestOptions = mockRequest.mock.calls[0]![1];
    expect(requestOptions.query.field).toEqual(
      expect.arrayContaining(['count(span.duration)'])
    );
    expect(requestOptions.query.field).not.toEqual(
      expect.arrayContaining(['count_if(`p95(span.duration):>100`,span.duration)'])
    );
    // EventView alias form of count(span.duration); must not keep the dropped series.
    expect(requestOptions.query.sort).toBe('-count_span_duration');
  });
});
