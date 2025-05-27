import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  SAMPLING_MODE,
  type SamplingMode,
  useProgressiveQuery,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/usePageFilters');

function useMockHookImpl({
  enabled,
  query,
  queryExtras,
}: {
  enabled: boolean;
  query: string;
  queryExtras: {samplingMode: SamplingMode};
}) {
  const api = useApi();
  const result = useQuery({
    queryKey: ['/test', {query: {samplingMode: queryExtras?.samplingMode, query}}],
    queryFn: () =>
      api.requestPromise('/test', {
        query: {samplingMode: queryExtras?.samplingMode, query},
      }),
    enabled,
  });

  return {
    result,
  };
}

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

describe('useProgressiveQuery', function () {
  describe('normal sampling mode', function () {
    let mockNormalRequestUrl: jest.Mock;
    beforeEach(function () {
      mockNormalRequestUrl = MockApiClient.addMockResponse({
        url: '/test',
        body: 'test',
      });

      jest.mocked(usePageFilters).mockReturnValue(
        PageFilterStateFixture({
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
        })
      );
    });

    it('takes in a callback that determines if we can trigger the high accuracy request', async function () {
      mockNormalRequestUrl = MockApiClient.addMockResponse({
        url: '/test',
        body: getMockResponse({dataScanned: 'partial'}),
        match: [
          function (_url: string, options: Record<string, any>) {
            return options.query.samplingMode === SAMPLING_MODE.NORMAL;
          },
        ],
      });
      const mockHighAccuracyRequest = MockApiClient.addMockResponse({
        url: '/test',
        body: ['has', 'data'],
        match: [
          function (_url: string, options: Record<string, any>) {
            return options.query.samplingMode === SAMPLING_MODE.HIGH_ACCURACY;
          },
        ],
      });
      renderHook(
        () =>
          useProgressiveQuery({
            queryHookImplementation: useMockHookImpl,
            queryHookArgs: {enabled: true, query: 'test value'},
            queryOptions: {
              canTriggerHighAccuracy: results => {
                // Simulate checking if there is data and more data is available
                return (
                  defined(results.data) && results.data.meta.dataScanned === 'partial'
                );
              },
            },
          }),
        {
          wrapper: createWrapper(OrganizationFixture()),
        }
      );

      expect(mockNormalRequestUrl).toHaveBeenCalledTimes(1);
      expect(mockNormalRequestUrl).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          query: {samplingMode: SAMPLING_MODE.NORMAL, query: 'test value'},
        })
      );

      await waitFor(() => {
        expect(mockHighAccuracyRequest).toHaveBeenCalledTimes(1);
      });
      expect(mockHighAccuracyRequest).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          query: {samplingMode: SAMPLING_MODE.HIGH_ACCURACY, query: 'test value'},
        })
      );
    });

    it('does not trigger the high accuracy request if the callback returns false', function () {
      mockNormalRequestUrl = MockApiClient.addMockResponse({
        url: '/test',
        body: getMockResponse({dataScanned: 'partial'}),
        match: [
          function (_url: string, options: Record<string, any>) {
            return options.query.samplingMode === SAMPLING_MODE.NORMAL;
          },
        ],
      });
      const mockHighAccuracyRequest = MockApiClient.addMockResponse({
        url: '/test',
        body: ['has', 'data'],
        match: [
          function (_url: string, options: Record<string, any>) {
            return options.query.samplingMode === undefined;
          },
        ],
      });
      renderHook(
        () =>
          useProgressiveQuery({
            queryHookImplementation: useMockHookImpl,
            queryHookArgs: {enabled: true, query: 'test value'},
            queryOptions: {
              canTriggerHighAccuracy: () => {
                // Simulate that this callback returned false for whatever reason
                return false;
              },
            },
          }),
        {
          wrapper: createWrapper(OrganizationFixture()),
        }
      );

      expect(mockNormalRequestUrl).toHaveBeenCalledTimes(1);
      expect(mockNormalRequestUrl).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          query: {samplingMode: SAMPLING_MODE.NORMAL, query: 'test value'},
        })
      );

      expect(mockHighAccuracyRequest).not.toHaveBeenCalled();
    });
  });
});

const getMockResponse = ({
  dataScanned,
  fields,
}: {
  dataScanned?: 'full' | 'partial';
  fields?: Record<string, string>;
}) => ({
  data: [[1745371800, [{count: 0}]]],
  meta: {
    dataScanned: dataScanned ?? 'full',
    accuracy: {
      confidence: [],
      sampleCount: [],
      samplingRate: [],
    },
    fields: fields ?? {},
  },
});
