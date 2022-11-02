import {ComponentProps} from 'react';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

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
    onSavedSearchDelete: jest.fn(),
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

    userEvent.click(screen.getByRole('button', {name: 'Assigned to Me'}));
    expect(defaultProps.onSavedSearchSelect).toHaveBeenLastCalledWith(recommendedSearch);

    userEvent.click(screen.getByRole('button', {name: 'Last 4 Hours'}));
    expect(defaultProps.onSavedSearchSelect).toHaveBeenLastCalledWith(orgSearch);
  });

  it('does not show header when there are no org saved searches', function () {
    render(<SavedIssueSearches {...defaultProps} savedSearches={[recommendedSearch]} />);

    expect(screen.queryByText(/saved searches/i)).not.toBeInTheDocument();
  });

  it('does not show overflow menu for recommended searches', function () {
    render(<SavedIssueSearches {...defaultProps} savedSearches={[recommendedSearch]} />);

    expect(
      screen.queryByRole('button', {name: /saved search options/i})
    ).not.toBeInTheDocument();
  });

  it('can delete an org saved search with correct permissions', function () {
    render(<SavedIssueSearches {...defaultProps} />);
    renderGlobalModal();

    userEvent.click(screen.getByRole('button', {name: /saved search options/i}));
    userEvent.click(screen.getByRole('menuitemradio', {name: /delete/i}));

    const modal = screen.getByRole('dialog');

    expect(within(modal).getByText(/are you sure/i)).toBeInTheDocument();

    userEvent.click(within(modal).getByRole('button', {name: /confirm/i}));

    expect(defaultProps.onSavedSearchDelete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSavedSearchDelete).toHaveBeenLastCalledWith(orgSearch);
  });

  it('cannot delete a saved search without correct permissions', function () {
    render(
      <SavedIssueSearches
        {...defaultProps}
        organization={{
          ...organization,
          access: organization.access.filter(access => access !== 'org:write'),
        }}
      />
    );

    userEvent.click(screen.getByRole('button', {name: /saved search options/i}));

    expect(
      screen.getByText('You do not have permission to delete this search.')
    ).toBeInTheDocument();
  });
});
