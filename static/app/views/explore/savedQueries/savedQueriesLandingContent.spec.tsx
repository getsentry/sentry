import {LocationFixture} from 'sentry-fixture/locationFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {SavedQueriesLandingContent} from 'sentry/views/explore/savedQueries/savedQueriesLandingContent';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('sentry/utils/useLocation', () => ({
  useLocation: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);
const mockUseLocation = jest.mocked(useLocation);

describe('SavedQueriesTable', () => {
  const {organization} = initializeOrg();
  let getSavedQueriesMock: jest.Mock;
  beforeEach(() => {
    mockUseLocation.mockReturnValue(
      LocationFixture({
        pathname: '/organizations/org-slug/explore/saved-queries/',
      })
    );

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
    render(<SavedQueriesLandingContent />);
    await screen.findByText('Created by Me');
    await screen.findByText('Created by Others');
    await screen.findByText('Most Starred');
  });

  it('should filter tables when searching', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
    const {rerender} = render(<SavedQueriesLandingContent />);
    await screen.findByText('Created by Me');
    await screen.findByText('Created by Others');
    await userEvent.type(screen.getByPlaceholderText('Search for a query'), 'Query Name');
    await userEvent.keyboard('{enter}');

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/explore/saved-queries/',
        query: expect.objectContaining({
          query: 'Query Name',
          ownedCursor: undefined,
          sharedCursor: undefined,
        }),
      })
    );

    mockUseLocation.mockReturnValue(
      LocationFixture({
        pathname: '/organizations/org-slug/explore/saved-queries/',
        query: {query: 'Query Name'},
      })
    );

    rerender(<SavedQueriesLandingContent />);

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
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseLocation.mockReturnValue(
      LocationFixture({
        pathname: '/organizations/org-slug/explore/saved-queries/',
        query: {ownedCursor: 'abc123', sharedCursor: 'def456'},
      })
    );
    render(<SavedQueriesLandingContent />);
    await screen.findByText('Created by Me');
    await userEvent.type(screen.getByPlaceholderText('Search for a query'), 'My Query');
    await userEvent.keyboard('{enter}');

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'My Query',
          ownedCursor: undefined,
          sharedCursor: undefined,
        }),
      })
    );
  });

  it('hides owned queries table when there are no results', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [],
    });
    render(<SavedQueriesLandingContent />);
    await screen.findByText('Created by Others');
    expect(screen.queryByText('Created by Me')).not.toBeInTheDocument();
  });
});
