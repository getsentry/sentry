import {ReactNode} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {
  EventsResults,
  formatSort,
  useProfileEvents,
} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {OrganizationContext} from 'sentry/views/organizationContext';

const {organization} = initializeOrg();
const client = new QueryClient();

function TestContext({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={client}>
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    </QueryClientProvider>
  );
}

describe('useProfileEvents', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('handles querying the api', async function () {
    const fields = ['count()'];

    const body: EventsResults<(typeof fields)[number]> = {
      data: [],
      meta: {fields: {}, units: {}},
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body,
      match: [MockApiClient.matchQuery({dataset: 'profiles'})],
    });

    const {result, waitFor} = reactHooks.renderHook(useProfileEvents, {
      wrapper: TestContext,
      initialProps: {
        fields,
        sort: {key: 'count()', order: 'desc' as const},
        referrer: '',
      },
    });

    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual([
      body,
      expect.anything(),
      expect.objectContaining({
        getResponseHeader: expect.anything(),
      }),
    ]);
  });

  it('handles api errors', async function () {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      status: 400,
      statusCode: 400,
      match: [MockApiClient.matchQuery({dataset: 'profiles'})],
    });

    const {result, waitFor} = reactHooks.renderHook(useProfileEvents, {
      wrapper: TestContext,
      initialProps: {
        fields: ['count()'],
        sort: {key: 'count()', order: 'desc' as const},
        referrer: '',
      },
    });

    await waitFor(() => result.current.isError);
    expect(result.current.status).toEqual('error');
  });
});

describe('formatSort', function () {
  it('uses the desc fallback', function () {
    const sort = formatSort(undefined, ['count()'], {
      key: 'count()',
      order: 'desc' as const,
    });
    expect(sort).toEqual({
      key: 'count()',
      order: 'desc',
    });
  });

  it('uses the asc fallback', function () {
    const sort = formatSort(undefined, ['count()'], {
      key: 'count()',
      order: 'asc' as const,
    });
    expect(sort).toEqual({
      key: 'count()',
      order: 'asc',
    });
  });

  it('uses the desc value', function () {
    const sort = formatSort('-p95()', ['p95()', 'count()'], {
      key: 'count()',
      order: 'asc' as const,
    });
    expect(sort).toEqual({
      key: 'p95()',
      order: 'desc',
    });
  });

  it('uses the asc value', function () {
    const sort = formatSort('p95()', ['p95()', 'count()'], {
      key: 'count()',
      order: 'desc' as const,
    });
    expect(sort).toEqual({
      key: 'p95()',
      order: 'asc',
    });
  });
});
