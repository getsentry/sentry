import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {ExploreSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {ExploreSavedQueryNavigationItems} from 'sentry/views/navigation/secondary/sections/explore/exploreSavedQueryNavigationItems';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

describe('ExploreSavedQueryNavigationItems', () => {
  const queries = [
    {
      id: 1,
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
  ] as unknown as ExploreSavedQuery[];

  it('should render a list of starred queries', () => {
    render(
      <SecondaryNavigationContextProvider>
        <ExploreSavedQueryNavigationItems queries={queries} />
      </SecondaryNavigationContextProvider>
    );

    expect(screen.getByText('My Saved Query')).toBeInTheDocument();
    expect(screen.getByText('Another Saved Query')).toBeInTheDocument();
  });
});
