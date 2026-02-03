import type {ReactNode} from 'react';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

jest.mock('sentry/utils/usePageFilters');

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

describe('useExploreTimeseries', () => {
  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
    jest.clearAllMocks();
  });

  it('triggers the high accuracy request when there is no data and a partial scan', async () => {
    const mockTimeSeries = TimeSeriesFixture();

    const mockNormalRequestUrl = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            ...mockTimeSeries,
            yAxis: 'count(span.duration)',
            values: [
              {
                ...mockTimeSeries.values[0]!,
                value: 0,
              },
            ],
            meta: {
              ...mockTimeSeries.meta,
              dataScanned: 'partial',
            },
          },
        ],
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.NORMAL;
        },
      ],
    });
    const mockHighAccuracyRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY;
        },
      ],
      method: 'GET',
    });
    renderHookWithProviders(
      () =>
        useExploreTimeseries({
          query: 'test value',
          enabled: true,
        }),
      {
        additionalWrapper: Wrapper,
      }
    );

    expect(mockNormalRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockNormalRequestUrl).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
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
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
          query: 'test value',
        }),
      })
    );
  });

  it('disables extrapolation', async () => {
    const mockNonExtrapolatedRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
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
        useExploreTimeseries({
          query: 'test value',
          enabled: true,
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
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
          disableAggregateExtrapolation: '1',
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
          query: 'test value',
        }),
      })
    );
  });
});
