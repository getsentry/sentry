import {ComponentProps} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SavedIssueSearches from 'sentry/views/issueList/savedIssueSearches';

describe('SavedIssueSearches', function () {
  const organization = TestStubs.Organization({
    features: ['issue-list-saved-searches-v2'],
  });

  const recommendedSearch = TestStubs.Search({
    isGlobal: true,
    name: 'Assigned to Me',
    query: 'is:unresolved assigned:me',
  });

  const orgSearch = TestStubs.Search({
    isGlobal: false,
    name: 'Last 4 Hours',
    query: 'age:-4h',
  });

  const defaultProps: ComponentProps<typeof SavedIssueSearches> = {
    isOpen: true,
    savedSearches: [recommendedSearch, orgSearch],
    savedSearch: null,
    savedSearchLoading: false,
    organization,
    onSavedSearchSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('displays saved searches with correct text and in correct sections', function () {
    const {container} = render(<SavedIssueSearches {...defaultProps} />);

    expect(container).toSnapshot();
  });

  it('can select a saved search', function () {
    render(<SavedIssueSearches {...defaultProps} />);

    userEvent.click(screen.getByText('Assigned to Me'));
    expect(defaultProps.onSavedSearchSelect).toHaveBeenLastCalledWith(recommendedSearch);

    userEvent.click(screen.getByText('Last 4 Hours'));
    expect(defaultProps.onSavedSearchSelect).toHaveBeenLastCalledWith(orgSearch);
  });

  it('does not show header when there are no org saved searches', function () {
    render(<SavedIssueSearches {...defaultProps} savedSearches={[recommendedSearch]} />);

    expect(screen.queryByText(/saved searches/i)).not.toBeInTheDocument();
  });
});
