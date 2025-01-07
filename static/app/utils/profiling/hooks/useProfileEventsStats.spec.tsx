import type {ReactNode} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {useProfileEventsStats} from 'sentry/utils/profiling/hooks/useProfileEventsStats';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

const {organization} = initializeOrg();
function TestContext({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>
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

  it('handles no axis', async function () {
    const yAxes = [];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {},
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });

    const {result} = renderHook(useProfileEventsStats, {
      wrapper: TestContext,
      initialProps: {
        dataset: 'profiles' as const,
        yAxes,
        referrer: '',
      },
    });

    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual({
      data: [],
      meta: {
        dataset: 'discover',
        end: 0,
        start: 0,
      },
      timestamps: [],
    });
  });

  it('handles 1 axis', async function () {
    const yAxes = ['count()'];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {
        data: [
          [0, [{count: 1}]],
          [5, [{count: 2}]],
        ],
        start: 0,
        end: 10,
        meta: {
          fields: {count: 'integer'},
          units: {count: null},
        },
      },
      match: [
        MockApiClient.matchQuery({
          dataset: 'discover',
          query: '(has:profile.id OR (has:profiler.id has:thread.id)) (transaction:foo)',
        }),
      ],
    });

    const {result} = renderHook(useProfileEventsStats, {
      wrapper: TestContext,
      initialProps: {
        dataset: 'profiles' as const,
        yAxes,
        query: 'transaction:foo',
        referrer: '',
      },
    });

    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual({
      data: [{axis: 'count()', values: [1, 2]}],
      meta: {
        dataset: 'discover',
        start: 0,
        end: 10,
      },
      timestamps: [0, 5],
    });
  });

  it('handles n axes', async function () {
    const yAxes = ['count()', 'p99()'];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {
        'count()': {
          data: [
            [0, [{count: 1}]],
            [5, [{count: 2}]],
          ],
          start: 0,
          end: 10,
          meta: {
            fields: {count: 'integer', p99: 'duration'},
            units: {count: null, p99: 'millisecond'},
          },
        },
        'p99()': {
          data: [
            [0, [{count: 3}]],
            [5, [{count: 4}]],
          ],
          start: 0,
          end: 10,
          meta: {
            fields: {count: 'integer', p99: 'duration'},
            units: {count: null, p99: 'millisecond'},
          },
        },
      },
      match: [
        MockApiClient.matchQuery({
          dataset: 'discover',
          query: '(has:profile.id OR (has:profiler.id has:thread.id)) (transaction:foo)',
        }),
      ],
    });

    const {result} = renderHook(useProfileEventsStats, {
      wrapper: TestContext,
      initialProps: {
        dataset: 'profiles' as const,
        yAxes,
        query: 'transaction:foo',
        referrer: '',
      },
    });

    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual({
      data: [
        {axis: 'count()', values: [1, 2]},
        {axis: 'p99()', values: [3, 4]},
      ],
      meta: {
        dataset: 'discover',
        start: 0,
        end: 10,
      },
      timestamps: [0, 5],
    });
  });

  it('handles 1 axis using discover', async function () {
    const {organization: organizationUsingTransactions} = initializeOrg();

    function TestContextUsingTransactions({children}: {children?: ReactNode}) {
      return (
        <QueryClientProvider client={makeTestQueryClient()}>
          <OrganizationContext.Provider value={organizationUsingTransactions}>
            {children}
          </OrganizationContext.Provider>
        </QueryClientProvider>
      );
    }

    const yAxes = ['count()'];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {
        data: [
          [0, [{count: 1}]],
          [5, [{count: 2}]],
        ],
        start: 0,
        end: 10,
        meta: {
          fields: {count: 'integer'},
          units: {count: null},
        },
      },
      match: [
        MockApiClient.matchQuery({
          dataset: 'discover',
          query: '(has:profile.id OR (has:profiler.id has:thread.id)) (transaction:foo)',
        }),
      ],
    });

    const {result} = renderHook(useProfileEventsStats, {
      wrapper: TestContextUsingTransactions,
      initialProps: {
        dataset: 'profiles' as const,
        yAxes,
        query: 'transaction:foo',
        referrer: '',
      },
    });

    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual({
      data: [{axis: 'count()', values: [1, 2]}],
      meta: {
        dataset: 'discover',
        start: 0,
        end: 10,
      },
      timestamps: [0, 5],
    });
  });
});
