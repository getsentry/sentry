import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useProfileEventsStats} from 'sentry/utils/profiling/hooks/useProfileEventsStats';

describe('useProfileEvents', () => {
  const organization = OrganizationFixture();
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('handles no axis', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {},
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });

    const {result} = renderHookWithProviders(useProfileEventsStats, {
      organization,
      initialProps: {
        dataset: 'profiles' as const,
        yAxes: [],
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

  it('handles 1 axis', async () => {
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

    const {result} = renderHookWithProviders(useProfileEventsStats, {
      organization,
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

  it('handles n axes', async () => {
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

    const {result} = renderHookWithProviders(useProfileEventsStats, {
      organization,
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

  it('handles 1 axis using discover', async () => {
    const {organization: organizationUsingTransactions} = initializeOrg();

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

    const {result} = renderHookWithProviders(useProfileEventsStats, {
      organization: organizationUsingTransactions,
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
