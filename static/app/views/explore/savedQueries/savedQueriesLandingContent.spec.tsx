import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SavedQueriesLandingContent} from 'sentry/views/explore/savedQueries/savedQueriesLandingContent';

describe('SavedQueriesTable', () => {
  const {organization} = initializeOrg();
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [],
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
    await screen.findByText('Owned by Me');
    await screen.findByText('Shared with Me');
    await screen.findByText('Recently Viewed');
  });

  it('should show a single table when searching', async () => {
    render(<SavedQueriesLandingContent />);
    await screen.findByText('Owned by Me');
    await screen.findByText('Shared with Me');
    await userEvent.type(screen.getByPlaceholderText('Search for a query'), 'Query Name');
    expect(screen.queryByText('Owned by Me')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared with Me')).not.toBeInTheDocument();
  });
});
