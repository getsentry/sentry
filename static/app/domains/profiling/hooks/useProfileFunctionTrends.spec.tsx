import {ReactElement, useMemo} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useProfileFunctionTrends} from 'sentry/domains/profiling/utils/profiling/hooks/useProfileFunctionTrends';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

function TestContext({children}: {children: ReactElement}) {
  const {organization} = useMemo(() => initializeOrg(), []);
  // ensure client is rebuilt on each render otherwise caching will interfere with subsequent tests
  const client = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={client}>
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

    const hook = reactHooks.renderHook(
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

    const hook = reactHooks.renderHook(
      () =>
        useProfileFunctionTrends({
          trendFunction: 'p95()',
          trendType: 'regression',
        }),
      {wrapper: TestContext}
    );
    expect(hook.result.current.isLoading).toEqual(true);
    expect(hook.result.current.isFetched).toEqual(false);
    await hook.waitForNextUpdate();
    expect(hook.result.current).toMatchObject(
      expect.objectContaining({
        isLoading: false,
        isFetched: true,
        data: expect.objectContaining({
          data: expect.any(Array),
        }),
      })
    );
  });
});
