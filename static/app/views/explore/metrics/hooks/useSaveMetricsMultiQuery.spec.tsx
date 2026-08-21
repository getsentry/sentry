import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  useGetSavedQueries,
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

  return (
    <div>
      <button onClick={() => void updateQuery()}>Update query</button>
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

  it('updates the starred-query URL after saving an existing query', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [savedQuery('old.metric')],
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

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [savedQuery('mockMetric')],
    });
    await userEvent.click(screen.getByRole('button', {name: 'Update query'}));

    await waitFor(() => {
      expect(screen.getByRole('link', {name: 'Saved Metrics'})).toHaveAttribute(
        'href',
        expect.stringContaining('mockMetric')
      );
    });
  });
});
