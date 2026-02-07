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
      <OrganizationContext value={organization}>{children}</OrganizationContext>
    </QueryClientProvider>
  );
}

describe('useProfileFunctionTrendss', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('initializes with the loading state', () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/function-trends/',
      body: {data: []},
    });

    const hook = renderHook(useProfileFunctionTrends<string>, {
      wrapper: TestContext,
      initialProps: {
        trendFunction: 'p95()',
        trendType: 'regression',
      },
    });
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

    const hook = renderHook(useProfileFunctionTrends<string>, {
      wrapper: TestContext,
      initialProps: {
        trendFunction: 'p95()',
        trendType: 'regression',
      },
    });
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
