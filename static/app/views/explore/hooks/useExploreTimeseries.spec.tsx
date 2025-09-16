import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {PageParamsProvider} from 'sentry/views/explore/contexts/pageParamsContext';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

jest.mock('sentry/utils/usePageFilters');

function createWrapper() {
  return function TestWrapper({children}: {children: React.ReactNode}) {
    return (
      <SpansQueryParamsProvider>
        <PageParamsProvider>{children}</PageParamsProvider>
      </SpansQueryParamsProvider>
    );
  };
}

describe('useExploreTimeseries', () => {
  let mockNormalRequestUrl: jest.Mock;

  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
    jest.clearAllMocks();
  });

  it('triggers the high accuracy request when there is no data and a partial scan', async () => {
    mockNormalRequestUrl = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [[1745371800, [{count: 0}]]],
        meta: {
          dataScanned: 'partial',
          accuracy: {
            confidence: [],
            sampleCount: [],
            samplingRate: [],
          },
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
      url: '/organizations/org-slug/events-stats/',
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
        additionalWrapper: createWrapper(),
      }
    );

    expect(mockNormalRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockNormalRequestUrl).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
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
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
          query: 'test value',
        }),
      })
    );
  });
});
