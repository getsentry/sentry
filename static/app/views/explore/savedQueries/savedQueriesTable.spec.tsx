import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {SavedQueriesTable} from 'sentry/views/explore/savedQueries/savedQueriesTable';

describe('SavedQueriesTable', () => {
  const {organization} = initializeOrg();
  let getQueriesMock: jest.Mock;
  let deleteQueryMock: jest.Mock;
  let starQueryMock: jest.Mock;
  let unstarQueryMock: jest.Mock;
  let saveQueryMock: jest.Mock;

  beforeEach(() => {
    getQueriesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [
        {
          id: 1,
          name: 'Query Name',
          projects: [1],
          environment: ['production'],
          createdBy: {
            name: 'Test User',
          },
          query: [
            {
              visualize: [],
              groupby: [],
            },
          ],
        },
      ],
    });
    deleteQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/1/`,
      method: 'DELETE',
    });
    starQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/1/starred/`,
      method: 'POST',
    });
    unstarQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/2/starred/`,
      method: 'POST',
    });
    saveQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should render', async () => {
    render(<SavedQueriesTable mode="owned" title="title" />, {
      deprecatedRouterMocks: true,
    });
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Query')).toBeInTheDocument();
    expect(screen.getByText('Creator')).toBeInTheDocument();
    expect(screen.getByText('Last Viewed')).toBeInTheDocument();
    await screen.findByText('Query Name');
  });

  it('should request for owned queries', async () => {
    render(<SavedQueriesTable mode="owned" title="title" />, {
      deprecatedRouterMocks: true,
    });
    await waitFor(() =>
      expect(getQueriesMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/explore/saved/`,
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            sortBy: ['starred', 'recentlyViewed'],
            exclude: 'shared',
          }),
        })
      )
    );
  });

  it('should request for shared queries', async () => {
    render(<SavedQueriesTable mode="shared" title="title" />, {
      deprecatedRouterMocks: true,
    });
    await waitFor(() =>
      expect(getQueriesMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/explore/saved/`,
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            sortBy: ['starred', 'recentlyViewed'],
            exclude: 'owned',
          }),
        })
      )
    );
  });

  it('deletes a query', async () => {
    render(<SavedQueriesTable mode="owned" title="title" />, {
      deprecatedRouterMocks: true,
    });
    renderGlobalModal();
    await screen.findByText('Query Name');
    await userEvent.click(screen.getByLabelText('More options'));
    await userEvent.click(screen.getByText('Delete'));
    await screen.findByText('Are you sure you want to delete the query "Query Name"?');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete Query',
      })
    );

    await waitFor(() =>
      expect(deleteQueryMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/explore/saved/1/`,
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    );
  });

  it('should link to a single query view', async () => {
    render(<SavedQueriesTable mode="owned" title="title" />, {
      deprecatedRouterMocks: true,
    });
    expect(await screen.findByText('Query Name')).toHaveAttribute(
      'href',
      '/organizations/org-slug/traces/?environment=production&groupBy=&id=1&project=1&title=Query%20Name'
    );
  });

  it('should link to a multi query view', async () => {
    getQueriesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [
        {
          id: 1,
          name: 'Query Name',
          projects: [1],
          environment: ['production'],
          createdBy: {
            name: 'Test User',
          },
          query: [
            {
              visualize: [],
              groupby: [],
            },
            {
              visualize: [],
              groupby: [],
            },
          ],
        },
      ],
    });
    render(<SavedQueriesTable mode="owned" title="title" />, {
      deprecatedRouterMocks: true,
    });
    expect(await screen.findByText('Query Name')).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/traces/compare/?environment=production&id=1&project=1&queries=%7B%22groupBys%22%3A%5B%5D%2C%22yAxes%22%3A%5B%5D%7D&queries=%7B%22groupBys%22%3A%5B%5D%2C%22yAxes%22%3A%5B%5D%7D&title=Query%20Name'
    );
  });

  it('should display starred status', async () => {
    getQueriesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [
        {
          id: 1,
          name: 'Query Name',
          projects: [1],
          environment: ['production'],
          createdBy: {
            name: 'Test User',
          },
          query: [
            {
              visualize: [],
              groupby: [],
            },
          ],
          starred: false,
        },
        {
          id: 2,
          name: 'Starred Query',
          projects: [1],
          environment: ['production'],
          createdBy: {
            name: 'Test User',
          },
          query: [
            {
              visualize: [],
              groupby: [],
            },
          ],
          starred: true,
        },
      ],
    });
    render(<SavedQueriesTable mode="owned" title="title" />, {
      deprecatedRouterMocks: true,
    });
    await screen.findByText('Query Name');
    screen.getByText('Starred Query');
    expect(screen.getByLabelText('Unstar')).toBeInTheDocument();
    expect(screen.getByLabelText('Star')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Star'));
    await waitFor(() =>
      expect(starQueryMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/explore/saved/1/starred/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            starred: true,
          },
        })
      )
    );
    await userEvent.click(screen.getAllByLabelText('Unstar')[1]!);
    await waitFor(() =>
      expect(unstarQueryMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/explore/saved/2/starred/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            starred: false,
          },
        })
      )
    );
  });

  it('should sort by most popular', async () => {
    render(<SavedQueriesTable mode="owned" sort="mostPopular" title="title" />, {
      deprecatedRouterMocks: true,
    });
    await screen.findByText('Query Name');
    expect(getQueriesMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/`,
      expect.objectContaining({
        query: expect.objectContaining({sortBy: ['starred', 'mostPopular']}),
      })
    );
  });

  it('should search for a query', async () => {
    render(<SavedQueriesTable mode="owned" searchQuery="Query Name" title="title" />, {
      deprecatedRouterMocks: true,
    });
    await screen.findByText('Query Name');
    expect(getQueriesMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/`,
      expect.objectContaining({
        query: expect.objectContaining({query: 'Query Name'}),
      })
    );
  });

  it('should duplicate a query', async () => {
    render(<SavedQueriesTable mode="owned" title="title" />, {
      deprecatedRouterMocks: true,
    });
    await screen.findByText('Query Name');
    await userEvent.click(screen.getByLabelText('More options'));
    await userEvent.click(screen.getByText('Duplicate'));
    await waitFor(() =>
      expect(saveQueryMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/explore/saved/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            name: 'Query Name (Copy)',
          }),
        })
      )
    );
  });
});
