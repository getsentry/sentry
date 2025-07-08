import {QueryClientProvider} from '@tanstack/react-query';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  useMultiQueryTableAggregateMode,
  useMultiQueryTableSampleMode,
} from 'sentry/views/explore/multiQueryMode/hooks/useMultiQueryTable';
import {useReadQueriesFromLocation} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/views/explore/multiQueryMode/locationUtils', () => {
  const actual = jest.requireActual('sentry/views/explore/multiQueryMode/locationUtils');
  return {
    ...actual,
    useReadQueriesFromLocation: jest.fn(),
  };
});

function createWrapper(org: Organization) {
  return function TestWrapper({children}: {children: React.ReactNode}) {
    const queryClient = makeTestQueryClient();
    return (
      <QueryClientProvider client={queryClient}>
        <OrganizationContext value={org}>{children}</OrganizationContext>
      </QueryClientProvider>
    );
  };
}

describe('useMultiQueryTable', () => {
  let mockNormalRequestUrl: jest.Mock;

  beforeEach(() => {
    jest.mocked(useLocation).mockReturnValue(LocationFixture());

    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '14d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [2],
      },
    });
    jest.clearAllMocks();
  });

  it.each([
    ['aggregate', useMultiQueryTableAggregateMode],
    ['sample', useMultiQueryTableSampleMode],
  ])(
    `triggers the high accuracy request when there is no data and a partial scan for %s mode`,
    async function (_mode, hook) {
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
      renderHook(
        () =>
          hook({
            enabled: true,
            groupBys: [],
            query: 'test value',
            sortBys: [],
            yAxes: [],
          }),
        {
          wrapper: createWrapper(OrganizationFixture()),
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
