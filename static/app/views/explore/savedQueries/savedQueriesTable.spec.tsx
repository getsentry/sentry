import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SavedQueriesTable} from 'sentry/views/explore/savedQueries/savedQueriesTable';

describe('SavedQueriesTable', () => {
  const {organization} = initializeOrg();
  let getQueriesMock: jest.Mock;
  let deleteQueryMock: jest.Mock;

  beforeEach(() => {
    getQueriesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [
        {
          id: 1,
          name: 'Query Name',
          visualize: [],
          projects: [1],
          createdBy: {
            name: 'Test User',
          },
        },
      ],
    });
    deleteQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/1/`,
      method: 'DELETE',
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should render', async () => {
    render(<SavedQueriesTable mode="owned" />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Query')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Access')).toBeInTheDocument();
    expect(screen.getByText('Last Viewed')).toBeInTheDocument();
    await screen.findByText('Query Name');
  });

  it('should request for owned queries', async () => {
    render(<SavedQueriesTable mode="owned" />);
    await waitFor(() =>
      expect(getQueriesMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/explore/saved/`,
        expect.objectContaining({
          method: 'GET',
          data: expect.objectContaining({sortBy: 'mostPopular', exclude: 'shared'}),
        })
      )
    );
  });

  it('should request for shared queries', async () => {
    render(<SavedQueriesTable mode="shared" />);
    await waitFor(() =>
      expect(getQueriesMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/explore/saved/`,
        expect.objectContaining({
          method: 'GET',
          data: expect.objectContaining({
            sortBy: 'mostPopular',
            exclude: 'owned',
          }),
        })
      )
    );
  });

  it('deletes a query', async () => {
    render(<SavedQueriesTable mode="owned" />);
    await screen.findByText('Query Name');
    await userEvent.click(screen.getByLabelText('Query actions'));
    await userEvent.click(screen.getByText('Delete'));
    await waitFor(() =>
      expect(deleteQueryMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/explore/saved/1/`,
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    );
  });
});
