import {Search} from 'sentry-fixture/search';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueSearchWithSavedSearches} from 'sentry/views/issueList/issueSearchWithSavedSearches';

describe('IssueSearchWithSavedSearches', () => {
  const defaultProps = {
    query: 'is:unresolved',
    onSearch: jest.fn(),
  };

  const savedSearch = Search({
    id: '789',
    query: 'is:unresolved TypeError',
    sort: 'date',
    name: 'Unresolved TypeErrors',
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [savedSearch],
    });
  });

  it('displays "Custom Search" label when no saved searches are selected', () => {
    render(<IssueSearchWithSavedSearches {...defaultProps} />);

    expect(screen.getByRole('button', {name: 'Custom Search'})).toBeInTheDocument();
  });

  it('displays salected saved search label when one is selected', async () => {
    render(<IssueSearchWithSavedSearches {...defaultProps} />, {
      router: {
        params: {
          searchId: '789',
        },
      },
    });

    expect(
      await screen.findByRole('button', {name: savedSearch.name})
    ).toBeInTheDocument();
  });
});
