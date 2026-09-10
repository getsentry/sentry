import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  useMultiQueryTableAggregateMode,
  useMultiQueryTableSampleMode,
} from 'sentry/views/explore/multiQueryMode/hooks/useMultiQueryTable';
import {useReadQueriesFromLocation} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

jest.mock('sentry/views/explore/multiQueryMode/locationUtils', () => {
  const actual = jest.requireActual('sentry/views/explore/multiQueryMode/locationUtils');
  return {
    ...actual,
    useReadQueriesFromLocation: jest.fn(),
  };
});

describe('useMultiQueryTable', () => {
  let mockNormalRequestUrl: jest.Mock;

  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        datetime: {
          period: '14d',
          start: null,
          end: null,
          utc: false,
        },
        projects: [2],
      })
    );
    jest.clearAllMocks();
  });

  it.each([
    ['aggregate', useMultiQueryTableAggregateMode],
    ['sample', useMultiQueryTableSampleMode],
  ])(
    'triggers the high accuracy request when there is no data and a partial scan for %s mode',
    async (_mode, hook) => {
      jest.mocked(useReadQueriesFromLocation).mockReturnValue([
        {
          query: 'test value',
          groupBys: [],
          sortBys: [],
          yAxes: [],
          chartType: ChartType.LINE,
          fields: [],
        },
      ]);
      mockNormalRequestUrl = MockApiClient.addMockResponse({
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
          hook({
            enabled: true,
            groupBys: [],
            query: 'test value',
            sortBys: [],
            yAxes: [],
          }),
        {
          initialRouterConfig: {
            location: {
              pathname: '/mock-pathname/',
              query: {},
            },
          },
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
            query: 'test value',
          }),
        })
      );
      expect(mockHighAccuracyRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            sampling: SAMPLING_MODE.HIGH_ACCURACY,
            query: 'test value',
          }),
        })
      );
    }
  );
});
