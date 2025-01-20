import {useMemo} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {useProfileFunctionTrends} from 'sentry/utils/profiling/hooks/useProfileFunctionTrends';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

function TestContext({children}: {children: React.ReactNode}) {
  const {organization} = useMemo(() => initializeOrg(), []);

  return (
    <QueryClientProvider client={makeTestQueryClient()}>
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    </QueryClientProvider>
  );
}

describe('useProfileFunctionTrendss', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('initializes with the loading state', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/function-trends/',
      body: {data: []},
    });

    const hook = renderHook(
      () =>
        useProfileFunctionTrends({
          trendFunction: 'p95()',
          trendType: 'regression',
        }),
      {wrapper: TestContext}
    );
    expect(hook.result.current).toMatchObject(
      expect.objectContaining({
        isInitialLoading: true,
      })
    );
  });

  it('fetches functions', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/function-trends/',
      body: {data: []},
    });

    const hook = renderHook(
      () =>
        useProfileFunctionTrends({
          trendFunction: 'p95()',
          trendType: 'regression',
        }),
      {wrapper: TestContext}
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
