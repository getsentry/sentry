import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import IssueListSavedSearchTab from 'sentry/views/issueList/savedSearchTab';

describe('IssueListSavedSearchTab', () => {
  const savedSearchList = [
    {
      id: '789',
      query: 'is:unresolved',
      sort: 'date',
      name: 'Unresolved',
      isPinned: false,
      isGlobal: true,
    },
    {
      id: '122',
      query: 'global search query',
      sort: 'date',
      name: 'Global Search',
      isPinned: false,
      isGlobal: true,
    },
    {
      id: '444',
      query: 'is:unresolved assigned:me',
      sort: 'date',
      name: 'Assigned to me',
      isPinned: false,
      isGlobal: false,
    },
  ];
  const onSelect = jest.fn();
  const onDelete = jest.fn();

  function renderSavedSearch({organization} = {}) {
    render(
      <IssueListSavedSearchTab
        organization={organization ?? TestStubs.Organization({access: ['org:write']})}
        savedSearchList={savedSearchList}
        onSavedSearchSelect={onSelect}
        onSavedSearchDelete={onDelete}
        query="is:unresolved assigned:lyn@sentry.io"
      />,
      {context: TestStubs.routerContext()}
    );

    // Open the saved searches menu
    screen.getByRole('button', {name: 'Saved Searches'}).click();
  }

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows a delete button with access', () => {
    renderSavedSearch();
    const assignedToMe = screen.getByTestId('saved-search-444');
    expect(
      within(assignedToMe).getByRole('button', {name: 'delete'})
    ).toBeInTheDocument();
  });

  it('does not show a delete button without access', () => {
    renderSavedSearch({organization: TestStubs.Organization({access: []})});
    const assignedToMe = screen.getByTestId('saved-search-444');
    expect(
      within(assignedToMe).queryByRole('button', {name: 'delete'})
    ).not.toBeInTheDocument();
  });

  it('does not show a delete button for global search', () => {
    renderSavedSearch();
    // Should not have a delete button as it is a global search
    const globalSearch = screen.getByTestId('global-search-122');
    expect(
      within(globalSearch).queryByRole('button', {name: 'delete'})
    ).not.toBeInTheDocument();
  });

  it('sends a request when delete button is clicked', async () => {
    renderSavedSearch();
    // Second item should have a delete button as it is not a global search
    userEvent.click(screen.getByRole('button', {name: 'delete'}));

    renderGlobalModal();
    expect(
      await screen.findByText('Are you sure you want to delete this saved search?')
    ).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', {name: 'Confirm'}));
    expect(onDelete).toHaveBeenCalledWith(savedSearchList[2]);
  });

  it('hides is:unresolved global search', () => {
    renderSavedSearch();
    expect(screen.queryByText('Unresolved')).not.toBeInTheDocument();
  });
});
