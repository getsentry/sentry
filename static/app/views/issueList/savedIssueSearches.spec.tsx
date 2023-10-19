import {ComponentProps, Fragment} from 'react';
import {Organization} from 'sentry-fixture/organization';
import {Search} from 'sentry-fixture/search';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import GlobalModalContainer from 'sentry/components/globalModal';
import {SavedSearchVisibility} from 'sentry/types';
import localStorageWrapper from 'sentry/utils/localStorage';
import SavedIssueSearches from 'sentry/views/issueList/savedIssueSearches';
import {SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY} from 'sentry/views/issueList/utils';

describe('SavedIssueSearches', function () {
  const organization = Organization();

  const recommendedSearch = Search({
    id: 'global-search',
    isGlobal: true,
    name: 'Assigned to Me',
    query: 'is:unresolved assigned:me',
    visibility: SavedSearchVisibility.ORGANIZATION,
  });

  const userSearch = Search({
    id: 'user-search',
    isGlobal: false,
    name: 'Just Firefox',
    query: 'browser:firefox',
    visibility: SavedSearchVisibility.OWNER,
  });

  const orgSearch = Search({
    id: 'org-search',
    isGlobal: false,
    name: 'Last 4 Hours',
    query: 'age:-4h',
    visibility: SavedSearchVisibility.ORGANIZATION,
  });

  const pinnedSearch = Search({
    id: 'pinned-search',
    isGlobal: false,
    isPinned: true,
    name: 'My Pinned Search',
    query: 'age:-4h',
  });

  const defaultProps: ComponentProps<typeof SavedIssueSearches> = {
    organization,
    onSavedSearchSelect: jest.fn(),
    query: 'is:unresolved',
    sort: 'date',
  };

  beforeEach(() => {
    localStorageWrapper.setItem(SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY, 'true');
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  it('displays saved searches with correct text and in correct sections', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [userSearch, recommendedSearch, orgSearch, pinnedSearch],
    });

    render(<SavedIssueSearches {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('hides saves searches by default past first 4', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [...new Array(6)].map((_, i) => ({
        ...orgSearch,
        name: 'Test Search',
        id: i,
      })),
    });

    render(<SavedIssueSearches {...defaultProps} />);

    expect(await screen.findAllByText('Test Search')).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', {name: /show 2 more/i}));
    expect(screen.getAllByText('Test Search')).toHaveLength(6);
  });

  it('can select a saved search', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [recommendedSearch, orgSearch, pinnedSearch],
    });

    render(<SavedIssueSearches {...defaultProps} />);

    await userEvent.click(await screen.findByRole('button', {name: 'Assigned to Me'}));
    expect(defaultProps.onSavedSearchSelect).toHaveBeenLastCalledWith(recommendedSearch);

    await userEvent.click(screen.getByRole('button', {name: 'Last 4 Hours'}));
    expect(defaultProps.onSavedSearchSelect).toHaveBeenLastCalledWith(orgSearch);
  });

  it('does not show header when there are no org saved searches', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [recommendedSearch],
    });

    render(<SavedIssueSearches {...defaultProps} />);

    expect(
      await screen.findByText(/You don't have any saved searches/i)
    ).toBeInTheDocument();
  });

  it('does not show overflow menu for recommended searches', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [recommendedSearch],
    });
    render(<SavedIssueSearches {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {name: /saved search options/i})
      ).not.toBeInTheDocument();
    });
  });

  it('can delete an org saved search with correct permissions', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [recommendedSearch, orgSearch, pinnedSearch],
    });
    const deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/org-search/',
      method: 'DELETE',
    });

    render(<SavedIssueSearches {...defaultProps} />);
    renderGlobalModal();

    await userEvent.click(
      await screen.findByRole('button', {name: /saved search options/i})
    );
    await userEvent.click(screen.getByRole('menuitemradio', {name: /delete/i}));

    const modal = screen.getByRole('dialog');

    expect(within(modal).getByText(/are you sure/i)).toBeInTheDocument();

    await userEvent.click(within(modal).getByRole('button', {name: /confirm/i}));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(orgSearch.name)).not.toBeInTheDocument();
    });
  });

  it('can edit an org saved search with correct permissions', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [recommendedSearch, orgSearch, pinnedSearch],
    });
    const putMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/org-search/',
      method: 'PUT',
      body: {
        ...orgSearch,
        name: 'new name',
      },
    });

    render(
      <Fragment>
        <SavedIssueSearches {...defaultProps} />
        <GlobalModalContainer />
      </Fragment>
    );

    await userEvent.click(
      await screen.findByRole('button', {name: /saved search options/i})
    );
    await userEvent.click(screen.getByRole('menuitemradio', {name: /edit/i}));

    const modal = screen.getByRole('dialog');

    await userEvent.clear(within(modal).getByRole('textbox', {name: /name/i}));
    await userEvent.type(within(modal).getByRole('textbox', {name: /name/i}), 'new name');

    await userEvent.click(within(modal).getByRole('button', {name: /save/i}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new name',
          }),
        })
      );
      expect(screen.getByText('new name')).toBeInTheDocument();
    });
  });

  it('cannot delete or edit a saved search without correct permissions', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [recommendedSearch, orgSearch, pinnedSearch],
    });

    render(
      <SavedIssueSearches
        {...defaultProps}
        organization={{
          ...organization,
          access: organization.access.filter(access => access !== 'org:write'),
        }}
      />
    );

    await userEvent.click(
      await screen.findByRole('button', {name: /saved search options/i})
    );

    expect(
      screen.getByText('You do not have permission to delete this search.')
    ).toBeInTheDocument();

    expect(
      screen.getByText('You do not have permission to edit this search.')
    ).toBeInTheDocument();
  });

  it('can create a new saved search', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [recommendedSearch],
    });

    const mockSave = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      method: 'POST',
      body: {},
    });

    render(<SavedIssueSearches {...defaultProps} />);
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: /add saved search/i}));

    const modal = screen.getByRole('dialog');

    await userEvent.type(
      within(modal).getByRole('textbox', {name: /name/i}),
      'new saved search'
    );

    await userEvent.click(within(modal).getByRole('button', {name: /save/i}));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new saved search',
            query: 'is:unresolved',
          }),
        })
      );
    });

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
