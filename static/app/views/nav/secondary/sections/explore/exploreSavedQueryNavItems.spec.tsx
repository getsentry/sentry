import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {SavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {ExploreSavedQueryNavItems} from 'sentry/views/nav/secondary/sections/explore/exploreSavedQueryNavItems';

describe('ExploreSavedQueryNavItems', () => {
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
  ] as unknown as SavedQuery[];

  it('should render a list of starred queries', () => {
    render(<ExploreSavedQueryNavItems queries={queries} />);

    expect(screen.getByText('My Saved Query')).toBeInTheDocument();
    expect(screen.getByText('Another Saved Query')).toBeInTheDocument();
  });
});
