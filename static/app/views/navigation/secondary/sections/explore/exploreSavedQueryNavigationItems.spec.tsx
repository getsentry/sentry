import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  type SavedQuery,
  SavedQueryType,
  type CombinedSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {ExploreSavedQueryNavigationItems} from 'sentry/views/navigation/secondary/sections/explore/exploreSavedQueryNavigationItems';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

describe('ExploreSavedQueryNavigationItems', () => {
  const queries = [
    {
      id: 1,
      queryType: SavedQueryType.EXPLORE,
      name: 'My Saved Query',
      query: [
        {
          query: '',
          fields: [],
          groupby: [],
          visualize: [],
        },
      ],
      starred: true,
      position: 1,
      projects: [],
    },
    {
      id: 2,
      queryType: SavedQueryType.EXPLORE,
      name: 'Another Saved Query',
      query: [
        {
          query: '',
          fields: [],
          groupby: [],
          visualize: [],
        },
      ],
      starred: true,
      position: 2,
      projects: [],
    },
  ] as unknown as SavedQuery[];

  const discoverQuery = {
    id: 1,
    name: 'My Discover Query',
    queryType: SavedQueryType.DISCOVER,
    queryDataset: 'error-events',
    fields: ['title'],
    query: '',
    orderby: '',
    projects: [],
    position: 3,
    starred: true,
  } as unknown as CombinedSavedQuery;

  it('should render a list of starred queries', () => {
    render(
      <SecondaryNavigationContextProvider>
        <ExploreSavedQueryNavigationItems queries={queries} />
      </SecondaryNavigationContextProvider>
    );

    expect(screen.getByText('My Saved Query')).toBeInTheDocument();
    expect(screen.getByText('Another Saved Query')).toBeInTheDocument();
  });

  it('renders explore and discover queries that share an id', () => {
    render(
      <SecondaryNavigationContextProvider>
        <ExploreSavedQueryNavigationItems queries={[...queries, discoverQuery]} />
      </SecondaryNavigationContextProvider>
    );

    expect(screen.getByText('My Saved Query')).toBeInTheDocument();
    expect(screen.getByText('My Discover Query')).toBeInTheDocument();
  });
});
