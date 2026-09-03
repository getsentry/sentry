import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  useGetSavedQueries,
  useGetSavedQuery,
  type ReadableSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {MockMetricQueryParamsContext} from 'sentry/views/explore/metrics/hooks/testUtils';
import {useSaveMetricsMultiQuery} from 'sentry/views/explore/metrics/hooks/useSaveMetricsMultiQuery';
import {ExploreSavedQueryNavigationItems} from 'sentry/views/navigation/secondary/sections/explore/exploreSavedQueryNavigationItems';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

const organization = OrganizationFixture();

function savedQuery(metricName: string): ReadableSavedQuery {
  return {
    id: 1,
    name: 'Saved Metrics',
    dataset: 'metrics',
    query: [
      {
        fields: [],
        mode: Mode.AGGREGATE,
        orderby: '',
        query: '',
        metric: {name: metricName, type: 'gauge', unit: 'none'},
        aggregateField: [
          {
            yAxes: [`max(value,${metricName},gauge,none)`],
            chartType: 1,
          },
        ],
      },
    ],
    dateAdded: '2024-01-01T00:00:00.000Z',
    dateUpdated: '2024-01-01T00:00:00.000Z',
    interval: '5m',
    lastVisited: '2024-01-01T00:00:00.000Z',
    position: 1,
    projects: [],
    starred: true,
  };
}

function Wrapper({children}: {children: ReactNode}) {
  return (
    <MockMetricQueryParamsContext>
      <SecondaryNavigationContextProvider>{children}</SecondaryNavigationContextProvider>
    </MockMetricQueryParamsContext>
  );
}

function TestPage() {
  const {updateQuery} = useSaveMetricsMultiQuery();
  const {data: starredQueries} = useGetSavedQueries({starred: true});
  const {data: query} = useGetSavedQuery('1');

  return (
    <div>
      <button onClick={() => void updateQuery()}>Update query</button>
      <h1>{query?.name}</h1>
      {starredQueries && <ExploreSavedQueryNavigationItems queries={starredQueries} />}
    </div>
  );
}

describe('useSaveMetricsMultiQuery', () => {
  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  afterEach(() => {
    PageFiltersStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('creates a query and refreshes the saved queries', async () => {
    const response = {...savedQuery('mockMetric'), id: '2', name: 'New Metrics'};
    const createRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: response,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [],
    });
    const {result} = renderHookWithProviders(
      () => ({
        ...useSaveMetricsMultiQuery(),
        queries: useGetSavedQueries({}),
      }),
      {organization, additionalWrapper: Wrapper}
    );
    await waitFor(() => expect(result.current.queries.data).toEqual([]));

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [response],
    });
    await act(async () => {
      await expect(
        result.current.saveQuery({name: 'New Metrics', starred: true})
      ).resolves.toEqual(response);
    });

    expect(createRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/`,
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'New Metrics',
          dataset: 'metrics',
          isMultiQuery: true,
        }),
      })
    );
    await waitFor(() =>
      expect(result.current.queries.data?.[0]?.name).toBe('New Metrics')
    );
  });

  it.each(['save', 'update'])(
    'rejects a failed %s without refetching queries',
    async action => {
      const listRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/explore/saved/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url:
          action === 'save'
            ? `/organizations/${organization.slug}/explore/saved/`
            : `/organizations/${organization.slug}/explore/saved/1/`,
        method: action === 'save' ? 'POST' : 'PUT',
        statusCode: 400,
        body: {detail: 'Unable to save query'},
      });
      const {result} = renderHookWithProviders(
        () => ({
          ...useSaveMetricsMultiQuery(),
          queries: useGetSavedQueries({}),
        }),
        {
          organization,
          additionalWrapper: Wrapper,
          initialRouterConfig: {
            location: {
              pathname: `/organizations/${organization.slug}/explore/metrics/`,
              query: {id: '1'},
            },
          },
        }
      );
      await waitFor(() => expect(result.current.queries.data).toEqual([]));

      await act(async () => {
        const request =
          action === 'save'
            ? result.current.saveQuery({name: 'New Metrics'})
            : result.current.updateQuery();
        await expect(request).rejects.toMatchObject({status: 400});
      });

      expect(listRequest).toHaveBeenCalledTimes(1);
    }
  );

  it('updates the starred-query URL after saving an existing query', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [savedQuery('old.metric')],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/1/`,
      body: {...savedQuery('old.metric'), name: 'Original Metrics'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/1/`,
      method: 'PUT',
      body: savedQuery('mockMetric'),
    });

    render(<TestPage />, {
      organization,
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/metrics/`,
          query: {id: '1', interval: '5m', title: 'Saved Metrics'},
        },
      },
    });

    expect(await screen.findByRole('link', {name: 'Saved Metrics'})).toHaveAttribute(
      'href',
      expect.stringContaining('old.metric')
    );
    expect(
      await screen.findByRole('heading', {name: 'Original Metrics'})
    ).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [savedQuery('mockMetric')],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/1/`,
      body: savedQuery('mockMetric'),
    });
    await userEvent.click(screen.getByRole('button', {name: 'Update query'}));

    await waitFor(() => {
      expect(screen.getByRole('link', {name: 'Saved Metrics'})).toHaveAttribute(
        'href',
        expect.stringContaining('mockMetric')
      );
    });
    expect(
      await screen.findByRole('heading', {name: 'Saved Metrics'})
    ).toBeInTheDocument();
  });
});
