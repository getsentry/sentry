import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useProfileFunctionTrends} from 'sentry/utils/profiling/hooks/useProfileFunctionTrends';

describe('useProfileFunctionTrendss', () => {
  it('initializes with the loading state', () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/function-trends/',
      body: {data: []},
    });

    const hook = renderHookWithProviders(() =>
      useProfileFunctionTrends({
        trendFunction: 'p95()',
        trendType: 'regression',
      })
    );
    expect(hook.result.current).toMatchObject(
      expect.objectContaining({
        isInitialLoading: true,
      })
    );
  });

  it('fetches functions', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/function-trends/',
      body: {data: []},
    });

    const hook = renderHookWithProviders(() =>
      useProfileFunctionTrends({
        trendFunction: 'p95()',
        trendType: 'regression',
      })
    );
    expect(hook.result.current.isPending).toBe(true);
    expect(hook.result.current.isFetched).toBe(false);
    await waitFor(() =>
      expect(hook.result.current).toMatchObject(
        expect.objectContaining({
          isLoading: false,
          isFetched: true,
          data: expect.objectContaining({
            data: expect.any(Array),
          }),
        })
      )
    );
  });
});
