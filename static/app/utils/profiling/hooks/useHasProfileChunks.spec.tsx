import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {useHasProfilingChunks} from 'sentry/utils/profiling/hooks/useHasProfileChunks';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

function createWrapper() {
  return function Wrapper({children}: any) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext.Provider value={OrganizationFixture()}>
          {children}
        </OrganizationContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe('useHasProfileChunks', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('does not have chunks', async function () {
    const {organization} = initializeOrg();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/has-chunks/`,
      body: {
        hasChunks: false,
      },
    });

    const {result} = renderHook(useHasProfilingChunks, {wrapper: createWrapper()});
    await waitFor(() => expect(result.current.data).toBe(false));
  });

  it('has chunks', async function () {
    const {organization} = initializeOrg();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/has-chunks/`,
      body: {
        hasChunks: true,
      },
    });

    const {result} = renderHook(useHasProfilingChunks, {wrapper: createWrapper()});
    await waitFor(() => expect(result.current.data).toBe(true));
  });
});
