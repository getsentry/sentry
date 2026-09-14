import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SavedQueriesLandingContent} from 'sentry/views/explore/savedQueries/savedQueriesLandingContent';

describe('SavedQueriesTable', () => {
  const {organization} = initializeOrg();
  let getSavedQueriesMock: jest.Mock;
  beforeEach(() => {
    getSavedQueriesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [
        {
          id: '57',
          name: 'Saved Query',
          projects: [1],
          dataset: 'spans',
          query: [{groupby: [], visualize: []}],
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/1/`,
      method: 'DELETE',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/1/starred/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/2/starred/`,
      method: 'POST',
    });
  });

  it('should render', async () => {
    render(<SavedQueriesLandingContent />, {
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/explore/saved-queries/'},
      },
    });
    await screen.findByText('Created by Me');
    await screen.findByText('Created by Others');
    await screen.findByText('Most Starred');
  });

  it('should filter tables when searching', async () => {
    const {router} = render(<SavedQueriesLandingContent />, {
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/explore/saved-queries/'},
      },
    });
    await screen.findByText('Created by Me');
    await screen.findByText('Created by Others');
    await userEvent.type(screen.getByPlaceholderText('Search for a query'), 'Query Name');
    await userEvent.keyboard('{enter}');

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/explore/saved-queries/'
    );
    expect(router.location.query).toEqual({query: 'Query Name'});

    expect(getSavedQueriesMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/`,
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'Query Name',
          exclude: 'shared',
        }),
      })
    );
    expect(getSavedQueriesMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/`,
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'Query Name',
          exclude: 'owned',
        }),
      })
    );
  });

  it('resets cursors when searching from a paginated page', async () => {
    const {router} = render(<SavedQueriesLandingContent />, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/saved-queries/',
          query: {ownedCursor: 'abc123', sharedCursor: 'def456'},
        },
      },
    });
    await screen.findByText('Created by Me');
    await userEvent.type(screen.getByPlaceholderText('Search for a query'), 'My Query');
    await userEvent.keyboard('{enter}');

    expect(router.location.query).toEqual({query: 'My Query'});
  });

  it('hides owned queries table when there are no results', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [],
    });
    render(<SavedQueriesLandingContent />, {
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/explore/saved-queries/'},
      },
    });
    await screen.findByText('Created by Others');
    expect(screen.queryByText('Created by Me')).not.toBeInTheDocument();
  });
});
