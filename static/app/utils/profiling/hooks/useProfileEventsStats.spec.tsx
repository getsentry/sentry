import {ReactNode} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useProfileEventsStats} from 'sentry/utils/profiling/hooks/useProfileEventsStats';
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

  it('handles no axis', async function () {
    const yAxes = [];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {},
      match: [MockApiClient.matchQuery({dataset: 'profiles'})],
    });

    const {result, waitFor} = reactHooks.renderHook(useProfileEventsStats, {
      wrapper: TestContext,
      initialProps: {
        yAxes,
        referrer: '',
      },
    });

    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual([
      {
        data: [],
        meta: {
          dataset: 'profiles',
          end: 0,
          start: 0,
        },
        timestamps: [],
      },
      expect.anything(),
      expect.objectContaining({
        getResponseHeader: expect.anything(),
      }),
    ]);
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
      match: [MockApiClient.matchQuery({dataset: 'profiles'})],
    });

    const {result, waitFor} = reactHooks.renderHook(useProfileEventsStats, {
      wrapper: TestContext,
      initialProps: {
        yAxes,
        referrer: '',
      },
    });

    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual([
      {
        data: [{axis: 'count()', values: [1, 2]}],
        meta: {
          dataset: 'profiles',
          start: 0,
          end: 10,
        },
        timestamps: [0, 5],
      },
      expect.anything(),
      expect.objectContaining({
        getResponseHeader: expect.anything(),
      }),
    ]);
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
      match: [MockApiClient.matchQuery({dataset: 'profiles'})],
    });

    const {result, waitFor} = reactHooks.renderHook(useProfileEventsStats, {
      wrapper: TestContext,
      initialProps: {
        yAxes,
        referrer: '',
      },
    });

    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual([
      {
        data: [
          {axis: 'count()', values: [1, 2]},
          {axis: 'p99()', values: [3, 4]},
        ],
        meta: {
          dataset: 'profiles',
          start: 0,
          end: 10,
        },
        timestamps: [0, 5],
      },
      expect.anything(),
      expect.objectContaining({
        getResponseHeader: expect.anything(),
      }),
    ]);
  });
});
